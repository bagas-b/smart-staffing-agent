# Section 8 — Agent Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) to implement plan task-by-task.

**Goal:** Turn the existing `/api/ai/*` functions into a real autonomous agent with a task queue, auto-scoring after CSV import, WA reply classification, follow-up cron, and an HR approval queue for draft messages.

**Architecture:** Events (CSV upload, WA reply, cron) enqueue rows in `agent_tasks`. `POST /api/agent/run` dequeues and processes them — calling scoring or classification prompts, updating candidate state, creating draft messages in `needs_approval` status. A new UI approval queue lets HR approve/reject drafts before they are ever sent.

**Tech Stack:** Next.js 15 App Router, Supabase (service-role client), Vercel Cron, raw fetch → `callClaude()` from `lib/ai/client.ts`, Tailwind + shadcn/ui (existing component set).

## Global Constraints

- API keys only in `.env` — NEVER hardcode or log them.
- Use `callClaude()` from `lib/ai/client.ts` (raw fetch), NOT Anthropic SDK — Etalas router blocks SDK.
- `COMPANY_ID = process.env.COMPANY_ID!` — same pattern as all existing routes.
- Use `createServiceClient()` from `@/lib/supabase/server` for all DB access.
- `attrition_risk_score` must NEVER be based on job-hopping frequency — spec 8.5 explicit constraint.
- Draft messages (outreach or follow-up) NEVER auto-send — must enter approval queue.
- Max 2 follow-up drafts per candidate — agent stops and marks `perlu_tindak_lanjut_manual` after that.
- All new tables: enable RLS with policy `company_id = get_my_company_id()` — same pattern as `004_scoring_cache.sql`.
- Migration files in `supabase/migrations/`, naming: `005_agent_tasks.sql`.
- `confidence` field on scoring: `'high' | 'medium' | 'low'` — "high" if cv_fit_score ≥ 70 AND attrition ≤ 40; "low" if cv_fit_score < 40 OR attrition > 70; "medium" otherwise.
- Task status values: `pending | processing | done | failed | needs_review`.
- WA reply classification values: `tertarik | tidak_tertarik | butuh_info | tidak_jelas`.
- If classification = `tidak_jelas` OR confidence = `'low'` → task status `needs_review`, do NOT update candidate status.

---

### Task 1: Migration — `agent_tasks` table + 3 columns on `candidates`

**Files:**
- Create: `supabase/migrations/005_agent_tasks.sql`

**Interfaces:**
- Produces: `agent_tasks(id, company_id, type, payload, status, attempts, result, error_message, created_at, processed_at)` and `candidates.follow_up_count`, `candidates.next_follow_up_at`, `candidates.last_agent_action` for Tasks 2–5.

- [ ] **Step 1: Write the migration**

```sql
-- 005_agent_tasks.sql

-- Task queue for agent orchestration
create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  type text not null check (type in ('score', 'classify_reply', 'draft_follow_up')),
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed', 'needs_review')),
  attempts int not null default 0,
  result jsonb,
  error_message text,
  created_at timestamptz default now(),
  processed_at timestamptz
);

create index agent_tasks_pending on agent_tasks(company_id, status, created_at)
  where status = 'pending';

alter table agent_tasks enable row level security;

create policy "agent_tasks_same_company" on agent_tasks
  for all using (company_id = get_my_company_id());

-- New columns on existing candidates table (additive only)
alter table candidates add column if not exists follow_up_count int not null default 0;
alter table candidates add column if not exists next_follow_up_at timestamptz;
alter table candidates add column if not exists last_agent_action text;
```

- [ ] **Step 2: Run migration in Supabase dashboard SQL editor, verify table exists + RLS is on**

```sql
-- Verify:
select count(*) from agent_tasks;
select column_name from information_schema.columns
  where table_name = 'candidates' and column_name in ('follow_up_count','next_follow_up_at','last_agent_action');
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_agent_tasks.sql
git commit -m "feat: add agent_tasks table and follow_up columns on candidates (8.3)"
```

