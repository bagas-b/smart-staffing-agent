import { createServiceClient } from '@/lib/supabase/server'
import { ApprovalQueue } from '@/components/approval/ApprovalQueue'

async function getDrafts() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('candidate_messages')
    .select('id, content, channel, created_at, candidate_id, candidates(name, position, outlet)')
    .eq('company_id', process.env.COMPANY_ID!)
    .eq('direction', 'draft')
    .order('created_at', { ascending: true })

  // Supabase's untyped client infers the to-one `candidates` embed as an array;
  // at runtime it's a single object (candidate_messages.candidate_id -> candidates.id
  // is many-to-one). Normalize defensively so it matches ApprovalQueue's Draft type.
  return (data ?? []).map(row => ({
    ...row,
    candidates: Array.isArray(row.candidates) ? row.candidates[0] ?? null : row.candidates,
  }))
}

export default async function ApprovalPage() {
  const drafts = await getDrafts()
  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-semibold text-gray-800">
        Antrean Persetujuan{' '}
        <span className="text-gray-400 font-normal text-base">({drafts.length})</span>
      </h1>
      <ApprovalQueue drafts={drafts} />
    </div>
  )
}
