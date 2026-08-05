import { HireFunnel } from '@/components/outcomes/HireFunnel'
import { RetentionMetrics } from '@/components/outcomes/RetentionMetrics'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

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

  return {
    funnel: { outreach: outreach ?? 0, response: response ?? 0, interview: interview ?? 0, hire: hired ?? 0 },
    retention: { first_day_rate: firstDayRate, day_30_rate: day30Rate, avg_rating: avgRating },
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
      <p className="text-xs text-gray-400">
        Data retention diisi manual oleh HR. Integrasi absensi otomatis tersedia di fase berikutnya.
      </p>
    </div>
  )
}
