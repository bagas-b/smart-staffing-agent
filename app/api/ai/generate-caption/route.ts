import { NextResponse, NextRequest } from 'next/server'
import { callClaude } from '@/lib/ai/client'

export async function POST(req: NextRequest) {
  const { jobTitle, position, outlet, shift, requirements, benefits, salary_range } = await req.json()

  const prompt = `Buatkan caption lowongan kerja untuk 2 platform:

Job: ${jobTitle ?? position}
Posisi: ${position}
Outlet: ${outlet ?? 'Greenly Cloud Kitchen'}
Shift: ${shift ?? '-'}
Gaji: ${salary_range ?? 'kompetitif'}
Kualifikasi: ${requirements?.join(', ') ?? '-'}
Benefit: ${benefits?.join(', ') ?? '-'}

1. Caption WhatsApp Group: informal, pakai emoji, maks 200 kata
2. Caption Instagram: catchy, dengan hashtag relevan, maks 150 kata

Format JSON:
{"wa": "<caption whatsapp>", "instagram": "<caption instagram>"}`

  try {
    const raw = await callClaude([{ role: 'user', content: prompt }])
    const parsed = JSON.parse(raw.match(/\{[\s\S]+\}/)?.[0] ?? raw)
    return NextResponse.json({ captions: parsed })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
