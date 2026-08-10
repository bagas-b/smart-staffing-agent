'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { JobRecord } from './constants'

export function AddApplicantForm({ job, onAdded }: { job: JobRecord; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
          phone: phone.trim(),
          position: job.position,
          outlet: job.outlet,
          // DB check constraint only allows: internal_wa | external_email | external_form | import
          source: 'external_form',
          applied_job_id: job.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menambah kandidat')
      setName(''); setPhone(''); setOpen(false)
      onAdded()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menambah kandidat')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-dashed rounded-lg py-2.5 hover:border-gray-400 transition-colors"
      >
        <Plus size={13} /> Tambah Kandidat untuk Lowongan Ini
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="border rounded-lg p-3 space-y-2 bg-gray-50">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Input placeholder="Nama kandidat" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <Input placeholder="Nomor WA (opsional)" value={phone} onChange={e => setPhone(e.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="bg-[#1E3A2F] hover:bg-[#2d5242]">
          {saving ? 'Menyimpan...' : 'Simpan'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
      </div>
    </form>
  )
}
