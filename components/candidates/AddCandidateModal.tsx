'use client'
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface JobOption {
  id: string
  title: string
  position: string
  outlet: string | null
}

interface AddCandidateModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function AddCandidateModal({ open, onClose, onCreated }: AddCandidateModalProps) {
  const [jobs, setJobs] = useState<JobOption[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState('')
  const [outlet, setOutlet] = useState('')
  const [appliedJobId, setAppliedJobId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    fetch('/api/jobs')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setJobs(data) })
      .catch(() => {})
  }, [open])

  function reset() {
    setName(''); setPhone(''); setEmail(''); setPosition(''); setOutlet('')
    setAppliedJobId(''); setNotes(''); setError('')
  }

  function handleJobSelect(jobId: string) {
    setAppliedJobId(jobId)
    const job = jobs.find(j => j.id === jobId)
    if (job) {
      setPosition(job.position)
      setOutlet(job.outlet ?? '')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Nama wajib diisi'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          position: position.trim() || null,
          outlet: outlet.trim() || null,
          notes: notes.trim() || null,
          source: 'external_form',
          applied_job_id: appliedJobId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menambah kandidat')
      reset()
      onCreated()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menambah kandidat')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg w-full !p-0 !gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-3 border-b gap-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-gray-900">Tambah Kandidat</DialogTitle>
            <button
              onClick={() => { reset(); onClose() }}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Tutup"
            >
              <span className="text-sm leading-none">✕</span>
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ac-name">Nama *</Label>
            <Input id="ac-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nama lengkap" autoFocus required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ac-phone">Nomor WA</Label>
              <Input id="ac-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-email">Email</Label>
              <Input id="ac-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="opsional" />
            </div>
          </div>

          {jobs.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="ac-job">Lowongan</Label>
              <select
                id="ac-job"
                value={appliedJobId}
                onChange={e => handleJobSelect(e.target.value)}
                className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Tanpa lowongan spesifik</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ac-position">Posisi</Label>
              <Input id="ac-position" value={position} onChange={e => setPosition(e.target.value)} placeholder="Contoh: Kasir" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-outlet">Outlet</Label>
              <Input id="ac-outlet" value={outlet} onChange={e => setOutlet(e.target.value)} placeholder="Contoh: Kemang" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ac-notes">Catatan</Label>
            <textarea
              id="ac-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Catatan HR (opsional)..."
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
            />
          </div>

          <p className="text-[11px] text-gray-400">
            Kandidat langsung di-score oleh AI. Kalau nomor WA diisi, agent juga akan siapkan draft pesan pembuka untuk direview di Approval.
          </p>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving} className="bg-[#1E3A2F] hover:bg-[#2d5242]">
              {saving ? 'Menyimpan...' : 'Tambah Kandidat'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
