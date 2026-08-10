# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the dashboard to be agent-aware — showing what the agent has done, what needs HR attention today, and top candidate recommendations from scoring data.

**Architecture:** All data fetched server-side in `page.tsx` via a single aggregated query function. New panels are pure display components that receive typed props — no client-side fetching except `AgentLogFeed` which polls for live activity. `page.tsx` is owned by Task 1 and imports all new components; Tasks 2–4 only create component files.

**Tech Stack:** Next.js 15 App Router, Supabase service client, Tailwind CSS, lucide-react icons (already installed).

## Global Constraints

- `createServiceClient()` from `@/lib/supabase/server` for all DB access — no direct Supabase client in components
- `COMPANY_ID = process.env.COMPANY_ID!` in all server code
- Brand color: `bg-[#1E3A2F]` / `text-[#1E3A2F]` for primary accents
- No new npm dependencies
- TypeScript — inline types only, no separate type files
- Tailwind only — no new CSS files
- All components in `components/dashboard/`
- Tier thresholds (verbatim from spec §7.3): `hire_success_probability >= 70` AND `confidence !== 'low'` → Prioritas; `>= 40` → Pertimbangkan; else → Perlu Review
- `reasoning.recommendation` comes from `candidate_scores.scoring_reasoning.recommendation` (jsonb field)

---

### Task 1: Stat cards + page.tsx data orchestration

**Files:**
- Modify: `app/(dashboard)/page.tsx`
- Modify: `components/dashboard/StatCard.tsx`

**Interfaces:**
- Produces: `DashboardStats` shape consumed by `page.tsx` JSX; `StatCard` accepts `{ label, value, color?, icon?, href? }`

The existing `page.tsx` only queries `candidates.status`. This task replaces it with a single aggregated query and updates `StatCard` to support an optional link and icon.

- [ ] **Step 1: Update `StatCard` to support `href` and `icon`**

Replace `components/dashboard/StatCard.tsx` entirely:

```typescript
import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number
  color?: string
  icon?: LucideIcon
  href?: string
}

function CardInner({ label, value, color = '#1E3A2F', icon: Icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-gray-500">{label}</p>
        {Icon && <Icon size={16} className="text-gray-400" />}
      </div>
      <p className="text-3xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )
}

export function StatCard(props: StatCardProps) {
  if (props.href) {
    return (
      <Link href={props.href} className="block hover:shadow-md transition-shadow rounded-lg">
        <CardInner {...props} />
      </Link>
    )
  }
  return <CardInner {...props} />
}
```

- [ ] **Step 2: Replace `page.tsx` with aggregated data fetch + 6 stat cards**

Replace `app/(dashboard)/page.tsx` entirely:

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/dashboard/StatCard'
import { AgentLogFeed } from '@/components/dashboard/AgentLogFeed'
import { ActionPanel } from '@/components/dashboard/ActionPanel'
import { RecommendationPanel } from '@/components/dashboard/RecommendationPanel'
import { PipelineSummary } from '@/components/dashboard/PipelineSummary'
import { Users, Clock, AlertTriangle, CheckSquare, TrendingUp, Activity } from 'lucide-react'

