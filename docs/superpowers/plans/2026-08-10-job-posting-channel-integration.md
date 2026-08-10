# Job Posting Channel Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) to implement plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status: DRAFT — not yet implemented.** Written 2026-08-10 for future execution. Re-verify file paths/line numbers against `main` before starting, since [[job-posting-modal]] work landed after this draft was written.

**Goal:** When HR marks a `job_postings.channels` entry as active (e.g. `email`), applications arriving through that channel should be auto-detected, turned into a `candidates` row with `applied_job_id` correctly set, and fed into the existing `agent_tasks` scoring pipeline — with zero manual data entry for the common case.

**Reality check (read before estimating):** Only **Email (Gmail)** is realistically automatable with a self-serve API. **LinkedIn does not offer a public API for reading Easy Apply submissions or DMs** — that data is only available via LinkedIn Talent Solutions' Recruiter System Connect, which requires a formal partner agreement (not self-serve, no public signup). This plan builds Gmail ingestion fully and treats LinkedIn as "manual bridge via existing CSV upload" rather than pretending auto-ingestion is possible.

**Architecture:**
```
Job posting created → app generates a unique "+tag" application address
  e.g. title "Kasir Outlet Kemang" → careers+kasir-kemang-a1b2@yourcompany.com
  (Gmail natively supports +tag routing to a single inbox — no extra domain config needed)

HR puts that address in the job ad (LinkedIn post, JobStreet, Instagram bio link, etc.)
        ↓
Applicant emails that address, optionally with CV attached
        ↓
Vercel Cron (every 10 min) → /api/cron/gmail-ingest
  → Gmail API: list unread messages in inbox
  → for each message: extract To-header +tag → match job_postings.application_email_tag
  → matched  → create candidate (source='external_email', applied_job_id=job.id),
               upload attachment to Supabase Storage → candidates.cv_url,
               enqueue agent_tasks type='score' (existing pipeline, unchanged)
  → unmatched → enqueue agent_tasks type='unmatched_email' status='needs_review'
               (payload holds raw sender/subject/body so HR can manually assign a job)
  → mark Gmail message as read + apply label "AgentBot/Processed" (idempotency —
    next poll's `is:unread` query naturally skips it, no separate dedup table needed)
```

**Tech Stack additions:** `googleapis` + `google-auth-library` (Gmail API, OAuth2 refresh-token flow — one-time consent from the mailbox owner, not per-candidate). No new DB engine, no new hosting — reuses Vercel Cron already used by `/api/cron/follow-up`.

## Global Constraints

- `createServiceClient()` from `@/lib/supabase/server` for all DB access — no direct Supabase client in components.
- `COMPANY_ID = process.env.COMPANY_ID!` in all server code — same pattern as every existing route.
- Reuse the **existing** `agent_tasks` → `/api/agent/run` → `/api/ai/score` pipeline unchanged for scoring newly-ingested candidates — do not build a parallel scoring path.
- `candidates.source` CHECK constraint only allows `'internal_wa' | 'external_email' | 'external_form' | 'import'` — email-ingested candidates use `'external_email'`. **Do not introduce new source values without a migration.**
- Gmail OAuth refresh token is a secret — store as `GMAIL_REFRESH_TOKEN` in `.env.local`/Vercel env, never log it, never expose to client code.
- Cron endpoints require `Authorization: Bearer ${CRON_SECRET}` — same guard as `/api/cron/follow-up`.
- All new tables/columns: additive migrations only (`alter table ... add column if not exists`), matching the style of `005_agent_tasks.sql`.

---

### Task 1: Migration — application email tag + unmatched-email task type

**Files:**
- Create: `supabase/migrations/006_email_ingestion.sql`

**Interfaces:**
- Produces: `job_postings.application_email_tag` (unique slug), extends `agent_tasks.type` CHECK to include `'unmatched_email'`.

- [ ] **Step 1: Write the migration**

