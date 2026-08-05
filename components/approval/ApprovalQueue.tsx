'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Draft = {
  id: string
  content: string
  channel: string
  created_at: string
  candidate_id: string
  candidates: { name: string; position: string | null; outlet: string | null } | null
}

export function ApprovalQueue({ drafts: initial }: { drafts: Draft[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setLoading(id)
    await fetch(`/api/approval/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDrafts(d => d.filter(x => x.id !== id))
    setLoading(null)
    router.refresh()
  }

  if (!drafts.length) return <p className="text-gray-500">Tidak ada pesan yang menunggu persetujuan.</p>

  return (
    <div className="space-y-3">
      {drafts.map(d => (
        <div key={d.id} className="border rounded-lg p-4 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{d.candidates?.name ?? d.candidate_id}</span>
            <span className="text-xs text-gray-400">{d.candidates?.position} · {d.candidates?.outlet}</span>
          </div>
          <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">{d.content}</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => handleAction(d.id, 'reject')}
              disabled={loading === d.id}
              className="text-sm px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >Tolak</button>
            <button
              onClick={() => handleAction(d.id, 'approve')}
              disabled={loading === d.id}
              className="text-sm px-3 py-1.5 rounded bg-[#1E3A2F] text-white hover:bg-[#2d5242] disabled:opacity-50"
            >Setujui</button>
          </div>
        </div>
      ))}
    </div>
  )
}
