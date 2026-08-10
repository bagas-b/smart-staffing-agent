'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CandidateModal } from './CandidateModal'
import { AddCandidateModal } from './AddCandidateModal'
import { CandidateUploadForm } from './CandidateUploadForm'
import { Button } from '@/components/ui/button'
import { Plus, Send } from 'lucide-react'

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
  const [addingOpen, setAddingOpen] = useState(false)
  const [generatingOutreach, setGeneratingOutreach] = useState(false)
  const [outreachMessage, setOutreachMessage] = useState('')
  const selectedCandidate = selectedId ? candidates.find(c => c.id === selectedId) : null

  async function generateOutreach() {
    setGeneratingOutreach(true)
    setOutreachMessage('')
    try {
      const res = await fetch('/api/candidates/generate-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal generate outreach')

      const parts: string[] = []
      if (data.enqueued > 0) parts.push(`${data.enqueued} draft baru dibuat`)
      if (data.pending > 0 || data.processing > 0) parts.push(`${data.pending + data.processing} sedang diproses agent (coba klik lagi sebentar lagi kalau belum muncul)`)
      if (data.done > 0) parts.push(`${data.done} sudah pernah dibuatkan draft sebelumnya — cek riwayat pesan di kartu kandidatnya`)
      if (data.needs_review > 0) parts.push(`${data.needs_review} perlu direview manual`)
      if (data.failed > 0) parts.push(`${data.failed} gagal sebelumnya (cek Aktivitas Agent untuk detail error)`)

      setOutreachMessage(parts.length > 0 ? parts.join(' · ') + '.' : 'Tidak ada kandidat dengan nomor WA di kolom ini.')
      router.refresh()
    } catch (e: unknown) {
      setOutreachMessage(e instanceof Error ? e.message : 'Gagal generate outreach')
    } finally {
      setGeneratingOutreach(false)
    }
  }

  // Re-fetch server data on close (candidate status may have changed — hire,
  // scoring, message-driven classification) and drop any ?candidate= deep link
  // so a page refresh doesn't reopen the modal.
  function closeModal() {
    setSelectedId(null)
    router.replace('/candidates')
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-800">
          Kandidat <span className="text-gray-400 font-normal text-base">({candidates.length})</span>
        </h1>
        <div className="flex gap-2">
          <CandidateUploadForm />
          <Button onClick={() => setAddingOpen(true)} className="bg-[#1E3A2F] hover:bg-[#2d5242] gap-2">
            <Plus size={16} /> Tambah Kandidat
          </Button>
        </div>
      </div>

      {outreachMessage && (
        <p className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3">{outreachMessage}</p>
      )}

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
              {col.key === 'belum_dihubungi' && items.length > 0 && (
                <button
                  onClick={generateOutreach}
                  disabled={generatingOutreach}
                  title="Buat draft pesan pembuka untuk kandidat di kolom ini yang belum pernah di-draft-kan"
                  className="flex items-center justify-center gap-1.5 text-[11px] px-2 py-1.5 border border-t-0 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors disabled:opacity-50"
                >
                  <Send size={11} />
                  {generatingOutreach ? 'Memproses...' : 'Generate Outreach'}
                </button>
              )}

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

      {/* Modals */}
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
      <AddCandidateModal
        open={addingOpen}
        onClose={() => setAddingOpen(false)}
        onCreated={() => router.refresh()}
      />
    </>
  )
}