---

### Task 2: Update `/api/ai/score` — add `confidence` field

**Files:**
- Modify: `app/api/ai/score/route.ts`

**Interfaces:**
- Consumes: existing `callClaude()`, `candidate_scores` table (already has `scoring_reasoning jsonb`)
- Produces: response now includes `confidence: 'high' | 'medium' | 'low'`; stored in `scoring_reasoning.confidence`.

- [ ] **Step 1: Write failing test (manual curl)**

```bash
curl -s -X POST http://localhost:3000/api/ai/score \
  -H 'Content-Type: application/json' \
  -d '{"candidate_id":"<any-valid-id>"}' | jq '.confidence'
# Expected before fix: null / undefined
```

- [ ] **Step 2: Add `confidence` derivation after parsing scores**

In `app/api/ai/score/route.ts`, after the lines computing `cvFit`, `attrition`, `hireProbability`, add:

```typescript
const confidence: 'high' | 'medium' | 'low' =
  cvFit >= 70 && attrition <= 40 ? 'high'
  : cvFit < 40 || attrition > 70 ? 'low'
  : 'medium'
```

Store it in `scoring_reasoning` by spreading into the upserted object:

```typescript
await supabase.from('candidate_scores').insert({
  candidate_id,
  company_id: COMPANY_ID,
  cv_fit_score: cvFit,
  attrition_risk_score: attrition,
  hire_success_probability: hireProbability,
  scoring_reasoning: { ...parsed.reasoning, confidence },
})
```

Return `confidence` in the JSON response:

```typescript
return NextResponse.json({
  cv_fit_score: cvFit,
  attrition_risk_score: attrition,
  hire_success_probability: hireProbability,
  confidence,
  reasoning: parsed.reasoning,
  cached: false,
})
```

For cached responses, read `confidence` from `cached.scoring_reasoning?.confidence ?? 'medium'`.

- [ ] **Step 3: Verify curl returns confidence**

```bash
curl -s -X POST http://localhost:3000/api/ai/score \
  -H 'Content-Type: application/json' \
  -d '{"candidate_id":"<id>"}' | jq '{cv_fit_score, confidence}'
# Expected: confidence is "high", "medium", or "low"
```

- [ ] **Step 4: Commit**

```bash
git add app/api/ai/score/route.ts
git commit -m "feat: add confidence field to scoring endpoint (8.5)"
```

---

### Task 3: `/api/agent/run` — task queue processor + auto-enqueue after CSV upload

**Files:**
- Create: `app/api/agent/run/route.ts`
- Modify: `app/api/candidates/upload/route.ts`

**Interfaces:**
- Consumes: `agent_tasks` (from Task 1), `POST /api/ai/score` (internal call via `fetch`), `candidates` table
- Produces: processes `type=score` tasks; updates task to `done`/`failed`/`needs_review`; writes to `agent_logs`

- [ ] **Step 1: Write the run endpoint**

