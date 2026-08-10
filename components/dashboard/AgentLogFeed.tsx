'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

interface AgentLog {
  id: string
  type: string
  message: string
  created_at: string
}

const typeStyles: Record<string, string> = {
  info: 'bg-blue-50 text-blue-700 border border-blue-100',
  ai: 'bg-purple-50 text-purple-700 border border-purple-100',
  wa: 'bg-green-50 text-green-700 border border-green-100',
  system: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-700 border border-red-200 font-medium',
}

export function AgentLogFeed() {
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-logs')
      const data = await res.json()
      if (Array.isArray(data)) {
        setLogs(data)
        setLastUpdated(new Date())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 15000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-5 py-3 border-b flex items-center justify-between">
        <span className="font-medium text-sm text-gray-700">Aktivitas Agent</span>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Update: {lastUpdated.toLocaleTimeString('id-ID')}
            </span>
          )}
          <button onClick={fetchLogs} className="text-gray-400 hover:text-gray-600">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="divide-y max-h-64 overflow-y-auto">
        {loading && logs.length === 0 && (
          <p className="p-4 text-sm text-gray-400">Memuat...</p>
        )}
        {!loading && logs.length === 0 && (
          <p className="p-4 text-sm text-gray-400">Belum ada aktivitas agent.</p>
        )}
        {logs.map(log => (
          <div key={log.id} className={`p-3 flex items-start gap-3 ${log.type === 'error' ? 'bg-red-50' : ''}`}>
            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${typeStyles[log.type] ?? typeStyles.system}`}>
              {log.type}
            </span>
            <span className={`text-sm flex-1 ${log.type === 'error' ? 'text-red-700' : 'text-gray-700'}`}>
              {log.message}
            </span>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {new Date(log.created_at).toLocaleTimeString('id-ID')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