```sql
-- 006_email_ingestion.sql

alter table job_postings add column if not exists application_email_tag text unique;

-- Backfill existing rows with a slug so the feature works retroactively
update job_postings
set application_email_tag = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 6)
where application_email_tag is null;

alter table agent_tasks drop constraint if exists agent_tasks_type_check;
alter table agent_tasks add constraint agent_tasks_type_check
  check (type in ('score', 'classify_reply', 'draft_follow_up', 'unmatched_email'));
```

- [ ] **Step 2: Verify the tag is unique and non-null for all jobs, re-run trigger logic in Task 2 for future inserts**
- [ ] **Step 3: Commit**

---

### Task 2: Auto-generate `application_email_tag` on job creation

**Files:**
- Modify: `app/api/jobs/route.ts`

**Interfaces:**
- `POST /api/jobs` response now includes `application_email_tag`.

- [ ] **Step 1: Slugify title + short id suffix on insert**

```ts
function slugify(title: string, seed: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return `${base}-${seed.slice(0, 6)}`
}
```

Generate the tag using `crypto.randomUUID()` as the seed *before* insert (since the row's own `id` isn't known yet), or insert first then `UPDATE ... set application_email_tag = ...` using the returned `id`. Prefer the second approach — matches the backfill logic in Task 1 exactly, avoids drift.

- [ ] **Step 2: Surface it in `JobModal.tsx` / `JobDetailClient.tsx`** — show a copyable "Alamat lamaran email" field (`careers+<tag>@yourcompany.com`, domain from a new `GMAIL_USER` env var) so HR can paste it into job ads.

---

### Task 3: Gmail API client

**Files:**
- Create: `lib/gmail/client.ts`

**Interfaces:**
- `listUnreadApplications(): Promise<GmailMessage[]>`
- `markProcessed(messageId: string): Promise<void>`
- `getAttachment(messageId: string, attachmentId: string): Promise<Buffer>`

**Setup prerequisite (manual, one-time, human-in-the-loop — cannot be scripted):**
1. Create a Google Cloud project, enable Gmail API.
2. OAuth consent screen (internal or external, testing mode is fine for a single mailbox).
3. Create OAuth Client ID (Desktop app type), run the standard `google-auth-library` local consent flow **once** against the target mailbox (e.g. `careers@yourcompany.com`) to obtain a refresh token.
4. Store `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER` in `.env.local` / Vercel env.

- [ ] **Step 1: Implement OAuth2 client + Gmail API wrapper**

```ts
import { google } from 'googleapis'

function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  )
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth: oauth2Client })
}

export async function listUnreadApplications() {
  const gmail = getGmailClient()
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread -label:AgentBot/Processed',
    maxResults: 25,
  })
  const messages = res.data.messages ?? []
  return Promise.all(messages.map(m => gmail.users.messages.get({ userId: 'me', id: m.id! })))
}

export async function markProcessed(messageId: string) {
  const gmail = getGmailClient()
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'], addLabelIds: [/* AgentBot/Processed label id */] },
  })
}
```

- [ ] **Step 2: Parse the `To` header for a `+tag` before the `@`**, e.g. `careers+kasir-kemang-a1b2@yourcompany.com` → `kasir-kemang-a1b2`. Handle multiple `To`/`Cc` recipients — check all of them.
- [ ] **Step 3: Extract plain-text/HTML body (strip tags for HTML) and any PDF/DOCX attachments.**

---

### Task 4: Ingestion cron endpoint

**Files:**
- Create: `app/api/cron/gmail-ingest/route.ts`
- Modify: `vercel.json` (add cron entry)

**Interfaces:**
- Consumes: `lib/gmail/client.ts`
- Produces: rows in `candidates`, `agent_tasks` — same shape as `app/api/candidates/upload/route.ts` already produces, so scoring "just works" without touching `/api/agent/run`.

- [ ] **Step 1: Add cron schedule**

```json
{
  "crons": [
    { "path": "/api/cron/follow-up", "schedule": "0 * * * *" },
    { "path": "/api/cron/gmail-ingest", "schedule": "*/10 * * * *" }
  ]
}
```

- [ ] **Step 2: Implement the route**

