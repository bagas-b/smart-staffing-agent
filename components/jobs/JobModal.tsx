'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2, Pencil, Briefcase, MapPin, Clock, Wallet } from 'lucide-react'
import { JobForm, type JobFormValues } from './JobForm'
import { AddApplicantForm } from './AddApplicantForm'
import { TierBadge } from './TierBadge'
import { StatusSegmented } from './StatusSegmented'
import { STATUS_BADGE, STATUS_LABEL, type JobRecord } from './constants'
import { CandidateModal } from '@/components/candidates/CandidateModal'

interface CandidateScore {
  cv_fit_score: number
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

interface JobWithApplicants extends JobRecord {
  candidates?: Applicant[] | null
}

export interface JobSnapshot {
  title: string
  position: string
  outlet?: string | null
  status: string
}

interface JobModalProps {
  /** id of the job to view/edit, or null when not viewing an existing job */
  jobId: string | null
  /** true to show the create form instead of loading an existing job */
  creating?: boolean
  onClose: () => void
  /** called after create/edit/delete so the parent can refresh its list */
  onChanged: () => void
  snapshot?: JobSnapshot
}

const emptyFormValues: JobFormValues = {
  title: '', position: '', outlet: '', shift: '',
  description: '', requirements: [], benefits: [],
  salary_range: '', channels: [],
}

export function JobModal({ jobId, creating = false, onClose, onChanged, snapshot }: JobModalProps) {
  const [job, setJob] = useState<JobWithApplicants | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editStatus, setEditStatus] = useState('draft')
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  const open = creating || !!jobId
  const current = job?.id === jobId ? job : null
  const fetching = !!jobId && !creating && !current

  const refetch = useCallback(async () => {
    if (!jobId) return
    const res = await fetch(`/api/jobs/${jobId}`)
    if (res.ok) setJob(await res.json())
  }, [jobId])

