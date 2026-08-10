import { NextResponse } from 'next/server'
import { getBotInfo } from '@/lib/telegram/client'

export async function GET() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ status: 'disconnected', reason: 'no_token' })
  }
  try {
    const info = await getBotInfo()
    return NextResponse.json({ status: 'connected', username: info.username })
  } catch {
    return NextResponse.json({ status: 'disconnected' })
  }
}
