import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { dispatchDraft } from '@/lib/approval/dispatch'
import { requireUser } from '@/lib/auth/require-user'

export async function POST(req: NextRequest) {
  const authError = await requireUser()
  if (authError) return authError

  const { id } = await req.json()
  const serviceSupabase = createServiceClient()
  const result = await dispatchDraft(serviceSupabase, id)

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json({ ok: true })
}