async function getDashboardData() {
  const supabase = createServiceClient()
  const companyId = process.env.COMPANY_ID!

  const [candidatesRes, pendingApprovalRes, needsReviewRes] = await Promise.all([
    supabase.from('candidates').select('id, status').eq('company_id', companyId),
    supabase.from('candidate_messages')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('direction', 'draft'),
    supabase.from('agent_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'needs_review'),
  ])

  const candidates = candidatesRes.data ?? []
  return {
    total: candidates.length,
    menunggu: candidates.filter(c => c.status === 'menunggu_balasan').length,
    tertarik: candidates.filter(c => c.status === 'tertarik').length,
    aktif: candidates.filter(c => c.status === 'aktif').length,
    pendingApproval: pendingApprovalRes.count ?? 0,
    needsReview: needsReviewRes.count ?? 0,
    candidateStatuses: candidates,
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardData()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Kandidat" value={stats.total} icon={Users} />
        <StatCard label="Menunggu Balasan" value={stats.menunggu} color="#d97706" icon={Clock} />
        <StatCard label="Tertarik" value={stats.tertarik} color="#2563eb" icon={TrendingUp} />
        <StatCard label="Aktif" value={stats.aktif} color="#16a34a" icon={Activity} />
        <StatCard label="Perlu Review" value={stats.needsReview} color="#dc2626" icon={AlertTriangle} href="/candidates" />
        <StatCard label="Menunggu Approval" value={stats.pendingApproval} color="#7c3aed" icon={CheckSquare} href="/approval" />
      </div>

      <PipelineSummary candidates={stats.candidateStatuses} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionPanel />
        <RecommendationPanel />
      </div>

      <AgentLogFeed />
    </div>
  )
}
```

- [ ] **Step 3: Verify page compiles — start dev server and check for TypeScript errors**

```bash
# In worktree directory:
npx tsc --noEmit 2>&1 | head -20
```

Expected: errors only about missing `ActionPanel`, `RecommendationPanel`, `PipelineSummary` imports (will be created in Tasks 2–4). No other errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/page.tsx components/dashboard/StatCard.tsx
git commit -m "feat: dashboard stat cards with agent metrics and icons"
```

---

### Task 2: ActionPanel — "Butuh Tindakan Hari Ini"

**Files:**
- Create: `components/dashboard/ActionPanel.tsx`

**Interfaces:**
- Consumes: queries `agent_tasks` (needs_review) and `candidate_messages` (draft) directly via server fetch from `/api/` endpoints
- Produces: `export function ActionPanel()` — async server component, no props

This is a server component that queries the two most urgent HR action items: tasks flagged `needs_review` (agent couldn't decide) and draft messages waiting for approval.

- [ ] **Step 1: Create `ActionPanel.tsx`**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, MessageSquare } from 'lucide-react'

async function getActionItems() {
  const supabase = createServiceClient()
  const companyId = process.env.COMPANY_ID!

  const [reviewTasksRes, draftsRes] = await Promise.all([
    supabase
      .from('agent_tasks')
      .select('id, type, payload, created_at')
      .eq('company_id', companyId)
      .eq('status', 'needs_review')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('candidate_messages')
      .select('id, content, created_at, candidates(name, position)')
      .eq('company_id', companyId)
      .eq('direction', 'draft')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    reviewTasks: reviewTasksRes.data ?? [],
    drafts: (draftsRes.data ?? []) as Array<{
      id: string
      content: string
      created_at: string
      candidates: { name: string; position: string | null } | null
    }>,
  }
}

const TYPE_LABELS: Record<string, string> = {
  score: 'Scoring perlu diperiksa',
  classify_reply: 'Balasan WA ambigu',
  draft_follow_up: 'Follow-up perlu review',
}

export async function ActionPanel() {
  const { reviewTasks, drafts } = await getActionItems()
  const totalActions = reviewTasks.length + drafts.length

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-5 py-3 border-b flex items-center justify-between">
        <span className="font-medium text-sm text-gray-700">Butuh Tindakan HR</span>
        {totalActions > 0 && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
            {totalActions}
          </span>
        )}
      </div>

      <div className="divide-y max-h-72 overflow-y-auto">
        {reviewTasks.map(task => (
          <Link key={task.id} href="/candidates"
            className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">{TYPE_LABELS[task.type] ?? task.type}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(task.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          </Link>
        ))}

        {drafts.map(draft => (
          <Link key={draft.id} href="/approval"
            className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
            <MessageSquare size={14} className="text-purple-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">
                {draft.candidates?.name ?? 'Kandidat'} — {draft.candidates?.position ?? '-'}
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{draft.content}</p>
            </div>
          </Link>
        ))}

        {totalActions === 0 && (
          <p className="p-4 text-sm text-gray-400">Tidak ada tindakan yang perlu dilakukan.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors in this file**

```bash
npx tsc --noEmit 2>&1 | grep ActionPanel
```

Expected: no errors referencing `ActionPanel.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/ActionPanel.tsx
git commit -m "feat: dashboard ActionPanel — HR action items (needs_review + pending drafts)"
```

---

### Task 3: RecommendationPanel — Top kandidat dengan rekomendasi agent

**Files:**
- Create: `components/dashboard/RecommendationPanel.tsx`

**Interfaces:**
- Consumes: `candidate_scores.scoring_reasoning` (jsonb with `recommendation`, `strengths`, `confidence`), `candidates.name`, `candidates.position`
- Produces: `export async function RecommendationPanel()` — async server component, no props

Shows top 5 candidates by `hire_success_probability` with their agent recommendation text. This is the key "smart" feature — surfaces `reasoning.recommendation` that was previously buried in candidate detail page.

- [ ] **Step 1: Create `RecommendationPanel.tsx`**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

type ScoredCandidate = {
  candidate_id: string
  hire_success_probability: number
  cv_fit_score: number
  scoring_reasoning: {
    recommendation?: string
    strengths?: string[]
    confidence?: string
  } | null
  candidates: {
    id: string
    name: string
    position: string | null
    outlet: string | null
  } | null
}

async function getTopCandidates(): Promise<ScoredCandidate[]> {
  const supabase = createServiceClient()
  const companyId = process.env.COMPANY_ID!

  const { data } = await supabase
    .from('candidate_scores')
    .select(`
      candidate_id,
      hire_success_probability,
      cv_fit_score,
      scoring_reasoning,
      candidates!inner(id, name, position, outlet)
    `)
    .eq('company_id', companyId)
    .order('hire_success_probability', { ascending: false })
    .limit(5)

  return (data ?? []) as ScoredCandidate[]
}

function TierBadge({ prob, confidence }: { prob: number; confidence?: string }) {
  const isLow = confidence === 'low'
  if (prob >= 70 && !isLow) return <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800">Prioritas</span>
  if (prob >= 40 && !isLow) return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">Pertimbangkan</span>
  return <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800">Perlu Review</span>
}

export async function RecommendationPanel() {
  const candidates = await getTopCandidates()

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-5 py-3 border-b">
        <span className="font-medium text-sm text-gray-700">Rekomendasi Agent</span>
        <p className="text-xs text-gray-400 mt-0.5">Top kandidat berdasarkan skor AI</p>
      </div>

      <div className="divide-y max-h-72 overflow-y-auto">
        {candidates.map((c) => {
          const reasoning = c.scoring_reasoning
          return (
            <Link key={c.candidate_id} href={`/candidates/${c.candidate_id}`}
              className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{c.candidates?.name}</span>
                  <TierBadge prob={c.hire_success_probability} confidence={reasoning?.confidence} />
                </div>
                <p className="text-xs text-gray-500">
                  {c.candidates?.position ?? '-'} · {c.candidates?.outlet ?? '-'} · Skor: {c.hire_success_probability}
                </p>
                {reasoning?.recommendation && (
                  <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 line-clamp-2">
                    {reasoning.recommendation}
                  </p>
                )}
              </div>
            </Link>
          )
        })}

        {candidates.length === 0 && (
          <p className="p-4 text-sm text-gray-400">Belum ada kandidat yang di-score. Upload CSV untuk memulai.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep RecommendationPanel
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/RecommendationPanel.tsx
git commit -m "feat: dashboard RecommendationPanel — top candidates with agent reasoning"
```

---

### Task 4: PipelineSummary — Funnel horizontal compact

**Files:**
- Create: `components/dashboard/PipelineSummary.tsx`

**Interfaces:**
- Consumes: `candidates: Array<{ id: string; status: string }>` passed from `page.tsx` (already fetched in Task 1)
- Produces: `export function PipelineSummary({ candidates }: { candidates: Array<{ id: string; status: string }> })`

A client component showing a compact horizontal pipeline funnel — each stage with its count and a visual bar proportional to total. Helps HR see where candidates are stuck at a glance.

- [ ] **Step 1: Create `PipelineSummary.tsx`**

```typescript
const PIPELINE_STAGES = [
  { key: 'belum_dihubungi', label: 'Belum Dihubungi', color: 'bg-gray-400' },
  { key: 'menunggu_balasan', label: 'Menunggu', color: 'bg-yellow-400' },
  { key: 'tertarik', label: 'Tertarik', color: 'bg-blue-400' },
  { key: 'interview_dijadwalkan', label: 'Interview', color: 'bg-purple-400' },
  { key: 'lulus_interview', label: 'Lulus', color: 'bg-teal-400' },
  { key: 'onboarding', label: 'Onboarding', color: 'bg-emerald-400' },
  { key: 'aktif', label: 'Aktif', color: 'bg-green-500' },
]

interface Props {
  candidates: Array<{ id: string; status: string }>
}

export function PipelineSummary({ candidates }: Props) {
  const counts = Object.fromEntries(
    PIPELINE_STAGES.map(s => [s.key, candidates.filter(c => c.status === s.key).length])
  )
  const max = Math.max(...Object.values(counts), 1)

  return (
    <div className="bg-white rounded-lg border shadow-sm p-5">
      <p className="text-sm font-medium text-gray-700 mb-4">Pipeline Kandidat</p>
      <div className="grid grid-cols-7 gap-2">
        {PIPELINE_STAGES.map(stage => {
          const count = counts[stage.key]
          const heightPct = Math.round((count / max) * 100)
          return (
            <div key={stage.key} className="flex flex-col items-center gap-1">
              <span className="text-sm font-semibold text-gray-800">{count}</span>
              <div className="w-full bg-gray-100 rounded-full overflow-hidden" style={{ height: 40 }}>
                <div
                  className={`w-full rounded-full transition-all ${stage.color}`}
                  style={{ height: `${heightPct}%`, marginTop: `${100 - heightPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 text-center leading-tight">{stage.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep PipelineSummary
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/PipelineSummary.tsx
git commit -m "feat: dashboard PipelineSummary — horizontal pipeline funnel"
```

---

### Task 5: AgentLogFeed — auto-polling + error highlighting

**Files:**
- Modify: `components/dashboard/AgentLogFeed.tsx`

**Interfaces:**
- Consumes: `GET /api/agent-logs` — returns `Array<{ id, type, message, created_at, metadata? }>`
- Produces: same export `AgentLogFeed` — client component, no props

Add auto-polling every 15 seconds and make `error` type entries more prominent with a distinct style.

- [ ] **Step 1: Replace `AgentLogFeed.tsx`**

```typescript
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
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep AgentLogFeed
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/AgentLogFeed.tsx
git commit -m "feat: AgentLogFeed auto-polling 15s, error highlighting"
```
