-- Expand step for the October 2026 write-path hardening (contract step:
-- 20261025100000_write_hardening.sql, pushed only after the app that reads
-- this column is deployed).
--
-- A stakeholder's saved answers belong to the link that saved them: a link
-- issued later opens an empty form, so replacing a link never hands anyone
-- the previous answers. The server still uses every response for gap
-- detection.
set lock_timeout = '3s';

alter table public.room_responses
  add column invite_token_hash text check (char_length(invite_token_hash) = 64);

-- Bind only answers saved through the current link (saved after it was
-- issued). Answers that predate a replaced link stay unbound, so the new
-- link can't read them. The backfill must not move updated_at: it is the
-- only record of when the answers were saved.
alter table public.room_responses disable trigger room_responses_set_updated_at;

update public.room_responses r
set invite_token_hash = i.token_hash
from public.room_invites i
where i.company_id = r.company_id
  and i.stakeholder = r.stakeholder
  and r.updated_at >= i.created_at;

alter table public.room_responses enable trigger room_responses_set_updated_at;
