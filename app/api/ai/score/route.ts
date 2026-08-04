import { NextResponse, NextRequest } from 'next/server'
import { callClaude } from '@/lib/ai/client'

export async function POST(req: NextRequest) {
  const { candidateName, position, outlet, status, notes, messages } = await req.json()

  const prompt = `Nilai kandidat ini berdasarkan data rekrutmen berikut:

Nama: ${candidateName}
Posisi: ${position ?? '-'}
Outlet: ${outlet ?? '-'}
Status pipeline: ${status}
Catatan HR: ${notes ?? '-'}
Riwayat pesan (${messages?.length ?? 0} pesan): ${
    messages?.slice(-5).map((m: any) => `[${m.direction}] ${m.content}`).join('\n') ?? '-'
  }

Berikan:
1. Skor 0-100 (angka saja)
2. Ringkasan singkat 1-2 kalimat alasan skor

Format respons JSON:
{"score": <angka>, "summary": "<ringkasan>"}`

  try {
    const raw = await callClaude([{ role: 'user', content: prompt }])
    const parsed = JSON.parse(raw.match(/\{[\s\S]+\}/)?.[0] ?? raw)
    return NextResponse.json(parsed)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
