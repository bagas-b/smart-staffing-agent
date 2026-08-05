-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Companies
create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  wa_number text,
  email text,
  logo_url text,
  created_at timestamptz default now()
);

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  company_id uuid not null references companies(id),
  full_name text not null,
  role text not null check (role in ('admin', 'hr')),
  avatar_url text,
  created_at timestamptz default now()
);

-- Job Postings
create table job_postings (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  title text not null,
  position text not null,
  outlet text,
  shift text,
  description text,
  requirements text[] default '{}',
  benefits text[] default '{}',
  salary_range text,
  channels text[] default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Candidate Imports
create table candidate_imports (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  filename text not null,
  imported_by uuid references profiles(id),
  total_rows int default 0,
  success_rows int default 0,
  imported_at timestamptz default now()
);

-- Candidates
create table candidates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  name text not null,
  phone text,
  email text,
  wa_chat_id text,
  position text,
  outlet text,
  source text not null default 'import' check (source in ('internal_wa', 'external_email', 'external_form', 'import')),
  import_batch_id uuid references candidate_imports(id),
  cv_url text,
  applied_job_id uuid references job_postings(id),
  status text not null default 'belum_dihubungi' check (status in (
    'belum_dihubungi', 'menunggu_balasan', 'tertarik',
    'butuh_info', 'tidak_tertarik', 'interview_dijadwalkan',
    'lulus_interview', 'tidak_lulus', 'onboarding', 'aktif'
  )),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Candidate Messages
create table candidate_messages (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  company_id uuid not null references companies(id),
  direction text not null check (direction in ('inbound', 'outbound')),
  channel text not null check (channel in ('wa', 'email')),
  content text not null,
  message_type text default 'text',
  sent_by text,
  created_at timestamptz default now()
);

-- Agent Logs
create table agent_logs (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  type text not null check (type in ('success', 'info', 'warning', 'error')),
  message text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Candidate Decisions
create table candidate_decisions (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  company_id uuid not null references companies(id),
  decision text not null check (decision in ('lulus', 'tidak_lulus')),
  notes text,
  decided_by uuid references profiles(id),
  decided_at timestamptz default now()
);

-- Seed: Greenly company record
insert into companies (id, name, wa_number, email)
values ('00000000-0000-0000-0000-000000000001', 'Greenly Cloud Kitchen', null, 'hello@greenly.id');
