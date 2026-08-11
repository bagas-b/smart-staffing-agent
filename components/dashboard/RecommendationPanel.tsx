import Link from 'next/link'
import { TelegramBadge } from '@/components/shared/TelegramBadge'

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
  } | null
}

function TierBadge({ prob, confidence }: { prob: number; confidence?: string }) {
  const isLow = confidence === 'low'
  if (prob >= 70 && !isLow) return <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800">Prioritas</span>
  if (prob >= 40 && !isLow) return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">Pertimbangkan</span>
  return <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800">Perlu Review</span>
}

export function RecommendationPanel({ candidates }: { candidates: ScoredCandidate[] }) {
  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-5 py-3 border-b">
        <span className="font-medium text-sm text-gray-700">Rekomendasi Agent</span>
        <p className="text-xs text-gray-400 mt-0.5">Top kandidat berdasarkan skor AI</p>
      </div>

      <div className="divide-y max-h-72 overflow-y-auto">
        {candidates.map((c) => {
          const reasoning = c.scoring_reasoning
          return (
            <Link key={c.candidate_id} href={`/candidates/${c.candidate_id}`}
              className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{c.candidates?.name}</span>
                  <TierBadge prob={c.hire_success_probability} confidence={reasoning?.confidence} />
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
              </div>
            </Link>
          )
        })}

        {candidates.length === 0 && (
          <p className="p-4 text-sm text-gray-400">Belum ada kandidat yang di-score. Upload CSV untuk memulai.</p>
        )}
      </div>
    </div>
  )
}
