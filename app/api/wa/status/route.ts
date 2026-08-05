import { NextResponse } from 'next/server'
import { getWAStatus } from '@/lib/baileys/client'

export async function GET() {
  try {
    const status = await getWAStatus()
    return NextResponse.json(status)
  } catch {
    return NextResponse.json({ status: 'disconnected' })
  }
}
