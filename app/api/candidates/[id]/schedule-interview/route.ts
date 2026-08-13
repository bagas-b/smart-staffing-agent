import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/utils/base-url'

const COMPANY_ID = process.env.COMPANY_ID!

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { scheduledAt } = await req.json() as { scheduledAt?: string }
  if (!scheduledAt) return NextResponse.json({ error: 'scheduledAt required' }, { status: 400 })

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('candidates')
    .update({
      status: 'interview_dijadwalkan',
      interview_scheduled_at: scheduledAt,
      last_agent_action: 'interview_scheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', COMPANY_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Draft the invitation message HR reviews/edits/approves — same pipeline
  // as initial outreach and follow-up drafts, no new machinery.
  await supabase.from('agent_tasks').insert({
    company_id: COMPANY_ID,
    type: 'draft_interview_invite',
    payload: { candidate_id: id },
  })

  const baseUrl = getBaseUrl()
  fetch(`${baseUrl}/api/agent/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
