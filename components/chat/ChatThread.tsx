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
  candidate_messages: Message[]
}

export function ChatThread({ candidateId, onSent }: { candidateId: string | null; onSent?: () => void }) {
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const current = candidate?.id === candidateId ? candidate : null

  useEffect(() => {
    if (!candidateId) return
    let cancelled = false
    function poll() {
      fetch(`/api/candidates/${candidateId}`)
        .then(r => r.json())
        .then(data => { if (!cancelled) setCandidate(data) })
        .catch(() => {})
    }
    poll()
    // Re-poll the open thread so a candidate's reply shows up without HR
    // having to click away and back — previously only the conversation list
    // (10s) refreshed, the open thread itself never did.
    const interval = setInterval(poll, 4000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [candidateId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [current?.candidate_messages?.length])

  async function send() {
    if (!text.trim() || !current) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/wa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: current.id, phone: current.phone, message: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal mengirim pesan')
      setCandidate(prev => prev ? {
        ...prev,
        candidate_messages: [...prev.candidate_messages, {
          id: `local-${Date.now()}`, direction: 'outbound', content: text,
          created_at: new Date().toISOString(), channel: 'wa',
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

  // Drafts haven't been approved/sent yet — don't render them in the thread
  // as if they were (MessageBubble would show a non-'outbound' draft on the
  // candidate's side, which is backwards and misleading).
  const messages = [...(current?.candidate_messages ?? [])]
    .filter(m => m.direction !== 'draft')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const canSend = !!current?.phone

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
            Kandidat belum punya nomor WhatsApp.
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
