-- Per-heir Decision Room seats (ADR-001 stage 4).
-- A named heir answers through their own link, stored as the seat
-- 'nextGen:<heir id>' in the existing stakeholder column. Keys, foreign keys,
-- link binding, RLS and grants are unchanged; this only widens what the
-- column accepts. Expand-only: the new CHECK admits every value the old one
-- did, so existing rows always validate and code writing the four plain
-- stakeholders keeps working. Each swap is one ALTER, so the column is never
-- unconstrained.
set lock_timeout = '3s';

alter table public.room_invites
  drop constraint room_invites_stakeholder_check,
  add constraint room_invites_stakeholder_check check (
    stakeholder in ('founder', 'nextGen', 'board', 'lender')
    or stakeholder ~ '^nextGen:[A-Za-z0-9_-]{1,40}$'
  );

alter table public.room_responses
  drop constraint room_responses_stakeholder_check,
  add constraint room_responses_stakeholder_check check (
    stakeholder in ('founder', 'nextGen', 'board', 'lender')
    or stakeholder ~ '^nextGen:[A-Za-z0-9_-]{1,40}$'
  );
