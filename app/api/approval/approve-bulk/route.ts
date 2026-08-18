import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { dispatchDraft } from '@/lib/approval/dispatch'
import { requireUser } from '@/lib/auth/require-user'

export async function POST(req: NextRequest) {
  const authError = await requireUser()
  if (authError) return authError

  const { ids } = await req.json() as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()
  // Sequential, not Promise.all — avoids hammering the WA API with a burst
  // of simultaneous sends when HR approves a large batch at once.
  const results = []
  for (const id of ids) {
    results.push(await dispatchDraft(serviceSupabase, id))
  }

  const succeeded = results.filter(r => r.ok).map(r => r.id)
  const failed = results.filter(r => !r.ok)

  return NextResponse.json({ succeeded, failed })
}
