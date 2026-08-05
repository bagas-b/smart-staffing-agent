import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function GET() {
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

  return NextResponse.json({
    funnel: {
      outreach: outreach ?? 0,
      response: response ?? 0,
      interview: interview ?? 0,
      hire: hired ?? 0,
    },
    retention: {
      first_day_rate: firstDayRate,
      day_30_rate: day30Rate,
      avg_rating: avgRating,
    },
  })
}
