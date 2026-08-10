# "Chat" Menu — Telegram Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) to implement plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status: DRAFT — not yet implemented.** Written 2026-08-10 for future execution, as a stand-in messaging channel while WhatsApp (Baileys) credentials are unavailable. Re-verify file paths/line numbers against `main` before starting.

**Goal:** A new top-level "Chat" menu where HR can send/receive messages with candidates over Telegram, see all conversations in one inbox, and monitor bot connectivity — without needing the WA Baileys key. Built so it plugs into the **existing** messaging/classification pipeline rather than duplicating it.

**Why this is a clean fit:** `candidate_messages` is already channel-agnostic (`channel: 'wa' | 'email'`, extending to `'telegram'`), and `agent_tasks.type='classify_reply'` / `processClassifyTask` in `app/api/agent/run/route.ts` already work purely off `{ candidate_id, message }` — no WA-specific logic inside. Telegram inbound messages can enqueue the exact same task type and get the exact same AI classification, draft follow-up, and approval-queue behavior WA messages get today.

**Matching problem & chosen solution:** Telegram has no phone number to match against (unlike WA's `wa_chat_id`/`phone` lookup in `app/api/wa/webhook/route.ts`). Candidates don't have a Telegram account on file. **Chosen approach: per-candidate deep-link.** Generate a link `https://t.me/<bot_username>?start=<candidate_id>` for each candidate; when they open it and hit Start, Telegram sends the bot a `/start <candidate_id>` command carrying that payload, which the webhook uses to link `telegram_chat_id` to the right `candidates` row. HR sends this link to the candidate once (via the existing WA/email channels, or manually) as the "onboarding" step for Telegram contact.

**Architecture:**
```
HR clicks "Kirim Link Telegram" on a candidate → generates t.me/<bot>?start=<candidate_id>
        ↓ (HR sends this link to candidate some other way — email/WA/SMS)
Candidate taps link → opens Telegram → hits Start
        ↓
Telegram POSTs to /api/telegram/webhook  (registered once via setWebhook)
        ↓
/start <candidate_id> → candidates.telegram_chat_id = chat.id, confirmation reply sent
subsequent text  → candidate_messages insert (channel='telegram', direction='inbound')
                 → agent_tasks insert (type='classify_reply') — SAME pipeline as WA
                 → fire-and-forget POST /api/agent/run
        ↓
New "Chat" menu (/chat) — inbox UI, list of conversations, thread view, compose box
  → send button calls /api/telegram/send (mirrors /api/wa/send)
  → approval queue (/approval) sending real messages once approved (see Task 6 — this
    closes an existing gap where approve only flips direction without dispatching)
```

**Tech Stack additions:** none required for MVP — Telegram Bot API is plain HTTPS/JSON, no SDK needed (same "raw fetch" philosophy as `lib/ai/client.ts`). Optionally `grammy` or `node-telegram-bot-api` later if the webhook payload handling grows complex; start with raw `fetch`.

## Global Constraints

- `createServiceClient()` from `@/lib/supabase/server` for all DB access.
- `COMPANY_ID = process.env.COMPANY_ID!` in all server code.
- `TELEGRAM_BOT_TOKEN` — secret, `.env.local`/Vercel env only, never logged, never sent to the client.
- Webhook must validate Telegram's `X-Telegram-Bot-Api-Secret-Token` header against a `TELEGRAM_WEBHOOK_SECRET` you set yourself when calling `setWebhook` — same guard pattern as `BAILEYS_SECRET` in `app/api/wa/webhook/route.ts`. Do not skip this; an unauthenticated webhook lets anyone inject fake candidate messages.
- Reuse `agent_tasks` type `classify_reply` unchanged — do not fork a Telegram-specific classification path.
- `candidate_messages.channel` CHECK constraint currently only allows `('wa', 'email')` — must migrate to include `'telegram'` before any insert will succeed.
- Draft messages must still land in `direction='draft'` and go through `/approval` before send — same non-negotiable as the WA flow (spec 8.x constraint, do not bypass for Telegram).

---

### Task 1: Migration — telegram_chat_id + channel constraint

**Files:**
- Create: `supabase/migrations/007_telegram.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 007_telegram.sql

alter table candidates add column if not exists telegram_chat_id text;

create unique index if not exists candidates_telegram_chat_id_idx
  on candidates(telegram_chat_id) where telegram_chat_id is not null;

-- Confirm actual constraint name first: select conname from pg_constraint
-- where conrelid = 'candidate_messages'::regclass and contype = 'c';
alter table candidate_messages drop constraint if exists candidate_messages_channel_check;
alter table candidate_messages add constraint candidate_messages_channel_check
  check (channel in ('wa', 'email', 'telegram'));
```

- [ ] **Step 2: Run in Supabase SQL editor, verify:**

```sql
select column_name from information_schema.columns
  where table_name = 'candidates' and column_name = 'telegram_chat_id';
insert into candidate_messages (candidate_id, company_id, direction, channel, content)
  values ('<test-uuid>', '<company-uuid>', 'inbound', 'telegram', 'test'); -- should succeed, then delete it
```

- [ ] **Step 3: Commit**

---

### Task 2: Telegram Bot API client

**Files:**
- Create: `lib/telegram/client.ts`

**Interfaces:**
- `sendTelegramMessage(chatId: string, text: string): Promise<void>`
- `setWebhook(url: string): Promise<void>` (one-time setup script/route, not called per-request)
- `getBotInfo(): Promise<{ username: string; ... }>` (for the status/monitor panel)

- [ ] **Step 1: Implement, mirroring `lib/ai/client.ts`'s raw-fetch style**

```ts
const API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export async function sendTelegramMessage(chatId: string, text: string) {
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) throw new Error(`Telegram sendMessage error ${res.status}: ${await res.text()}`)
}

export async function getBotInfo() {
  const res = await fetch(`${API}/getMe`)
  if (!res.ok) throw new Error(`Telegram getMe error ${res.status}`)
  const data = await res.json()
  return data.result as { id: number; username: string; first_name: string }
}
```

- [ ] **Step 2: One-time webhook registration** — either a throwaway script or an authenticated admin-only route:

```ts
// called once manually after deploy, not part of the request lifecycle
await fetch(`${API}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/webhook`,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
  }),
})
```

---

### Task 3: Webhook — link candidates + ingest inbound messages

**Files:**
- Create: `app/api/telegram/webhook/route.ts`

**Interfaces:**
- Consumes: Telegram `Update` payload (`message.chat.id`, `message.text`, `message.from`).
- Produces: `candidates.telegram_chat_id` (on `/start`), `candidate_messages` rows, `agent_tasks` rows (`type='classify_reply'`) — same shape `app/api/wa/webhook/route.ts` already produces.

- [ ] **Step 1: Validate the secret header, parse payload**

```ts
export async function POST(req: NextRequest) {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const update = await req.json()
  const message = update.message
  if (!message?.text) return NextResponse.json({ ok: true })  // ignore non-text updates for MVP

  const chatId = String(message.chat.id)
  const supabase = createServiceClient()
```

- [ ] **Step 2: Handle `/start <candidate_id>` — link the chat**

```ts
  if (message.text.startsWith('/start')) {
    const candidateId = message.text.split(' ')[1]?.trim()
    if (!candidateId) return NextResponse.json({ ok: true })

    const { data: candidate, error } = await supabase
      .from('candidates')
      .update({ telegram_chat_id: chatId })
      .eq('id', candidateId)
      .eq('company_id', COMPANY_ID)
      .select('name')
      .single()

    if (candidate) {
      await sendTelegramMessage(chatId,
        `Halo ${candidate.name}! Chat ini sudah terhubung dengan tim HR Greenly Cloud Kitchen. Kami akan menghubungi kamu di sini.`)
    }
    return NextResponse.json({ ok: true })
  }
```

- [ ] **Step 3: Handle regular inbound text — mirror `wa/webhook`'s tail exactly**

```ts
  const { data: candidate } = await supabase
    .from('candidates').select('id, status')
    .eq('telegram_chat_id', chatId).eq('company_id', COMPANY_ID).single()

  if (!candidate) return NextResponse.json({ ok: true })  // unlinked chat — ignore for MVP (see Task 7)

  await supabase.from('candidate_messages').insert({
    candidate_id: candidate.id, company_id: COMPANY_ID,
    direction: 'inbound', channel: 'telegram', content: message.text, sent_by: chatId,
  })

  await supabase.from('agent_tasks').insert({
    company_id: COMPANY_ID, type: 'classify_reply',
    payload: { candidate_id: candidate.id, message: message.text }, status: 'pending', attempts: 0,
  })

  fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/agent/run`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
```

---

### Task 4: Send route + candidate deep-link generator

**Files:**
- Create: `app/api/telegram/send/route.ts` (mirrors `app/api/wa/send/route.ts`)
- Modify: `components/candidates/CandidateModal.tsx` — "Kirim Link Telegram" action when `telegram_chat_id` is null

- [ ] **Step 1: Send route**

```ts
export async function POST(req: NextRequest) {
  const { candidateId, message } = await req.json()
  const supabase = createServiceClient()
  const { data: candidate } = await supabase.from('candidates')
    .select('telegram_chat_id').eq('id', candidateId).eq('company_id', COMPANY_ID).single()

  if (!candidate?.telegram_chat_id) return NextResponse.json({ error: 'candidate not linked to Telegram' }, { status: 400 })

  await sendTelegramMessage(candidate.telegram_chat_id, message)

  await supabase.from('candidate_messages').insert({
    candidate_id: candidateId, company_id: COMPANY_ID,
    direction: 'outbound', channel: 'telegram', content: message, sent_by: 'agent',
  })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Deep-link UI** — when `candidate.telegram_chat_id` is null, show a copyable link `https://t.me/<bot_username>?start=<candidate.id>` (bot username from `getBotInfo()`, cache it — doesn't change) plus a short instruction: *"Kirimkan link ini ke kandidat lewat WA/email agar chat Telegram bisa terhubung."*

---

### Task 5: New "Chat" menu — inbox UI

**Files:**
- Create: `app/(dashboard)/chat/page.tsx`
- Create: `components/chat/ChatInbox.tsx`
- Create: `components/chat/ChatThread.tsx`
- Create: `app/api/chat/conversations/route.ts` (list candidates with `candidate_messages`, most-recent-first)
- Modify: sidebar nav component (find via `Grep "Dashboard.*Candidates.*Jobs" app/(dashboard)` — likely `components/layout/Sidebar.tsx` or similar) — add "Chat" entry

**Interfaces:**
- `GET /api/chat/conversations` → `{ candidateId, name, lastMessage, lastMessageAt, channel, unread }[]`
- `ChatInbox` — left panel, conversation list, click → sets selected candidate
- `ChatThread` — right panel, full message history + compose box for the selected candidate, reusing the send logic from `MessageHistory.tsx` generalized to also POST `/api/telegram/send` when `channel==='telegram'`

- [ ] **Step 1: Conversations list query**

```ts
// naive first pass: one query per candidate that has any candidate_messages,
// ordered by MAX(candidate_messages.created_at) desc — revisit with a materialized
// view or last_message_at column on candidates if this gets slow at scale
const { data } = await supabase
  .from('candidates')
  .select('id, name, candidate_messages(content, created_at, direction, channel)')
  .eq('company_id', COMPANY_ID)
  .not('candidate_messages', 'is', null)
```

Sort client-side by each candidate's latest `candidate_messages` timestamp; "unread" = latest message is `direction='inbound'` and newer than the latest `direction='outbound'`.

- [ ] **Step 2: Two-pane layout** — `ChatInbox` (list, ~320px fixed width) + `ChatThread` (flex-1), similar visual language to `CandidateModal`'s message bubbles (`components/candidates/CandidateModal.tsx`'s `MessageBubble`) — consider extracting that component to `components/shared/MessageBubble.tsx` so both places render bubbles identically.
- [ ] **Step 3: Compose box in `ChatThread`** — channel-aware: if the open candidate only has `telegram_chat_id` (no WA), POST to `/api/telegram/send`; if only WA-linked, POST to `/api/wa/send`; if both, show a small channel picker. Draft-vs-send behavior: for MVP, sending directly from the Chat inbox is a deliberate HR action (not an AI draft) — it can bypass the `/approval` queue, since a human is typing it live right there. AI-generated drafts (`draft_follow_up`, `classify_reply`'s "butuh_info" auto-draft) still always go through `/approval` regardless of channel.
- [ ] **Step 4: Nav entry** — add between "Kandidat" and "Approval" (or wherever fits), icon suggestion: `MessageCircle` from `lucide-react`.

---

### Task 6: Monitor panel — bot connectivity status

**Files:**
- Create: `app/api/telegram/status/route.ts` (mirrors `app/api/wa/status/route.ts`)
- Modify: `app/(dashboard)/chat/page.tsx` — small status pill in the header

- [ ] **Step 1:**

```ts
export async function GET() {
  try {
    const info = await getBotInfo()
    return NextResponse.json({ status: 'connected', username: info.username })
  } catch {
    return NextResponse.json({ status: 'disconnected' })
  }
}
```

- [ ] **Step 2:** Green/red dot + "@botusername" text in the Chat page header, polling every 30s (same pattern as `AgentLogFeed`'s 15s poll).

---

### Task 7 (closes an existing gap, not Telegram-specific): make `/approval` actually send

**Files:**
- Modify: `app/api/approval/approve/route.ts`

**Why this belongs here:** currently `approve` only flips `candidate_messages.direction` from `draft` to `outbound` — it never calls `sendWA` or (with this plan) `sendTelegramMessage`. Approved AI drafts silently never leave the building. Worth fixing while touching this path for Telegram, since the fix is channel-dispatch logic this plan already needs.

- [ ] **Step 1: Look up the draft's `channel` + candidate contact info, dispatch accordingly, then flip direction only on send success**

```ts
const { data: draft } = await serviceSupabase.from('candidate_messages')
  .select('id, channel, content, candidate_id, candidates(phone, telegram_chat_id)')
  .eq('id', id).eq('company_id', COMPANY_ID).eq('direction', 'draft').single()

if (!draft) return NextResponse.json({ error: 'draft not found' }, { status: 404 })

if (draft.channel === 'telegram') {
  if (!draft.candidates?.telegram_chat_id) return NextResponse.json({ error: 'candidate not linked to Telegram' }, { status: 400 })
  await sendTelegramMessage(draft.candidates.telegram_chat_id, draft.content)
} else if (draft.channel === 'wa') {
  if (!draft.candidates?.phone) return NextResponse.json({ error: 'candidate has no phone' }, { status: 400 })
  await sendWA(draft.candidates.phone, draft.content)
}

await serviceSupabase.from('candidate_messages').update({ direction: 'outbound' }).eq('id', id)
```

- [ ] **Step 2:** Wrap the dispatch in try/catch — on failure, leave `direction='draft'` and surface the error to the HR user instead of silently marking it sent.

---

## Rollout order

1. Task 1 (migration) — do first, blocks everything else.
2. Task 2 → 3 (bot client + webhook) — **requires the bot token you already have** and one manual `setWebhook` call after first deploy (needs a public HTTPS URL, so this can't be fully tested on `localhost` — use a tunnel like `ngrok`/`cloudflared` for local dev, or test against the Vercel preview deployment).
3. Task 4 (send + deep-link) — testable once Task 3 is live.
4. Task 5 (Chat inbox UI) — the actual new menu; biggest single chunk of work, can be built in parallel with Task 3 against mock data.
5. Task 6 (status pill) — trivial, ship alongside Task 5.
6. Task 7 (approval dispatch fix) — do last since it touches an existing route; also fixes the same gap for WA once Baileys keys are available again.
