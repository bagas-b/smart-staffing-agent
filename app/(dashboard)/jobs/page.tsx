import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-600',
}

async function getJobs() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('job_postings')
    .select('id, title, position, outlet, status, created_at')
    .eq('company_id', process.env.COMPANY_ID!)
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function JobsPage() {
  const jobs = await getJobs()

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">
          Job Postings <span className="text-gray-400 font-normal text-base">({jobs.length})</span>
        </h1>
        <Link
          href="/jobs/new"
          className={cn(buttonVariants(), 'bg-[#1E3A2F] hover:bg-[#2d5242] gap-2')}
        >
          + Buat Lowongan
        </Link>
      </div>

      {jobs.length === 0 ? (
        <p className="text-gray-500 text-sm">Belum ada lowongan. Buat yang pertama!</p>
      ) : (
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
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
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
