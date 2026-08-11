import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { dispatchDraft } from '@/lib/approval/dispatch'

const COMPANY_ID = process.env.COMPANY_ID!
const MAX_TASKS_PER_RUN = 40
// Sequential AI calls across up to 40 tasks can take a while — give this route
// the most headroom Vercel Hobby allows (default would be far too short and
// silently strand the tail of a batch as 'pending' with no error, no retry).
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Also reclaim tasks stuck at 'processing' for >10 minutes — the previous
  // run's function almost certainly got killed (timeout, cold-start eviction)
  // mid-task, and nothing else ever revisits 'processing' rows since only
  // 'pending' is queried here by default.
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .or(`status.eq.pending,and(status.eq.processing,created_at.lt.${staleThreshold})`)
    .order('created_at')
    .limit(MAX_TASKS_PER_RUN)

  if (!tasks?.length) return NextResponse.json({ processed: 0 })

  let processed = 0
  for (const task of tasks) {
    await supabase
      .from('agent_tasks')
      .update({ status: 'processing', attempts: task.attempts + 1 })
      .eq('id', task.id)

    try {
      if (task.type === 'score') {
        await processScoreTask(supabase, task)
      } else if (task.type === 'classify_reply') {
        await processClassifyTask(supabase, task)
      } else if (task.type === 'draft_follow_up') {
        await processDraftFollowUpTask(supabase, task)
      } else if (task.type === 'draft_initial_outreach') {
        await processInitialOutreachTask(supabase, task)
      } else if (task.type === 'draft_interview_invite') {
        await processInterviewInviteTask(supabase, task)
      } else {
        throw new Error(`unknown task type: ${task.type}`)
      }
      processed++
    } catch (e: unknown) {
      const msg = (e as Error).message
      if (task.attempts >= 1) {
        await supabase.from('agent_tasks').update({
          status: 'failed',
          error_message: msg,
          processed_at: new Date().toISOString(),
        }).eq('id', task.id)
        await supabase.from('agent_logs').insert({
          company_id: COMPANY_ID,
          type: 'error',
          message: `Task ${task.type} failed: ${msg}`,
          metadata: { taskId: task.id },
        })
      } else {
        await supabase.from('agent_tasks').update({
          status: 'pending',
          error_message: msg,
        }).eq('id', task.id)
      }
    }
  }

  return NextResponse.json({ processed })
}

async function processScoreTask(
  supabase: ReturnType<typeof createServiceClient>,
  task: { id: string; payload: { candidate_id?: string; job_posting_id?: string } },
) {
  const { candidate_id, job_posting_id } = task.payload
  if (!candidate_id) throw new Error('missing candidate_id in payload')

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/ai/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id, job_posting_id }),
  })
  if (!res.ok) throw new Error(`score API error ${res.status}`)
  const result = await res.json()

  const finalStatus = result.confidence === 'low' ? 'needs_review' : 'done'
  await supabase.from('agent_tasks').update({
    status: finalStatus,
    result,
    processed_at: new Date().toISOString(),
  }).eq('id', task.id)

  const { data: candidate } = await supabase
    .from('candidates')
    .update({ last_agent_action: 'scored' })
    .eq('id', candidate_id)
    .select('name')
    .single()

  await supabase.from('agent_logs').insert({
    company_id: COMPANY_ID,
    type: finalStatus === 'needs_review' ? 'info' : 'ai',
    message: finalStatus === 'needs_review'
      ? `${candidate?.name ?? 'Kandidat'} di-score tapi confidence rendah — perlu direview manual`
      : `${candidate?.name ?? 'Kandidat'} berhasil di-score (${result.hire_success_probability}% prob. hire)`,
    metadata: { candidate_id },
  })
}

