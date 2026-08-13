'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink, RefreshCw, Phone, Mail, User, MapPin, Briefcase } from 'lucide-react'
import { TelegramLinkStatus } from '@/components/shared/TelegramLinkStatus'
import { TelegramBadge } from '@/components/shared/TelegramBadge'
import { STATUS_LABELS, STATUS_COLOR } from '@/lib/candidates/status'
import { HireSection } from './HireSection'
import { InterviewSection } from './InterviewSection'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  id: string
  direction: string
  content: string
  created_at: string
  sent_by: string
  channel?: string
}

interface ScoreReasoning {
  strengths?: string[]
  concerns?: string[]
  recommendation?: string
  confidence?: string
}

interface Decision {
  id: string
  decision: 'lulus' | 'tidak_lulus'
  notes: string | null
  decided_at: string
}

interface Candidate {
  id: string
  name: string
  status: string
  position?: string | null
  outlet?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
  source?: string | null
  cv_url?: string | null
  telegram_chat_id?: string | null
  interview_scheduled_at?: string | null
  candidate_messages?: Message[]
  candidate_decisions?: Decision[]
  job_postings?: { id: string; title: string; position: string; outlet: string | null; status: string } | null
}

interface ScoreResult {
  cv_fit_score: number
  attrition_risk_score: number
  hire_success_probability: number
  confidence: string
  reasoning: ScoreReasoning
  cached: boolean
}

// ─── Score Section ────────────────────────────────────────────────────────────

