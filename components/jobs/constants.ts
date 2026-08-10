export const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-600',
}

export const STATUS_FLOW: Record<string, string[]> = {
  draft: ['published', 'closed'],
  published: ['closed', 'draft'],
  closed: ['draft', 'published'],
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
}

export interface JobRecord {
  id: string
  title: string
  position: string
  outlet: string | null
  shift: string | null
  description: string | null
  requirements: string[] | null
  benefits: string[] | null
  salary_range: string | null
  channels: string[] | null
  status: string
}
