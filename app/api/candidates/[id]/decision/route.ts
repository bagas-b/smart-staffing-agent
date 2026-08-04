import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient()
  const { id } = await params
  const { decision, notes } = await req.json()

  if (!decision || !['lulus', 'tidak_lulus'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be lulus or tidak_lulus' }, { status: 400 })
  }

  const { error: logError } = await supabase.from('candidate_decisions').insert({
    candidate_id: id,
    company_id: COMPANY_ID,
    decision,
    notes,
  })
  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  const newStatus = decision === 'lulus' ? 'lulus_interview' : 'tidak_lulus'
  await supabase
    .from('candidates')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', COMPANY_ID)

  return NextResponse.json({ success: true })
}