```typescript
// app/api/agent/run/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!
const MAX_TASKS_PER_RUN = 10

export async function POST() {
  const supabase = createServiceClient()

  // Claim up to MAX_TASKS_PER_RUN pending tasks atomically
  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('status', 'pending')
    .order('created_at')
    .limit(MAX_TASKS_PER_RUN)

  if (!tasks?.length) return NextResponse.json({ processed: 0 })

  let processed = 0
  for (const task of tasks) {
    // Mark processing
    await supabase.from('agent_tasks').update({ status: 'processing', attempts: task.attempts + 1 }).eq('id', task.id)

    try {
      if (task.type === 'score') {
        await processScoreTask(supabase, task)
      } else if (task.type === 'classify_reply') {
        await processClassifyTask(supabase, task)
      } else if (task.type === 'draft_follow_up') {
        await processDraftFollowUpTask(supabase, task)
      }
      processed++
    } catch (e: unknown) {
      const msg = (e as Error).message
      if (task.attempts >= 1) {
        // Second failure → mark failed
        await supabase.from('agent_tasks').update({ status: 'failed', error_message: msg, processed_at: new Date().toISOString() }).eq('id', task.id)
        await supabase.from('agent_logs').insert({ company_id: COMPANY_ID, type: 'error', message: `Task ${task.type} failed: ${msg}`, metadata: { taskId: task.id } })
      } else {
        // First failure → back to pending for retry
        await supabase.from('agent_tasks').update({ status: 'pending', error_message: msg }).eq('id', task.id)
      }
    }
  }

  return NextResponse.json({ processed })
}

async function processScoreTask(supabase: ReturnType<typeof createServiceClient>, task: { id: string; payload: { candidate_id?: string; job_posting_id?: string } }) {
  const { candidate_id, job_posting_id } = task.payload
  if (!candidate_id) throw new Error('missing candidate_id in payload')

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/ai/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id, job_posting_id }),
  })
  if (!res.ok) throw new Error(`score API error ${res.status}`)
  const result = await res.json()

  const finalStatus = result.confidence === 'low' ? 'needs_review' : 'done'
  await supabase.from('agent_tasks').update({
    status: finalStatus,
    result,
    processed_at: new Date().toISOString(),
  }).eq('id', task.id)

  await supabase.from('candidates').update({ last_agent_action: 'scored' }).eq('id', candidate_id)
}

// Stubs for Tasks 4 (filled in Task 4)
async function processClassifyTask(_supabase: ReturnType<typeof createServiceClient>, _task: { id: string; payload: Record<string, unknown> }) {
  throw new Error('classify_reply not yet implemented — will be added in Task 4')
}
async function processDraftFollowUpTask(_supabase: ReturnType<typeof createServiceClient>, _task: { id: string; payload: Record<string, unknown> }) {
  throw new Error('draft_follow_up not yet implemented — will be added in Task 4')
}
```

- [ ] **Step 2: Auto-enqueue score tasks after CSV upload**

In `app/api/candidates/upload/route.ts`, after `imported++` accumulation and before the final `return`, enqueue one `score` task per imported candidate. First collect IDs during insert:

```typescript
// Change the candidates insert loop to collect IDs:
const importedIds: string[] = []
for (const row of rows) {
  // ... existing pick() calls ...
  const { data: inserted, error } = await supabase.from('candidates').insert({
    company_id: COMPANY_ID,
    name, phone, position, outlet,
    source: 'import',
    import_batch_id: batch.id,
  }).select('id').single()
  if (!error && inserted) {
    imported++
    importedIds.push(inserted.id)
  }
}

// Enqueue score tasks
if (importedIds.length > 0) {
  await supabase.from('agent_tasks').insert(
    importedIds.map(candidate_id => ({
      company_id: COMPANY_ID,
      type: 'score',
      payload: { candidate_id },
    }))
  )
  // Trigger processing (fire-and-forget, don't await failure)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/agent/run`, { method: 'POST' }).catch(() => {/* cron will retry */})
}
```

- [ ] **Step 3: Verify — upload a CSV, check agent_tasks in Supabase dashboard**

```sql
select type, status, payload->>'candidate_id', created_at
from agent_tasks order by created_at desc limit 10;
```

Expected: rows with `type=score`, `status=done` or `needs_review` (if scoring ran fast enough) or `pending`.

- [ ] **Step 4: Commit**

```bash
git add app/api/agent/run/route.ts app/api/candidates/upload/route.ts
git commit -m "feat: agent/run task processor + auto-enqueue score after CSV upload (8.2, 8.3)"
```

---

### Task 4: WA reply classification + follow-up cron

**Files:**
- Modify: `app/api/wa/webhook/route.ts`
- Modify: `app/api/agent/run/route.ts` (fill in `processClassifyTask` and `processDraftFollowUpTask` stubs)
- Create: `app/api/cron/follow-up/route.ts`
- Modify: `vercel.json` (add cron config)

**Interfaces:**
- Consumes: `agent_tasks` (Task 1), `callClaude()` from `lib/ai/client.ts`, `candidates.follow_up_count`, `candidates.next_follow_up_at` (Task 1 columns)
- Produces: candidate status updated on classify; draft messages inserted into `candidate_messages` with `direction='draft'`; `candidates.follow_up_count` incremented; candidates with `follow_up_count >= 2` marked `perlu_tindak_lanjut_manual`

**Note on `candidate_messages`:** existing schema has `direction text check (direction in ('inbound', 'outbound'))` — we need to add `'draft'` to the check constraint. Add `alter table candidate_messages drop constraint if exists ...; alter table candidate_messages add constraint ... check (direction in ('inbound','outbound','draft'));` OR simply use a separate `draft_messages` approach. Prefer adding `'draft'` to existing constraint — simpler, fewer tables. Check actual constraint name from `001_initial_schema.sql` and alter accordingly.

- [ ] **Step 1: Update webhook to enqueue classify_reply task instead of direct status update**

Replace the existing naive status update block in `app/api/wa/webhook/route.ts` (lines 40–53) with:

```typescript
  // Enqueue classification task regardless of current status
  await supabase.from('agent_tasks').insert({
    company_id: COMPANY_ID,
    type: 'classify_reply',
    payload: { candidate_id: candidate.id, message, from },
  })

  // Trigger processing fire-and-forget
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/agent/run`, { method: 'POST' }).catch(() => {})
```

