-- 011_scoring_criteria.sql
-- Lets each company define their own weighted screening/scoring indicators
-- instead of the app's fixed hardcoded criteria — the AI scoring prompt reads
-- these (when present) and returns a per-criterion breakdown alongside the
-- overall cv_fit_score.

create table if not exists scoring_criteria (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  label text not null,
  description text,
  weight integer not null default 20 check (weight > 0 and weight <= 100),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists scoring_criteria_company_idx on scoring_criteria(company_id);
