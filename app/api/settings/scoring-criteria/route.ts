import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'

const COMPANY_ID = process.env.COMPANY_ID!

export async function GET() {
  const authError = await requireUser()
  if (authError) return authError

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('scoring_criteria')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const authError = await requireUser()
  if (authError) return authError

  const { label, description, weight, sort_order } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'label required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('scoring_criteria')
    .insert({
      company_id: COMPANY_ID,
      label: label.trim(),
      description: description?.trim() || null,
      weight: weight ?? 20,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
