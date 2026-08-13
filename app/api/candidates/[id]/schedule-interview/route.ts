import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { requireUser } from '@/lib/auth/require-user'

const COMPANY_ID = process.env.COMPANY_ID!

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireUser()
  if (authError) return authError

  const { id } = await params
  const { scheduledAt, location, notes } = await req.json() as {
    scheduledAt?: string
    location?: string
    notes?: string
  }
  if (!scheduledAt) return NextResponse.json({ error: 'scheduledAt required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: candidate, error } = await supabase
    .from('candidates')
    .update({
      status: 'interview_dijadwalkan',
      interview_scheduled_at: scheduledAt,
      interview_location: location?.trim() || null,
      interview_notes: notes?.trim() || null,
      last_agent_action: 'interview_scheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', COMPANY_ID)
    .select('name, position, outlet, phone, telegram_chat_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Draft the invitation right here, synchronously, instead of queueing a
  // background agent_task — HR is waiting on this screen for the draft to
  // review and send, not checking back on the Approval page later.
  const channel = candidate.telegram_chat_id ? 'telegram' : candidate.phone ? 'wa' : null
  if (!channel) {
    // Schedule was still saved — just nothing to draft a message onto.
    return NextResponse.json({
      success: true,
      draft: null,
      warning: 'Jadwal tersimpan, tapi kandidat belum punya nomor WA atau Telegram terhubung — tidak ada draft undangan yang dibuat.',
    })
  }

  const scheduledLabel = new Date(scheduledAt).toLocaleString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const prompt = `Buatkan pesan undangan interview untuk kandidat recruitment.

Nama kandidat: ${candidate.name}
Posisi: ${candidate.position ?? 'Staff'}
Outlet: ${candidate.outlet ?? 'Greenly Cloud Kitchen'}
Jadwal interview: ${scheduledLabel} WIB
${location?.trim() ? `Lokasi: ${location.trim()}` : ''}
${notes?.trim() ? `Catatan tambahan dari HR: ${notes.trim()}` : ''}

Pesan harus:
- Singkat dan jelas (maks 3 paragraf)
- Menyebutkan nama kandidat dan ucapan selamat karena lolos ke tahap interview
- Menyebutkan jadwal interview (hari, tanggal, jam) dengan jelas${location?.trim() ? ', dan lokasinya' : ''}
- Meminta konfirmasi kehadiran, dan minta datang/standby 10 menit lebih awal
- Bahasa Indonesia yang ramah dan profesional, tidak terlalu formal

Tulis hanya isi pesannya saja, tanpa label atau penjelasan tambahan.`

  try {
    const draftText = await callClaude([{ role: 'user', content: prompt }])

    const { data: inserted, error: insertError } = await supabase
      .from('candidate_messages')
      .insert({
        candidate_id: id,
        company_id: COMPANY_ID,
        direction: 'draft',
        channel,
        content: draftText.trim(),
        sent_by: 'agent',
      })
      .select('id, content, channel')
      .single()

    if (insertError) throw new Error(insertError.message)

    await supabase.from('agent_logs').insert({
      company_id: COMPANY_ID,
      type: 'info',
      message: `Draft undangan interview dibuat untuk ${candidate.name} (menunggu dikirim HR)`,
      metadata: { candidate_id: id },
    })

    return NextResponse.json({ success: true, draft: inserted })
  } catch (e: unknown) {
    // Schedule itself is already saved — only the draft generation failed.
    // Surface that distinctly so HR knows the date stuck but needs to write
    // the invite manually (or retry) rather than assuming nothing happened.
    return NextResponse.json({
      success: true,
      draft: null,
      warning: `Jadwal tersimpan, tapi gagal membuat draft undangan otomatis (${e instanceof Error ? e.message : 'unknown error'}).`,
    })
  }
}
