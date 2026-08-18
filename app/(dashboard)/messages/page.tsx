'use client'
import { useState, useEffect, useCallback } from 'react'
import { Send } from 'lucide-react'
import { ChatInbox, type Conversation } from '@/components/chat/ChatInbox'
import { ChatThread } from '@/components/chat/ChatThread'

function BotStatusPill() {
  const [status, setStatus] = useState<'connected' | 'qr' | 'disconnected' | null>(null)

  useEffect(() => {
    let cancelled = false
    function poll() {
      fetch('/api/wa/status')
        .then(r => r.json())
        .then(data => { if (!cancelled) setStatus(data.status) })
        .catch(() => { if (!cancelled) setStatus('disconnected') })
    }
    poll()
    const interval = setInterval(poll, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  if (status === null) return null

  const label = status === 'connected' ? 'WA Terhubung' : status === 'qr' ? 'Menunggu Scan QR' : 'WA Terputus'

  return (
    <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-white">
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-red-400'}`} />
      <Send size={11} className="text-gray-400" />
      {label}
    </div>
  )
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations')
      const data = await res.json()
      if (Array.isArray(data)) setConversations(data)
    } catch {}
  }, [])

  useEffect(() => {
    // Standard fetch-on-mount + poll pattern; setState inside fetchConversations only
    // runs after `await`, never synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConversations()
    const interval = setInterval(fetchConversations, 10000)
    return () => clearInterval(interval)
  }, [fetchConversations])

  return (
    <div className="h-screen flex flex-col">
      <div className="px-5 py-3 border-b bg-white flex items-center justify-between flex-shrink-0">
        <h1 className="text-base font-semibold text-gray-800">Chat</h1>
        <BotStatusPill />
      </div>
      <div className="flex-1 flex min-h-0">
        <ChatInbox conversations={conversations} selectedId={selectedId} onSelect={setSelectedId} />
        <ChatThread candidateId={selectedId} onSent={fetchConversations} />
      </div>
    </div>
  )
}
