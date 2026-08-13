import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram/client'
import { getBaseUrl } from '@/lib/utils/base-url'

const COMPANY_ID = process.env.COMPANY_ID!

interface TelegramUpdate {
  message?: {
    text?: string
    chat: { id: number }
    from?: { first_name?: string }
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'server misconfiguration' }, { status: 500 })
  }
  if (req.headers.get('x-telegram-bot-api-secret-token') !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const update: TelegramUpdate = await req.json()
  const message = update.message
  if (!message?.text) return NextResponse.json({ ok: true }) // ignore non-text updates for MVP

  const chatId = String(message.chat.id)
  const supabase = createServiceClient()

  // /start <candidate_id> — deep-link sent by HR to a specific candidate
  if (message.text.startsWith('/start')) {
    const candidateId = message.text.split(' ')[1]?.trim()
    if (!candidateId) return NextResponse.json({ ok: true })

    const { data: candidate } = await supabase
      .from('candidates')
      .update({ telegram_chat_id: chatId })
      .eq('id', candidateId)
      .eq('company_id', COMPANY_ID)
      .select('name')
      .single()

    if (candidate) {
      await sendTelegramMessage(chatId,
        `Halo ${candidate.name}! Chat ini sudah terhubung dengan tim HR. Kami akan menghubungi kamu di sini.`
      ).catch(() => {})

      await supabase.from('agent_logs').insert({
        company_id: COMPANY_ID,
        type: 'success',
        message: `${candidate.name} terhubung via Telegram`,
        metadata: { candidateId },
      })
    }
    return NextResponse.json({ ok: true })
  }

  // Regular inbound text — match to an already-linked candidate
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, status')
    .eq('telegram_chat_id', chatId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (!candidate) return NextResponse.json({ ok: true }) // unlinked chat — ignore

  await supabase.from('candidate_messages').insert({
    candidate_id: candidate.id,
    company_id: COMPANY_ID,
    direction: 'inbound',
    channel: 'telegram',
    content: message.text,
    sent_by: chatId,
  })

  // Enqueue classification — same pipeline WA replies already use
  await supabase.from('agent_tasks').insert({
    company_id: COMPANY_ID,
    type: 'classify_reply',
    payload: { candidate_id: candidate.id, message: message.text, channel: 'telegram' },
    status: 'pending',
    attempts: 0,
  })

  const baseUrl = getBaseUrl()
  fetch(`${baseUrl}/api/agent/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
