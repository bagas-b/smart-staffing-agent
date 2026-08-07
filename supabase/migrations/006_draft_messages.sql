-- Extend direction check constraint to allow 'draft' for agent approval queue
ALTER TABLE candidate_messages DROP CONSTRAINT IF EXISTS candidate_messages_direction_check;

ALTER TABLE candidate_messages ADD CONSTRAINT candidate_messages_direction_check
  CHECK (direction IN ('inbound', 'outbound', 'draft'));