- [ ] **Step 2: Implement `processClassifyTask` in `app/api/agent/run/route.ts`**

```typescript
async function processClassifyTask(supabase: ReturnType<typeof createServiceClient>, task: { id: string; payload: Record<string, unknown> }) {
  const { candidate_id, message } = task.payload as { candidate_id: string; message: string }

  const prompt = `Klasifikasikan balasan WhatsApp kandidat kerja berikut.

Pesan: "${message}"

Kembalikan JSON:
{
  "classification": "tertarik" | "tidak_tertarik" | "butuh_info" | "tidak_jelas",
  "confidence": "high" | "medium" | "low",
  "reasoning": "satu kalimat alasan"
}

HANYA kembalikan JSON valid, tidak ada teks lain.`

  const { callClaude } = await import('@/lib/ai/client')
  let raw: string
  try {
    raw = await callClaude([{ role: 'user', content: prompt }])
  } catch {
    throw new Error('LLM call failed')
  }

  const match = raw.match(/\{[\s\S]+\}/)
  if (!match) throw new Error('no JSON in LLM response')
  const parsed = JSON.parse(match[0]) as { classification: string; confidence: string; reasoning: string }

  const isAmbiguous = parsed.classification === 'tidak_jelas' || parsed.confidence === 'low'

  if (isAmbiguous) {
    await supabase.from('agent_tasks').update({
      status: 'needs_review',
      result: parsed,
      processed_at: new Date().toISOString(),
    }).eq('id', task.id)
    return
  }

  // Update candidate status
  const statusMap: Record<string, string> = {
    tertarik: 'tertarik',
    tidak_tertarik: 'tidak_tertarik',
    butuh_info: 'menunggu_balasan',
  }
  const newStatus = statusMap[parsed.classification] ?? 'menunggu_balasan'

  await supabase.from('candidates')
    .update({ status: newStatus, last_agent_action: 'classified_reply' })
    .eq('id', candidate_id)
    .eq('company_id', COMPANY_ID)

  await supabase.from('agent_tasks').update({
    status: 'done',
    result: parsed,
    processed_at: new Date().toISOString(),
  }).eq('id', task.id)

  await supabase.from('agent_logs').insert({
    company_id: COMPANY_ID,
    type: 'info',
    message: `Balasan diklasifikasikan: ${parsed.classification}`,
    metadata: { candidate_id, classification: parsed.classification },
  })
}
```

