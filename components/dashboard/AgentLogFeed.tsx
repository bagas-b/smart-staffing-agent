'use client'
import { useEffect, useState } from 'react'

interface AgentLog {
  id: string
  type: string
  message: string
  created_at: string
}

const typeColors: Record<string, string> = {
  ai: 'bg-purple-100 text-purple-700',
  wa: 'bg-green-100 text-green-700',
  system: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-700',
}

export function AgentLogFeed() {
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agent-logs')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setLogs(data)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-5 py-3 border-b font-medium text-sm text-gray-700">
        Aktivitas Agent
      </div>
      <div className="divide-y max-h-80 overflow-y-auto">
        {loading && (
          <p className="p-4 text-sm text-gray-400">Memuat...</p>
        )}
        {!loading && logs.length === 0 && (
          <p className="p-4 text-sm text-gray-400">Belum ada aktivitas.</p>
        )}
        {logs.map(log => (
          <div key={log.id} className="p-3 flex items-start gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${typeColors[log.type] ?? 'bg-gray-100 text-gray-600'}`}>
              {log.type}
            </span>
            <span className="text-sm text-gray-700 flex-1">{log.message}</span>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {new Date(log.created_at).toLocaleTimeString('id-ID')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
