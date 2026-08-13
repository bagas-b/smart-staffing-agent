-- 010_interview_scheduling_details.sql
-- Adds location/notes for a scheduled interview, and a distinct status for
-- "candidate confirmed readiness for interview via chat, HR hasn't picked a
-- date yet" — reuses the existing interview_dijadwalkan status/column
-- (differentiated by interview_scheduled_at being null vs set), so no new
-- status value needed here.

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS interview_location text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS interview_notes text;

-- Fix: processDraftFollowUpTask (app/api/agent/run/route.ts) sets
-- status = 'perlu_tindak_lanjut_manual' after 2 failed follow-up attempts,
-- but that value was never added to this constraint — every such update has
-- been silently failing (23514) since the feature was built.
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_status_check
  CHECK (status IN (
    'belum_dihubungi', 'menunggu_balasan', 'tertarik',
    'butuh_info', 'tidak_tertarik', 'interview_dijadwalkan',
    'lulus_interview', 'tidak_lulus', 'onboarding', 'aktif',
    'perlu_tindak_lanjut_manual'
  ));
