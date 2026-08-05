import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('candidate_hire_records')
    .select('*, candidate_performance(*)')
    .eq('candidate_id', id)
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return NextResponse.json({ hire_record: null })
  return NextResponse.json({ hire_record: data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await req.json() as Record<string, unknown>

  const { data, error } = await supabase
    .from('candidate_hire_records')
    .insert({
      candidate_id: id,
      company_id: COMPANY_ID,
      job_posting_id: body.job_posting_id ?? null,
      hired_date: body.hired_date ?? null,
      start_date: body.start_date ?? null,
      first_day_attended: body.first_day_attended ?? false,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update candidate status to onboarding (best-effort)
  const { error: updateError } = await supabase
    .from('candidates')
    .update({ status: 'onboarding', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', COMPANY_ID)

  if (updateError) {
    console.warn('hire record created but candidate status update failed:', updateError.message)
  }

  return NextResponse.json({ hire_record: data }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await req.json() as Record<string, unknown>

  // Get the hire record first
  const { data: hire } = await supabase
    .from('candidate_hire_records')
    .select('id')
    .eq('candidate_id', id)
    .eq('company_id', COMPANY_ID)
    .single()

  if (!hire) return NextResponse.json({ error: 'hire record not found' }, { status: 404 })

  const hireFields = ['hired_date', 'start_date', 'first_day_attended', 'notes']
  const perfFields = ['day_1_checkin', 'day_7_status', 'day_30_status', 'performance_rating', 'resign_date', 'resign_reason', 'mentor_feedback']

  const hireUpdate = Object.fromEntries(Object.entries(body).filter(([k]) => hireFields.includes(k)))
  const perfUpdate = Object.fromEntries(Object.entries(body).filter(([k]) => perfFields.includes(k)))

  if (Object.keys(hireUpdate).length > 0) {
    await supabase
      .from('candidate_hire_records')
      .update(hireUpdate)
      .eq('id', hire.id)
      .eq('company_id', COMPANY_ID)
  }

  if (Object.keys(perfUpdate).length > 0) {
    const { data: existingPerf } = await supabase
      .from('candidate_performance')
      .select('id')
      .eq('candidate_hire_id', hire.id)
      .eq('company_id', COMPANY_ID)
      .single()

    if (existingPerf) {
      await supabase
        .from('candidate_performance')
        .update({ ...perfUpdate, updated_at: new Date().toISOString() })
        .eq('id', existingPerf.id)
        .eq('company_id', COMPANY_ID)
    } else {
      await supabase
        .from('candidate_performance')
        .insert({ candidate_hire_id: hire.id, company_id: COMPANY_ID, ...perfUpdate })
    }
  }

  return NextResponse.json({ success: true })
}
