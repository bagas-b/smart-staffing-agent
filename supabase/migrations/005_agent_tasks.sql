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
