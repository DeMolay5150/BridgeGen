-- Multi-seat firms: advisors work inside a firm (workspace); a firm's members
-- share its client companies. Every advisor gets a personal firm at sign-up
-- (existing advisors get theirs here, holding their companies), so nothing
-- changes for single-seat accounts.
--
-- Roles: owner (everything, incl. granting owner), admin (manage members
-- below owner, delete companies), member (read and edit companies).
-- Raw Decision Room answers stay server-only, for every role.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.firm_members (
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);

-- Policies look members up by user; the primary key covers lookups by firm.
create index firm_members_user_id_idx on public.firm_members (user_id);

-- ---------------------------------------------------------------------------
-- Membership helpers. SECURITY DEFINER so policies on firm_members can ask
-- about firm_members without recursing into their own RLS.
-- ---------------------------------------------------------------------------
create function public.firm_role(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.firm_members m
  where m.firm_id = target and m.user_id = (select auth.uid());
$$;

create function public.is_firm_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.firm_role(target) is not null;
$$;

revoke all on function public.firm_role(uuid) from public, anon;
revoke all on function public.is_firm_member(uuid) from public, anon;
grant execute on function public.firm_role(uuid) to authenticated;
grant execute on function public.is_firm_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Personal firms. Created when the account is, never mid-statement: the
-- membership helpers are STABLE, so a firm created inside the same INSERT as
-- a company would be invisible to that INSERT's RLS check.
-- ---------------------------------------------------------------------------
create function public.create_personal_firm(advisor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  personal uuid;
begin
  insert into public.firms (name) values ('Personal workspace') returning id into personal;
  insert into public.firm_members (firm_id, user_id, role) values (personal, advisor, 'owner');
  return personal;
end;
$$;

revoke all on function public.create_personal_firm(uuid) from public, anon, authenticated;

create function public.users_create_personal_firm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_personal_firm(new.id);
  return new;
end;
$$;

create trigger users_create_personal_firm
  after insert on auth.users
  for each row execute function public.users_create_personal_firm();

-- Backfill: every existing advisor gets a personal firm holding their companies.
alter table public.companies add column firm_id uuid references public.firms (id) on delete cascade;

do $$
declare
  advisor uuid;
  personal uuid;
begin
  for advisor in select id from auth.users loop
    personal := public.create_personal_firm(advisor);
    update public.companies set firm_id = personal where owner_id = advisor;
  end loop;
end;
$$;

alter table public.companies alter column firm_id set not null;
create index companies_firm_id_idx on public.companies (firm_id);

-- A shared company outlives the colleague who created it: deleting their
-- account clears owner_id instead of deleting the firm's work.
alter table public.companies alter column owner_id drop not null;
alter table public.companies drop constraint companies_owner_id_fkey;
alter table public.companies
  add constraint companies_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- New companies without a firm land in the creator's first firm, so clients
-- that don't know about firms keep working. Runs before RLS checks the row.
-- ---------------------------------------------------------------------------
create function public.companies_default_firm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if new.firm_id is not null then
    return new;
  end if;
  if caller is null then
    raise exception 'firm_id is required when no user is signed in';
  end if;
  select m.firm_id into new.firm_id
  from public.firm_members m
  where m.user_id = caller
  order by m.created_at, m.firm_id
  limit 1;
  if new.firm_id is null then
    raise exception 'Create or join a firm before adding companies';
  end if;
  return new;
end;
$$;

create trigger companies_default_firm
  before insert on public.companies
  for each row execute function public.companies_default_firm();

-- Creating a firm and becoming its owner is one step, so there's no moment
-- where a firm exists that its creator can't see.
create function public.create_firm(firm_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  created uuid;
begin
  if caller is null then
    raise exception 'Sign in to create a firm';
  end if;
  insert into public.firms (name) values (firm_name) returning id into created;
  insert into public.firm_members (firm_id, user_id, role) values (created, caller, 'owner');
  return created;
end;
$$;

revoke all on function public.create_firm(text) from public, anon;
grant execute on function public.create_firm(text) to authenticated;

-- A firm always keeps at least one owner. Exempt: deleting the firm itself,
-- and deleting the owner's account (the empty-firm cleanup below takes over).
create function public.firm_members_keep_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.firm_id <> old.firm_id)
     and exists (select 1 from public.firms f where f.id = old.firm_id)
     and exists (select 1 from auth.users u where u.id = old.user_id)
     and not exists (
       select 1 from public.firm_members m
       where m.firm_id = old.firm_id and m.role = 'owner' and m.user_id <> old.user_id
     ) then
    raise exception 'A firm must keep at least one owner';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger firm_members_keep_owner
  before update or delete on public.firm_members
  for each row execute function public.firm_members_keep_owner();

-- A firm with no members left (e.g. a deleted advisor's personal firm) is
-- deleted with its companies, as single-owner accounts were before.
create function public.firms_delete_empty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.firm_members m where m.firm_id = old.firm_id) then
    delete from public.firms where id = old.firm_id;
  end if;
  return null;
end;
$$;

create trigger firms_delete_empty
  after delete on public.firm_members
  for each row execute function public.firms_delete_empty();

-- ---------------------------------------------------------------------------
-- RLS: firms
-- ---------------------------------------------------------------------------
alter table public.firms enable row level security;

create policy "Members read their firms"
  on public.firms for select to authenticated
  using ((select public.is_firm_member(id)));

-- No insert policy: firms are created through create_firm().
create policy "Owners and admins rename firms"
  on public.firms for update to authenticated
  using ((select public.firm_role(id)) in ('owner', 'admin'))
  with check ((select public.firm_role(id)) in ('owner', 'admin'));

create policy "Owners delete firms"
  on public.firms for delete to authenticated
  using ((select public.firm_role(id)) = 'owner');

revoke all on table public.firms from anon;

-- ---------------------------------------------------------------------------
-- RLS: firm_members. Owners manage everyone; admins manage non-owners;
-- anyone may leave (subject to the last-owner rule).
-- ---------------------------------------------------------------------------
alter table public.firm_members enable row level security;

create policy "Members see their colleagues"
  on public.firm_members for select to authenticated
  using ((select public.is_firm_member(firm_id)));

create policy "Owners and admins add members"
  on public.firm_members for insert to authenticated
  with check (
    (select public.firm_role(firm_id)) = 'owner'
    or ((select public.firm_role(firm_id)) = 'admin' and role <> 'owner')
  );

create policy "Owners and admins change roles"
  on public.firm_members for update to authenticated
  using (
    (select public.firm_role(firm_id)) = 'owner'
    or ((select public.firm_role(firm_id)) = 'admin' and role <> 'owner')
  )
  with check (
    (select public.firm_role(firm_id)) = 'owner'
    or ((select public.firm_role(firm_id)) = 'admin' and role <> 'owner')
  );

create policy "Owners and admins remove members; anyone may leave"
  on public.firm_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.firm_role(firm_id)) = 'owner'
    or ((select public.firm_role(firm_id)) = 'admin' and role <> 'owner')
  );

