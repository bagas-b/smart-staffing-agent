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

/**
 * XLSX.read(buffer, { type: 'buffer' })'s CSV auto-detection doesn't reliably
 * respect RFC4180 quoting — a quoted field containing a comma (e.g. a notes
 * column like `"5 tahun pengalaman, terbiasa shift malam"`) gets split on
 * that inner comma instead of treated as one field, silently corrupting every
 * column after it. Parsing CSV text ourselves sidesteps that entirely; XLSX
 * is still used for real .xlsx/.xls binary files below.
 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // Normalize line endings, strip a leading UTF-8 BOM if present.
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } // escaped quote
        else inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += ch
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }

  const [header, ...dataRows] = rows.filter(r => r.some(cell => cell.trim() !== ''))
  if (!header) return []
  return dataRows.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
  const jobPostingId = (formData.get('job_posting_id') as string | null) || null

  const buffer = Buffer.from(await file.arrayBuffer())
  let rows: Record<string, unknown>[]
  if (file.name.toLowerCase().endsWith('.csv')) {
    rows = parseCsv(buffer.toString('utf-8'))
  } else {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
  }

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
