import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

const COMPANY_ID = process.env.COMPANY_ID!

function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
    if (val != null && val !== '') return String(val)
  }
  return ''
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
  const jobPostingId = (formData.get('job_posting_id') as string | null) || null

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

  const { data: batch, error: batchError } = await supabase
    .from('candidate_imports')
    .insert({ company_id: COMPANY_ID, filename: file.name, total_rows: rows.length })
    .select()
    .single()
  if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 })

  let imported = 0
  const importedIds: string[] = []
  const contactableIds: string[] = [] // has a phone number — worth drafting outreach for
  for (const row of rows) {
    const name = pick(row, 'name', 'nama', 'Name', 'Nama')
    const phone = pick(row, 'phone', 'nomor', 'wa', 'Phone', 'Nomor', 'WA')
    const email = pick(row, 'email', 'Email')
    const position = pick(row, 'position', 'posisi', 'Position', 'Posisi')
    const outlet = pick(row, 'outlet', 'Outlet')
    const notes = pick(row, 'notes', 'catatan', 'Notes', 'Catatan')
    if (!name) continue
    const { data: inserted, error } = await supabase.from('candidates').insert({
      company_id: COMPANY_ID,
      name, phone, email, position, outlet, notes,
      source: 'import',
      import_batch_id: batch.id,
      applied_job_id: jobPostingId,
    }).select('id').single()
    if (!error && inserted) {
      imported++
      importedIds.push(inserted.id)
      if (phone) contactableIds.push(inserted.id)
    }
  }

  await supabase
    .from('candidate_imports')
    .update({ success_rows: imported })
    .eq('id', batch.id)

  if (importedIds.length > 0) {
    await supabase.from('agent_tasks').insert([
      ...importedIds.map(candidate_id => ({
        company_id: COMPANY_ID,
        type: 'score',
        payload: { candidate_id },
      })),
      // Draft a first-contact message HR can review/edit and approve — only for
      // rows with a phone number, otherwise there's nothing to send it on yet.
      ...contactableIds.map(candidate_id => ({
        company_id: COMPANY_ID,
        type: 'draft_initial_outreach',
        payload: { candidate_id },
      })),
    ])
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    fetch(`${baseUrl}/api/agent/run`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
    }).catch(() => {})
  }

  return NextResponse.json({ imported, failed: rows.length - imported, batchId: batch.id })
}
