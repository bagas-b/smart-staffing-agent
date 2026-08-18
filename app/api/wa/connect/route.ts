import { NextResponse } from 'next/server'
import { connectWA } from '@/lib/baileys/client'
import { requireUser } from '@/lib/auth/require-user'

export async function POST() {
  const authError = await requireUser()
  if (authError) return authError

  try {
    const data = await connectWA()
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal menyambungkan' }, { status: 503 })
  }
}
