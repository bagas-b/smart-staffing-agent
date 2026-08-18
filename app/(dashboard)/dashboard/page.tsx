import { createServiceClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/dashboard/StatCard'
import { AgentLogFeed } from '@/components/dashboard/AgentLogFeed'
import { ActionPanel, type ReviewTaskItem, type DraftItem } from '@/components/dashboard/ActionPanel'
import { RecommendationPanel, type ScoredCandidate } from '@/components/dashboard/RecommendationPanel'
import { Users, Clock, AlertTriangle, CheckSquare, TrendingUp, Activity } from 'lucide-react'

// Force per-request rendering — this page has no dynamic API usage Next.js can
// detect (createServiceClient() doesn't touch cookies()/headers()), so without
// this it gets statically prerendered at build time and never reflects DB changes.
export const dynamic = 'force-dynamic'

interface RawReviewTask {
  id: string
  type: string
  payload: { candidate_id?: string }
  created_at: string
}

async function getDashboardData() {
  const supabase = createServiceClient()
  const companyId = process.env.COMPANY_ID!

  // Everything independent fires in one batch — separate sequential awaits
  // (even reusing the same client, even across separate Server Components)
  // were each paying a full connection-latency hit on this Vercel/Supabase
  // pairing, stacking into a 20-40s page load. This was previously split
  // across page.tsx + ActionPanel + RecommendationPanel each doing their own
  // fetching; consolidated here so it's one round-trip group instead of four.
  const [
    candidatesRes,
    pendingApprovalRes,
    needsReviewCountRes,
    reviewTasksRes,
    draftsRes,
    topScoresRes,
  ] = await Promise.all([
    supabase.from('candidates').select('id, status').eq('company_id', companyId),
    supabase.from('candidate_messages')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('direction', 'draft'),
    supabase.from('agent_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'needs_review'),
    supabase.from('agent_tasks')
      .select('id, type, payload, created_at')
      .eq('company_id', companyId)
      .eq('status', 'needs_review')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('candidate_messages')
      .select('id, content, created_at, candidate_id, candidates(name, position)')
      .eq('company_id', companyId)
      .eq('direction', 'draft')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('candidate_scores')
      .select('candidate_id, hire_success_probability, cv_fit_score, scoring_reasoning, candidates!inner(id, name, position, outlet, status)')
      .eq('company_id', companyId)
      .order('hire_success_probability', { ascending: false })
      .limit(5),
  ])

  const candidates = candidatesRes.data ?? []
  const reviewTasks = (reviewTasksRes.data ?? []) as RawReviewTask[]

  // agent_tasks.payload is jsonb (no FK join possible) — batch-fetch candidate
  // names separately so "Butuh Tindakan HR" can say who, not just what. Only
  // fires when there's actually something to look up.
  const candidateIds = [...new Set(reviewTasks.map(t => t.payload?.candidate_id).filter(Boolean))] as string[]
  const { data: candidatesData } = candidateIds.length > 0
    ? await supabase.from('candidates').select('id, name').in('id', candidateIds).eq('company_id', companyId)
    : { data: [] }
  const candidateNames = new Map((candidatesData ?? []).map(c => [c.id, c.name]))

  const reviewTaskItems: ReviewTaskItem[] = reviewTasks.map(t => ({
    id: t.id,
    type: t.type,
    created_at: t.created_at,
    candidateId: t.payload?.candidate_id ?? null,
    candidateName: t.payload?.candidate_id ? candidateNames.get(t.payload.candidate_id) ?? null : null,
  }))

  return {
    total: candidates.length,
    menunggu: candidates.filter(c => c.status === 'menunggu_balasan').length,
    tertarik: candidates.filter(c => c.status === 'tertarik').length,
    aktif: candidates.filter(c => c.status === 'aktif').length,
    pendingApproval: pendingApprovalRes.count ?? 0,
    needsReview: needsReviewCountRes.count ?? 0,
    reviewTasks: reviewTaskItems,
    drafts: (draftsRes.data ?? []) as unknown as DraftItem[],
    topScores: (topScoresRes.data ?? []) as unknown as ScoredCandidate[],
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardData()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Kandidat" value={stats.total} icon={Users} />
        <StatCard label="Menunggu Balasan" value={stats.menunggu} color="#d97706" icon={Clock} />
        <StatCard label="Tertarik" value={stats.tertarik} color="#2563eb" icon={TrendingUp} />
        <StatCard label="Aktif" value={stats.aktif} color="#16a34a" icon={Activity} />
        <StatCard label="Perlu Review" value={stats.needsReview} color="#dc2626" icon={AlertTriangle} href="/candidates" />
        <StatCard label="Menunggu Approval" value={stats.pendingApproval} color="#7c3aed" icon={CheckSquare} href="/approval" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionPanel reviewTasks={stats.reviewTasks} drafts={stats.drafts} />
        <RecommendationPanel candidates={stats.topScores} />
      </div>

      <AgentLogFeed />
    </div>
  )
}
