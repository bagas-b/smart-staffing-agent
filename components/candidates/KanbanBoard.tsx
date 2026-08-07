'use client'
import Link from 'next/link'

interface CandidateScore {
  hire_success_probability: number
  scoring_reasoning?: { confidence?: string } | null
}

interface Candidate {
  id: string
  name: string
  status: string
  position: string
  outlet: string
  candidate_scores?: Array<CandidateScore> | null
}

const PIPELINE = [
  { key: 'belum_dihubungi', label: 'Belum Dihubungi', color: 'bg-gray-100' },
  { key: 'menunggu_balasan', label: 'Menunggu Balasan', color: 'bg-yellow-50' },
  { key: 'tertarik', label: 'Tertarik', color: 'bg-blue-50' },
  { key: 'interview_dijadwalkan', label: 'Interview', color: 'bg-purple-50' },
  { key: 'lulus_interview', label: 'Lulus', color: 'bg-green-50' },
  { key: 'onboarding', label: 'Onboarding', color: 'bg-teal-50' },
  { key: 'aktif', label: 'Aktif', color: 'bg-emerald-50' },
]

function TierBadge({ score }: { score: CandidateScore | undefined | null }) {
  if (!score) return null
  const prob = score.hire_success_probability
  const lowConf = score.scoring_reasoning?.confidence === 'low'
  if (prob >= 70 && !lowConf) return <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800">Prioritas</span>
  if (prob >= 40 && !lowConf) return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">Pertimbangkan</span>
  return <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800">Perlu Review</span>
}

export function KanbanBoard({ candidates }: { candidates: Candidate[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE.map(col => {
        const items = candidates.filter(c => c.status === col.key)
        return (
          <div key={col.key} className="min-w-48 flex-shrink-0">
            <div className={`rounded-t-lg px-3 py-2 ${col.color} border border-b-0`}>
              <span className="text-xs font-semibold text-gray-600">{col.label}</span>
              <span className="ml-2 text-xs text-gray-400">({items.length})</span>
            </div>
            <div className="border rounded-b-lg min-h-32 space-y-2 p-2 bg-white">
              {items.map(c => (
                <Link key={c.id} href={`/candidates/${c.id}`}>
                  <div className="p-2 bg-gray-50 rounded text-xs hover:bg-gray-100 cursor-pointer">
                    <p className="font-medium text-gray-800 truncate">{c.name}</p>
                    {c.position && <p className="text-gray-500">{c.position}</p>}
                    {c.outlet && <p className="text-gray-400">{c.outlet}</p>}
                    <div className="mt-1">
                      <TierBadge score={c.candidate_scores?.[0]} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
