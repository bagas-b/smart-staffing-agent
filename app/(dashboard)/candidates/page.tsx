import { createServiceClient } from '@/lib/supabase/server'
import { CandidateUploadForm } from '@/components/candidates/CandidateUploadForm'
import { KanbanBoard } from '@/components/candidates/KanbanBoard'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// Force per-request rendering — otherwise this gets statically prerendered at
// build time and the kanban board never reflects DB changes (e.g. status updates).
export const dynamic = 'force-dynamic'

async function getCandidates() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('candidates')
    .select('id, name, status, position, outlet, candidate_scores(cv_fit_score, hire_success_probability, scoring_reasoning)')
    .eq('company_id', process.env.COMPANY_ID!)
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function CandidatesPage() {
  const candidates = await getCandidates()

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">
          Kandidat <span className="text-gray-400 font-normal text-base">({candidates.length})</span>
        </h1>
        <div className="flex gap-2">
          <CandidateUploadForm />
          <Link href="/candidates/new"
            className={cn(buttonVariants(), 'bg-[#1E3A2F] hover:bg-[#2d5242] gap-2')}>
            + Tambah Kandidat
          </Link>
        </div>
      </div>
      <KanbanBoard candidates={candidates} />
    </div>
  )
}
