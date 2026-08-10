'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X as XIcon } from 'lucide-react'

type Draft = {
  id: string
  content: string
  channel: string
  created_at: string
  candidate_id: string
  candidates: { name: string; position: string | null; outlet: string | null } | null
}

const CHANNEL_LABEL: Record<string, string> = { wa: 'WhatsApp', telegram: 'Telegram', email: 'Email' }

function DraftCard({
  draft, selected, onToggleSelect, onSaved, onRemoved, busy, setBusy,
}: {
  draft: Draft
  selected: boolean
  onToggleSelect: () => void
  onSaved: (id: string, content: string) => void
  onRemoved: (id: string) => void
  busy: boolean
  setBusy: (id: string | null) => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(draft.content)
  const [error, setError] = useState('')

  async function saveEdit() {
    if (!text.trim()) return
    setBusy(draft.id)
    setError('')
    try {
      const res = await fetch('/api/approval/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, content: text }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Gagal menyimpan')
      onSaved(draft.id, text.trim())
      setEditing(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setBusy(null)
    }
  }

  async function handleAction(action: 'approve' | 'reject') {
    setBusy(draft.id)
    setError('')
    const res = await fetch(`/api/approval/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draft.id }),
    })
    if (!res.ok) {
      setError((await res.json()).error ?? 'Gagal memproses. Coba lagi.')
      setBusy(null)
      return
    }
    onRemoved(draft.id)
    setBusy(null)
    router.refresh()
  }

  return (
    <div className={`border rounded-lg p-4 bg-white space-y-2 ${selected ? 'ring-2 ring-[#1E3A2F]/30 border-[#1E3A2F]/30' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1 rounded"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{draft.candidates?.name ?? draft.candidate_id}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                {CHANNEL_LABEL[draft.channel] ?? draft.channel}
              </span>
              <span className="text-xs text-gray-400">{draft.candidates?.position} · {draft.candidates?.outlet}</span>
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={busy}
                  className="text-xs px-2.5 py-1 rounded bg-[#1E3A2F] text-white hover:bg-[#2d5242] disabled:opacity-50 flex items-center gap-1"
                >
                  <Check size={12} /> Simpan
                </button>
                <button
                  onClick={() => { setText(draft.content); setEditing(false) }}
                  className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                >
                  <XIcon size={12} /> Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              <p className="text-sm text-gray-700 bg-gray-50 rounded p-3 whitespace-pre-wrap">{draft.content}</p>
              <button
                onClick={() => setEditing(true)}
                className="absolute top-1.5 right-1.5 p-1 rounded bg-white border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                title="Edit pesan"
              >
                <Pencil size={12} className="text-gray-500" />
              </button>
            </div>
          )}

          {!editing && (
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => handleAction('reject')}
                disabled={busy}
                className="text-sm px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >Tolak</button>
              <button
                onClick={() => handleAction('approve')}
                disabled={busy}
                className="text-sm px-3 py-1.5 rounded bg-[#1E3A2F] text-white hover:bg-[#2d5242] disabled:opacity-50"
              >Setujui</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ApprovalQueue({ drafts: initial }: { drafts: Draft[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState('')

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => prev.size === drafts.length ? new Set() : new Set(drafts.map(d => d.id)))
  }

  function handleRemoved(id: string) {
    setDrafts(d => d.filter(x => x.id !== id))
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  function handleSaved(id: string, content: string) {
    setDrafts(d => d.map(x => x.id === id ? { ...x, content } : x))
  }

  async function bulkAction(action: 'approve' | 'reject') {
    if (selected.size === 0) return
    setBulkBusy(true)
    setBulkError('')
    const ids = [...selected]
    try {
      const res = await fetch(`/api/approval/${action}-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal memproses')

      if (action === 'reject') {
        ids.forEach(handleRemoved)
      } else {
        const succeeded: string[] = data.succeeded ?? []
        const failed: Array<{ id: string; error?: string }> = data.failed ?? []
        succeeded.forEach(handleRemoved)
        if (failed.length > 0) {
          setBulkError(`${failed.length} pesan gagal dikirim (draft tetap tersimpan): ${failed.map(f => f.error).join('; ')}`)
        }
      }
      router.refresh()
    } catch (e: unknown) {
      setBulkError(e instanceof Error ? e.message : 'Gagal memproses')
    } finally {
      setBulkBusy(false)
    }
  }

  if (!drafts.length) return <p className="text-gray-500">Tidak ada pesan yang menunggu persetujuan.</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-gray-50 border rounded-lg px-3 py-2">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={selected.size === drafts.length && drafts.length > 0}
            onChange={toggleAll}
            className="rounded"
          />
          {selected.size > 0 ? `${selected.size} dipilih` : 'Pilih semua'}
        </label>
        {selected.size > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => bulkAction('reject')}
              disabled={bulkBusy}
              className="text-sm px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Tolak {selected.size}
            </button>
            <button
              onClick={() => bulkAction('approve')}
              disabled={bulkBusy}
              className="text-sm px-3 py-1.5 rounded bg-[#1E3A2F] text-white hover:bg-[#2d5242] disabled:opacity-50"
            >
              {bulkBusy ? 'Memproses...' : `Setujui ${selected.size}`}
            </button>
          </div>
        )}
      </div>

      {bulkError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{bulkError}</p>
      )}

      {drafts.map(d => (
        <DraftCard
          key={d.id}
          draft={d}
          selected={selected.has(d.id)}
          onToggleSelect={() => toggle(d.id)}
          onSaved={handleSaved}
          onRemoved={handleRemoved}
          busy={busyId === d.id}
          setBusy={setBusyId}
        />
      ))}
    </div>
  )
}
