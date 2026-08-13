import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'

const COMPANY_ID = process.env.COMPANY_ID!

/**
 * Manual "Follow Up Kandidat" trigger — lets HR prioritize outreach to
 * agent-recommended candidates on demand instead of waiting for the
 * 48h-inactivity cron (app/api/cron/follow-up) to pick them up.
 *
 * Picks the task type per-candidate rather than hardcoding draft_follow_up:
 * a candidate never yet contacted (belum_dihubungi) gets a first-contact
 * outreach draft, everyone else gets an actual follow-up nudge. Both task
 * types always land as a draft for HR approval — this never auto-sends,
 * consistent with follow-up/scheduling staying human-reviewed.
 */
export async function POST(req: NextRequest) {
  const authError = await requireUser()
  if (authError) return authError

  const { ids } = await req.json().catch(() => ({})) as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('id, status')
    .eq('company_id', COMPANY_ID)
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!candidates?.length) return NextResponse.json({ enqueued: 0, alreadyQueued: 0 })

  // Don't pile up a duplicate draft on top of one that's still in flight —
  // only skip candidates with a task actively pending/processing right now.
  const { data: activeTasks } = await supabase
    .from('agent_tasks')
    .select('type, payload')
    .eq('company_id', COMPANY_ID)
    .in('type', ['draft_follow_up', 'draft_initial_outreach'])
    .in('status', ['pending', 'processing'])

  const busyCandidateIds = new Set(
    (activeTasks ?? [])
      .map(t => (t.payload as { candidate_id?: string } | null)?.candidate_id)
      .filter(Boolean)
  )

  const toEnqueue = candidates.filter(c => !busyCandidateIds.has(c.id))

  if (toEnqueue.length > 0) {
    await supabase.from('agent_tasks').insert(
      toEnqueue.map(c => ({
        company_id: COMPANY_ID,
        type: c.status === 'belum_dihubungi' ? 'draft_initial_outreach' : 'draft_follow_up',
        payload: { candidate_id: c.id },
        status: 'pending',
        attempts: 0,
      }))
    )
  }

  // Always trigger, even with nothing new enqueued — this is also how a
  // "already queued" task stranded at pending (e.g. a previous attempt that
  // failed and was requeued, but nothing has called agent/run since) gets
  // another chance instead of sitting stuck forever.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/agent/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {})

  return NextResponse.json({
    enqueued: toEnqueue.length,
    alreadyQueued: candidates.length - toEnqueue.length,
  })
}
