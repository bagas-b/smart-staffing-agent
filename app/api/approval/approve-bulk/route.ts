import { NextResponse, NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { dispatchDraft } from '@/lib/approval/dispatch'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { ids } = await req.json() as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()
  // Sequential, not Promise.all — avoids hammering the WA/Telegram APIs with a
  // burst of simultaneous sends when HR approves a large batch at once.
  const results = []
  for (const id of ids) {
    results.push(await dispatchDraft(serviceSupabase, id))
  }

  const succeeded = results.filter(r => r.ok).map(r => r.id)
  const failed = results.filter(r => !r.ok)

  return NextResponse.json({ succeeded, failed })
}