function ScoreSection({ candidateId }: { candidateId: string }) {
  const [score, setScore] = useState<ScoreResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchScore = useCallback(async (force = false, onCancelled?: () => boolean) => {
    try {
      const res = await fetch('/api/ai/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: candidateId, force }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal mengambil skor')
      if (onCancelled?.()) return
      setScore(data)
      setError('')
    } catch (e: unknown) {
      if (onCancelled?.()) return
      setError((e as Error).message)
    } finally {
      if (!onCancelled?.()) setLoading(false)
    }
  }, [candidateId])

  // Manual refresh (button click) — resetting loading/error synchronously here is fine,
  // it's an event handler, not an effect.
  const refresh = useCallback(() => {
    setLoading(true)
    setError('')
    fetchScore(true)
  }, [fetchScore])

  useEffect(() => {
    let cancelled = false
    // Standard fetch-on-mount pattern (react.dev/learn/you-might-not-need-an-effect#fetching-data);
    // setState calls inside fetchScore only run after `await`, guarded by `cancelled`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchScore(false, () => cancelled)
    return () => { cancelled = true }
  }, [fetchScore])

  if (loading) {
    return (
      <div className="rounded-lg border bg-gray-50 p-4 flex items-center gap-2 text-sm text-gray-400">
        <RefreshCw size={13} className="animate-spin flex-shrink-0" />
        Menganalisis kandidat…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 p-3 space-y-2">
        <p className="text-xs text-red-600">Gagal memuat analisis: {error}</p>
        <Button size="sm" variant="outline" onClick={refresh} className="text-xs h-7">
          Coba Lagi
        </Button>
      </div>
    )
  }

  if (!score) return null

  const prob = score.hire_success_probability
  const tierLabel =
    prob >= 70 && score.confidence !== 'low' ? '🌟 Prioritas'
    : prob >= 40 && score.confidence !== 'low' ? '👀 Pertimbangkan'
    : '⚠ Perlu Review Manual'
  const tierColor =
    prob >= 70 && score.confidence !== 'low' ? 'bg-green-100 text-green-800'
    : prob >= 40 && score.confidence !== 'low' ? 'bg-yellow-100 text-yellow-800'
    : 'bg-red-100 text-red-700'

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
        <p className="text-xs font-semibold text-gray-700">Analisis AI</p>
        <div className="flex items-center gap-2">
          {score.cached && <span className="text-[11px] text-gray-400">(cache)</span>}
          <button
            onClick={refresh}
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh skor"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Score meters */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {([
            { val: score.cv_fit_score, label: 'CV Fit', color: '#1E3A2F' },
            { val: score.hire_success_probability, label: 'Prob. Hire', color: '#2563eb' },
            { val: score.attrition_risk_score, label: 'Risiko Attrisi', color: '#d97706' },
          ] as const).map(m => (
            <div key={m.label}>
              <p className="text-2xl font-bold" style={{ color: m.color }}>{m.val}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Tier */}
        <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-medium ${tierColor}`}>
          {tierLabel}
        </span>

        {/* Strengths */}
        {(score.reasoning.strengths?.length ?? 0) > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-600 mb-1">✅ Kekuatan</p>
            <ul className="space-y-0.5">
              {score.reasoning.strengths!.map((s, i) => (
                <li key={i} className="text-xs text-gray-600 pl-2 border-l-2 border-green-200">{s}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Concerns */}
        {(score.reasoning.concerns?.length ?? 0) > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-600 mb-1">💬 Pertanyaan untuk Interview</p>
            <ul className="space-y-0.5">
              {score.reasoning.concerns!.map((c, i) => (
                <li key={i} className="text-xs text-gray-600 pl-2 border-l-2 border-yellow-200">{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendation */}
        {score.reasoning.recommendation && (
          <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
            <p className="text-[11px] font-semibold text-blue-700 mb-0.5">📋 Rekomendasi</p>
            <p className="text-xs text-blue-700">{score.reasoning.recommendation}</p>
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          * Skor attrisi hanya catatan HR, bukan penentu reject otomatis.
        </p>
      </div>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export interface CandidateSnapshot {
  name: string
  status: string
  position?: string | null
  outlet?: string | null
}

interface CandidateModalProps {
  candidateId: string | null
  onClose: () => void
  snapshot?: CandidateSnapshot
}

export function CandidateModal({ candidateId, onClose, snapshot }: CandidateModalProps) {
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  // Derived rather than a separately-tracked flag: still fetching whenever the loaded
  // candidate doesn't match the one currently requested.
  const fetching = !!candidateId && candidate?.id !== candidateId

  const refetchCandidate = useCallback(() => {
    if (!candidateId) return
    fetch(`/api/candidates/${candidateId}`)
      .then(r => r.json())
      .then(data => setCandidate(data))
      .catch(() => {})
  }, [candidateId])

  useEffect(() => { refetchCandidate() }, [refetchCandidate])

  const open = !!candidateId
  // Only trust `candidate` once it actually matches the requested id — otherwise it's
  // stale data left over from whichever candidate was open before.
  const current = candidate?.id === candidateId ? candidate : null

  const name     = current?.name     ?? snapshot?.name     ?? '…'
  const status   = current?.status   ?? snapshot?.status   ?? ''
  const position = current?.position ?? snapshot?.position
  const outlet   = current?.outlet   ?? snapshot?.outlet

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      {/* Override default sm:max-w-sm to get a wider modal */}
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl w-full !p-0 !gap-0 overflow-hidden"
      >
        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b gap-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold text-gray-900 leading-snug truncate">
                {name}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {status && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[status] ?? status}
                  </span>
                )}
                {current?.telegram_chat_id && <TelegramBadge />}
                {position && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Briefcase size={11} /> {position}
                  </span>
                )}
                {outlet && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={11} /> {outlet}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              {candidateId && (
                <Link
                  href={`/candidates/${candidateId}`}
                  className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                >
                  <ExternalLink size={11} /> Buka Penuh
                </Link>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Tutup"
              >
                <span className="text-sm leading-none">✕</span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto px-5 py-4 space-y-4" style={{ maxHeight: '68vh' }}>

          {/* Contact strip */}
          {(current?.phone || current?.email || current?.source) && (
            <div className="flex flex-wrap gap-3 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              {current.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={11} className="text-gray-400" /> {current.phone}
                </span>
              )}
              {current.email && (
                <span className="flex items-center gap-1">
                  <Mail size={11} className="text-gray-400" /> {current.email}
                </span>
              )}
              {current.source && (
                <span className="flex items-center gap-1">
                  <User size={11} className="text-gray-400" /> Sumber: {current.source}
                </span>
              )}
              {current.cv_url && (
                <a href={current.cv_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline">
                  <ExternalLink size={11} /> CV
                </a>
              )}
            </div>
          )}

          {/* Telegram link status */}
          {current && (
            <TelegramLinkStatus candidateId={current.id} linked={!!current.telegram_chat_id} />
          )}

          {/* Applied job */}
          {current?.job_postings && (
            <Link
              href={`/jobs/${current.job_postings.id}`}
              className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 hover:bg-indigo-100 transition-colors"
            >
              <Briefcase size={12} className="text-indigo-500 flex-shrink-0" />
              <span className="text-indigo-700">
                Melamar untuk <span className="font-semibold">{current.job_postings.title}</span>
              </span>
              <ExternalLink size={11} className="text-indigo-400 ml-auto flex-shrink-0" />
            </Link>
          )}

          {/* Notes */}
          {current?.notes && (
            <div className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <span className="font-semibold text-amber-700">Catatan HR: </span>
              <span className="text-gray-700">{current.notes}</span>
            </div>
          )}

          {/* Interview scheduling & decision */}
          {!fetching && current && (
            <InterviewSection
              candidateId={current.id}
              status={current.status}
              interviewScheduledAt={current.interview_scheduled_at ?? null}
              decisions={current.candidate_decisions ?? []}
              messages={current.candidate_messages ?? []}
              onChanged={refetchCandidate}
            />
          )}

          {/* Onboarding & Performance */}
          {!fetching && current && <HireSection candidateId={current.id} status={current.status} />}

          {/* AI Analysis */}
          {!fetching && candidateId && <ScoreSection candidateId={candidateId} />}
          {fetching && (
            <div className="rounded-lg border bg-gray-50 p-4 animate-pulse h-24" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
