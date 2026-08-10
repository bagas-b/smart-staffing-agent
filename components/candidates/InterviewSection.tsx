'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CalendarClock, CheckCircle2, XCircle } from 'lucide-react'

interface Decision {
  id: string
  decision: 'lulus' | 'tidak_lulus'
  notes: string | null
  decided_at: string
}

interface InterviewSectionProps {
  candidateId: string
  status: string
  interviewScheduledAt: string | null
  decisions: Decision[]
  onChanged: () => void
}

function ScheduleForm({ candidateId, onScheduled }: { candidateId: string; onScheduled: () => void }) {
  const [open, setOpen] = useState(false)
  const [datetime, setDatetime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!datetime) { setError('Pilih tanggal & jam dulu'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/candidates/${candidateId}/schedule-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: new Date(datetime).toISOString() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menjadwalkan interview')
      onScheduled()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menjadwalkan interview')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className="bg-[#1E3A2F] hover:bg-[#2d5242] gap-1.5 w-full">
        <CalendarClock size={14} /> Jadwalkan Interview
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-lg border bg-gray-50 p-3 space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        type="datetime-local"
        value={datetime}
        onChange={e => setDatetime(e.target.value)}
        className="w-full h-8 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <p className="text-[11px] text-gray-400">
        Setelah dijadwalkan, agent otomatis bikin draft undangan interview — cek di menu Approval.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="bg-[#1E3A2F] hover:bg-[#2d5242]">
          {saving ? 'Menyimpan...' : 'Jadwalkan'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
      </div>
    </form>
  )
}

function DecisionForm({ candidateId, onDecided }: { candidateId: string; onDecided: () => void }) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState<'lulus' | 'tidak_lulus' | null>(null)
  const [error, setError] = useState('')

  async function submit(decision: 'lulus' | 'tidak_lulus') {
    setSaving(decision)
    setError('')
    try {
      const res = await fetch(`/api/candidates/${candidateId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: notes.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menyimpan keputusan')
      onDecided()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan keputusan')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        placeholder="Catatan hasil interview (opsional)..."
        className="w-full rounded-lg border border-input bg-white px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!!saving}
          onClick={() => submit('tidak_lulus')}
          variant="destructive"
          className="gap-1.5 flex-1"
        >
          <XCircle size={13} /> {saving === 'tidak_lulus' ? 'Menyimpan...' : 'Tidak Lulus'}
        </Button>
        <Button
          size="sm"
          disabled={!!saving}
          onClick={() => submit('lulus')}
          className="gap-1.5 flex-1 bg-[#1E3A2F] hover:bg-[#2d5242]"
        >
          <CheckCircle2 size={13} /> {saving === 'lulus' ? 'Menyimpan...' : 'Lulus'}
        </Button>
      </div>
    </div>
  )
}

export function InterviewSection({ candidateId, status, interviewScheduledAt, decisions, onChanged }: InterviewSectionProps) {
  // Nothing to show until the candidate has expressed interest — avoid
  // cluttering the modal for every candidate regardless of stage.
  const relevantStages = ['tertarik', 'interview_dijadwalkan', 'lulus_interview', 'tidak_lulus']
  if (!relevantStages.includes(status) && decisions.length === 0 && !interviewScheduledAt) return null

  const latestDecision = [...decisions].sort((a, b) => new Date(b.decided_at).getTime() - new Date(a.decided_at).getTime())[0]

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b">
        <p className="text-xs font-semibold text-gray-700">Interview</p>
      </div>
      <div className="p-3 space-y-2">
        {interviewScheduledAt && (
          <p className="text-xs text-gray-600 flex items-center gap-1.5">
            <CalendarClock size={12} className="text-gray-400" />
            {new Date(interviewScheduledAt).toLocaleString('id-ID', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })} WIB
          </p>
        )}

        {status === 'tertarik' && !interviewScheduledAt && (
          <ScheduleForm candidateId={candidateId} onScheduled={onChanged} />
        )}

        {status === 'interview_dijadwalkan' && (
          <DecisionForm candidateId={candidateId} onDecided={onChanged} />
        )}

        {latestDecision && (
          <div className={`rounded-md px-2.5 py-2 text-xs ${
            latestDecision.decision === 'lulus' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            <p className="font-medium flex items-center gap-1.5">
              {latestDecision.decision === 'lulus' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {latestDecision.decision === 'lulus' ? 'Lulus Interview' : 'Tidak Lulus'}
              <span className="font-normal text-[10px] opacity-70 ml-auto">
                {new Date(latestDecision.decided_at).toLocaleDateString('id-ID')}
              </span>
            </p>
            {latestDecision.notes && <p className="mt-1 opacity-90">{latestDecision.notes}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
