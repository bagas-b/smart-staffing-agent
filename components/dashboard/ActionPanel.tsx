'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, MessageSquare } from 'lucide-react'
import { CandidateModal } from '@/components/candidates/CandidateModal'

export interface ReviewTaskItem {
  id: string
  type: string
  created_at: string
  candidateId: string | null
  candidateName: string | null
}

export interface DraftItem {
  id: string
  content: string
  created_at: string
  candidate_id: string
  candidates: { name: string; position: string | null } | null
}

const TYPE_LABELS: Record<string, string> = {
  score: 'Skor AI perlu diperiksa (confidence rendah)',
  classify_reply: 'Balasan kandidat ambigu, perlu diklasifikasi manual',
  draft_follow_up: 'Follow-up perlu direview',
  unmatched_email: 'Email lamaran tidak cocok dengan lowongan manapun',
}

export function ActionPanel({ reviewTasks, drafts }: { reviewTasks: ReviewTaskItem[]; drafts: DraftItem[] }) {
  const router = useRouter()
  const totalActions = reviewTasks.length + drafts.length
  const [selectedId, setSelectedId] = useState<string | null>(null)

  function closeModal() {
    setSelectedId(null)
    // Picks up any status/score change made from inside the modal without a
    // full page navigation.
    router.refresh()
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-5 py-3 border-b flex items-center justify-between">
        <span className="font-medium text-sm text-gray-700">Butuh Tindakan HR</span>
        {totalActions > 0 && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
            {totalActions}
          </span>
        )}
      </div>

      <div className="divide-y max-h-72 overflow-y-auto">
        {reviewTasks.map(task => (
          task.candidateId ? (
            <button
              key={task.id}
              type="button"
              onClick={() => setSelectedId(task.candidateId)}
              className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors w-full text-left"
            >
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {task.candidateName ?? 'Kandidat tidak diketahui'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{TYPE_LABELS[task.type] ?? task.type}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(task.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </button>
          ) : (
            // No specific candidate to open a modal for — fall back to the full list.
            <Link
              key={task.id}
              href="/candidates"
              className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors"
            >
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">Kandidat tidak diketahui</p>
                <p className="text-xs text-gray-500 mt-0.5">{TYPE_LABELS[task.type] ?? task.type}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(task.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </Link>
          )
        ))}

        {drafts.map(draft => (
          <button
            key={draft.id}
            type="button"
            onClick={() => setSelectedId(draft.candidate_id)}
            className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors w-full text-left"
          >
            <MessageSquare size={14} className="text-purple-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {draft.candidates?.name ?? 'Kandidat'} — {draft.candidates?.position ?? '-'}
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{draft.content}</p>
              <p className="text-xs text-gray-400 mt-0.5">Draft menunggu approval</p>
            </div>
          </button>
        ))}

        {totalActions === 0 && (
          <p className="p-4 text-sm text-gray-400">Tidak ada tindakan yang perlu dilakukan.</p>
        )}
      </div>

      <CandidateModal candidateId={selectedId} onClose={closeModal} />
    </div>
  )
}
