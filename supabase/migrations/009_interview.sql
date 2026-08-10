-- 009_interview.sql
-- Adds interview scheduling: a date/time on the candidate + an agent task
-- type for drafting the interview invitation message (same draft->approval
-- pipeline as outreach/follow-up, nothing new there).

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS interview_scheduled_at timestamptz;

ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS agent_tasks_type_check;
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_type_check
  CHECK (type IN ('score', 'classify_reply', 'draft_follow_up', 'draft_initial_outreach', 'draft_interview_invite'));
