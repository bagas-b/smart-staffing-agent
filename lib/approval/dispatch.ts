import { createServiceClient } from '@/lib/supabase/server'
import { sendWA } from '@/lib/baileys/client'

const COMPANY_ID = process.env.COMPANY_ID!

type ServiceClient = ReturnType<typeof createServiceClient>

export interface DispatchResult {
  id: string
  ok: boolean
  error?: string
}

/**
 * Sends one approved draft over WA and flips it to
 * outbound only on send success. Shared by both the single-draft approve
 * route and the bulk-approve route so the dispatch logic can't drift apart.
 */
export async function dispatchDraft(supabase: ServiceClient, draftId: string): Promise<DispatchResult> {
  const { data: draft, error: fetchError } = await supabase
    .from('candidate_messages')
    .select('id, channel, content, candidate_id, candidates(phone)')
    .eq('id', draftId)
    .eq('company_id', COMPANY_ID)
    .eq('direction', 'draft')
    .single()

  if (fetchError || !draft) return { id: draftId, ok: false, error: 'draft not found' }

  const candidate = draft.candidates as unknown as { phone: string | null } | null

  try {
    if (!candidate?.phone) throw new Error('Kandidat tidak punya nomor WA')
    await sendWA(candidate.phone, draft.content)
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

  // A sent draft is the first real outreach for a fresh candidate — move them
  // out of "Belum Dihubungi" into "Menunggu Balasan" so the kanban board
  // reflects that we're now waiting on a reply. Previously only the ad-hoc
  // Chat "kirim manual" path did this transition; approving a draft (single
  // or bulk) never did, so the card silently never moved.
  await supabase
    .from('candidates')
    .update({ status: 'menunggu_balasan', updated_at: new Date().toISOString() })
    .eq('id', draft.candidate_id)
    .eq('company_id', COMPANY_ID)
    .eq('status', 'belum_dihubungi')

  return { id: draftId, ok: true }
}
