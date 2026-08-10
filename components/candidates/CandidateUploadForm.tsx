'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'

interface JobOption {
  id: string
  title: string
  position: string
}

export function CandidateUploadForm() {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<JobOption[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/jobs')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setJobs(data) })
      .catch(() => {})
  }, [])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setStatus(null)
    const fd = new FormData()
    fd.append('file', file)
    if (selectedJobId) fd.append('job_posting_id', selectedJobId)
    try {
      const res = await fetch('/api/candidates/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatus(`Berhasil import ${data.imported} kandidat${data.failed ? `, ${data.failed} gagal` : ''}`)
      router.refresh()
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      // reset so same file can be re-uploaded
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-2">
      {jobs.length > 0 && (
        <select
          value={selectedJobId}
          onChange={e => setSelectedJobId(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs text-gray-600 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 max-w-40"
        >
          <option value="">Tanpa lowongan spesifik</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
      )}
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls"
        className="hidden" onChange={handleFile} />
      <Button variant="outline" onClick={() => inputRef.current?.click()}
        disabled={loading} className="gap-2">
        <Upload size={16} />
        {loading ? 'Mengupload...' : 'Upload CSV/Excel'}
      </Button>
      {status && <p className="text-sm text-gray-600">{status}</p>}
    </div>
  )
}
