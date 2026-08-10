import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, MessageSquare } from 'lucide-react'

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
      .select('id, content, created_at, candidates(name, position)')
      .eq('company_id', companyId)
      .eq('direction', 'draft')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    reviewTasks: reviewTasksRes.data ?? [],
    drafts: (draftsRes.data ?? []) as unknown as Array<{
      id: string
      content: string
      created_at: string
      candidates: { name: string; position: string | null } | null
    }>,
  }
}

const TYPE_LABELS: Record<string, string> = {
  score: 'Scoring perlu diperiksa',
  classify_reply: 'Balasan WA ambigu',
  draft_follow_up: 'Follow-up perlu review',
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
        {reviewTasks.map((task: { id: string; type: string; payload: unknown; created_at: string }) => (
          <Link key={task.id} href="/candidates"
            className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">{TYPE_LABELS[task.type] ?? task.type}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(task.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          </Link>
        ))}

        {drafts.map(draft => (
          <Link key={draft.id} href="/approval"
            className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
            <MessageSquare size={14} className="text-purple-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">
                {draft.candidates?.name ?? 'Kandidat'} — {draft.candidates?.position ?? '-'}
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{draft.content}</p>
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
