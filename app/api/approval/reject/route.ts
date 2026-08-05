import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { id } = await req.json()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('candidate_messages')
    .delete()
    .eq('id', id)
    .eq('company_id', process.env.COMPANY_ID!)
    .eq('direction', 'draft')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
