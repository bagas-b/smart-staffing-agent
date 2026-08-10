'use client'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Star } from 'lucide-react'

interface Performance {
  id: string
  day_1_checkin: boolean
  day_7_status: string | null
  day_30_status: string | null
  performance_rating: number | null
  resign_date: string | null
  resign_reason: string | null
  mentor_feedback: string | null
}

interface HireRecord {
  id: string
  hired_date: string | null
  start_date: string | null
  first_day_attended: boolean
  notes: string | null
  candidate_performance: Performance[] | null
}

const DAY7_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'no_show', label: 'Tidak Hadir' },
  { value: 'absent', label: 'Absen' },
]
const DAY30_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'resigned', label: 'Resign' },
  { value: 'terminated', label: 'Diberhentikan' },
]

// ─── "Tandai Direkrut" form ────────────────────────────────────────────────────

function MarkHiredForm({ candidateId, onDone }: { candidateId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [hiredDate, setHiredDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/candidates/${candidateId}/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hired_date: hiredDate || null, start_date: startDate || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menandai direkrut')
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menandai direkrut')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className="bg-[#1E3A2F] hover:bg-[#2d5242] gap-1.5 w-full">
        <CheckCircle2 size={14} /> Tandai Direkrut
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-lg border bg-gray-50 p-3 space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-gray-500">Tanggal Direkrut</Label>
          <Input type="date" value={hiredDate} onChange={e => setHiredDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-gray-500">Tanggal Mulai Kerja</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="bg-[#1E3A2F] hover:bg-[#2d5242]">
          {saving ? 'Menyimpan...' : 'Simpan'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
      </div>
    </form>
  )
}

// ─── Onboarding & performance update form ─────────────────────────────────────

function PerformanceForm({ candidateId, hire, onSaved }: { candidateId: string; hire: HireRecord; onSaved: () => void }) {
  const perf = hire.candidate_performance?.[0]
  const [firstDay, setFirstDay] = useState(hire.first_day_attended)
  const [day7, setDay7] = useState(perf?.day_7_status ?? '')
  const [day30, setDay30] = useState(perf?.day_30_status ?? '')
  const [rating, setRating] = useState(perf?.performance_rating ?? 0)
  const [resignReason, setResignReason] = useState(perf?.resign_reason ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const showResign = day30 === 'resigned' || day30 === 'terminated'

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/candidates/${candidateId}/hire`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_day_attended: firstDay,
          day_1_checkin: firstDay,
          day_7_status: day7 || null,
          day_30_status: day30 || null,
          performance_rating: rating || null,
          resign_reason: showResign ? resignReason : null,
          resign_date: showResign ? new Date().toISOString().slice(0, 10) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menyimpan')
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b">
        <p className="text-xs font-semibold text-gray-700">Onboarding & Performa</p>
        {(hire.hired_date || hire.start_date) && (
          <p className="text-[11px] text-gray-400 mt-0.5">
            {hire.hired_date && `Direkrut: ${new Date(hire.hired_date).toLocaleDateString('id-ID')}`}
            {hire.hired_date && hire.start_date && ' · '}
            {hire.start_date && `Mulai: ${new Date(hire.start_date).toLocaleDateString('id-ID')}`}
          </p>
        )}
      </div>

      <div className="p-3 space-y-3">
        {error && <p className="text-xs text-red-600">{error}</p>}

        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={firstDay} onChange={e => setFirstDay(e.target.checked)} className="rounded" />
          Masuk hari pertama
        </label>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-gray-500">Status Hari-7</Label>
            <select
              value={day7}
              onChange={e => setDay7(e.target.value)}
              className="w-full h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">—</option>
              {DAY7_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-gray-500">Status Hari-30</Label>
            <select
              value={day30}
              onChange={e => setDay30(e.target.value)}
              className="w-full h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">—</option>
              {DAY30_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {showResign && (
          <div className="space-y-1">
            <Label className="text-[11px] text-gray-500">Alasan {day30 === 'resigned' ? 'Resign' : 'Diberhentikan'}</Label>
            <Input value={resignReason} onChange={e => setResignReason(e.target.value)} placeholder="Alasan singkat..." />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-[11px] text-gray-500">Rating Performa</Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)}>
                <Star size={16} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
              </button>
            ))}
          </div>
        </div>

        <Button size="sm" onClick={save} disabled={saving} className="bg-[#1E3A2F] hover:bg-[#2d5242]">
          {saving ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>
    </div>
  )
}

// ─── Main section ───────────────────────────────────────────────────────────────

export function HireSection({ candidateId }: { candidateId: string }) {
  const [hire, setHire] = useState<HireRecord | null | undefined>(undefined) // undefined = loading
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/candidates/${candidateId}/hire`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setHire(data.hire_record ?? null) })
      .catch(() => { if (!cancelled) setHire(null) })
    return () => { cancelled = true }
  }, [candidateId, refreshKey])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  if (hire === undefined) return null // still loading — don't flash the "mark hired" prompt

  if (!hire) {
    return <MarkHiredForm candidateId={candidateId} onDone={refresh} />
  }

  return <PerformanceForm candidateId={candidateId} hire={hire} onSaved={refresh} />
}
