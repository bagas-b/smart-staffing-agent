import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.BAILEYS_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { from, message } = await req.json()
  const supabase = createServiceClient()

  const phone = from.replace('@s.whatsapp.net', '')
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, status')
    .eq('company_id', COMPANY_ID)
    .or(`wa_chat_id.eq.${from},phone.eq.${phone}`)
    .single()

  if (!candidate) return NextResponse.json({ ok: true })

  await supabase.from('candidate_messages').insert({
    candidate_id: candidate.id,
    company_id: COMPANY_ID,
    direction: 'inbound',
    channel: 'wa',
    content: message,
    sent_by: from,
  })

  if (candidate.status === 'menunggu_balasan') {
    await supabase
      .from('candidates')
      .update({ status: 'tertarik', updated_at: new Date().toISOString() })
      .eq('id', candidate.id)

    await supabase.from('agent_logs').insert({
      company_id: COMPANY_ID,
      type: 'info',
      message: `Balasan masuk dari kandidat — status diupdate ke Tertarik`,
      metadata: { candidateId: candidate.id, from },
    })
  }

  return NextResponse.json({ ok: true })
}
