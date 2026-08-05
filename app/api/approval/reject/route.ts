import { NextResponse, NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

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