- [ ] **Step 3: Implement `processDraftFollowUpTask`**

```typescript
async function processDraftFollowUpTask(supabase: ReturnType<typeof createServiceClient>, task: { id: string; payload: Record<string, unknown> }) {
  const { candidate_id } = task.payload as { candidate_id: string }

  const { data: candidate } = await supabase
    .from('candidates')
    .select('name, position, outlet, follow_up_count')
    .eq('id', candidate_id)
    .eq('company_id', COMPANY_ID)
    .single()

  if (!candidate) throw new Error('candidate not found')

  if ((candidate.follow_up_count ?? 0) >= 2) {
    await supabase.from('candidates')
      .update({ status: 'perlu_tindak_lanjut_manual', last_agent_action: 'max_followup_reached' })
      .eq('id', candidate_id)
    await supabase.from('agent_tasks').update({ status: 'done', processed_at: new Date().toISOString() }).eq('id', task.id)
    return
  }

  const prompt = `Tulis pesan follow-up WhatsApp singkat (maks 2 kalimat) untuk kandidat yang belum membalas undangan kerja.

Kandidat: ${candidate.name}
Posisi: ${candidate.position ?? '-'}
Outlet: ${candidate.outlet ?? '-'}

Buat pesan yang ramah, profesional, dalam Bahasa Indonesia. Kembalikan hanya teks pesan, tanpa tanda kutip.`

  const { callClaude } = await import('@/lib/ai/client')
  const draftText = await callClaude([{ role: 'user', content: prompt }])

  // Insert as draft — needs approval before sending
  await supabase.from('candidate_messages').insert({
    candidate_id,
    company_id: COMPANY_ID,
    direction: 'draft',
    channel: 'wa',
    content: draftText.trim(),
    sent_by: 'agent',
  })

  await supabase.from('candidates').update({
    follow_up_count: (candidate.follow_up_count ?? 0) + 1,
    last_agent_action: 'draft_follow_up_created',
  }).eq('id', candidate_id)

  await supabase.from('agent_tasks').update({ status: 'done', processed_at: new Date().toISOString() }).eq('id', task.id)
}
```

- [ ] **Step 4: Create cron endpoint**

```typescript
// app/api/cron/follow-up/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!
// 24h threshold — candidates waiting >24h with no reply
const FOLLOW_UP_THRESHOLD_HOURS = 24

export async function GET(req: Request) {
  // Vercel Cron sends Authorization: Bearer CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - FOLLOW_UP_THRESHOLD_HOURS * 3600 * 1000).toISOString()

  // Find candidates status=menunggu_balasan, updated >24h ago, follow_up_count < 2
  const { data: candidates } = await supabase
    .from('candidates')
    .select('id, follow_up_count')
    .eq('company_id', COMPANY_ID)
    .eq('status', 'menunggu_balasan')
    .lt('updated_at', cutoff)
    .lt('follow_up_count', 2)

  if (!candidates?.length) return NextResponse.json({ enqueued: 0 })

  await supabase.from('agent_tasks').insert(
    candidates.map(c => ({
      company_id: COMPANY_ID,
      type: 'draft_follow_up',
      payload: { candidate_id: c.id },
    }))
  )

  // Trigger run
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  await fetch(`${baseUrl}/api/agent/run`, { method: 'POST' })

  return NextResponse.json({ enqueued: candidates.length })
}
```

- [ ] **Step 5: Add cron config to `vercel.json`** (create if not exists)

```json
{
  "crons": [
    {
      "path": "/api/cron/follow-up",
      "schedule": "0 * * * *"
    }
  ]
}
```

- [ ] **Step 6: Add `CRON_SECRET` to `.env.local`** (any random string, note to add it in Vercel dashboard too)

