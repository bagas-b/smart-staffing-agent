-- 008_initial_outreach.sql
-- Adds an agent task type for AI-drafted first-contact outreach messages,
-- created automatically when new candidates enter the system (CSV upload,
-- manual add, and — later — email ingestion).

ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS agent_tasks_type_check;
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_type_check
  CHECK (type IN ('score', 'classify_reply', 'draft_follow_up', 'draft_initial_outreach'));
