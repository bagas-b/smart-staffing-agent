import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'

const COMPANY_ID = process.env.COMPANY_ID!

export async function POST(req: NextRequest) {
  const authError = await requireUser()
  if (authError) return authError

  const { id, content } = await req.json() as { id?: string; content?: string }
  if (!id || !content?.trim()) return NextResponse.json({ error: 'id and content required' }, { status: 400 })

  const serviceSupabase = createServiceClient()
  const { error } = await serviceSupabase
    .from('candidate_messages')
    .update({ content: content.trim() })
    .eq('id', id)
    .eq('company_id', COMPANY_ID)
    .eq('direction', 'draft') // only editable while still a draft, never after it's sent

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
