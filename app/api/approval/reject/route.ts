import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'

export async function POST(req: NextRequest) {
  const authError = await requireUser()
  if (authError) return authError

  const { id } = await req.json()
  const serviceSupabase = createServiceClient()
  const { error } = await serviceSupabase
    .from('candidate_messages')
    .delete()
    .eq('id', id)
    .eq('company_id', process.env.COMPANY_ID!)
    .eq('direction', 'draft')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
