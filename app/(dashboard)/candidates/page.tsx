import { createServiceClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/candidates/KanbanBoard'

// Force per-request rendering — otherwise this gets statically prerendered at
// build time and the kanban board never reflects DB changes (e.g. status updates).
export const dynamic = 'force-dynamic'

async function getCandidates() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('candidates')
    .select('id, name, status, position, outlet, interview_scheduled_at, candidate_scores(cv_fit_score, hire_success_probability, scoring_reasoning)')
    .eq('company_id', process.env.COMPANY_ID!)
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ candidate?: string }>
}) {
  const candidates = await getCandidates()
  const { candidate } = await searchParams

  return (
    <div className="p-6">
      <KanbanBoard candidates={candidates} initialCandidateId={candidate} />
    </div>
  )
}
