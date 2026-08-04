# Smart Staffing Agent — Product Design Spec

**Date:** 2026-08-04  
**Client:** Greenly Cloud Kitchen  
**Stack:** Next.js 15 + Supabase + Baileys (WA) + Anthropic API  
**Solo developer, single tenant Phase 1, multi-tenant ready**

---

## 1. System Architecture

**Chosen: Option A — Next.js (Vercel) + Supabase + Baileys (VPS)**

```
┌─────────────────────────────────────┐
│ Vercel                              │
│  Next.js 15 App Router              │
│  API Routes (backend logic)         │
│  Vercel Cron (Gmail polling, P2)    │
└──────────────┬──────────────────────┘
               │ HTTP + shared secret
┌──────────────▼──────────────────────┐
│ VPS (DigitalOcean existing)         │
│  Baileys WA service (Node.js :3001) │
│  Nginx reverse proxy                │
│  Systemd service                    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ Supabase (managed)                  │
│  PostgreSQL + Auth + Storage        │
└─────────────────────────────────────┘
```

**Rationale:**
- Next.js full-stack di Vercel: auto-deploy, zero infra management, API routes menggantikan FastAPI
- Supabase: PostgreSQL + Auth + Storage dalam satu platform, free tier cukup untuk Phase 1
- Baileys tetap di VPS karena butuh persistent WebSocket — tidak bisa di serverless
- VPS existing dipakai ulang, tidak perlu infra baru

---

## 2. Database Schema

Semua tabel memiliki `company_id` untuk multi-tenant readiness. UI multi-company tidak dibangun sampai Phase 2+.

```sql
-- Multi-tenant foundation
companies (
  id, name, wa_number, email, logo_url, created_at
)

-- Auth managed by Supabase Auth (auth.users)
profiles (
  id → auth.users,
  company_id,
  full_name,
  role: admin | hr,
  avatar_url
)

-- Job Postings
job_postings (
  id, company_id,
  title, position, outlet, shift,
  description, requirements[], benefits[], salary_range,
  channels[],  -- wa_group | email | instagram | etc
  status: draft | published | closed,
  created_by → profiles,
  created_at, updated_at
)

-- Candidates
candidates (
  id, company_id,
  name, phone, email,
  wa_chat_id,               -- untuk WA agent
  position, outlet,
  source: internal_wa | external_email | external_form | import,
  import_batch_id → candidate_imports,  -- nullable
  cv_url,                   -- nullable, Phase 2 (Supabase Storage)
  applied_job_id → job_postings,  -- nullable
  status: belum_dihubungi | menunggu_balasan | tertarik |
          butuh_info | tidak_tertarik | interview_dijadwalkan |
          lulus_interview | tidak_lulus | onboarding | aktif,
  notes,
  created_at, updated_at
)

-- Batch import tracking
candidate_imports (
  id, company_id,
  filename,
  imported_by → profiles,
  total_rows, success_rows,
  imported_at
)

-- Message history per kandidat
candidate_messages (
  id, candidate_id, company_id,
  direction: inbound | outbound,
  channel: wa | email,
  content,
  message_type,
  sent_by,  -- "agent" atau profile id
  created_at
)

-- Agent activity log
agent_logs (
  id, company_id,
  type: success | info | warning | error,
  message,
  metadata jsonb,
  created_at
)

-- HR decision history (audit trail)
candidate_decisions (
  id, candidate_id, company_id,
  decision: lulus | tidak_lulus,
  notes,
  decided_by → profiles,
  decided_at
)
```

---

## 3. Feature Breakdown

### Phase 1 — Internal WA Hiring (MVP)

**Auth & Setup**
- Login HR/Manager via Supabase Auth (email + password)
- Single company, admin setup awal

**Kandidat Management**
- Upload list kandidat via CSV/Excel (dengan `candidate_imports` tracking)
- Tambah kandidat manual via form
- Pipeline kanban: status board dengan drag atau button action
- AI Scoring per kandidat (Anthropic API)
- Keputusan HR (lulus/tidak lulus) + notes → tersimpan di `candidate_decisions`

**Job Postings**
- Buat/edit/delete job posting
- AI generate deskripsi dan caption per channel
- Status: draft → published → closed
- Channel tag (informational, bukan auto-post)

**WA Agent (Baileys)**
- Kirim pesan outreach individual + bulk
- AI generate pesan personal per kandidat
- Terima + klasifikasi balasan otomatis
- Auto-update status kandidat berdasarkan balasan
- History pesan per kandidat di `candidate_messages`

