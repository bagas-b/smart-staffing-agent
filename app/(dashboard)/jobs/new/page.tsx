'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { JobForm, type JobFormValues } from '@/components/jobs/JobForm'

export default function NewJobPage() {
  const router = useRouter()

  async function handleSubmit(values: JobFormValues) {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Gagal membuat lowongan')
    router.push(`/jobs/${data.id}`)
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={14} /> Kembali ke Job Postings
        </Link>
        <h1 className="text-xl font-semibold text-gray-800 mt-2">Buat Lowongan Baru</h1>
      </div>

      <JobForm submitLabel="Buat Lowongan" onSubmit={handleSubmit} />
    </div>
  )
}
