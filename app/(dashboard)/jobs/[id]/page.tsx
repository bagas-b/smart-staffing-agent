import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { JobDetailClient } from '@/components/jobs/JobDetailClient'

async function getJob(id: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', id)
    .eq('company_id', process.env.COMPANY_ID!)
    .single()
  if (error) return null
  return data
}

async function getApplicants(jobId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('candidates')
    .select('id, name, status, position, outlet, candidate_scores(cv_fit_score, hire_success_probability, scoring_reasoning)')
    .eq('applied_job_id', jobId)
    .eq('company_id', process.env.COMPANY_ID!)
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await getJob(id)
  if (!job) notFound()
  const applicants = await getApplicants(id)

  return <JobDetailClient job={job} applicants={applicants} />
}