revoke all on table public.firm_members from anon;

-- ---------------------------------------------------------------------------
-- RLS: companies move from owner-only to firm membership. owner_id now
-- records who created the company.
-- ---------------------------------------------------------------------------
drop policy "Owners read their companies" on public.companies;
drop policy "Owners create companies" on public.companies;
drop policy "Owners update their companies" on public.companies;
drop policy "Owners delete their companies" on public.companies;

create policy "Firm members read companies"
  on public.companies for select to authenticated
  using ((select public.is_firm_member(firm_id)));

create policy "Firm members create companies"
  on public.companies for insert to authenticated
  with check ((select auth.uid()) = owner_id and (select public.is_firm_member(firm_id)));

-- WITH CHECK stops a member moving a company into a firm they don't belong to.
create policy "Firm members update companies"
  on public.companies for update to authenticated
  using ((select public.is_firm_member(firm_id)))
  with check ((select public.is_firm_member(firm_id)));

create policy "Creators, owners and admins delete companies"
  on public.companies for delete to authenticated
  using (
    ((select auth.uid()) = owner_id and (select public.is_firm_member(firm_id)))
    or (select public.firm_role(firm_id)) in ('owner', 'admin')
  );

-- ---------------------------------------------------------------------------
-- RLS: room_invites follow the company's firm. room_responses is unchanged:
-- no policies, no API privileges, server-only.
-- ---------------------------------------------------------------------------
drop policy "Owners read their invites" on public.room_invites;
drop policy "Owners create invites" on public.room_invites;
drop policy "Owners replace invites" on public.room_invites;
drop policy "Owners delete invites" on public.room_invites;

create policy "Firm members read invites"
  on public.room_invites for select to authenticated
  using (exists (
    select 1 from public.companies c
    where c.id = company_id and (select public.is_firm_member(c.firm_id))
  ));

create policy "Firm members create invites"
  on public.room_invites for insert to authenticated
  with check (exists (
    select 1 from public.companies c
    where c.id = company_id and (select public.is_firm_member(c.firm_id))
  ));

create policy "Firm members replace invites"
  on public.room_invites for update to authenticated
  using (exists (
    select 1 from public.companies c
    where c.id = company_id and (select public.is_firm_member(c.firm_id))
  ))
  with check (exists (
    select 1 from public.companies c
    where c.id = company_id and (select public.is_firm_member(c.firm_id))
  ));

create policy "Firm members delete invites"
  on public.room_invites for delete to authenticated
  using (exists (
    select 1 from public.companies c
    where c.id = company_id and (select public.is_firm_member(c.firm_id))
  ));
