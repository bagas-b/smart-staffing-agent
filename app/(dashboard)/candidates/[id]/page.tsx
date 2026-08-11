import { createServiceClient } from '@/lib/supabase/server'
import { MessageHistory } from '@/components/candidates/MessageHistory'
import { Badge } from '@/components/ui/badge'
import { notFound } from 'next/navigation'
import { ScoreCard } from '@/components/candidates/ScoreCard'
import { TelegramBadge } from '@/components/shared/TelegramBadge'

const STATUS_LABELS: Record<string, string> = {
  belum_dihubungi: 'Belum Dihubungi',
  menunggu_balasan: 'Menunggu Balasan',
  tertarik: 'Tertarik',
  butuh_info: 'Butuh Info',
  tidak_tertarik: 'Tidak Tertarik',
  interview_dijadwalkan: 'Interview Dijadwalkan',
  lulus_interview: 'Lulus Interview',
  tidak_lulus: 'Tidak Lulus',
  onboarding: 'Onboarding',
  aktif: 'Aktif',
}

async function getCandidate(id: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('candidates')
    .select('*, candidate_messages(*)')
    .eq('id', id)
    .eq('company_id', process.env.COMPANY_ID!)
    .single()
  if (error) return null
  return data
}

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const candidate = await getCandidate(id)
  if (!candidate) notFound()

  const messages = (candidate.candidate_messages ?? [])
    .sort((a: { created_at: string }, b: { created_at: string }) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{candidate.name}</h1>
          <p className="text-sm text-gray-500">{candidate.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{STATUS_LABELS[candidate.status] ?? candidate.status}</Badge>
          {candidate.telegram_chat_id && <TelegramBadge />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {candidate.position && <div><span className="text-gray-500">Posisi:</span> {candidate.position}</div>}
        {candidate.outlet && <div><span className="text-gray-500">Outlet:</span> {candidate.outlet}</div>}
        {candidate.email && <div><span className="text-gray-500">Email:</span> {candidate.email}</div>}
        {candidate.notes && <div className="col-span-2"><span className="text-gray-500">Catatan:</span> {candidate.notes}</div>}
      </div>

      <ScoreCard candidateId={candidate.id} />

      <MessageHistory
        candidateId={candidate.id}
        phone={candidate.phone ?? ''}
        messages={messages}
      />
    </div>
  )
}
