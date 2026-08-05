import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function POST(req: NextRequest) {
  if (!process.env.BAILEYS_SECRET) {
    return NextResponse.json({ error: 'server misconfiguration' }, { status: 500 })
  }

  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.BAILEYS_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { from, message } = await req.json()
  const supabase = createServiceClient()

  const cleanPhone = (from as string).replace(/\D/g, '')
  const cleanJid = `${cleanPhone}@s.whatsapp.net`

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, status')
    .eq('company_id', COMPANY_ID)
    .or(`wa_chat_id.eq.${cleanJid},phone.eq.${cleanPhone}`)
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

  // Enqueue classification task regardless of current status
  await supabase.from('agent_tasks').insert({
    company_id: COMPANY_ID,
    type: 'classify_reply',
    payload: { candidate_id: candidate.id, message, from },
    status: 'pending',
    attempts: 0,
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/agent/run`, { method: 'POST' }).catch(() => {})

  return NextResponse.json({ ok: true })
}
