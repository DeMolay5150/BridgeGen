-- Write-path hardening from the October 2026 schema audit. Every finding was
-- reproduced in PGlite before this migration and is pinned by
-- tests/migrations/migrations.mjs.

-- ---------------------------------------------------------------------------
-- 1. Stakeholder links are issued by the server only.
-- Any firm member could delete or overwrite a room_invites row through the
-- API, mint a link of their own and read a stakeholder's saved answers at
-- /respond/<token>. The invites route now writes with the secret key after
-- authorize(); signed-in users keep read access for invite status.
-- ---------------------------------------------------------------------------
drop policy "Firm members create invites" on public.room_invites;
drop policy "Firm members replace invites" on public.room_invites;
drop policy "Firm members delete invites" on public.room_invites;
revoke insert, update, delete on table public.room_invites from authenticated;

-- A response belongs to the link that wrote it. A replaced link opens an
-- empty form, so rotating a link never hands anyone the previous answers;
-- the server still uses them for gap detection until they're overwritten.
alter table public.room_responses
  add column invite_token_hash text check (char_length(invite_token_hash) = 64);

update public.room_responses r
set invite_token_hash = i.token_hash
from public.room_invites i
where i.company_id = r.company_id and i.stakeholder = r.stakeholder;

-- ---------------------------------------------------------------------------
-- 2. Members edit a company's contents, not who created it or which firm
-- holds it. Rewriting owner_id made a member the "creator" (delete, link
-- rotation); rewriting firm_id moved a company and its answers between firms.
-- ---------------------------------------------------------------------------
revoke update on table public.companies from authenticated;
grant update (name, baseline, scenario, governance, fork, priorities) on table public.companies to authenticated;

-- Saved snapshots are JSON objects of bounded size (the largest real
-- section is well under 2 KB).
alter table public.companies
  add constraint companies_snapshot_shape check (
    jsonb_typeof(baseline) = 'object'
    and jsonb_typeof(scenario) = 'object'
    and jsonb_typeof(governance) = 'object'
    and jsonb_typeof(fork) = 'object'
    and jsonb_typeof(priorities) = 'object'
  ),
  add constraint companies_snapshot_size check (
    pg_column_size(baseline) <= 8192
    and pg_column_size(scenario) <= 8192
    and pg_column_size(governance) <= 8192
    and pg_column_size(fork) <= 8192
    and pg_column_size(priorities) <= 8192
  );

-- ---------------------------------------------------------------------------
-- 3. Colleagues join only by accepting an invitation. Owners and admins could
-- insert any user straight into the firm (owners even as owner), and admins
-- could rewrite a membership's user_id. create_firm() and
-- accept_firm_invite() are SECURITY DEFINER and don't need these grants.
-- ---------------------------------------------------------------------------
drop policy "Owners and admins add members" on public.firm_members;
revoke insert, update on table public.firm_members from authenticated;
grant update (role) on table public.firm_members to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The last-owner rule.
-- It read auth.users as the caller, which API roles can't, so every owner
-- change failed ("permission denied for table users") even with a co-owner
-- present. It also raced: two owners demoting each other concurrently both
-- saw the other as owner. Run as definer and serialize owner changes per firm.
-- ---------------------------------------------------------------------------
create or replace function public.firm_members_keep_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.firm_id <> old.firm_id) then
    -- Concurrent owner changes in one firm queue here; the check below then
    -- sees whatever the earlier transaction committed.
    perform 1 from public.firms f where f.id = old.firm_id for update;
    if exists (select 1 from public.firms f where f.id = old.firm_id)
       and exists (select 1 from auth.users u where u.id = old.user_id)
       and not exists (
         select 1 from public.firm_members m
         where m.firm_id = old.firm_id and m.role = 'owner' and m.user_id <> old.user_id
       ) then
      raise exception 'A firm must keep at least one owner';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

-- A sole owner deleting their account left a shared firm with no owner and no
-- way to appoint one. The longest-standing admin (else member) takes over.
create function public.firm_members_succeed_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and exists (select 1 from public.firms f where f.id = old.firm_id)
     and not exists (
       select 1 from public.firm_members m where m.firm_id = old.firm_id and m.role = 'owner'
     ) then
    update public.firm_members
    set role = 'owner'
    where (firm_id, user_id) = (
      select m.firm_id, m.user_id from public.firm_members m
      where m.firm_id = old.firm_id
      order by (m.role = 'admin') desc, m.created_at, m.user_id
      limit 1
    );
  end if;
  return null;
end;
$$;

create trigger firm_members_succeed_owner
  after delete on public.firm_members
  for each row execute function public.firm_members_succeed_owner();

revoke execute on function public.firm_members_succeed_owner() from public, anon, authenticated;
