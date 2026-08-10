import { NextResponse, NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { ids } = await req.json() as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()
  const { error } = await serviceSupabase
    .from('candidate_messages')
    .delete()
    .in('id', ids)
    .eq('company_id', COMPANY_ID)
    .eq('direction', 'draft')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
