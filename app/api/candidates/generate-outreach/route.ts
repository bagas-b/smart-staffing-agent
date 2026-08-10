import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

/**
 * Manual "catch-up" trigger for the belum_dihubungi backlog — draft_initial_outreach
 * only ever fires automatically at candidate-creation time (CSV upload / manual
 * add). Candidates who slipped through that (imported before the feature existed,
 * had no phone yet at creation time, etc.) never get a draft on their own. This
 * lets HR sweep the backlog on demand instead of needing a recurring cron for it.
 *
 * Also doubles as a manual "un-stick the queue" button: if a previous batch
 * queued more tasks than /api/agent/run processes in one call, the leftovers
 * sit at status='pending' forever with nothing else to nudge them — clicking
 * this always re-triggers a run so that backlog gets a chance to drain too.
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

  const { data: existingTasks } = await supabase
    .from('agent_tasks')
    .select('status, payload')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'draft_initial_outreach')

  const taskStatusByCandidate = new Map(
    (existingTasks ?? [])
      .map(t => [(t.payload as { candidate_id?: string } | null)?.candidate_id, t.status])
      .filter(([id]) => !!id) as [string, string][]
  )

  const toEnqueue = (candidates ?? []).filter(c => !taskStatusByCandidate.has(c.id))
  const statusCounts = { pending: 0, processing: 0, done: 0, needs_review: 0, failed: 0 }
  for (const status of taskStatusByCandidate.values()) {
    if (status in statusCounts) statusCounts[status as keyof typeof statusCounts]++
  }

  if (toEnqueue.length > 0) {
    await supabase.from('agent_tasks').insert(
      toEnqueue.map(c => ({
        company_id: COMPANY_ID,
        type: 'draft_initial_outreach',
        payload: { candidate_id: c.id },
      }))
    )
  }

  // Always trigger — even with nothing new to enqueue, this is also how a
  // stranded pending/failed backlog from a previous run gets another chance.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/agent/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {})

  return NextResponse.json({
    enqueued: toEnqueue.length,
    ...statusCounts,
  })
}
