import { NextResponse, NextRequest } from 'next/server'
import { callClaude } from '@/lib/ai/client'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const { candidate_id, job_posting_id } = await req.json()
  if (!candidate_id) return NextResponse.json({ error: 'candidate_id required' }, { status: 400 })

  // Check cache first
  const { data: cached } = await supabase
    .from('candidate_scores')
    .select('*')
    .eq('candidate_id', candidate_id)
    .eq('company_id', COMPANY_ID)
    .gt('valid_until', new Date().toISOString())
    .single()

  if (cached) {
    return NextResponse.json({
      cv_fit_score: cached.cv_fit_score,
      attrition_risk_score: cached.attrition_risk_score,
      hire_success_probability: cached.hire_success_probability,
      confidence: cached.scoring_reasoning?.confidence ?? 'medium',
      reasoning: cached.scoring_reasoning,
      cached: true,
    })
  }

  // Fetch candidate data
  const { data: candidate, error: candErr } = await supabase
    .from('candidates')
    .select('name, position, outlet, notes, source, cv_url, phone, email, applied_job_id')
    .eq('id', candidate_id)
    .eq('company_id', COMPANY_ID)
    .single()

  if (candErr || !candidate) return NextResponse.json({ error: 'candidate not found' }, { status: 404 })

  // Fetch job posting if provided, falling back to the job the candidate applied to
  const effectiveJobId = job_posting_id ?? candidate.applied_job_id
  let jobContext = ''
  if (effectiveJobId) {
    const { data: job } = await supabase
      .from('job_postings')
      .select('title, position, outlet, requirements, benefits, salary_range')
      .eq('id', effectiveJobId)
      .eq('company_id', COMPANY_ID)
      .single()
    if (job) {
      jobContext = `\nJob Posting:\n- Posisi: ${job.position}\n- Outlet: ${job.outlet ?? '-'}\n- Kualifikasi: ${Array.isArray(job.requirements) ? job.requirements.join(', ') : '-'}`
    }
  }

  const prompt = `Nilai kandidat untuk posisi di Greenly Cloud Kitchen (cloud kitchen, blue-collar/service worker).

Data kandidat:
- Nama: ${candidate.name}
- Posisi yang dilamar: ${candidate.position ?? '-'}
- Outlet: ${candidate.outlet ?? '-'}
- Sumber: ${candidate.source}
- Email tersedia: ${candidate.email ? 'ya' : 'tidak'}
- Nomor WA tersedia: ${candidate.phone ? 'ya' : 'tidak'}
- CV tersedia: ${candidate.cv_url ? 'ya' : 'tidak'}
- Catatan HR: ${candidate.notes ?? '-'}
${jobContext}

Berikan penilaian dalam format JSON berikut. PENTING:
- cv_fit_score: 0-100 (bobot: pengalaman relevan 35%, skill spesifik 25%, kelengkapan data 20%, kecocokan lokasi 20%)
- attrition_risk_score: 0-100 berdasarkan sinyal objektif SAJA: kelengkapan data kontak, kelengkapan informasi yang tersedia. JANGAN menilai berdasarkan frekuensi ganti kerja (tidak relevan untuk blue-collar/gig worker). Skor ini hanya sebagai catatan untuk HR, BUKAN untuk auto-reject.
- reasoning.strengths: array string, kekuatan kandidat
- reasoning.concerns: array string, hal yang perlu ditanyakan saat interview (bukan alasan reject)
- reasoning.recommendation: string, saran tindak lanjut untuk HR

{
  "cv_fit_score": <0-100>,
  "attrition_risk_score": <0-100>,
  "reasoning": {
    "strengths": ["..."],
    "concerns": ["..."],
    "recommendation": "..."
  }
}`

  try {
    const raw = await callClaude([{ role: 'user', content: prompt }])
    const match = raw.match(/\{[\s\S]+\}/)
    if (!match) throw new Error('no JSON in response')
    const parsed = JSON.parse(match[0])

    const cvFit = Math.min(100, Math.max(0, Math.round(Number(parsed.cv_fit_score))))
    const attrition = Math.min(100, Math.max(0, Math.round(Number(parsed.attrition_risk_score))))
    // Formula from spec: hire_success_probability = (cv_fit * 0.6) + ((100 - attrition) * 0.4)
    const hireProbability = Math.round((cvFit * 0.6) + ((100 - attrition) * 0.4))

    const confidence: 'high' | 'medium' | 'low' =
      cvFit >= 70 && attrition <= 40 ? 'high'
      : cvFit < 40 || attrition > 70 ? 'low'
      : 'medium'

    // Delete old score, insert new (handles the partial unique index on valid_until > now)
    await supabase
      .from('candidate_scores')
      .delete()
      .eq('candidate_id', candidate_id)
      .eq('company_id', COMPANY_ID)

    await supabase.from('candidate_scores').insert({
      candidate_id,
      company_id: COMPANY_ID,
      cv_fit_score: cvFit,
      attrition_risk_score: attrition,
      hire_success_probability: hireProbability,
      scoring_reasoning: { ...parsed.reasoning, confidence },
    })

    return NextResponse.json({
      cv_fit_score: cvFit,
      attrition_risk_score: attrition,
      hire_success_probability: hireProbability,
      confidence,
      reasoning: parsed.reasoning,
      cached: false,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
