import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram/client'

const COMPANY_ID = process.env.COMPANY_ID!

export async function POST(req: NextRequest) {
  const { candidateId, message } = await req.json()
  if (!candidateId || !message) return NextResponse.json({ error: 'candidateId and message required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: candidate } = await supabase
    .from('candidates')
    .select('name, telegram_chat_id')
    .eq('id', candidateId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (!candidate?.telegram_chat_id) {
    return NextResponse.json({ error: 'Kandidat belum terhubung ke Telegram' }, { status: 400 })
  }

  try {
    await sendTelegramMessage(candidate.telegram_chat_id, message)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  await supabase.from('candidate_messages').insert({
    candidate_id: candidateId,
    company_id: COMPANY_ID,
    direction: 'outbound',
    channel: 'telegram',
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
    message: `Pesan Telegram terkirim ke ${candidate.name}`,
    metadata: { candidateId },
  })

  return NextResponse.json({ success: true })
}
