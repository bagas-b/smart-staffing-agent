import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const companyId = process.env.COMPANY_ID!

  const { data, error } = await supabase
    .from('candidates')
    .select('id, name, status, position, outlet, source, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
