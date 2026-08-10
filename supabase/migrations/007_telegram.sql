-- 007_telegram.sql
-- Adds Telegram as a messaging channel alongside WhatsApp/email.

alter table candidates add column if not exists telegram_chat_id text;

create unique index if not exists candidates_telegram_chat_id_idx
  on candidates(telegram_chat_id) where telegram_chat_id is not null;

-- Widen candidate_messages.channel to allow 'telegram'.
-- If this constraint name doesn't match your DB, find the real one first:
--   select conname from pg_constraint where conrelid = 'candidate_messages'::regclass and contype = 'c';
alter table candidate_messages drop constraint if exists candidate_messages_channel_check;
alter table candidate_messages add constraint candidate_messages_channel_check
  check (channel in ('wa', 'email', 'telegram'));
