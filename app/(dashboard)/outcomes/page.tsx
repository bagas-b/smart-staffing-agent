import { HireFunnel } from '@/components/outcomes/HireFunnel'
import { RetentionMetrics } from '@/components/outcomes/RetentionMetrics'
import { PendingCheckins, daysAgo, type PendingCheckin } from '@/components/outcomes/PendingCheckins'
import { ResignList, type ResignEntry } from '@/components/outcomes/ResignList'
import { createServiceClient } from '@/lib/supabase/server'

// Force per-request rendering — otherwise this gets statically prerendered at
// build time and never reflects new hire/performance data.
export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.COMPANY_ID!

// Supabase's untyped client infers to-one embeds as arrays; normalize defensively
// since the actual runtime shape is a single object (many-to-one FK).
function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

async function getOutcomes() {
  const supabase = createServiceClient()

  const [
    { count: outreach },
    { count: response },
    { count: interview },
    { count: hired },
  ] = await Promise.all([
    supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).neq('status', 'belum_dihubungi'),
    supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).in('status', ['tertarik', 'butuh_info', 'interview_dijadwalkan', 'lulus_interview', 'onboarding', 'aktif']),
    supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).in('status', ['interview_dijadwalkan', 'lulus_interview', 'onboarding', 'aktif']),
    supabase.from('candidate_hire_records').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
  ])

  const { data: perfData } = await supabase
    .from('candidate_performance')
    .select('day_1_checkin, day_30_status, performance_rating')
    .eq('company_id', COMPANY_ID)

  const perf = perfData ?? []
  const firstDayRate = perf.length > 0
    ? Math.round((perf.filter(p => p.day_1_checkin).length / perf.length) * 100)
    : null
  const perfWithDay30 = perf.filter(p => p.day_30_status !== null)
  const day30Rate = perfWithDay30.length > 0
    ? Math.round((perfWithDay30.filter(p => p.day_30_status === 'active').length / perfWithDay30.length) * 100)
    : null
  const ratings = perf.filter(p => p.performance_rating !== null).map(p => p.performance_rating as number)
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null

  // Hire records + candidate + performance, for the check-in / attrition sections below.
  const { data: hireRows } = await supabase
    .from('candidate_hire_records')
    .select('id, candidate_id, hired_date, start_date, first_day_attended, candidates(id, name, position, outlet), candidate_performance(day_7_status, day_30_status, resign_date, resign_reason)')
    .eq('company_id', COMPANY_ID)
    .order('hired_date', { ascending: false })

  const pendingCheckins: PendingCheckin[] = []
  const resigned: ResignEntry[] = []

  for (const row of hireRows ?? []) {
    const candidate = toOne(row.candidates)
    const perfRow = toOne(row.candidate_performance)
    if (!candidate) continue

    if (perfRow?.day_30_status === 'resigned' || perfRow?.day_30_status === 'terminated') {
      resigned.push({
        candidateId: candidate.id,
        name: candidate.name,
        position: candidate.position,
        outlet: candidate.outlet,
        status: perfRow.day_30_status,
        resignDate: perfRow.resign_date,
        resignReason: perfRow.resign_reason,
      })
      continue
    }

    const needsCheckin = !row.first_day_attended || !perfRow?.day_7_status || !perfRow?.day_30_status
    if (needsCheckin) {
      pendingCheckins.push({
        candidateId: candidate.id,
        name: candidate.name,
        position: candidate.position,
        outlet: candidate.outlet,
        hiredDate: row.hired_date,
        startDate: row.start_date,
        firstDayAttended: row.first_day_attended,
        day7Status: perfRow?.day_7_status ?? null,
        day30Status: perfRow?.day_30_status ?? null,
        daysSinceHire: daysAgo(row.hired_date),
      })
    }
  }

  return {
    funnel: { outreach: outreach ?? 0, response: response ?? 0, interview: interview ?? 0, hire: hired ?? 0 },
    retention: { first_day_rate: firstDayRate, day_30_rate: day30Rate, avg_rating: avgRating },
    pendingCheckins,
    resigned,
  }
}

export default async function OutcomesPage() {
  const data = await getOutcomes()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Outcome Dashboard</h1>
        <p className="text-sm text-gray-500">Hasil hire nyata — bukan hanya berapa pesan yang terkirim.</p>
      </div>
      <HireFunnel data={data.funnel} />
      <div>
        <h2 className="text-sm font-medium text-gray-700 mb-3">Retention & Performa</h2>
        <RetentionMetrics data={data.retention} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PendingCheckins items={data.pendingCheckins} />
        <ResignList items={data.resigned} />
      </div>
      <p className="text-xs text-gray-400">
        Data retention diisi manual oleh HR lewat kartu kandidat (menu Kandidat → klik kandidat → Onboarding & Performa).
      </p>
    </div>
  )
}
