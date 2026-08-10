'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { STATUS_BADGE } from './constants'
import { JobModal } from './JobModal'

interface JobListItem {
  id: string
  title: string
  position: string
  outlet: string | null
  status: string
  created_at: string
}

export function JobsBoard({ jobs }: { jobs: JobListItem[] }) {
  const router = useRouter()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null

  function handleChanged() {
    router.refresh()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">
          Job Postings <span className="text-gray-400 font-normal text-base">({jobs.length})</span>
        </h1>
        <button
          onClick={() => setCreating(true)}
          className={cn(buttonVariants(), 'bg-[#1E3A2F] hover:bg-[#2d5242] gap-2')}
        >
          + Buat Lowongan
        </button>
      </div>

      {jobs.length === 0 ? (
        <p className="text-gray-500 text-sm">Belum ada lowongan. Buat yang pertama!</p>
      ) : (
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white">
          {jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJobId(job.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="space-y-0.5">
                <p className="font-medium text-gray-800 text-sm">{job.title}</p>
                <p className="text-xs text-gray-500">
                  {job.position}{job.outlet ? ` · ${job.outlet}` : ''}
                </p>
              </div>
              <Badge className={cn('text-xs font-medium border-0', STATUS_BADGE[job.status] ?? 'bg-gray-100 text-gray-600')}>
                {job.status}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <JobModal
        jobId={selectedJobId}
        creating={creating}
        onClose={() => { setSelectedJobId(null); setCreating(false) }}
        onChanged={handleChanged}
        snapshot={selectedJob ? {
          title: selectedJob.title,
          position: selectedJob.position,
          outlet: selectedJob.outlet,
          status: selectedJob.status,
        } : undefined}
      />
    </div>
  )
}
