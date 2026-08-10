import { createServiceClient } from '@/lib/supabase/server'
import { sendWA } from '@/lib/baileys/client'
import { sendTelegramMessage } from '@/lib/telegram/client'

const COMPANY_ID = process.env.COMPANY_ID!

type ServiceClient = ReturnType<typeof createServiceClient>

export interface DispatchResult {
  id: string
  ok: boolean
  error?: string
}

/**
 * Sends one approved draft over its channel (WA/Telegram) and flips it to
 * outbound only on send success. Shared by both the single-draft approve
 * route and the bulk-approve route so the dispatch logic can't drift apart.
 */
export async function dispatchDraft(supabase: ServiceClient, draftId: string): Promise<DispatchResult> {
  const { data: draft, error: fetchError } = await supabase
    .from('candidate_messages')
    .select('id, channel, content, candidate_id, candidates(phone, telegram_chat_id)')
    .eq('id', draftId)
    .eq('company_id', COMPANY_ID)
    .eq('direction', 'draft')
    .single()

  if (fetchError || !draft) return { id: draftId, ok: false, error: 'draft not found' }

  const candidate = draft.candidates as unknown as { phone: string | null; telegram_chat_id: string | null } | null

  try {
    if (draft.channel === 'telegram') {
      if (!candidate?.telegram_chat_id) throw new Error('Kandidat belum terhubung ke Telegram')
      await sendTelegramMessage(candidate.telegram_chat_id, draft.content)
    } else if (draft.channel === 'wa') {
      if (!candidate?.phone) throw new Error('Kandidat tidak punya nomor WA')
      await sendWA(candidate.phone, draft.content)
    } else {
      throw new Error(`Channel '${draft.channel}' belum didukung untuk pengiriman otomatis`)
    }
  } catch (e: unknown) {
    // Leave direction='draft' on failure — never mark as sent without confirmation.
    return { id: draftId, ok: false, error: e instanceof Error ? e.message : 'Gagal mengirim pesan' }
  }

  const { error } = await supabase
    .from('candidate_messages')
    .update({ direction: 'outbound' })
    .eq('id', draftId)
    .eq('company_id', COMPANY_ID)
    .eq('direction', 'draft')

  if (error) return { id: draftId, ok: false, error: error.message }
  return { id: draftId, ok: true }
}
