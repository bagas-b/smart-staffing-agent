'use client'
import { useState, useEffect, useRef } from 'react'
import { Send as SendIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageBubble } from '@/components/shared/MessageBubble'

interface Message {
  id: string
  direction: string
  content: string
  created_at: string
  channel: string
}

interface CandidateDetail {
  id: string
  name: string
  position: string | null
  outlet: string | null
  phone: string | null
  telegram_chat_id: string | null
  candidate_messages: Message[]
}

export function ChatThread({ candidateId, onSent }: { candidateId: string | null; onSent?: () => void }) {
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null)
  const [text, setText] = useState('')
  const [manualChannel, setManualChannel] = useState<'telegram' | 'wa' | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const current = candidate?.id === candidateId ? candidate : null

  // Reset the manual channel override whenever a different candidate is opened —
  // adjusted during render rather than via effect (react.dev/learn/you-might-not-need-an-effect#adjusting-state).
  const [trackedCandidateId, setTrackedCandidateId] = useState(candidateId)
  if (candidateId !== trackedCandidateId) {
    setTrackedCandidateId(candidateId)
    setManualChannel(null)
  }
  const channel = manualChannel ?? (current?.telegram_chat_id ? 'telegram' : 'wa')

  useEffect(() => {
    if (!candidateId) return
    let cancelled = false
    fetch(`/api/candidates/${candidateId}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setCandidate(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [candidateId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [current?.candidate_messages?.length])

  async function send() {
    if (!text.trim() || !current) return
    setSending(true)
    setError('')
    try {
      const endpoint = channel === 'telegram' ? '/api/telegram/send' : '/api/wa/send'
      const body = channel === 'telegram'
        ? { candidateId: current.id, message: text }
        : { candidateId: current.id, phone: current.phone, message: text }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal mengirim pesan')
      setCandidate(prev => prev ? {
        ...prev,
        candidate_messages: [...prev.candidate_messages, {
          id: `local-${Date.now()}`, direction: 'outbound', content: text,
          created_at: new Date().toISOString(), channel,
        }],
      } : prev)
      setText('')
      onSent?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim pesan')
    } finally {
      setSending(false)
    }
  }

  if (!candidateId) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        Pilih percakapan di sebelah kiri untuk mulai chat.
      </div>
    )
  }

  const messages = [...(current?.candidate_messages ?? [])]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const hasTelegram = !!current?.telegram_chat_id
  const hasWA = !!current?.phone
  const canSend = channel === 'telegram' ? hasTelegram : hasWA

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
      {/* Header */}
      <div className="px-5 py-3 border-b bg-white flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{current?.name ?? '…'}</p>
          <p className="text-xs text-gray-400 truncate">
            {current?.position ?? '-'}{current?.outlet ? ` · ${current.outlet}` : ''}
          </p>
        </div>
        {hasTelegram && hasWA && (
          <div className="flex items-center rounded-lg border p-0.5 bg-gray-50 flex-shrink-0">
            {(['telegram', 'wa'] as const).map(ch => (
              <button
                key={ch}
                onClick={() => setManualChannel(ch)}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                  channel === ch ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                }`}
              >
                {ch === 'telegram' ? 'Telegram' : 'WA'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">Belum ada pesan.</p>
        )}
        {messages.map(m => (
          <MessageBubble key={m.id} direction={m.direction} content={m.content} created_at={m.created_at} channel={m.channel} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="p-3 border-t bg-white space-y-1.5">
        {error && <p className="text-xs text-red-600">{error}</p>}
        {!canSend ? (
          <p className="text-xs text-gray-400 px-1">
            Kandidat belum terhubung via {channel === 'telegram' ? 'Telegram' : 'WhatsApp'}.
          </p>
        ) : (
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Ketik pesan..."
              onKeyDown={e => e.key === 'Enter' && send()}
            />
            <Button onClick={send} disabled={sending || !text.trim()} className="bg-[#1E3A2F] hover:bg-[#2d5242] gap-1.5">
              <SendIcon size={14} /> Kirim
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
