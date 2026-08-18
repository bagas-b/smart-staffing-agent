import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/utils/base-url'

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

  // Stored candidate phones aren't guaranteed to be in one canonical format
  // (+62xxx from the new "+62" input prefix, bare 62xxx, or legacy 0xxx from
  // older CSV imports) — match against all of them instead of assuming one,
  // otherwise an inbound reply silently fails to match and gets dropped.
  const localFormat = cleanPhone.startsWith('62') ? `0${cleanPhone.slice(2)}` : cleanPhone
  const phoneFilters = [cleanPhone, `+${cleanPhone}`, localFormat].map(p => `phone.eq.${p}`)

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, status, wa_chat_id')
    .eq('company_id', COMPANY_ID)
    .or([`wa_chat_id.eq.${cleanJid}`, ...phoneFilters].join(','))
    .maybeSingle()

  if (!candidate) return NextResponse.json({ ok: true })

  // Backfill wa_chat_id on first successful match so future lookups for this
  // candidate go through the exact chat-id match, not phone-format guessing.
  if (!candidate.wa_chat_id) {
    await supabase.from('candidates').update({ wa_chat_id: cleanJid }).eq('id', candidate.id)
  }

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
    payload: { candidate_id: candidate.id, message, from, channel: 'wa' },
    status: 'pending',
    attempts: 0,
  })

  const baseUrl = getBaseUrl()
  fetch(`${baseUrl}/api/agent/run`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
