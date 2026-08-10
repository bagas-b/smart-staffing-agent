import { NextResponse, NextRequest } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram/client'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

// TEMPORARY: same override as lib/approval/dispatch.ts — WA (Baileys) has no
// working key, so route through Telegram instead until it does.
const TELEGRAM_FALLBACK_CHAT_ID = process.env.TELEGRAM_FALLBACK_CHAT_ID

export async function POST(req: NextRequest) {
  const { candidateId, phone, message } = await req.json()
  if (!phone || !message) return NextResponse.json({ error: 'phone and message required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: candidate } = await supabase
    .from('candidates')
    .select('telegram_chat_id')
    .eq('id', candidateId)
    .eq('company_id', COMPANY_ID)
    .single()

  const chatId = candidate?.telegram_chat_id ?? TELEGRAM_FALLBACK_CHAT_ID
  if (!chatId) {
    return NextResponse.json({ error: 'WA belum aktif dan kandidat belum terhubung ke Telegram' }, { status: 503 })
  }

  try {
    await sendTelegramMessage(chatId, message)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  await supabase.from('candidate_messages').insert({
    candidate_id: candidateId,
    company_id: COMPANY_ID,
    direction: 'outbound',
    channel: 'wa',
    content: message,
    sent_by: 'agent',
  })

  await supabase
    .from('candidates')
    .update({ status: 'menunggu_balasan', updated_at: new Date().toISOString() })
    .eq('id', candidateId)
    .eq('company_id', COMPANY_ID)
    .eq('status', 'belum_dihubungi')

  await supabase.from('agent_logs').insert({
    company_id: COMPANY_ID,
    type: 'success',
    message: `Pesan terkirim ke ${phone} (via Telegram — WA belum aktif)`,
    metadata: { candidateId },
  })

  return NextResponse.json({ success: true })
}
