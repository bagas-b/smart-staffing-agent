import { NextResponse, NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { dispatchDraft } from '@/lib/approval/dispatch'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const serviceSupabase = createServiceClient()
  const result = await dispatchDraft(serviceSupabase, id)

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json({ ok: true })
}
