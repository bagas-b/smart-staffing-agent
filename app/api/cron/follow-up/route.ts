import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!
const FOLLOW_UP_THRESHOLD_HOURS = 24

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - FOLLOW_UP_THRESHOLD_HOURS * 3600 * 1000).toISOString()

  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('id, follow_up_count')
    .eq('company_id', COMPANY_ID)
    .eq('status', 'menunggu_balasan')
    .lt('updated_at', cutoff)
    .lt('follow_up_count', 2)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const enqueued: string[] = []

  for (const candidate of candidates ?? []) {
    await supabase.from('agent_tasks').insert({
      company_id: COMPANY_ID,
      type: 'draft_follow_up',
      payload: { candidate_id: candidate.id },
      status: 'pending',
      attempts: 0,
    })
    enqueued.push(candidate.id)
  }

  return NextResponse.json({ ok: true, enqueued: enqueued.length, ids: enqueued })
}