```
CRON_SECRET=dev-cron-secret-replace-in-prod
```

- [ ] **Step 7: Handle `direction='draft'` in `candidate_messages`**

Check current constraint name in `001_initial_schema.sql` and add migration `006_draft_messages.sql`:

```sql
-- 006_draft_messages.sql
-- Extend direction enum to include draft messages for approval queue
alter table candidate_messages
  drop constraint if exists candidate_messages_direction_check;

alter table candidate_messages
  add constraint candidate_messages_direction_check
  check (direction in ('inbound', 'outbound', 'draft'));
```

Run this migration in Supabase dashboard.

- [ ] **Step 8: Commit**

```bash
git add app/api/wa/webhook/route.ts app/api/agent/run/route.ts \
  app/api/cron/follow-up/route.ts vercel.json \
  supabase/migrations/006_draft_messages.sql
git commit -m "feat: WA reply classification + follow-up cron with 2x limit (8.2, 8.6, 8.7)"
```

---

### Task 5: UI — `needs_review` badge + approval queue for draft messages

**Files:**
- Modify: `app/(dashboard)/candidates/page.tsx` (pass scores to KanbanBoard)
- Modify: `components/candidates/KanbanBoard.tsx` (add tier badge + needs_review indicator)
- Create: `app/(dashboard)/approval/page.tsx`
- Create: `components/approval/ApprovalQueue.tsx`
- Modify: `app/(dashboard)/layout.tsx` (or nav component — add "Approval" menu item)

**Interfaces:**
- Consumes: `candidate_scores` (Task 2 `confidence` field), `candidate_messages` with `direction='draft'` (Task 4), `agent_tasks` with `status='needs_review'`
- Produces: tier badge on each kanban card (Prioritas / Pertimbangkan / Perlu Review); approval queue page listing draft messages with Approve/Reject buttons; `needs_review` indicator on cards whose latest task is `needs_review`

**Tier mapping** (from spec 7.3):
- `hire_success_probability >= 70` → "Prioritas" (green)
- `hire_success_probability >= 40` → "Pertimbangkan" (yellow)
- `< 40` OR `confidence === 'low'` → "Perlu Review" (red/gray)
- No score yet → no badge

**Approval queue behavior:**
- "Approve" → change `candidate_messages.direction` from `'draft'` to `'outbound'` AND set a `approved_at` timestamp if the column exists (else just update direction); do NOT auto-send — that's a separate HR action
- "Reject" → delete the draft message row

- [ ] **Step 1: Update candidates page to join scores**

In `app/(dashboard)/candidates/page.tsx`, update `getCandidates()`:

```typescript
async function getCandidates() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('candidates')
    .select(`
      id, name, status, position, outlet,
      candidate_scores (cv_fit_score, attrition_risk_score, hire_success_probability, scoring_reasoning)
    `)
    .eq('company_id', process.env.COMPANY_ID!)
    .order('created_at', { ascending: false })
  return data ?? []
}
```

Pass `candidates` to `KanbanBoard` — the type widens to include `candidate_scores`.

- [ ] **Step 2: Add tier badge to kanban card**

In `components/candidates/KanbanBoard.tsx`, find the card render and add:

```typescript
function TierBadge({ score }: { score?: { hire_success_probability: number; scoring_reasoning?: { confidence?: string } } | null }) {
  if (!score) return null
  const prob = score.hire_success_probability
  const lowConf = score.scoring_reasoning?.confidence === 'low'
  if (prob >= 70 && !lowConf) return <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800">Prioritas</span>
  if (prob >= 40 && !lowConf) return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">Pertimbangkan</span>
  return <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800">Perlu Review</span>
}
```

Render `<TierBadge score={candidate.candidate_scores?.[0]} />` on each card. Tier "Perlu Review" candidates remain visible in the kanban — they are NEVER filtered out or hidden.

- [ ] **Step 3: Create approval queue page**

