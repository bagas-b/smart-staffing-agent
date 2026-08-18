'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Criterion {
  id: string
  label: string
  description: string | null
  weight: number
  active: boolean
  sort_order: number
}

function CriterionRow({
  criterion, onSaved, onDeleted,
}: {
  criterion: Criterion
  onSaved: (c: Criterion) => void
  onDeleted: (id: string) => void
}) {
  const [label, setLabel] = useState(criterion.label)
  const [description, setDescription] = useState(criterion.description ?? '')
  const [weight, setWeight] = useState(criterion.weight)
  const [active, setActive] = useState(criterion.active)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/settings/scoring-criteria/${criterion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, description, weight, active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menyimpan')
      onSaved(data)
      setDirty(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    if (!confirm(`Hapus kriteria "${criterion.label}"?`)) return
    await fetch(`/api/settings/scoring-criteria/${criterion.id}`, { method: 'DELETE' })
    onDeleted(criterion.id)
  }

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-white">
      <div className="flex gap-2 items-start">
        <div className="flex-1 space-y-2">
          <Input
            value={label}
            onChange={e => { setLabel(e.target.value); setDirty(true) }}
            placeholder="Nama kriteria, contoh: Pengalaman F&B"
            className="font-medium"
          />
          <textarea
            value={description}
            onChange={e => { setDescription(e.target.value); setDirty(true) }}
            rows={2}
            placeholder="Deskripsi spesifik biar AI nilai konsisten, contoh: pengalaman kerja di F&B/dapur minimal 6 bulan"
            className="w-full text-sm rounded-lg border border-input bg-transparent px-2.5 py-1.5 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
          />
        </div>
        <div className="w-20 flex-shrink-0">
          <label className="text-[11px] text-gray-400">Bobot %</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={weight}
            onChange={e => { setWeight(Number(e.target.value)); setDirty(true) }}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={active}
            onChange={e => { setActive(e.target.checked); setDirty(true) }}
            className="rounded"
          />
          Aktif
        </label>
        <div className="flex gap-2">
          <button onClick={del} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
            <Trash2 size={12} /> Hapus
          </button>
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="text-xs px-2.5 py-1 rounded bg-[#1E3A2F] text-white hover:bg-[#2d5242] disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Simpan
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ScoringSettingsPage() {
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/settings/scoring-criteria')
    const data = await res.json()
    if (Array.isArray(data)) setCriteria(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    // setState inside load() only runs after `await`, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function addCriterion() {
    setAdding(true)
    try {
      const res = await fetch('/api/settings/scoring-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Kriteria baru', weight: 20, sort_order: criteria.length }),
      })
      const data = await res.json()
      if (res.ok) setCriteria(c => [...c, data])
    } finally {
      setAdding(false)
    }
  }

  const totalWeight = criteria.filter(c => c.active).reduce((s, c) => s + c.weight, 0)

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 mb-4">
        Tentukan indikator yang jadi acuan AI saat menilai kandidat. Semakin spesifik deskripsinya, semakin konsisten penilaiannya.
        Kalau belum ada kriteria di sini, sistem pakai bobot default bawaan.
      </p>

      {!loading && criteria.length > 0 && (
        <div className={`mb-3 text-xs px-3 py-2 rounded-lg border ${
          totalWeight === 100 ? 'bg-green-50 border-green-100 text-green-700' : 'bg-amber-50 border-amber-100 text-amber-700'
        }`}>
          Total bobot kriteria aktif: <strong>{totalWeight}%</strong>{totalWeight !== 100 && ' — sebaiknya dijumlahkan sampai 100%'}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> Memuat...</div>
      ) : (
        <div className="space-y-2">
          {criteria.map(c => (
            <CriterionRow
              key={c.id}
              criterion={c}
              onSaved={updated => setCriteria(prev => prev.map(x => x.id === updated.id ? updated : x))}
              onDeleted={id => setCriteria(prev => prev.filter(x => x.id !== id))}
            />
          ))}
          {criteria.length === 0 && (
            <p className="text-sm text-gray-400 bg-white border rounded-lg p-4 text-center">
              Belum ada kriteria custom — AI pakai bobot default (pengalaman relevan 35%, skill spesifik 25%, kelengkapan data 20%, kecocokan lokasi 20%).
            </p>
          )}
        </div>
      )}

      <Button variant="outline" onClick={addCriterion} disabled={adding} className="mt-3 gap-2">
        {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Tambah Kriteria
      </Button>
    </div>
  )
}
