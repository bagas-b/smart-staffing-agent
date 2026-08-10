'use client'
import { useState, useEffect } from 'react'
import { Send, Copy, Check } from 'lucide-react'

export function TelegramLinkStatus({ candidateId, linked }: { candidateId: string; linked: boolean }) {
  const [botUsername, setBotUsername] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/telegram/status')
      .then(r => r.json())
      .then(data => { if (!cancelled && data.status === 'connected') setBotUsername(data.username) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (linked) {
    return (
      <div className="flex items-center gap-1.5 text-xs bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 text-sky-700">
        <Send size={12} className="text-sky-500" />
        Terhubung via Telegram
      </div>
    )
  }

  if (!botUsername) return null // bot not configured yet — nothing useful to show

  const link = `https://t.me/${botUsername}?start=${candidateId}`

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="flex items-center justify-between gap-2 text-xs bg-gray-50 border rounded-lg px-3 py-2">
      <span className="text-gray-500 flex items-center gap-1.5 min-w-0">
        <Send size={12} className="text-gray-400 flex-shrink-0" />
        <span className="truncate">Belum terhubung Telegram — kirim link ini ke kandidat</span>
      </span>
      <button
        onClick={copyLink}
        className="flex items-center gap-1 text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 flex-shrink-0"
      >
        {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
        {copied ? 'Tersalin' : 'Salin Link'}
      </button>
    </div>
  )
}
