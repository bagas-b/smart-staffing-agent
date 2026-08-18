import { NextResponse } from 'next/server'
import { getWAQR } from '@/lib/baileys/client'
import { requireUser } from '@/lib/auth/require-user'

export async function GET() {
  const authError = await requireUser()
  if (authError) return authError

  try {
    const data = await getWAQR()
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal mengambil QR' }, { status: 503 })
  }
}
