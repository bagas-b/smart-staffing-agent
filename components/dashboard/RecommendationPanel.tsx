'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TelegramBadge } from '@/components/shared/TelegramBadge'
import { STATUS_LABELS, STATUS_COLOR } from '@/lib/candidates/status'

export type ScoredCandidate = {
  candidate_id: string
  hire_success_probability: number
  cv_fit_score: number
  scoring_reasoning: {
    recommendation?: string
    strengths?: string[]
    confidence?: string
  } | null
  candidates: {
    id: string
    name: string
    position: string | null
    outlet: string | null
    telegram_chat_id: string | null
    status: string | null
  } | null
}

function TierBadge({ prob, confidence }: { prob: number; confidence?: string }) {
  const isLow = confidence === 'low'
  if (prob >= 70 && !isLow) return <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800">Prioritas</span>
  if (prob >= 40 && !isLow) return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">Pertimbangkan</span>
  return <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800">Perlu Review</span>
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

async function triggerFollowUp(ids: string[]) {
  const res = await fetch('/api/candidates/follow-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Gagal membuat draft follow-up')
  return data as { enqueued: number; alreadyQueued: number }
}

export function RecommendationPanel({ candidates }: { candidates: ScoredCandidate[] }) {
  const router = useRouter()
  const [bulkBusy, setBulkBusy] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  function describe(data: { enqueued: number; alreadyQueued: number }) {
    const parts: string[] = []
    if (data.enqueued > 0) parts.push(`${data.enqueued} draft pesan sedang disiapkan agent — cek halaman Approval sebentar lagi`)
    if (data.alreadyQueued > 0) parts.push(`${data.alreadyQueued} kandidat sudah punya draft yang masih diproses`)
    return parts.length > 0 ? parts.join(' · ') + '.' : 'Tidak ada kandidat yang perlu di-follow-up.'
  }

  async function handleBulkFollowUp() {
    setBulkBusy(true)
    setFeedback(null)
    try {
      const data = await triggerFollowUp(candidates.map(c => c.candidate_id))
      setFeedback(describe(data))
      router.refresh()
    } catch (e: unknown) {
      setFeedback(e instanceof Error ? e.message : 'Gagal membuat draft follow-up')
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleRowFollowUp(id: string) {
    setRowBusyId(id)
    setFeedback(null)
    try {
      const data = await triggerFollowUp([id])
      setFeedback(describe(data))
      router.refresh()
    } catch (e: unknown) {
      setFeedback(e instanceof Error ? e.message : 'Gagal membuat draft follow-up')
    } finally {
      setRowBusyId(null)
    }
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-5 py-3 border-b flex items-center justify-between gap-3">
        <div>
          <span className="font-medium text-sm text-gray-700">Rekomendasi Agent</span>
          <p className="text-xs text-gray-400 mt-0.5">Top kandidat berdasarkan skor AI</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={bulkBusy || candidates.length === 0}
          onClick={handleBulkFollowUp}
          title="Buat draft pesan follow-up untuk semua kandidat yang direkomendasikan di panel ini"
        >
          {bulkBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Follow Up Kandidat
        </Button>
      </div>

      {feedback && (
        <p className="px-5 py-2 text-xs text-blue-700 bg-blue-50 border-b">{feedback}</p>
      )}

      <div className="divide-y max-h-72 overflow-y-auto">
        {candidates.map((c) => {
          const reasoning = c.scoring_reasoning
          const isRowBusy = rowBusyId === c.candidate_id
          return (
            <div key={c.candidate_id} className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
              <Link href={`/candidates/${c.candidate_id}`} className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{c.candidates?.name}</span>
                  <TierBadge prob={c.hire_success_probability} confidence={reasoning?.confidence} />
                  <StatusBadge status={c.candidates?.status ?? null} />
                  {c.candidates?.telegram_chat_id && <TelegramBadge />}
                </div>
                <p className="text-xs text-gray-500">
                  {c.candidates?.position ?? '-'} · {c.candidates?.outlet ?? '-'} · Skor: {c.hire_success_probability}
                </p>
                {reasoning?.recommendation && (
                  <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 line-clamp-2">
                    {reasoning.recommendation}
                  </p>
                )}
              </Link>
              <button
                type="button"
                disabled={isRowBusy}
                onClick={() => handleRowFollowUp(c.candidate_id)}
                title="Follow up kandidat ini"
                className="shrink-0 mt-0.5 flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 transition-colors"
              >
                {isRowBusy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Follow Up
              </button>
            </div>
          )
        })}

        {candidates.length === 0 && (
          <p className="p-4 text-sm text-gray-400">Belum ada kandidat yang di-score. Upload CSV untuk memulai.</p>
        )}
      </div>
    </div>
  )
}
