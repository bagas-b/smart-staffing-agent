import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json()
  const { name, phone, position, outlet, notes, source = 'import', applied_job_id } = body
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('candidates')
    .insert({ company_id: COMPANY_ID, name, phone, position, outlet, notes, source, applied_job_id: applied_job_id ?? null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Same auto-pipeline as CSV import: score the candidate, and draft a
  // first-contact message for HR to review if there's a phone to reach them on.
  await supabase.from('agent_tasks').insert([
    { company_id: COMPANY_ID, type: 'score', payload: { candidate_id: data.id } },
    ...(phone ? [{ company_id: COMPANY_ID, type: 'draft_initial_outreach', payload: { candidate_id: data.id } }] : []),
  ])
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/agent/run`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {})

  return NextResponse.json(data, { status: 201 })
}