**Dashboard**
- Stats overview (total, per status)
- Agent activity log real-time
- HR chat dengan agent ("kirim reminder ke semua yang tertarik")
- Onboarding guide untuk user baru

### Phase 2 — External Email Hiring *(skeleton UI di Phase 1, fungsional di Phase 2)*

**Gmail Integration** *(OAuth setup di-skip, dikerjakan saat Phase 2 aktif)*
- Polling inbox hello@greenly.id via Gmail API
- Auto-parse lamaran masuk → buat kandidat baru (`source: external_email`)
- CV attachment → upload ke Supabase Storage → isi `cv_url`

**Job Portal Publik**
- Halaman `/jobs` publik (no login) — list job postings yang published
- Kandidat lihat detail, apply via email langsung
- Share link per posting ke IG/WA

**CV Management**
- HR lihat/download CV dari dashboard
- Filter kandidat berdasarkan source

---

## 4. API & Integration Design

### Baileys WA Service

Berjalan sebagai Node.js microservice di VPS port 3001. Komunikasi dua arah dengan Next.js via HTTP + shared secret.

**Endpoints yang di-expose Baileys:**
```
POST /send          — kirim pesan ke nomor WA
GET  /status        — cek status koneksi (qr | connected | disconnected)
GET  /qr            — ambil QR code PNG untuk scan
```

**Inbound messages:** Baileys push ke Next.js via callback URL:
```
POST https://<app>.vercel.app/api/wa/webhook
Authorization: Bearer <BAILEYS_SECRET>
Body: { from, message, timestamp }
```

### Supabase Usage
- **PostgreSQL** — semua data via Supabase client
- **Auth** — JWT, server-side validation di API routes dengan `service_role_key`
- **Storage** — bucket `cvs/` untuk CV upload (Phase 2)
- **Realtime** — opsional untuk live update status kandidat di dashboard

### Anthropic API
- Dev: Etalas router (`9router.etalas.studio`) — httpx langsung, bukan SDK (router blokir SDK)
- Production: API key dari Greenly, langsung ke `api.anthropic.com`
- Model: `cc/claude-sonnet-4-5-20250929` (dev Etalas) → `claude-sonnet-5` (production)

### Environment Variables

```bash
# Next.js / Vercel
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
BAILEYS_SERVICE_URL          # http://165.22.251.138:3001
BAILEYS_SECRET               # shared secret key
ANTHROPIC_API_KEY
ANTHROPIC_BASE_URL           # opsional, untuk Etalas dev

# Baileys Service / VPS
BAILEYS_SECRET
NEXT_APP_CALLBACK_URL        # https://<app>.vercel.app/api/wa/webhook
PORT=3001
```

---

## 5. Deployment Strategy

**Next.js → Vercel**
- Push ke `main` → Vercel auto-deploy
- Environment variables di Vercel dashboard
- Domain: vercel.app default dulu, custom domain nanti

**Baileys Service → VPS (existing)**
- Node.js service baru di `/opt/baileys-service/`
- Systemd service `baileys.service` untuk auto-start
- Nginx proxy port 80/3001
- Deploy update: `scp` → `systemctl restart baileys`
- VPS: `165.22.251.138`, SSH `ssh -i ~/.ssh/important_key/id_droplet root@165.22.251.138`

**Supabase → Managed**
- Project baru di supabase.com
- Migration files di `supabase/migrations/`
- Row Level Security (RLS) aktif, policy per `company_id`

**Branching:**
- `main` → production (auto-deploy Vercel)
- `dev` → development / staging
- Feature branches: `feat/<name>`

---

## 6. Folder Structure (Next.js)

```
smart-staffing-agent/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # sidebar + nav
│   │   ├── page.tsx            # dashboard home
│   │   ├── candidates/
│   │   ├── jobs/
│   │   ├── messages/
│   │   └── onboarding/
│   ├── jobs/                   # public job portal (Phase 2 skeleton)
│   └── api/
│       ├── candidates/
│       ├── jobs/
│       ├── wa/
│       │   ├── send/
│       │   └── webhook/
│       ├── ai/
│       │   ├── generate-message/
│       │   ├── generate-caption/
│       │   └── score/
│       └── gmail/              # Phase 2 skeleton
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── candidates/
│   ├── jobs/
│   └── dashboard/
├── lib/
│   ├── supabase/
│   ├── baileys/
│   └── ai/
├── supabase/
│   └── migrations/
└── docs/
    └── superpowers/specs/
```

---

## Out of Scope (Phase 1)

- Multi-company UI
- Gmail OAuth setup
- CV upload oleh kandidat
- Job portal publik fungsional
- Mobile app
- Notifikasi email ke HR
