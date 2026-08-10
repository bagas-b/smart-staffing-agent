'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CandidateModal } from './CandidateModal'

interface CandidateScore {
  hire_success_probability: number
  scoring_reasoning?: { confidence?: string } | null
}

interface Candidate {
  id: string
  name: string
  status: string
  position?: string | null
  outlet?: string | null
  candidate_scores?: Array<CandidateScore> | null
}

const PIPELINE = [
  { key: 'belum_dihubungi',      label: 'Belum Dihubungi',  color: 'bg-gray-100',   dot: 'bg-gray-400' },
  { key: 'menunggu_balasan',     label: 'Menunggu Balasan', color: 'bg-yellow-50',  dot: 'bg-yellow-400' },
  { key: 'tertarik',             label: 'Tertarik',          color: 'bg-blue-50',    dot: 'bg-blue-400' },
  { key: 'interview_dijadwalkan',label: 'Interview',         color: 'bg-purple-50',  dot: 'bg-purple-400' },
  { key: 'lulus_interview',      label: 'Lulus',             color: 'bg-green-50',   dot: 'bg-green-400' },
  { key: 'onboarding',           label: 'Onboarding',        color: 'bg-teal-50',    dot: 'bg-teal-400' },
  { key: 'aktif',                label: 'Aktif',             color: 'bg-emerald-50', dot: 'bg-emerald-400' },
]

function TierBadge({ score }: { score: CandidateScore | undefined | null }) {
  if (!score) return null
  const prob = score.hire_success_probability
  const lowConf = score.scoring_reasoning?.confidence === 'low'
  if (prob >= 70 && !lowConf)
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium">Prioritas</span>
  if (prob >= 40 && !lowConf)
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-medium">Pertimbangkan</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">Review</span>
}

export function KanbanBoard({ candidates, initialCandidateId }: { candidates: Candidate[]; initialCandidateId?: string }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(initialCandidateId ?? null)
  const selectedCandidate = selectedId ? candidates.find(c => c.id === selectedId) : null

  // Re-fetch server data on close (candidate status may have changed — hire,
  // scoring, message-driven classification) and drop any ?candidate= deep link
  // so a page refresh doesn't reopen the modal.
  function closeModal() {
    setSelectedId(null)
    router.replace('/candidates')
  }

  return (
    <>
      {/* Board — columns stretch to fill available width, scroll horizontally only when they don't fit */}
      <div className="flex gap-3 overflow-x-auto pb-3 min-h-0" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {PIPELINE.map(col => {
          const items = candidates.filter(c => c.status === col.key)
          return (
            <div key={col.key} className="flex flex-col flex-1 basis-0 min-w-44">
              {/* Column header */}
              <div className={`rounded-t-lg px-3 py-2 ${col.color} border border-b-0 flex items-center gap-2`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
                <span className="text-xs font-semibold text-gray-700 truncate">{col.label}</span>
                <span className="ml-auto text-xs text-gray-400 font-normal flex-shrink-0">{items.length}</span>
              </div>

              {/* Card list — scrolls vertically */}
              <div className="flex-1 overflow-y-auto border rounded-b-lg bg-white p-1.5 space-y-1.5 min-h-20">
                {items.length === 0 && (
                  <div className="py-4 text-center text-[11px] text-gray-300 select-none">—</div>
                )}
                {items.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="w-full text-left p-2 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent rounded-md transition-colors cursor-pointer group"
                  >
                    <p className="text-xs font-medium text-gray-800 truncate group-hover:text-blue-800">
                      {c.name}
                    </p>
                    {c.position && (
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{c.position}</p>
                    )}
                    {c.outlet && (
                      <p className="text-[11px] text-gray-400 truncate">{c.outlet}</p>
                    )}
                    {c.candidate_scores?.[0] && (
                      <div className="mt-1">
                        <TierBadge score={c.candidate_scores[0]} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      <CandidateModal
        candidateId={selectedId}
        onClose={closeModal}
        snapshot={selectedCandidate ? {
          name: selectedCandidate.name,
          status: selectedCandidate.status,
          position: selectedCandidate.position,
          outlet: selectedCandidate.outlet,
        } : undefined}
      />
    </>
  )
}