async function processClassifyTask(
  supabase: ReturnType<typeof createServiceClient>,
  task: { id: string; payload: { candidate_id?: string; message?: string; channel?: string } },
) {
  const { candidate_id, message, channel: inboundChannel } = task.payload
  if (!candidate_id || !message) throw new Error('missing candidate_id or message in payload')
  // The auto-drafted reply must go out on whatever channel the candidate actually
  // messaged in on — defaulting to 'wa' here would silently produce an
  // undeliverable draft for Telegram-only candidates.
  const replyChannel = inboundChannel === 'telegram' ? 'telegram' : 'wa'

  const { data: candidate } = await supabase
    .from('candidates')
    .select('name, position, outlet')
    .eq('id', candidate_id)
    .eq('company_id', COMPANY_ID)
    .single()

  const prompt = `Kamu adalah asisten HR. Klasifikasikan balasan kandidat berikut.

Balasan: "${message}"

Klasifikasikan sebagai salah satu:
- tertarik: kandidat tertarik dengan posisi
- tidak_tertarik: kandidat tidak tertarik atau menolak
- butuh_info: kandidat membutuhkan informasi lebih lanjut
- tidak_jelas: tidak dapat menentukan maksud kandidat

Jawab HANYA dalam format JSON:
{"classification": "<kategori>", "confidence": "high" | "medium" | "low", "reasoning": "<alasan singkat>"}`

  const raw = await callClaude([{ role: 'user', content: prompt }])

  const match = raw.match(/\{[\s\S]+\}/)
  if (!match) throw new Error('no JSON in LLM response')
  const parsed = JSON.parse(match[0]) as { classification: string; confidence: string; reasoning: string }

  const isAmbiguous = parsed.classification === 'tidak_jelas' || parsed.confidence === 'low'

  if (isAmbiguous) {
    await supabase.from('agent_tasks').update({
      status: 'needs_review',
      result: parsed,
      processed_at: new Date().toISOString(),
    }).eq('id', task.id)
    return
  }

  const statusMap: Record<string, string> = {
    tertarik: 'tertarik',
    tidak_tertarik: 'tidak_tertarik',
    butuh_info: 'menunggu_balasan',
  }
  const newStatus = statusMap[parsed.classification] ?? 'menunggu_balasan'

  await supabase.from('candidates')
    .update({ status: newStatus, last_agent_action: 'classified_reply' })
    .eq('id', candidate_id)
    .eq('company_id', COMPANY_ID)

  // Every recognized classification gets an auto-drafted reply so the
  // candidate isn't left hanging — previously only 'butuh_info' did, which
  // meant candidates who replied "tertarik" or "tidak tertarik" got their
  // kanban status silently moved with zero acknowledgment sent back to them.
  // 'tertarik'/'tidak_tertarik' replies are lightweight conversational
  // acknowledgments (thank-you / polite decline) with no factual claims —
  // those auto-send immediately, customer-service-bot style, no HR approval
  // needed. 'butuh_info' replies quote real salary/job details back to the
  // candidate, so a wrong or stale answer is a promise that already went out;
  // those still queue as a draft for HR to check before sending. Anything
  // substantive (follow-up nudges, interview scheduling, interview
  // invitations) is a separate task type entirely and always drafts.
  let replyPrompt: string | null = null
  let autoSend = false

  if (parsed.classification === 'butuh_info') {
    const { data: job } = await supabase
      .from('job_postings')
      .select('title, salary_range, description')
      .eq('company_id', COMPANY_ID)
      .eq('position', candidate?.position ?? '')
      .limit(1)
      .single()

    replyPrompt = `Tulis pesan balasan WhatsApp singkat (maks 3 kalimat) untuk kandidat yang meminta info lebih lanjut tentang posisi kerja.

Kandidat: ${candidate?.name ?? 'Kandidat'}
Posisi: ${candidate?.position ?? '-'}
Outlet: ${candidate?.outlet ?? '-'}
${job ? `Gaji: ${job.salary_range ?? 'kompetitif'}\nDeskripsi singkat: ${(job.description ?? '').slice(0, 200)}` : ''}

Buat pesan yang ramah, informatif, dalam Bahasa Indonesia. Kembalikan hanya teks pesan.`
  } else if (parsed.classification === 'tertarik') {
    autoSend = true
    replyPrompt = `Tulis pesan balasan singkat (maks 3 kalimat) untuk kandidat yang baru saja menyatakan tertarik dengan lowongan kerja.

Kandidat: ${candidate?.name ?? 'Kandidat'}
Posisi: ${candidate?.position ?? '-'}
Outlet: ${candidate?.outlet ?? '-'}

Pesan harus: ucapkan terima kasih atas ketertarikannya, jelaskan bahwa tim HR akan segera menghubungi untuk jadwal interview, nada ramah dan profesional dalam Bahasa Indonesia. Kembalikan hanya teks pesan.`
  } else if (parsed.classification === 'tidak_tertarik') {
    autoSend = true
    replyPrompt = `Tulis pesan balasan singkat (maks 2-3 kalimat) untuk kandidat yang menyatakan tidak tertarik/menolak lowongan kerja.

Kandidat: ${candidate?.name ?? 'Kandidat'}
Posisi: ${candidate?.position ?? '-'}

Pesan harus: ucapkan terima kasih sudah meluangkan waktu, sampaikan pintu tetap terbuka untuk kesempatan lain di masa depan, nada sopan dan tidak memaksa dalam Bahasa Indonesia. Kembalikan hanya teks pesan.`
  }

  if (replyPrompt) {
    const draftText = await callClaude([{ role: 'user', content: replyPrompt }])

    const { data: inserted } = await supabase.from('candidate_messages').insert({
      candidate_id,
      company_id: COMPANY_ID,
      direction: 'draft',
      channel: replyChannel,
      content: draftText.trim(),
      sent_by: 'agent',
    }).select('id').single()

    // Auto-send path: dispatch immediately through the same send logic HR's
    // "Setujui" button uses. On failure it deliberately leaves direction
    // as 'draft' (dispatchDraft's own contract), so a failed auto-send just
    // falls back into the approval queue instead of vanishing.
    const sent = autoSend && inserted ? await dispatchDraft(supabase, inserted.id) : null

    await supabase.from('agent_logs').insert({
      company_id: COMPANY_ID,
      type: sent ? (sent.ok ? 'success' : 'error') : 'ai',
      message: sent
        ? sent.ok
          ? `Balasan otomatis terkirim ke ${candidate?.name ?? 'kandidat'} (tanpa approval HR — konfirmasi minat)`
          : `Auto-kirim balasan ke ${candidate?.name ?? 'kandidat'} gagal (${sent.error}) — disimpan sebagai draft untuk approval manual`
        : `Draft balasan otomatis dibuat untuk ${candidate?.name ?? 'kandidat'} (menunggu approval)`,
      metadata: { candidate_id },
    })
  }

  await supabase.from('agent_tasks').update({
    status: 'done',
    result: parsed,
    processed_at: new Date().toISOString(),
  }).eq('id', task.id)

  const CLASSIFICATION_LABEL: Record<string, string> = {
    tertarik: 'tertarik',
    tidak_tertarik: 'tidak tertarik',
    butuh_info: 'butuh info lebih lanjut',
  }
  await supabase.from('agent_logs').insert({
    company_id: COMPANY_ID,
    type: 'info',
    message: `Balasan ${candidate?.name ?? 'kandidat'} diklasifikasikan: ${CLASSIFICATION_LABEL[parsed.classification] ?? parsed.classification}`,
    metadata: { candidate_id, classification: parsed.classification },
  })
}

