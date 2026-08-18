import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'

const COMPANY_ID = process.env.COMPANY_ID!

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireUser()
  if (authError) return authError

  const { id } = await params
  const body = await req.json()
  const allowed = ['label', 'description', 'weight', 'active', 'sort_order'] as const
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('scoring_criteria')
    .update(patch)
    .eq('id', id)
    .eq('company_id', COMPANY_ID)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireUser()
  if (authError) return authError

  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('scoring_criteria')
    .delete()
    .eq('id', id)
    .eq('company_id', COMPANY_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
