import { createServiceClient } from '@/lib/supabase/server'
import { JobsBoard } from '@/components/jobs/JobsBoard'

// Force per-request rendering — otherwise this gets statically prerendered at
// build time and never reflects new/updated job postings.
export const dynamic = 'force-dynamic'

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
  return <JobsBoard jobs={jobs} />
}
