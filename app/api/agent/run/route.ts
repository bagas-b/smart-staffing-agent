import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!
const MAX_TASKS_PER_RUN = 10

export async function POST() {
  const supabase = createServiceClient()

  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('status', 'pending')
    .order('created_at')
    .limit(MAX_TASKS_PER_RUN)

  if (!tasks?.length) return NextResponse.json({ processed: 0 })

  let processed = 0
  for (const task of tasks) {
    await supabase
      .from('agent_tasks')
      .update({ status: 'processing', attempts: task.attempts + 1 })
      .eq('id', task.id)

    try {
      if (task.type === 'score') {
        await processScoreTask(supabase, task)
      } else if (task.type === 'classify_reply') {
        await processClassifyTask(supabase, task)
      } else if (task.type === 'draft_follow_up') {
        await processDraftFollowUpTask(supabase, task)
      }
      processed++
    } catch (e: unknown) {
      const msg = (e as Error).message
      if (task.attempts >= 1) {
        await supabase.from('agent_tasks').update({
          status: 'failed',
          error_message: msg,
          processed_at: new Date().toISOString(),
        }).eq('id', task.id)
        await supabase.from('agent_logs').insert({
          company_id: COMPANY_ID,
          type: 'error',
          message: `Task ${task.type} failed: ${msg}`,
          metadata: { taskId: task.id },
        })
      } else {
        await supabase.from('agent_tasks').update({
          status: 'pending',
          error_message: msg,
        }).eq('id', task.id)
      }
    }
  }

  return NextResponse.json({ processed })
}

async function processScoreTask(
  supabase: ReturnType<typeof createServiceClient>,
  task: { id: string; payload: { candidate_id?: string; job_posting_id?: string } },
) {
  const { candidate_id, job_posting_id } = task.payload
  if (!candidate_id) throw new Error('missing candidate_id in payload')

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/ai/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id, job_posting_id }),
  })
  if (!res.ok) throw new Error(`score API error ${res.status}`)
  const result = await res.json()

  const finalStatus = result.confidence === 'low' ? 'needs_review' : 'done'
  await supabase.from('agent_tasks').update({
    status: finalStatus,
    result,
    processed_at: new Date().toISOString(),
  }).eq('id', task.id)

  await supabase.from('candidates').update({ last_agent_action: 'scored' }).eq('id', candidate_id)
}

// ponytail: stubs — filled in Task 4
async function processClassifyTask(
  _supabase: ReturnType<typeof createServiceClient>,
  _task: { id: string; payload: Record<string, unknown> },
) {
  throw new Error('classify_reply not yet implemented — will be added in Task 4')
}

async function processDraftFollowUpTask(
  _supabase: ReturnType<typeof createServiceClient>,
  _task: { id: string; payload: Record<string, unknown> },
) {
  throw new Error('draft_follow_up not yet implemented — will be added in Task 4')
}