async function processDraftFollowUpTask(
  supabase: ReturnType<typeof createServiceClient>,
  task: { id: string; payload: { candidate_id?: string } },
) {
  const { candidate_id } = task.payload
  if (!candidate_id) throw new Error('missing candidate_id in payload')

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, name, follow_up_count, position, outlet, phone, telegram_chat_id')
    .eq('id', candidate_id)
    .eq('company_id', COMPANY_ID)
    .single()

  if (!candidate) throw new Error(`candidate ${candidate_id} not found`)

  // Prefer whichever channel the candidate is actually reachable on — defaulting
  // to 'wa' would produce an undeliverable draft for Telegram-only candidates.
  const followUpChannel = candidate.telegram_chat_id ? 'telegram' : 'wa'

  if ((candidate.follow_up_count ?? 0) >= 2) {
    await supabase.from('candidates').update({
      status: 'perlu_tindak_lanjut_manual',
      last_agent_action: 'max_follow_up_reached',
    }).eq('id', candidate_id)

    await supabase.from('agent_tasks').update({
      status: 'done',
      processed_at: new Date().toISOString(),
    }).eq('id', task.id)
    return
  }

  const prompt = `Kamu adalah asisten HR untuk Greenly Cloud Kitchen.
Tulis pesan follow-up WhatsApp singkat (2-3 kalimat) untuk kandidat bernama ${candidate.name ?? 'kandidat'} yang belum membalas pesan sebelumnya.
Nada: ramah, profesional, tidak memaksa.
Tulis langsung isi pesannya saja, tanpa label atau penjelasan tambahan.`

  const draftText = await callClaude([{ role: 'user', content: prompt }])

  await supabase.from('candidate_messages').insert({
    candidate_id,
    company_id: COMPANY_ID,
    direction: 'draft',
    channel: followUpChannel,
    content: draftText.trim(),
    sent_by: 'agent',
  })

  await supabase.from('candidates').update({
    follow_up_count: (candidate.follow_up_count ?? 0) + 1,
    last_agent_action: 'draft_follow_up_created',
  }).eq('id', candidate_id)

  await supabase.from('agent_logs').insert({
    company_id: COMPANY_ID,
    type: 'ai',
    message: `Draft follow-up dibuat untuk ${candidate.name} (menunggu approval)`,
    metadata: { candidate_id },
  })

  await supabase.from('agent_tasks').update({
    status: 'done',
    processed_at: new Date().toISOString(),
  }).eq('id', task.id)
}

