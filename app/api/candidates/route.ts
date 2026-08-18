import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/utils/base-url'

const COMPANY_ID = process.env.COMPANY_ID!

export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('candidates')
    .select('id, name, status, position, outlet, source, created_at')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

interface CandidateInput {
  name: string
  phone?: string | null
  email?: string | null
  position?: string | null
  outlet?: string | null
  notes?: string | null
  source: string
  applied_job_id?: string | null
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const contentType = req.headers.get('content-type') ?? ''

  let input: CandidateInput
  let cvFile: File | null = null

  // AddCandidateModal submits multipart (so it can attach a CV file);
  // AddApplicantForm and CSV-derived callers still send plain JSON — support both.
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const get = (k: string) => (form.get(k) as string | null)?.trim() || null
    input = {
      name: get('name') ?? '',
      phone: get('phone'),
      email: get('email'),
      position: get('position'),
      outlet: get('outlet'),
      notes: get('notes'),
      source: get('source') ?? 'import',
      applied_job_id: get('applied_job_id'),
    }
    const file = form.get('cv')
    if (file instanceof File && file.size > 0) cvFile = file
  } else {
    const body = await req.json()
    input = { source: 'import', ...body }
  }

  if (!input.name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('candidates')
    .insert({
      company_id: COMPANY_ID,
      name: input.name,
      phone: input.phone,
      email: input.email,
      position: input.position,
      outlet: input.outlet,
      notes: input.notes,
      source: input.source,
      applied_job_id: input.applied_job_id ?? null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Upload CV after the row exists so the storage path can key off the
  // candidate id. A failed upload shouldn't fail candidate creation — HR can
  // always attach it later — so this is best-effort with its own error log.
  let cvUrl: string | null = null
  if (cvFile) {
    const path = `${COMPANY_ID}/${data.id}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('cv')
      .upload(path, await cvFile.arrayBuffer(), { contentType: 'application/pdf', upsert: true })

    if (!uploadError) {
      cvUrl = supabase.storage.from('cv').getPublicUrl(path).data.publicUrl
      await supabase.from('candidates').update({ cv_url: cvUrl }).eq('id', data.id)
    } else {
      await supabase.from('agent_logs').insert({
        company_id: COMPANY_ID,
        type: 'error',
        message: `Gagal upload CV untuk ${data.name}: ${uploadError.message}`,
        metadata: { candidate_id: data.id },
      })
    }
  }

  // Same auto-pipeline as CSV import: score the candidate, and draft a
  // first-contact message for HR to review if there's a phone to reach them on.
  await supabase.from('agent_tasks').insert([
    { company_id: COMPANY_ID, type: 'score', payload: { candidate_id: data.id } },
    ...(input.phone ? [{ company_id: COMPANY_ID, type: 'draft_initial_outreach', payload: { candidate_id: data.id } }] : []),
  ])
  const baseUrl = getBaseUrl()
  fetch(`${baseUrl}/api/agent/run`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {})

  return NextResponse.json({ ...data, cv_url: cvUrl ?? data.cv_url }, { status: 201 })
}
