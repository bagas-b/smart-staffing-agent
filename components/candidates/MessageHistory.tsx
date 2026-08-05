'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  created_at: string
  sent_by: string
}

interface Props {
  candidateId: string
  phone: string
  messages: Message[]
}

export function MessageHistory({ candidateId, phone, messages: initial }: Props) {
  const [msgs, setMsgs] = useState(initial)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    if (!text.trim()) return
    setSending(true)
    const res = await fetch('/api/wa/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId, phone, message: text }),
    })
    if (res.ok) {
      setMsgs(prev => [...prev, {
        id: Date.now().toString(),
        direction: 'outbound',
        content: text,
        created_at: new Date().toISOString(),
        sent_by: 'agent',
      }])
      setText('')
    }
    setSending(false)
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-3 border-b text-sm font-medium">Riwayat Pesan WA</div>
      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
        {msgs.length === 0 && <p className="text-xs text-gray-400">Belum ada pesan.</p>}
        {msgs.map(m => (
          <div key={m.id}
            className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-3 py-2 rounded-lg text-sm
              ${m.direction === 'outbound'
                ? 'bg-[#1E3A2F] text-white'
                : 'bg-gray-100 text-gray-800'}`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t flex gap-2">
        <Input value={text} onChange={e => setText(e.target.value)}
          placeholder="Ketik pesan..."
          onKeyDown={e => e.key === 'Enter' && send()} />
        <Button onClick={send} disabled={sending || !phone}
          className="bg-[#1E3A2F] hover:bg-[#2d5242]">
          Kirim
        </Button>
      </div>
    </div>
  )
}