async function processInitialOutreachTask(
  supabase: ReturnType<typeof createServiceClient>,
  task: { id: string; payload: { candidate_id?: string } },
) {
  const { candidate_id } = task.payload
  if (!candidate_id) throw new Error('missing candidate_id in payload')

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, name, position, outlet, phone, telegram_chat_id, applied_job_id')
    .eq('id', candidate_id)
    .eq('company_id', COMPANY_ID)
    .single()

  if (!candidate) throw new Error(`candidate ${candidate_id} not found`)

  // Nothing to reach the candidate on yet — surface this as a failed task
  // (after retry) so it shows up for HR to add a phone/link Telegram manually,
  // rather than silently doing nothing.
  const channel = candidate.telegram_chat_id ? 'telegram' : candidate.phone ? 'wa' : null
  if (!channel) throw new Error('candidate has no phone number or linked Telegram to contact')

  let jobTitle: string | null = null
  if (candidate.applied_job_id) {
    const { data: job } = await supabase
      .from('job_postings')
      .select('title')
      .eq('id', candidate.applied_job_id)
      .eq('company_id', COMPANY_ID)
      .single()
    jobTitle = job?.title ?? null
  }

  const prompt = `Buatkan pesan outreach untuk kandidat recruitment.

Nama kandidat: ${candidate.name}
Posisi yang ditawarkan: ${candidate.position ?? 'Staff'}
Outlet: ${candidate.outlet ?? 'Greenly Cloud Kitchen'}
${jobTitle ? `Lowongan: ${jobTitle}` : ''}

Pesan harus:
- Singkat dan natural (maks 3 paragraf)
- Menyebutkan nama kandidat
- Menjelaskan posisi yang ditawarkan
- Meminta konfirmasi apakah tertarik
- Bahasa Indonesia yang ramah dan profesional, tidak terlalu formal

Tulis hanya isi pesannya saja, tanpa label atau penjelasan tambahan.`

  const draftText = await callClaude([{ role: 'user', content: prompt }])

  await supabase.from('candidate_messages').insert({
    candidate_id,
    company_id: COMPANY_ID,
    direction: 'draft',
    channel,
    content: draftText.trim(),
    sent_by: 'agent',
  })

  await supabase.from('candidates').update({
    last_agent_action: 'draft_initial_outreach_created',
  }).eq('id', candidate_id)

  await supabase.from('agent_logs').insert({
    company_id: COMPANY_ID,
    type: 'ai',
    message: `Draft pesan pertama dibuat untuk ${candidate.name} (menunggu approval)`,
    metadata: { candidate_id },
  })

  await supabase.from('agent_tasks').update({
    status: 'done',
    processed_at: new Date().toISOString(),
  }).eq('id', task.id)
}

async function processInterviewInviteTask(
  supabase: ReturnType<typeof createServiceClient>,
  task: { id: string; payload: { candidate_id?: string } },
) {
  const { candidate_id } = task.payload
  if (!candidate_id) throw new Error('missing candidate_id in payload')

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, name, position, outlet, phone, telegram_chat_id, interview_scheduled_at')
    .eq('id', candidate_id)
    .eq('company_id', COMPANY_ID)
    .single()

  if (!candidate) throw new Error(`candidate ${candidate_id} not found`)
  if (!candidate.interview_scheduled_at) throw new Error('candidate has no interview_scheduled_at set')

  const channel = candidate.telegram_chat_id ? 'telegram' : candidate.phone ? 'wa' : null
  if (!channel) throw new Error('candidate has no phone number or linked Telegram to contact')

  const scheduledLabel = new Date(candidate.interview_scheduled_at).toLocaleString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const prompt = `Buatkan pesan undangan interview untuk kandidat recruitment.

Nama kandidat: ${candidate.name}
Posisi: ${candidate.position ?? 'Staff'}
Outlet: ${candidate.outlet ?? 'Greenly Cloud Kitchen'}
Jadwal interview: ${scheduledLabel} WIB

Pesan harus:
- Singkat dan jelas (maks 3 paragraf)
- Menyebutkan nama kandidat dan ucapan selamat karena lolos ke tahap interview
- Menyebutkan jadwal interview (hari, tanggal, jam) dengan jelas
- Meminta konfirmasi kehadiran, dan minta datang/standby 10 menit lebih awal
- Bahasa Indonesia yang ramah dan profesional, tidak terlalu formal

Tulis hanya isi pesannya saja, tanpa label atau penjelasan tambahan.`

  const draftText = await callClaude([{ role: 'user', content: prompt }])

  await supabase.from('candidate_messages').insert({
    candidate_id,
    company_id: COMPANY_ID,
    direction: 'draft',
    channel,
    content: draftText.trim(),
    sent_by: 'agent',
  })

  await supabase.from('agent_logs').insert({
    company_id: COMPANY_ID,
    type: 'ai',
    message: `Draft undangan interview dibuat untuk ${candidate.name} (menunggu approval)`,
    metadata: { candidate_id },
  })

  await supabase.from('agent_tasks').update({
    status: 'done',
    processed_at: new Date().toISOString(),
  }).eq('id', task.id)
}
