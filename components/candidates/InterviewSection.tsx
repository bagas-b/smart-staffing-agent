'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CalendarClock, CheckCircle2, XCircle, MessageSquare, ChevronDown, ChevronUp, Send, Loader2 } from 'lucide-react'
import { MessageBubble } from '@/components/shared/MessageBubble'
import type { Message } from './CandidateModal'

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
  messages: Message[]
  onChanged: () => void
}

interface DraftResult { id: string; content: string; channel: string }

function ScheduleForm({ candidateId, onScheduled }: { candidateId: string; onScheduled: () => void }) {
  const [step, setStep] = useState<'closed' | 'form' | 'confirming'>('closed')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [draft, setDraft] = useState<DraftResult | null>(null)
  const [warning, setWarning] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !time) { setError('Isi tanggal & waktu dulu'); return }
    setSaving(true)
    setError('')
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString()
      const res = await fetch(`/api/candidates/${candidateId}/schedule-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt, location: location.trim(), notes: notes.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menjadwalkan interview')
      setDraft(data.draft ?? null)
      setWarning(data.warning ?? '')
      setStep('confirming')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menjadwalkan interview')
    } finally {
      setSaving(false)
    }
  }

  async function sendNow() {
    if (!draft) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/approval/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal mengirim pesan')
      onScheduled()
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Gagal mengirim pesan')
    } finally {
      setSending(false)
    }
  }

  if (step === 'closed') {
    return (
      <Button size="sm" onClick={() => setStep('form')} className="bg-[#1E3A2F] hover:bg-[#2d5242] gap-1.5 w-full">
        <CalendarClock size={14} /> Jadwalkan Interview
      </Button>
    )
  }

  if (step === 'confirming') {
    return (
      <div className="rounded-lg border bg-gray-50 p-3 space-y-2">
        <p className="text-xs font-medium text-gray-700">Jadwal tersimpan.</p>
        {warning && <p className="text-xs text-amber-600">{warning}</p>}
        {draft && (
          <>
            <div className="rounded-lg border bg-white p-2.5">
              <p className="text-[10px] text-gray-400 mb-1">Draft undangan ({draft.channel === 'telegram' ? 'Telegram' : 'WA'}) — bisa diedit dulu di halaman Approval kalau perlu:</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{draft.content}</p>
            </div>
            {sendError && <p className="text-xs text-red-600">{sendError}</p>}
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={sending} onClick={sendNow} className="gap-1.5 flex-1 bg-[#1E3A2F] hover:bg-[#2d5242]">
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {sending ? 'Mengirim...' : 'Kirim Sekarang'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onScheduled}>Nanti di Approval</Button>
            </div>
          </>
        )}
        {!draft && (
          <Button type="button" size="sm" variant="outline" onClick={onScheduled} className="w-full">Tutup</Button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-lg border bg-gray-50 p-3 space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <input
        type="text"
        value={location}
        onChange={e => setLocation(e.target.value)}
        placeholder="Lokasi (opsional) — misal: Outlet Greenly Sudirman"
        className="w-full h-8 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        placeholder="Catatan (opsional) — akan disertakan sebagai konteks untuk draft undangan..."
        className="w-full rounded-lg border border-input bg-white px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
      />
      <p className="text-[11px] text-gray-400">
        Setelah disimpan, agent langsung bikin draft undangan di sini — tinggal review & kirim.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="bg-[#1E3A2F] hover:bg-[#2d5242]">
          {saving ? 'Menyiapkan draft...' : 'Jadwalkan'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setStep('closed')}>Batal</Button>
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

export function InterviewSection({ candidateId, status, interviewScheduledAt, decisions, messages, onChanged }: InterviewSectionProps) {
  // Hooks must run unconditionally, before the early-return below.
  const [showMessages, setShowMessages] = useState(false)

  // Nothing to show until the candidate has expressed interest — avoid
  // cluttering the modal for every candidate regardless of stage.
  const relevantStages = ['tertarik', 'interview_dijadwalkan', 'lulus_interview', 'tidak_lulus']
  if (!relevantStages.includes(status) && decisions.length === 0 && !interviewScheduledAt) return null

  const latestDecision = [...decisions].sort((a, b) => new Date(b.decided_at).getTime() - new Date(a.decided_at).getTime())[0]
  const sortedMessages = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b">
        <p className="text-xs font-semibold text-gray-700">Interview</p>
      </div>
      <div className="p-3 space-y-2">
        {interviewScheduledAt && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-600 flex items-center gap-1.5">
              <CalendarClock size={12} className="text-gray-400" />
              {new Date(interviewScheduledAt).toLocaleString('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })} WIB
            </p>
            <button
              type="button"
              onClick={() => setShowMessages(v => !v)}
              className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <MessageSquare size={11} />
              Lihat Pesan
              {showMessages ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>
        )}

        {interviewScheduledAt && showMessages && (
          <div className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b">
              <p className="text-xs font-semibold text-gray-700">
                Riwayat Pesan
                <span className="ml-1.5 font-normal text-gray-400">({sortedMessages.length})</span>
              </p>
            </div>
            <div className="p-3 space-y-2 max-h-48 overflow-y-auto bg-white">
              {sortedMessages.length > 0
                ? sortedMessages.map(m => (
                    <MessageBubble key={m.id} direction={m.direction} content={m.content} created_at={m.created_at} channel={m.channel} />
                  ))
                : <p className="text-xs text-gray-400 text-center py-1">Belum ada riwayat pesan.</p>}
            </div>
          </div>
        )}

        {/* Covers both a fresh 'tertarik' candidate and one the agent already
            moved into 'interview_dijadwalkan' off a chat confirmation
            (status set, but no actual date/time picked yet). */}
        {(status === 'tertarik' || status === 'interview_dijadwalkan') && !interviewScheduledAt && (
          <ScheduleForm candidateId={candidateId} onScheduled={onChanged} />
        )}

        {/* Decision only makes sense once an interview actually happened —
            gate on a real date, not just the status, since status alone can
            now mean "agreed to interview" with nothing scheduled yet. */}
        {status === 'interview_dijadwalkan' && interviewScheduledAt && (
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
