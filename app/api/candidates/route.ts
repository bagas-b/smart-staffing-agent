import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('candidates')
    .select('id, name, status, position, outlet, source, created_at')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json()
  const { name, phone, position, outlet, notes, source = 'import' } = body
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('candidates')
    .insert({ company_id: COMPANY_ID, name, phone, position, outlet, notes, source })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
