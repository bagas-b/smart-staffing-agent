-- Enable RLS on all tables
alter table companies enable row level security;
alter table profiles enable row level security;
alter table job_postings enable row level security;
alter table candidates enable row level security;
alter table candidate_imports enable row level security;
alter table candidate_messages enable row level security;
alter table agent_logs enable row level security;
alter table candidate_decisions enable row level security;

-- Helper: get caller's company_id from profiles
create or replace function get_my_company_id()
returns uuid language sql security definer stable as $$
  select company_id from profiles where id = auth.uid();
$$;

-- Profiles: users see only their own company
create policy "profiles_same_company" on profiles
  for all using (company_id = get_my_company_id());

-- Job postings: same company
create policy "job_postings_same_company" on job_postings
  for all using (company_id = get_my_company_id());

-- Candidates: same company
create policy "candidates_same_company" on candidates
  for all using (company_id = get_my_company_id());

-- Candidate imports: same company
create policy "candidate_imports_same_company" on candidate_imports
  for all using (company_id = get_my_company_id());

-- Candidate messages: same company
create policy "candidate_messages_same_company" on candidate_messages
  for all using (company_id = get_my_company_id());

-- Agent logs: same company
create policy "agent_logs_same_company" on agent_logs
  for all using (company_id = get_my_company_id());

-- Candidate decisions: same company
create policy "candidate_decisions_same_company" on candidate_decisions
  for all using (company_id = get_my_company_id());