```ts
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  const messages = await listUnreadApplications()
  let matched = 0, unmatched = 0

  for (const msg of messages) {
    const tag = extractTag(msg)               // from Task 3, Step 2
    const { name, email, body } = parseApplicant(msg)

    const job = tag
      ? (await supabase.from('job_postings').select('id, position, outlet')
          .eq('application_email_tag', tag).eq('company_id', COMPANY_ID).single()).data
      : null

    if (job) {
      // Dedup: same email + same job already applied → skip re-creating, just mark processed
      const { data: existing } = await supabase.from('candidates')
        .select('id').eq('email', email).eq('applied_job_id', job.id).eq('company_id', COMPANY_ID).maybeSingle()

      if (!existing) {
        const cvUrl = await uploadAttachmentIfPresent(msg)   // Supabase Storage, bucket 'cvs'
        const { data: candidate } = await supabase.from('candidates').insert({
          company_id: COMPANY_ID, name, email, position: job.position, outlet: job.outlet,
          source: 'external_email', applied_job_id: job.id, cv_url: cvUrl, notes: body.slice(0, 500),
        }).select('id').single()

        await supabase.from('agent_tasks').insert({
          company_id: COMPANY_ID, type: 'score', payload: { candidate_id: candidate!.id },
        })
        matched++
      }
    } else {
      await supabase.from('agent_tasks').insert({
        company_id: COMPANY_ID, type: 'unmatched_email', status: 'needs_review',
        payload: { from: email, subject: msg.subject, snippet: body.slice(0, 300) },
      })
      unmatched++
    }

    await markProcessed(msg.id)
  }

  if (matched > 0) {
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/agent/run`, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    }).catch(() => {})
  }

  return NextResponse.json({ matched, unmatched })
}
```

- [ ] **Step 3: Handle Supabase Storage bucket setup** (`cvs`, public or signed-URL read) if not already present — check existing `candidates.cv_url` usage first; a bucket may already exist from manual CV linking.

---

### Task 5: Surface unmatched emails for manual triage

**Files:**
- Modify: `components/dashboard/ActionPanel.tsx`

**Interfaces:** none new — `ActionPanel` already queries `agent_tasks` where `status='needs_review'`; `type='unmatched_email'` rows will appear automatically. Only the label map needs updating.

- [ ] **Step 1: Add a label + distinct icon**

```ts
const TYPE_LABELS: Record<string, string> = {
  score: 'Scoring perlu diperiksa',
  classify_reply: 'Balasan WA ambigu',
  draft_follow_up: 'Follow-up perlu review',
  unmatched_email: 'Email lamaran tidak cocok dengan lowongan manapun',
}
```

- [ ] **Step 2 (stretch): a small "Assign to job" action** that reads `task.payload`, lets HR pick a `job_posting_id` from a dropdown, and on submit creates the `candidates` row (same shape as Task 4) + marks the task `done`. Can reuse `AddApplicantForm`'s POST pattern.

---

### Task 6: LinkedIn — document the real constraint, no code

**Files:**
- Modify: `components/jobs/JobForm.tsx` (tooltip only)

- [ ] **Step 1:** Next to the "LinkedIn" channel toggle, add a small info icon with tooltip: *"Auto-ingest tidak tersedia — LinkedIn API publik tidak mengizinkan akses ke data pelamar/DM tanpa partnership resmi (Recruiter System Connect). Ekspor daftar pelamar dari LinkedIn Recruiter secara manual, lalu gunakan tombol Upload CSV/Excel di halaman Kandidat dengan lowongan ini dipilih."*
- [ ] **Step 2:** No backend work. If LinkedIn partner access is ever secured, this task gets replaced by a real integration plan at that time — don't build speculative code against an API you don't have access to.

---

## Rollout order

1. Task 1 → 2 (schema + tag generation) — safe, no external dependency, ship first.
2. Task 6 (LinkedIn tooltip) — trivial, ship alongside Task 2.
3. Task 3 (Gmail OAuth setup) — **requires you personally to run the one-time consent flow** before Task 4 can be tested end-to-end. Budget time for Google Cloud project setup.
4. Task 4 → 5 — the actual ingestion + triage UI.
