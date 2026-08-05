import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('candidate_scores')
    .select('candidate_id, hire_success_probability')
    .eq('company_id', COMPANY_ID)
    .gt('valid_until', new Date().toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return as map: { [candidate_id]: hire_success_probability }
  const scoreMap: Record<string, number> = {}
  for (const row of data ?? []) {
    scoreMap[row.candidate_id] = row.hire_success_probability
  }
  return NextResponse.json(scoreMap)
}
