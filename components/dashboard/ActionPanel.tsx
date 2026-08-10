import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, MessageSquare } from 'lucide-react'

interface ReviewTask {
  id: string
  type: string
  payload: { candidate_id?: string }
  created_at: string
}

async function getActionItems() {
  const supabase = createServiceClient()
  const companyId = process.env.COMPANY_ID!

  const [reviewTasksRes, draftsRes] = await Promise.all([
    supabase
      .from('agent_tasks')
      .select('id, type, payload, created_at')
      .eq('company_id', companyId)
      .eq('status', 'needs_review')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('candidate_messages')
      .select('id, content, created_at, candidate_id, candidates(name, position)')
      .eq('company_id', companyId)
      .eq('direction', 'draft')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const reviewTasks = (reviewTasksRes.data ?? []) as ReviewTask[]

  // agent_tasks.payload is jsonb (no FK join possible) — batch-fetch candidate
  // names separately so "Butuh Tindakan HR" can say who, not just what.
  const candidateIds = [...new Set(reviewTasks.map(t => t.payload?.candidate_id).filter(Boolean))] as string[]
  const { data: candidatesData } = candidateIds.length > 0
    ? await supabase.from('candidates').select('id, name').in('id', candidateIds).eq('company_id', companyId)
    : { data: [] }
  const candidateNames = new Map((candidatesData ?? []).map(c => [c.id, c.name]))

  return {
    reviewTasks: reviewTasks.map(t => ({
      ...t,
      candidateId: t.payload?.candidate_id ?? null,
      candidateName: t.payload?.candidate_id ? candidateNames.get(t.payload.candidate_id) ?? null : null,
    })),
    drafts: (draftsRes.data ?? []) as unknown as Array<{
      id: string
      content: string
      created_at: string
      candidate_id: string
      candidates: { name: string; position: string | null } | null
    }>,
  }
}

const TYPE_LABELS: Record<string, string> = {
  score: 'Skor AI perlu diperiksa (confidence rendah)',
  classify_reply: 'Balasan kandidat ambigu, perlu diklasifikasi manual',
  draft_follow_up: 'Follow-up perlu direview',
  unmatched_email: 'Email lamaran tidak cocok dengan lowongan manapun',
}

export async function ActionPanel() {
  const { reviewTasks, drafts } = await getActionItems()
  const totalActions = reviewTasks.length + drafts.length

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
          <Link
            key={task.id}
            href={task.candidateId ? `/candidates?candidate=${task.candidateId}` : '/candidates'}
            className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors"
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
          </Link>
        ))}

        {drafts.map(draft => (
          <Link key={draft.id} href={`/candidates?candidate=${draft.candidate_id}`}
            className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
            <MessageSquare size={14} className="text-purple-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {draft.candidates?.name ?? 'Kandidat'} — {draft.candidates?.position ?? '-'}
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{draft.content}</p>
              <p className="text-xs text-gray-400 mt-0.5">Draft menunggu approval</p>
            </div>
          </Link>
        ))}

        {totalActions === 0 && (
          <p className="p-4 text-sm text-gray-400">Tidak ada tindakan yang perlu dilakukan.</p>
        )}
      </div>
    </div>
  )
}
