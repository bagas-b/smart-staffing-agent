-- Hire tracking
create table candidate_hire_records (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  company_id uuid not null references companies(id),
  job_posting_id uuid references job_postings(id),
  hired_date date,
  start_date date,
  first_day_attended boolean default false,
  notes text,
  created_at timestamptz default now()
);

-- Performance & retention tracking
create table candidate_performance (
  id uuid primary key default uuid_generate_v4(),
  candidate_hire_id uuid not null references candidate_hire_records(id) on delete cascade,
  company_id uuid not null references companies(id),
  day_1_checkin boolean default false,
  day_7_status text check (day_7_status in ('active', 'no_show', 'absent')),
  day_30_status text check (day_30_status in ('active', 'resigned', 'terminated')),
  performance_rating int check (performance_rating between 1 and 5),
  resign_date date,
  resign_reason text,
  mentor_feedback text,
  updated_at timestamptz default now()
);

-- RLS
alter table candidate_hire_records enable row level security;
alter table candidate_performance enable row level security;

create policy "hire_records_same_company" on candidate_hire_records
  for all using (company_id = get_my_company_id());

create policy "performance_same_company" on candidate_performance
  for all using (company_id = get_my_company_id());
