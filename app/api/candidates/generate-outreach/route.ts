import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

/**
 * Manual "catch-up" trigger for the belum_dihubungi backlog — draft_initial_outreach
 * only ever fires automatically at candidate-creation time (CSV upload / manual
 * add). Candidates who slipped through that (imported before the feature existed,
 * had no phone yet at creation time, etc.) never get a draft on their own. This
 * lets HR sweep the backlog on demand instead of needing a recurring cron for it.
 */
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json().catch(() => ({})) as { candidateIds?: string[] }

  let query = supabase
    .from('candidates')
    .select('id, phone')
    .eq('company_id', COMPANY_ID)
    .eq('status', 'belum_dihubungi')
    .not('phone', 'is', null)
    .neq('phone', '')

  if (body.candidateIds?.length) {
    query = query.in('id', body.candidateIds)
  }

  const { data: candidates, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!candidates?.length) return NextResponse.json({ enqueued: 0, skipped: 0 })

  // Don't double-queue candidates that already have an outreach task in any
  // status (pending/processing/done/needs_review/failed) — one attempt already
  // exists for them.
  const { data: existingTasks } = await supabase
    .from('agent_tasks')
    .select('payload')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'draft_initial_outreach')

  const alreadyQueued = new Set(
    (existingTasks ?? [])
      .map(t => (t.payload as { candidate_id?: string } | null)?.candidate_id)
      .filter((id): id is string => !!id)
  )

  const toEnqueue = candidates.filter(c => !alreadyQueued.has(c.id))
  const skipped = candidates.length - toEnqueue.length
  if (toEnqueue.length === 0) return NextResponse.json({ enqueued: 0, skipped })

  await supabase.from('agent_tasks').insert(
    toEnqueue.map(c => ({
      company_id: COMPANY_ID,
      type: 'draft_initial_outreach',
      payload: { candidate_id: c.id },
    }))
  )

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/agent/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {})

  return NextResponse.json({ enqueued: toEnqueue.length, skipped })
}
