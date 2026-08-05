-- Scoring cache (avoid re-scoring unchanged candidates)
create table candidate_scores (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  company_id uuid not null references companies(id),
  cv_fit_score int not null check (cv_fit_score between 0 and 100),
  attrition_risk_score int not null check (attrition_risk_score between 0 and 100),
  hire_success_probability int not null check (hire_success_probability between 0 and 100),
  scoring_reasoning jsonb default '{}',
  scored_at timestamptz default now(),
  valid_until timestamptz default (now() + interval '7 days')
);

-- One active score per candidate (partial unique index)
create unique index candidate_scores_candidate_active
  on candidate_scores(candidate_id)
  where valid_until > now();

-- RLS
alter table candidate_scores enable row level security;

create policy "scores_same_company" on candidate_scores
  for all using (company_id = get_my_company_id());
