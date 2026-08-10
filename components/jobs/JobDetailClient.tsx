'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, Pencil, Briefcase, MapPin, Clock, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { JobForm, type JobFormValues } from './JobForm'
import { AddApplicantForm } from './AddApplicantForm'
import { TierBadge } from './TierBadge'
import { StatusSegmented } from './StatusSegmented'
import { STATUS_BADGE, STATUS_LABEL, type JobRecord } from './constants'
import { CandidateModal } from '@/components/candidates/CandidateModal'

interface CandidateScore {
  hire_success_probability: number
  scoring_reasoning?: { confidence?: string } | null
}

interface Applicant {
  id: string
  name: string
  status: string
  position: string | null
  outlet: string | null
  candidate_scores?: CandidateScore[] | null
}

export function JobDetailClient({ job, applicants }: { job: JobRecord; applicants: Applicant[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editStatus, setEditStatus] = useState(job.status)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  const selectedApplicant = selectedCandidateId
    ? applicants.find(a => a.id === selectedCandidateId)
    : null

  function startEditing() {
    setEditStatus(job.status)
    setEditing(true)
  }

  async function handleEditSubmit(values: JobFormValues) {
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, status: editStatus }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Gagal menyimpan perubahan')
    setEditing(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Hapus lowongan "${job.title}"? Tindakan ini tidak bisa dibatalkan.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' })
      if (res.ok) router.push('/jobs')
      else setDeleting(false)
    } catch {
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <div className="p-6 space-y-5">
        <div>
          <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft size={14} /> Batal Edit
          </button>
          <h1 className="text-xl font-semibold text-gray-800 mt-2">Edit Lowongan</h1>
        </div>
        <JobForm
          initial={{
            title: job.title,
            position: job.position,
            outlet: job.outlet ?? '',
            shift: job.shift ?? '',
            description: job.description ?? '',
            requirements: job.requirements ?? [],
            benefits: job.benefits ?? [],
            salary_range: job.salary_range ?? '',
            channels: job.channels ?? [],
          }}
          submitLabel="Simpan Perubahan"
          onSubmit={handleEditSubmit}
          footerLeft={
            <div className="space-y-1">
              <p className="text-[11px] text-gray-400">Status lowongan</p>
              <StatusSegmented value={editStatus} onChange={setEditStatus} />
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={14} /> Kembali ke Job Postings
        </Link>

        <div className="flex items-start justify-between mt-2 gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-800 truncate">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[job.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABEL[job.status] ?? job.status}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Briefcase size={11} /> {job.position}
              </span>
              {job.outlet && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin size={11} /> {job.outlet}
                </span>
              )}
              {job.shift && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={11} /> {job.shift}
                </span>
              )}
              {job.salary_range && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Wallet size={11} /> {job.salary_range}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
              <Pencil size={13} /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              <Trash2 size={13} /> {deleting ? 'Menghapus...' : 'Hapus'}
            </Button>
          </div>
        </div>
      </div>

      {/* Description */}
      {job.description && (
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
        </div>
      )}

      {/* Requirements & Benefits */}
      <div className="grid grid-cols-2 gap-4">
        {job.requirements && job.requirements.length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Kualifikasi</p>
            <ul className="space-y-1">
              {job.requirements.map((r, i) => (
                <li key={i} className="text-xs text-gray-600 pl-2 border-l-2 border-gray-200">{r}</li>
              ))}
            </ul>
          </div>
        )}
        {job.benefits && job.benefits.length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Benefit</p>
            <ul className="space-y-1">
              {job.benefits.map((b, i) => (
                <li key={i} className="text-xs text-gray-600 pl-2 border-l-2 border-green-200">{b}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Channels */}
      {job.channels && job.channels.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Dipublikasikan di:</span>
          {job.channels.map(c => (
            <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c}</span>
          ))}
        </div>
      )}

      {/* Applicants */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Kandidat yang Melamar
            <span className="ml-1.5 text-gray-400 font-normal">({applicants.length})</span>
          </span>
        </div>

        <div className="p-3 space-y-2">
          {applicants.length === 0 && (
            <p className="text-xs text-gray-400 py-2">Belum ada kandidat yang terhubung ke lowongan ini.</p>
          )}
          {applicants.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCandidateId(c.id)}
              className="w-full flex items-center justify-between text-left px-3 py-2 rounded-md bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                <p className="text-xs text-gray-400">{c.status}</p>
              </div>
              <TierBadge score={c.candidate_scores?.[0]} />
            </button>
          ))}

          <AddApplicantForm job={job} onAdded={() => router.refresh()} />
        </div>
      </div>

      <CandidateModal
        candidateId={selectedCandidateId}
        onClose={() => setSelectedCandidateId(null)}
        snapshot={selectedApplicant ? {
          name: selectedApplicant.name,
          status: selectedApplicant.status,
          position: selectedApplicant.position,
          outlet: selectedApplicant.outlet,
        } : undefined}
      />
    </div>
  )
}
