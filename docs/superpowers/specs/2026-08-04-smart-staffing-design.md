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
│   ├── careers/                # public job portal (Phase 2 skeleton, /careers bukan /jobs karena conflict dengan dashboard route)
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
│       ├── agent/
│       │   └── run/            # task queue processor (Section 8)
│       └── gmail/              # Phase 2 skeleton
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── candidates/
│   ├── jobs/
│   ├── outcomes/
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

## 7. Roadmap — Dari Automation Tool ke Smart Staffing Agent Sejati

Phase 1 yang sudah kelar di dev adalah **automation layer** yang solid: upload kandidat, generate pesan personal, kirim WA, klasifikasi balasan otomatis, pipeline kanban. Ini mengurangi kerja manual HR secara signifikan.

Tapi automation ≠ smart. Agar agent ini benar-benar layak disebut "smart staffing agent" — bukan cuma "WA blast tool yang rapi" — dia perlu bisa membantu HR menjawab pertanyaan yang lebih penting dari sekadar "sudah dikirim belum": **siapa yang seharusnya di-hire, dan seberapa besar kemungkinan mereka akan bertahan & perform.**

Roadmap di bawah ini disusun berdasarkan dependency teknis (apa yang harus ada duluan sebelum yang lain bisa dibangun), bukan berdasarkan waktu pengerjaan.

### 7.1 Fondasi — Outcome Tracking ✅ Implemented

Tanpa ini, tidak ada cara untuk tahu apakah agent-nya actually bekerja dengan baik atau cuma sibuk kirim pesan tanpa hasil.

```sql
-- Hire tracking
candidate_hire_records (
  id, candidate_id, company_id,
  job_posting_id → job_postings,
  hired_date, start_date,
  first_day_attended: boolean,
  notes, created_at
)

-- Performance & retention tracking
candidate_performance (
  id, candidate_hire_id → candidate_hire_records, company_id,
  day_1_checkin: boolean,
  day_7_status: active | no_show | absent,
  day_30_status: active | resigned | terminated,
  performance_rating: 1-5,
  resign_date, resign_reason,
  mentor_feedback, updated_at
)

-- Scoring cache
candidate_scores (
  id, candidate_id, company_id,
  cv_fit_score: 0-100,
  attrition_risk_score: 0-100,
  hire_success_probability: 0-100,
  scoring_reasoning: jsonb,
  scored_at, valid_until
)
```

Ini murni tabel baru — tidak menyentuh skema `candidates`, `candidate_messages`, atau service Baileys yang sudah berjalan.

### 7.2 Scoring Engine — Decision Support, Bukan Keputusan Final ✅ Implemented

**Endpoint:**
```
POST /api/ai/score
Body: { candidate_id, job_posting_id }
Response: {
  cv_fit_score, attrition_risk_score, hire_success_probability,
  reasoning: { strengths[], concerns[], recommendation },
  cached: boolean
}
```

**Kriteria `cv_fit_score`** (composite, sesuai prioritas yang sudah ditetapkan):

| Kriteria | Bobot |
|---|---|
| Pengalaman relevan | 35% |
| Skill spesifik | 25% |
| Kelengkapan data / red flag | 20% |
| Kecocokan lokasi | 20% |

**Formula final:**
```
hire_success_probability = (cv_fit_score * 0.6) + ((100 - attrition_risk_score) * 0.4)
```
Lokasi hanya dihitung sekali (di dalam `cv_fit_score`), tidak dihitung ulang di formula akhir — menghindari bias skor yang timpang ke satu faktor.

**Batasan penting soal `attrition_risk_score`:**
- Dihitung dari sinyal minim & aman: gap kerja yang tidak dijelaskan di CV, data kontak tidak lengkap, kelengkapan riwayat — **bukan** dari pola "sering ganti kerja," karena di segmen kerja blue-collar/gig, itu bukan indikator ketidakandalan dan berisiko menghasilkan bias sistemik terhadap kandidat dari latar belakang ekonomi tertentu.
- **Skor ini tidak pernah dipakai untuk auto-reject atau auto-skip kandidat dari pipeline.** Fungsinya murni sebagai catatan/flag yang ditampilkan ke HR ("perlu ditanyakan saat interview"), bukan filter otomatis.
- Semua scoring diposisikan sebagai **decision support** — HR yang membuat keputusan akhir. LLM membaca CV blue-collar yang sering minim detail/tidak terstruktur, jadi akurasinya terbatas; dokumen produk & UI harus eksplisit menyebut ini sebagai bantuan pertimbangan, bukan penentu otomatis.

### 7.3 Smart Sequencing ✅ Implemented

Setelah scoring stabil, kandidat dikelompokkan jadi tier rekomendasi (bukan filter keras):

- **Tier 1 — Prioritize** (hire_success_probability ≥ 80): direkomendasikan diinvite duluan
- **Tier 2 — Consider** (60–79): direkomendasikan dengan catatan tambahan
- **Tier 3 — Perlu review manual** (<60): tetap masuk pipeline, ditandai untuk direview HR sebelum diinvite — bukan otomatis di-skip

