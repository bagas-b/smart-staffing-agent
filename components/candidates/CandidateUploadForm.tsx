'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'

export function CandidateUploadForm() {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setStatus(null)
    const fd = new FormData()
    fd.append('file', file)
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
    <div>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls"
        className="hidden" onChange={handleFile} />
      <Button variant="outline" onClick={() => inputRef.current?.click()}
        disabled={loading} className="gap-2">
        <Upload size={16} />
        {loading ? 'Mengupload...' : 'Upload CSV/Excel'}
      </Button>
      {status && <p className="mt-2 text-sm text-gray-600">{status}</p>}
    </div>
  )
}
