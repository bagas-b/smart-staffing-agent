import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient()
  const { id } = await params
  const { data, error } = await supabase
    .from('candidates')
    .select('*, candidate_messages(*), candidate_decisions(*), candidate_scores(*), job_postings(id, title, position, outlet, status)')
    .eq('id', id)
    .eq('company_id', COMPANY_ID)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient()
  const { id } = await params
  const body = await req.json()
  const { data, error } = await supabase
    .from('candidates')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', COMPANY_ID)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient()
  const { id } = await params
  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', id)
    .eq('company_id', COMPANY_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