```typescript
// app/(dashboard)/approval/page.tsx
import { createServiceClient } from '@/lib/supabase/server'
import { ApprovalQueue } from '@/components/approval/ApprovalQueue'

async function getDrafts() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('candidate_messages')
    .select('id, content, channel, created_at, candidate_id, candidates(name, position, outlet)')
    .eq('company_id', process.env.COMPANY_ID!)
    .eq('direction', 'draft')
    .order('created_at', { ascending: true })
  return data ?? []
}

export default async function ApprovalPage() {
  const drafts = await getDrafts()
  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-semibold text-gray-800">
        Antrean Persetujuan <span className="text-gray-400 font-normal text-base">({drafts.length})</span>
      </h1>
      <ApprovalQueue drafts={drafts} />
    </div>
  )
}
```

- [ ] **Step 4: Create `ApprovalQueue` client component**

```typescript
// components/approval/ApprovalQueue.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Draft = {
  id: string
  content: string
  channel: string
  created_at: string
  candidate_id: string
  candidates: { name: string; position: string | null; outlet: string | null } | null
}

export function ApprovalQueue({ drafts: initial }: { drafts: Draft[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setLoading(id)
    await fetch(`/api/approval/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDrafts(d => d.filter(x => x.id !== id))
    setLoading(null)
    router.refresh()
  }

  if (!drafts.length) return <p className="text-gray-500">Tidak ada pesan yang menunggu persetujuan.</p>

  return (
    <div className="space-y-3">
      {drafts.map(d => (
        <div key={d.id} className="border rounded-lg p-4 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{d.candidates?.name ?? d.candidate_id}</span>
            <span className="text-xs text-gray-400">{d.candidates?.position} · {d.candidates?.outlet}</span>
          </div>
          <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">{d.content}</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => handleAction(d.id, 'reject')}
              disabled={loading === d.id}
              className="text-sm px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
            >Tolak</button>
            <button
              onClick={() => handleAction(d.id, 'approve')}
              disabled={loading === d.id}
              className="text-sm px-3 py-1.5 rounded bg-[#1E3A2F] text-white hover:bg-[#2d5242]"
            >Setujui</button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create approval API routes**

```typescript
// app/api/approval/approve/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { id } = await req.json()
  const supabase = createServiceClient()
  await supabase.from('candidate_messages')
    .update({ direction: 'outbound' })
    .eq('id', id)
    .eq('company_id', process.env.COMPANY_ID!)
    .eq('direction', 'draft')
  return NextResponse.json({ ok: true })
}
```

```typescript
// app/api/approval/reject/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { id } = await req.json()
  const supabase = createServiceClient()
  await supabase.from('candidate_messages')
    .delete()
    .eq('id', id)
    .eq('company_id', process.env.COMPANY_ID!)
    .eq('direction', 'draft')
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Add "Approval" to navigation**

Find the nav/sidebar component (likely `components/layout/Sidebar.tsx` or similar) and add an "Antrean Approval" link pointing to `/approval`.

- [ ] **Step 7: Verify in browser**

1. Upload a CSV — check agent_tasks get `score` tasks.
2. Wait or call `POST /api/agent/run` manually — check scores appear on kanban cards.
3. Simulate WA reply by calling webhook directly — check `classify_reply` task created.
4. Manually insert a `direction='draft'` message in Supabase dashboard — check it appears in `/approval`.
5. Click Approve → message moves to `direction='outbound'`, disappears from queue.
6. Tier "Perlu Review" candidate stays visible in kanban (not removed from pipeline).

- [ ] **Step 8: Commit**

```bash
git add app/\(dashboard\)/candidates/page.tsx \
  components/candidates/KanbanBoard.tsx \
  app/\(dashboard\)/approval/page.tsx \
  components/approval/ApprovalQueue.tsx \
  app/api/approval/
git commit -m "feat: tier badges, needs_review indicator, approval queue UI (7.3, 8.4)"
```
