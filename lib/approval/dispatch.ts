import { createServiceClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram/client'

const COMPANY_ID = process.env.COMPANY_ID!

// TEMPORARY: WA (Baileys) isn't configured yet, so every approved draft — WA or
// Telegram — goes out via Telegram instead. Candidates who haven't done their own
// /start deep-link fall back to this shared chat_id. Remove this whole override
// (and restore the wa/telegram branch below) once Baileys has a working key.
const TELEGRAM_FALLBACK_CHAT_ID = process.env.TELEGRAM_FALLBACK_CHAT_ID

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
    // TEMPORARY override — see TELEGRAM_FALLBACK_CHAT_ID comment above.
    const chatId = candidate?.telegram_chat_id ?? TELEGRAM_FALLBACK_CHAT_ID
    if (!chatId) throw new Error('Kandidat belum terhubung ke Telegram dan tidak ada fallback chat_id')
    await sendTelegramMessage(chatId, draft.content)
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
