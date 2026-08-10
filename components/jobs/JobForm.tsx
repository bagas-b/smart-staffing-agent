'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface JobFormValues {
  title: string
  position: string
  outlet: string
  shift: string
  description: string
  requirements: string[]
  benefits: string[]
  salary_range: string
  channels: string[]
}

const CHANNEL_OPTIONS = [
  { key: 'wa', label: 'WhatsApp' },
  { key: 'jobstreet', label: 'JobStreet' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'instagram', label: 'Instagram' },
]

const EMPTY: JobFormValues = {
  title: '', position: '', outlet: '', shift: '',
  description: '', requirements: [], benefits: [],
  salary_range: '', channels: [],
}

function linesToArray(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean)
}

interface JobFormProps {
  initial?: Partial<JobFormValues>
  submitLabel: string
  onSubmit: (values: JobFormValues) => Promise<void>
  /** Rendered to the left of the submit button, same row — e.g. a status control. */
  footerLeft?: React.ReactNode
}

export function JobForm({ initial, submitLabel, onSubmit, footerLeft }: JobFormProps) {
  const values = { ...EMPTY, ...initial }
  const [title, setTitle] = useState(values.title)
  const [position, setPosition] = useState(values.position)
  const [outlet, setOutlet] = useState(values.outlet)
  const [shift, setShift] = useState(values.shift)
  const [description, setDescription] = useState(values.description)
  const [requirementsText, setRequirementsText] = useState(values.requirements.join('\n'))
  const [benefitsText, setBenefitsText] = useState(values.benefits.join('\n'))
  const [salaryRange, setSalaryRange] = useState(values.salary_range)
  const [channels, setChannels] = useState<string[]>(values.channels)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleChannel(key: string) {
    setChannels(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !position.trim()) {
      setError('Judul dan posisi wajib diisi')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        title: title.trim(),
        position: position.trim(),
        outlet: outlet.trim(),
        shift: shift.trim(),
        description: description.trim(),
        requirements: linesToArray(requirementsText),
        benefits: linesToArray(benefitsText),
        salary_range: salaryRange.trim(),
        channels,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="title">Judul Lowongan *</Label>
          <Input id="title" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Contoh: Kasir Outlet Kemang" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="position">Posisi *</Label>
          <Input id="position" value={position} onChange={e => setPosition(e.target.value)}
            placeholder="Contoh: Kasir" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="outlet">Outlet</Label>
          <Input id="outlet" value={outlet} onChange={e => setOutlet(e.target.value)}
            placeholder="Contoh: Kemang" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shift">Shift</Label>
          <Input id="shift" value={shift} onChange={e => setShift(e.target.value)}
            placeholder="Contoh: Pagi (08:00-16:00)" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="salary">Range Gaji</Label>
          <Input id="salary" value={salaryRange} onChange={e => setSalaryRange(e.target.value)}
            placeholder="Contoh: 3.500.000 - 4.200.000" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Deskripsi</Label>
        <textarea
          id="description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Deskripsi singkat pekerjaan..."
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="requirements">Kualifikasi <span className="text-gray-400 font-normal">(satu per baris)</span></Label>
        <textarea
          id="requirements"
          value={requirementsText}
          onChange={e => setRequirementsText(e.target.value)}
          rows={4}
          placeholder={'Minimal SMA/SMK\nPengalaman 1 tahun di F&B\nBisa kerja shift'}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="benefits">Benefit <span className="text-gray-400 font-normal">(satu per baris)</span></Label>
        <textarea
          id="benefits"
          value={benefitsText}
          onChange={e => setBenefitsText(e.target.value)}
          rows={3}
          placeholder={'BPJS Kesehatan & Ketenagakerjaan\nMakan siang gratis\nBonus kehadiran'}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Channel Publikasi</Label>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map(opt => (
            <button
              type="button"
              key={opt.key}
              onClick={() => toggleChannel(opt.key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                channels.includes(opt.key)
                  ? 'bg-[#1E3A2F] text-white border-[#1E3A2F]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t">
        <div>{footerLeft}</div>
        <Button type="submit" disabled={saving} className="bg-[#1E3A2F] hover:bg-[#2d5242] shrink-0">
          {saving ? 'Menyimpan...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