HR tetap bisa override rekomendasi ini kapan saja (manual select siapa yang mau diinvite, di luar urutan tier).

### 7.4 Outcome Dashboard ✅ Implemented

Menjawab pertanyaan yang sebenarnya penting buat HR: bukan "berapa pesan terkirim," tapi "dari yang di-hire, berapa yang stay dan perform."

- **Hire funnel:** total outreach → response → interview → hire
- **Quality metrics:** first-day show rate, 30-day retention rate, rata-rata performance rating
- **Cost metrics:** cost per hire, cost per successful hire (>30 hari)
- **Source effectiveness:** platform/sumber kandidat mana yang paling menghasilkan hire yang bertahan

Versi awal cukup input manual dari HR untuk status day-1/day-30 (belum perlu integrasi absensi otomatis) plus query agregasi sederhana — belum butuh visualisasi kompleks.

### 7.5 Setelah Data Historis Cukup — Feedback Loop & Daily Digest

Dua hal ini baru masuk akal setelah agent sudah dipakai cukup lama dan ada cukup data hire nyata untuk dipelajari:

- **Feedback loop:** saat kandidat ditandai resign, sistem membandingkan prediksi awal vs hasil aktual, dan datanya dipakai untuk mengevaluasi/mengkalibrasi ulang bobot scoring dari waktu ke waktu
- **Daily digest:** ringkasan actionable harian ke HR (siapa siap interview hari ini, siapa mulai kerja hari ini, siapa yang berisiko resign minggu ini, insight mingguan) — bentuk paling ringkas dari "smart" ini terasa: HR tidak perlu buka dashboard, cukup baca satu ringkasan dan tahu harus ngapain hari itu

Membangun dua ini lebih awal, sebelum ada data hire yang cukup, tidak akan menghasilkan insight yang berguna — jadi urutannya memang harus setelah 7.1–7.4 berjalan dan mengumpulkan data nyata.

---

## 8. Agent Design — Orchestration, Autonomy, dan Reasoning

Section 1-7 mendefinisikan *apa* yang perlu ada (data, fitur, metrik). Section ini mendefinisikan *bagaimana agent-nya benar-benar bernalar dan bertindak* — bagian yang sebelumnya tidak ada di spec ini sama sekali. Tanpa ini, `/api/ai/*` cuma kumpulan fungsi AI yang dipanggil manual, bukan agent.

### 8.1 Prinsip Dasar

- **Agent yang mengambil keputusan & mengeksekusi** (baca data → nilai → putuskan langkah → bertindak), bukan cuma dipanggil satu kali lalu selesai.
- **Manusia mengontrol titik kritis** — pesan tidak pernah terkirim ke kandidat tanpa approval HR. Ini non-negotiable, sudah ditetapkan sejak awal project.
- **Semua keputusan agent harus bisa dijelaskan** (reasoning eksplisit), bukan black box — konsisten dengan prinsip observability yang sudah dibahas di awal project.

### 8.2 Trigger — Kapan Agent Bertindak

Agent tidak berjalan terus-menerus (tidak ada infra buat itu di stack serverless ini). Agent bertindak berdasarkan tiga jenis trigger:

| Trigger | Sumber | Aksi agent |
|---|---|---|
| **Event: kandidat baru masuk** | CSV/Excel upload selesai diproses | Scoring (`cv_fit_score`, `attrition_risk_score`) untuk tiap kandidat baru |
| **Event: balasan WA masuk** | Webhook `/api/wa/webhook` dari Baileys | Klasifikasi balasan → update status kandidat → (kalau perlu) siapkan draft follow-up |
| **Scheduled: cek follow-up** | Vercel Cron, jalan tiap beberapa jam | Cari kandidat berstatus `menunggu_balasan` yang sudah lewat waktu tertentu tanpa respons → siapkan draft follow-up (masuk antrean approval, bukan langsung kirim) |

### 8.3 Task Queue — Supaya Agent Punya "Alur Kerja", Bukan Sekadar Function Call

Tambahan tabel baru supaya tindakan agent tercatat sebagai unit kerja yang bisa di-retry dan diaudit, bukan cuma request/response sesaat:

```sql
agent_tasks (
  id, company_id, candidate_id,
  type: score | classify_reply | draft_message | draft_follow_up,
  status: pending | processing | done | failed | needs_review,
  payload jsonb,        -- input untuk task ini
  result jsonb,         -- output dari LLM, nullable sampai selesai
  error_message,        -- nullable, diisi kalau failed
  attempts int default 0,
  created_at, processed_at
)
```

Alur: event terjadi → task di-enqueue ke `agent_tasks` → endpoint `/api/agent/run` memproses task pending (dipanggil langsung setelah enqueue untuk near-real-time, dan juga dipanggil oleh Vercel Cron sebagai fallback kalau ada yang gagal/tertunda) → hasil disimpan, status task jadi `done`/`failed`/`needs_review`.

**Tambahan field di tabel `candidates` yang sudah ada** (additive, tidak mengubah struktur existing):
```sql
ALTER TABLE candidates ADD COLUMN follow_up_count int DEFAULT 0;
ALTER TABLE candidates ADD COLUMN next_follow_up_at timestamptz;
ALTER TABLE candidates ADD COLUMN last_agent_action text;
```

