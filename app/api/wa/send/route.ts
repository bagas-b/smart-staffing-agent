import { NextResponse, NextRequest } from 'next/server'
import { sendWA } from '@/lib/baileys/client'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function POST(req: NextRequest) {
  const { candidateId, phone, message } = await req.json()
  if (!phone || !message) return NextResponse.json({ error: 'phone and message required' }, { status: 400 })

  try {
    await sendWA(phone, message)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  const supabase = createServiceClient()

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
    message: `Pesan WA terkirim ke ${phone}`,
    metadata: { candidateId },
  })

  return NextResponse.json({ success: true })
}
