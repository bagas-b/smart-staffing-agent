import { NextResponse, NextRequest } from 'next/server'
import { callClaude } from '@/lib/ai/client'

export async function POST(req: NextRequest) {
  const { candidateName, position, outlet, jobTitle } = await req.json()
  if (!candidateName) return NextResponse.json({ error: 'candidateName required' }, { status: 400 })

  const prompt = `Buatkan pesan WhatsApp untuk outreach kandidat recruitment.

Nama kandidat: ${candidateName}
Posisi yang ditawarkan: ${position ?? 'Staff'}
Outlet: ${outlet ?? 'Greenly Cloud Kitchen'}
Job posting: ${jobTitle ?? position ?? 'Staff'}

Pesan harus:
- Singkat dan natural (maks 3 paragraf)
- Menyebutkan nama kandidat
- Menjelaskan posisi yang ditawarkan
- Meminta konfirmasi apakah tertarik
- Bahasa Indonesia yang ramah dan profesional
- Jangan terlalu formal

Tulis hanya isi pesannya saja, tanpa penjelasan.`

  try {
    const message = await callClaude([{ role: 'user', content: prompt }])
    return NextResponse.json({ message })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
