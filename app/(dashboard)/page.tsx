import { StatCard } from '@/components/dashboard/StatCard'
import { AgentLogFeed } from '@/components/dashboard/AgentLogFeed'
import { createServiceClient } from '@/lib/supabase/server'

async function getStats() {
  const supabase = createServiceClient()
  const companyId = process.env.COMPANY_ID!
  const { data } = await supabase
    .from('candidates')
    .select('status')
    .eq('company_id', companyId)
  return data ?? []
}

export default async function DashboardPage() {
  const candidates = await getStats()
  const total = candidates.length
  const menunggu = candidates.filter(c => c.status === 'menunggu_balasan').length
  const tertarik = candidates.filter(c => c.status === 'tertarik').length
  const aktif = candidates.filter(c => c.status === 'aktif').length

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Kandidat" value={total} />
        <StatCard label="Menunggu Balasan" value={menunggu} color="#d97706" />
        <StatCard label="Tertarik" value={tertarik} color="#2563eb" />
        <StatCard label="Aktif" value={aktif} color="#16a34a" />
      </div>
      <AgentLogFeed />
    </div>
  )
}
