import { NextResponse, NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWA } from '@/lib/baileys/client'
import { sendTelegramMessage } from '@/lib/telegram/client'

const COMPANY_ID = process.env.COMPANY_ID!

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const serviceSupabase = createServiceClient()

  const { data: draft, error: fetchError } = await serviceSupabase
    .from('candidate_messages')
    .select('id, channel, content, candidate_id, candidates(phone, telegram_chat_id)')
    .eq('id', id)
    .eq('company_id', COMPANY_ID)
    .eq('direction', 'draft')
    .single()

  if (fetchError || !draft) return NextResponse.json({ error: 'draft not found' }, { status: 404 })

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
    const msg = e instanceof Error ? e.message : 'Gagal mengirim pesan'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const { error } = await serviceSupabase
    .from('candidate_messages')
    .update({ direction: 'outbound' })
    .eq('id', id)
    .eq('company_id', COMPANY_ID)
    .eq('direction', 'draft')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