### 8.4 Autonomy Boundary — Apa yang Otomatis vs Wajib Approval

| Aksi | Otonomi |
|---|---|
| Scoring kandidat baru | **Otomatis**, tanpa approval — ini analisis, bukan tindakan ke luar |
| Klasifikasi balasan WA | **Otomatis** — update status kandidat langsung berdasarkan hasil klasifikasi |
| Draft pesan (outreach maupun follow-up) | **Otomatis dibuat**, tapi **masuk antrean approval** — tidak pernah langsung terkirim |
| Kirim pesan ke kandidat | **Wajib approval HR**, tanpa terkecuali |
| Menandai kandidat "Tier 3 / perlu review" | **Otomatis** sebagai flag, **tidak pernah** otomatis me-reject atau menghapus dari pipeline |
| Follow-up ke-2 dst | **Otomatis dibuat draft-nya**, tapi dibatasi maksimum (mis. 2x follow-up) sebelum agent berhenti & serahkan ke HR sepenuhnya |

### 8.5 Prompt Spec — Scoring

**System prompt (ringkas, prinsip):**
- Diminta membaca CV/data kandidat + kriteria job posting
- Diminta mengeluarkan **JSON terstruktur saja**, sesuai schema yang sudah ditetapkan di Section 7.2 (`cv_fit_score`, breakdown per kriteria, `reasoning.strengths[]`, `reasoning.concerns[]`, `reasoning.recommendation`)
- **Instruksi eksplisit dilarang**: tidak boleh menyertakan penalti berbasis pola "sering ganti kerja" ke dalam `attrition_risk_score` — sesuai batasan yang sudah ditetapkan di Section 7.2, untuk mencegah bias sistemik
- Diminta memberi `confidence` (high/medium/low) atas skor yang dihasilkan — kalau CV terlalu minim data, confidence rendah, dan hasil otomatis ditandai `needs_review` alih-alih dipakai langsung untuk tiering

### 8.6 Prompt Spec — Klasifikasi Balasan WA

**Kategori output (fixed set, bukan open-ended):**
```
tertarik | tidak_tertarik | butuh_info | tidak_jelas
```
- Kalau hasil klasifikasi `tidak_jelas` atau confidence rendah → **jangan auto-update status**, tandai task sebagai `needs_review` supaya HR yang baca balasannya langsung dan putuskan manual
- Kalau `butuh_info` → agent boleh siapkan draft balasan (bukan kirim langsung) yang menjawab pertanyaan umum (jadwal, lokasi, gaji) berdasarkan data job posting

### 8.7 Failure Handling

| Kegagalan | Penanganan |
|---|---|
| LLM tidak mengembalikan JSON valid | Retry sekali dengan instruksi lebih ketat; kalau gagal lagi → task `failed`, log ke `agent_logs` type `error`, tidak block proses lain |
| Confidence rendah pada scoring | Task selesai tapi ditandai `needs_review` — kandidat tetap masuk pipeline, tidak diberi tier otomatis |
| Klasifikasi balasan ambigu | Task `needs_review`, status kandidat tidak berubah sampai HR review manual |
| Baileys service down (gagal kirim) | Pesan tetap di antrean approval dengan status `gagal_kirim`, agent retry saat service kembali online, HR mendapat notifikasi via `agent_logs` |
| Follow-up melebihi batas maksimum | Agent berhenti membuat draft follow-up baru untuk kandidat tsb, status ditandai `perlu_tindak_lanjut_manual` |

### 8.8 Contoh Alur End-to-End (menyatukan semuanya)

```
HR upload CSV 20 kandidat
   → agent_tasks: 20 task type=score di-enqueue
   → /api/agent/run proses tiap task → hasil: cv_fit_score, attrition_risk, tier
   → kandidat dengan confidence rendah ditandai needs_review (tidak dapat tier)
   → HR buka dashboard, lihat Tier 1/2/3 + kandidat needs_review terpisah
   → HR pilih siapa yang diinvite (individual/bulk) → draft dibuat agent → masuk antrean approval
   → HR approve → Baileys kirim
   → Kandidat balas → webhook masuk → agent klasifikasi
   → Kalau "butuh info" → agent siapkan draft balasan → antrean approval lagi
   → Kalau 48 jam tanpa balasan → cron trigger follow-up draft → antrean approval
   → Setelah 2x follow-up tanpa respons → status "perlu_tindak_lanjut_manual", agent berhenti
```

Ini yang membuatnya jadi **agent** — bukan cuma endpoint yang nunggu dipanggil, tapi alur yang punya kesadaran state per kandidat, mengambil inisiatif langkah berikutnya sesuai aturan yang sudah ditetapkan, dan tahu kapan harus berhenti dan menyerahkan ke manusia.

---

## Out of Scope (Phase 1)

- Multi-company UI
- Gmail OAuth setup
- CV upload oleh kandidat
- Job portal publik fungsional
- Mobile app
- Notifikasi email ke HR