  useEffect(() => {
    if (!jobId || creating) return
    let cancelled = false
    fetch(`/api/jobs/${jobId}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setJob(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [jobId, creating])

  // Reset edit mode + seed the status control whenever a different job is opened, or once
  // its data finishes loading — adjusted during render rather than via effect
  // (react.dev/learn/you-might-not-need-an-effect#adjusting-state).
  const trackedKeyValue = `${jobId}:${creating}:${current ? '1' : '0'}`
  const [trackedKey, setTrackedKey] = useState(trackedKeyValue)
  if (trackedKeyValue !== trackedKey) {
    setTrackedKey(trackedKeyValue)
    setEditing(false)
    setEditStatus(creating ? 'draft' : (current?.status ?? 'draft'))
  }

  const selectedApplicant = selectedCandidateId
    ? current?.candidates?.find(a => a.id === selectedCandidateId)
    : null

  async function handleCreateSubmit(values: JobFormValues) {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, status: editStatus }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Gagal membuat lowongan')
    onChanged()
    onClose()
  }

  async function handleEditSubmit(values: JobFormValues) {
    if (!jobId) return
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, status: editStatus }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Gagal menyimpan perubahan')
    setEditing(false)
    await refetch()
    onChanged()
  }

  async function handleDelete() {
    if (!jobId || !current) return
    if (!confirm(`Hapus lowongan "${current.title}"? Tindakan ini tidak bisa dibatalkan.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      if (res.ok) { onChanged(); onClose() }
      else setDeleting(false)
    } catch {
      setDeleting(false)
    }
  }

  const title = current?.title ?? snapshot?.title ?? '…'
  const position = current?.position ?? snapshot?.position
  const outlet = current?.outlet ?? snapshot?.outlet
  const status = current?.status ?? snapshot?.status ?? 'draft'
  const applicants = current?.candidates ?? []

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-2xl w-full !p-0 !gap-0 overflow-hidden"
        >
          {creating || editing ? (
            <>
              <DialogHeader className="px-5 pt-4 pb-3 border-b gap-0">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-semibold text-gray-900">
                    {creating ? 'Buat Lowongan Baru' : 'Edit Lowongan'}
                  </DialogTitle>
                  <button
                    onClick={() => creating ? onClose() : setEditing(false)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    aria-label="Tutup"
                  >
                    <span className="text-sm leading-none">✕</span>
                  </button>
                </div>
              </DialogHeader>
              <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: '75vh' }}>
                <JobForm
                  initial={creating ? emptyFormValues : {
                    title: current?.title,
                    position: current?.position,
                    outlet: current?.outlet ?? '',
                    shift: current?.shift ?? '',
                    description: current?.description ?? '',
                    requirements: current?.requirements ?? [],
                    benefits: current?.benefits ?? [],
                    salary_range: current?.salary_range ?? '',
                    channels: current?.channels ?? [],
                  }}
                  submitLabel={creating ? 'Buat Lowongan' : 'Simpan Perubahan'}
                  onSubmit={creating ? handleCreateSubmit : handleEditSubmit}
                  footerLeft={
                    <div className="space-y-1">
                      <p className="text-[11px] text-gray-400">Status lowongan</p>
                      <StatusSegmented value={editStatus} onChange={setEditStatus} />
                    </div>
                  }
                />
              </div>
            </>
          ) : (
            <>
              {/* Header */}
              <DialogHeader className="px-5 pt-4 pb-3 border-b gap-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base font-semibold text-gray-900 leading-snug truncate">
                      {title}
                    </DialogTitle>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[status] ?? status}
                      </span>
                      {position && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Briefcase size={11} /> {position}
                        </span>
                      )}
                      {outlet && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin size={11} /> {outlet}
                        </span>
                      )}
                      {current?.shift && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock size={11} /> {current.shift}
                        </span>
                      )}
                      {current?.salary_range && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Wallet size={11} /> {current.salary_range}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={fetching} className="gap-1 h-7 text-xs px-2">
                      <Pencil size={12} /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={fetching || deleting} className="gap-1 h-7 text-xs px-2">
                      <Trash2 size={12} /> {deleting ? '...' : 'Hapus'}
                    </Button>
                    <button
                      onClick={onClose}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      aria-label="Tutup"
                    >
                      <span className="text-sm leading-none">✕</span>
                    </button>
                  </div>
                </div>
              </DialogHeader>

              {/* Scrollable body */}
              <div className="overflow-y-auto px-5 py-4 space-y-4" style={{ maxHeight: '65vh' }}>
                {fetching && (
                  <div className="rounded-lg border bg-gray-50 p-4 animate-pulse h-24" />
                )}

                {current?.description && (
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{current.description}</p>
                  </div>
                )}

                {current && ((current.requirements?.length ?? 0) > 0 || (current.benefits?.length ?? 0) > 0) && (
                  <div className="grid grid-cols-2 gap-3">
                    {(current.requirements?.length ?? 0) > 0 && (
                      <div className="rounded-lg border bg-white p-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1.5">Kualifikasi</p>
                        <ul className="space-y-1">
                          {current.requirements!.map((r, i) => (
                            <li key={i} className="text-xs text-gray-600 pl-2 border-l-2 border-gray-200">{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(current.benefits?.length ?? 0) > 0 && (
                      <div className="rounded-lg border bg-white p-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1.5">Benefit</p>
                        <ul className="space-y-1">
                          {current.benefits!.map((b, i) => (
                            <li key={i} className="text-xs text-gray-600 pl-2 border-l-2 border-green-200">{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {current?.channels && current.channels.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Dipublikasikan di:</span>
                    {current.channels.map(c => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c}</span>
                    ))}
                  </div>
                )}

                {/* Applicants */}
                {current && (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b">
                      <p className="text-xs font-semibold text-gray-700">
                        Kandidat yang Melamar
                        <span className="ml-1.5 font-normal text-gray-400">({applicants.length})</span>
                      </p>
                    </div>
                    <div className="p-2.5 space-y-1.5 bg-white">
                      {applicants.length === 0 && (
                        <p className="text-xs text-gray-400 px-1 py-1">Belum ada kandidat yang terhubung ke lowongan ini.</p>
                      )}
                      {applicants.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCandidateId(c.id)}
                          className="w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-md bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{c.name}</p>
                            <p className="text-[11px] text-gray-400">{c.status}</p>
                          </div>
                          <TierBadge score={c.candidate_scores?.[0]} />
                        </button>
                      ))}
                      <AddApplicantForm job={current} onAdded={refetch} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Nested candidate modal — layered above the job modal */}
      <CandidateModal
        candidateId={selectedCandidateId}
        onClose={() => { setSelectedCandidateId(null); refetch() }}
        snapshot={selectedApplicant ? {
          name: selectedApplicant.name,
          status: selectedApplicant.status,
          position: selectedApplicant.position,
          outlet: selectedApplicant.outlet,
        } : undefined}
      />
    </>
  )
}
