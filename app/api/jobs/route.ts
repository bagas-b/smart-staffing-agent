import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json()
  const { title, position, outlet, shift, description, requirements, benefits, salary_range, channels } = body
  if (!title || !position) return NextResponse.json({ error: 'title and position required' }, { status: 400 })

  const { data, error } = await supabase
    .from('job_postings')
    .insert({
      company_id: COMPANY_ID,
      title,
      position,
      outlet,
      shift,
      description,
      requirements: requirements ?? [],
      benefits: benefits ?? [],
      salary_range,
      channels: channels ?? [],
      status: 'draft',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
