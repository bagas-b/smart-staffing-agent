import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { requireUser } from '@/lib/auth/require-user'

const COMPANY_ID = process.env.COMPANY_ID!
const ONBOARDING_LEAD_DAYS = 2

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireUser()
  if (authError) return authError

  const supabase = createServiceClient()
  const { id } = await params
  const { decision, notes } = await req.json()

  if (!decision || !['lulus', 'tidak_lulus'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be lulus or tidak_lulus' }, { status: 400 })
  }

  const { error: logError } = await supabase.from('candidate_decisions').insert({
    candidate_id: id,
    company_id: COMPANY_ID,
    decision,
    notes,
  })
  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  const newStatus = decision === 'lulus' ? 'lulus_interview' : 'tidak_lulus'
  const { data: candidate } = await supabase
    .from('candidates')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', COMPANY_ID)
    .select('name, position, outlet, phone, telegram_chat_id')
    .single()

  if (decision !== 'lulus' || !candidate) {
    return NextResponse.json({ success: true })
  }

  // "Lulus" carries a real commitment (a start date) — draft it for HR to
  // review/edit/approve rather than auto-sending, same rule as the interview
  // invite: anything with a factual promise stays human-reviewed.
  const channel = candidate.telegram_chat_id ? 'telegram' : candidate.phone ? 'wa' : null
  if (!channel) return NextResponse.json({ success: true })

  const onboardingDate = new Date()
  onboardingDate.setDate(onboardingDate.getDate() + ONBOARDING_LEAD_DAYS)
  const onboardingLabel = onboardingDate.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const prompt = `Buatkan pesan untuk kandidat recruitment yang baru saja dinyatakan LULUS interview kerja.

Nama kandidat: ${candidate.name}
Posisi: ${candidate.position ?? 'Staff'}
Outlet: ${candidate.outlet ?? 'Greenly Cloud Kitchen'}
Tanggal mulai onboarding yang disarankan: ${onboardingLabel}

Pesan harus:
- Ucapan selamat yang hangat karena lolos interview dan diterima bekerja
- Informasikan bahwa hari pertama/onboarding direncanakan mulai ${onboardingLabel}
- Minta konfirmasi kesediaan kandidat untuk mulai di tanggal tersebut
- Singkat, maks 3 paragraf, Bahasa Indonesia ramah dan profesional

Tulis hanya isi pesannya saja, tanpa label atau penjelasan tambahan.`

  try {
    const draftText = await callClaude([{ role: 'user', content: prompt }])

    await supabase.from('candidate_messages').insert({
      candidate_id: id,
      company_id: COMPANY_ID,
      direction: 'draft',
      channel,
      content: draftText.trim(),
      sent_by: 'agent',
    })

    await supabase.from('agent_logs').insert({
      company_id: COMPANY_ID,
      type: 'info',
      message: `Draft ucapan lulus + info onboarding dibuat untuk ${candidate.name} (menunggu approval)`,
      metadata: { candidate_id: id },
    })
  } catch (e: unknown) {
    // Decision is already recorded — a failed draft here shouldn't fail the
    // whole request, just means HR writes the congrats message manually.
    await supabase.from('agent_logs').insert({
      company_id: COMPANY_ID,
      type: 'error',
      message: `Gagal membuat draft ucapan lulus untuk ${candidate.name}: ${e instanceof Error ? e.message : 'unknown error'}`,
      metadata: { candidate_id: id },
    })
  }

  return NextResponse.json({ success: true })
}
