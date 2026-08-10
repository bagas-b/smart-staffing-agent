import { createServiceClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/dashboard/StatCard'
import { AgentLogFeed } from '@/components/dashboard/AgentLogFeed'
import { ActionPanel } from '@/components/dashboard/ActionPanel'
import { RecommendationPanel } from '@/components/dashboard/RecommendationPanel'
import { Users, Clock, AlertTriangle, CheckSquare, TrendingUp, Activity } from 'lucide-react'

async function getDashboardData() {
  const supabase = createServiceClient()
  const companyId = process.env.COMPANY_ID!

  const [candidatesRes, pendingApprovalRes, needsReviewRes] = await Promise.all([
    supabase.from('candidates').select('id, status').eq('company_id', companyId),
    supabase.from('candidate_messages')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('direction', 'draft'),
    supabase.from('agent_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'needs_review'),
  ])

  const candidates = candidatesRes.data ?? []
  return {
    total: candidates.length,
    menunggu: candidates.filter(c => c.status === 'menunggu_balasan').length,
    tertarik: candidates.filter(c => c.status === 'tertarik').length,
    aktif: candidates.filter(c => c.status === 'aktif').length,
    pendingApproval: pendingApprovalRes.count ?? 0,
    needsReview: needsReviewRes.count ?? 0,
    candidateStatuses: candidates,
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
        <ActionPanel />
        <RecommendationPanel />
      </div>

      <AgentLogFeed />
    </div>
  )
}
