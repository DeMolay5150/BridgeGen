-- Firm invitations: owners and admins invite a colleague by email and share a
-- one-time link (stored as a SHA-256 hash, like Decision Room links). The
-- colleague accepts while signed in with that same, confirmed email address,
-- so a forwarded or leaked link can't put anyone else in the firm. Nobody is
-- added to a firm without accepting, and inviting never reveals whether an
-- email address already has an account.
--
-- Invitations grant admin or member, never owner: owners promote after joining.

create table public.firm_invites (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254 and position('@' in email) > 1),
  role text not null default 'member' check (role in ('admin', 'member')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  -- One live invitation per person per firm; inviting again replaces the link.
  unique (firm_id, email)
);

create index firm_invites_invited_by_idx on public.firm_invites (invited_by);

alter table public.firm_invites enable row level security;

-- Same rule as adding members directly: owners invite anyone, admins anyone below owner.
create policy "Owners and admins read invitations"
  on public.firm_invites for select to authenticated
  using ((select public.firm_role(firm_id)) in ('owner', 'admin'));

create policy "Owners and admins invite"
  on public.firm_invites for insert to authenticated
  with check ((select public.firm_role(firm_id)) in ('owner', 'admin') and invited_by = (select auth.uid()));

create policy "Owners and admins replace invitations"
  on public.firm_invites for update to authenticated
  using ((select public.firm_role(firm_id)) in ('owner', 'admin'))
  with check ((select public.firm_role(firm_id)) in ('owner', 'admin') and invited_by = (select auth.uid()));

create policy "Owners and admins revoke invitations"
  on public.firm_invites for delete to authenticated
  using ((select public.firm_role(firm_id)) in ('owner', 'admin'));

revoke all on table public.firm_invites from anon;

-- ---------------------------------------------------------------------------
-- The firm's roster with email addresses. auth.users isn't readable through
-- the API, so this exposes exactly one column of it, to colleagues only.
-- ---------------------------------------------------------------------------
create function public.firm_roster(target uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.firm_members m
  join auth.users u on u.id = m.user_id
  where m.firm_id = target and public.is_firm_member(target)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
$$;

revoke all on function public.firm_roster(uuid) from public, anon;
grant execute on function public.firm_roster(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- What an invitation link offers, for the page that accepts it. Never returns
-- the invited address, only whether it matches the caller's.
-- ---------------------------------------------------------------------------
create function public.firm_invite_preview(invite_hash text)
returns table (firm_name text, role text, expired boolean, email_matches boolean, already_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    f.name,
    i.role,
    i.expires_at <= now(),
    exists (
      select 1 from auth.users u
      where u.id = (select auth.uid()) and lower(u.email) = i.email and u.email_confirmed_at is not null
    ),
    public.is_firm_member(i.firm_id)
  from public.firm_invites i
  join public.firms f on f.id = i.firm_id
  where i.token_hash = invite_hash and (select auth.uid()) is not null;
$$;

revoke all on function public.firm_invite_preview(text) from public, anon;
grant execute on function public.firm_invite_preview(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Accepting: one statement checks the link, the expiry and the caller's
-- confirmed email, adds the membership and spends the invitation. Someone
-- who is already a member keeps their current role.
-- ---------------------------------------------------------------------------
create function public.accept_firm_invite(invite_hash text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  invite public.firm_invites%rowtype;
begin
  if caller is null then
    raise exception 'Sign in to accept an invitation';
  end if;
  select * into invite from public.firm_invites where token_hash = invite_hash for update;
  if not found then
    raise exception 'This invitation is no longer valid' using errcode = 'P0002';
  end if;
  if invite.expires_at <= now() then
    raise exception 'This invitation has expired' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = caller and lower(u.email) = invite.email and u.email_confirmed_at is not null
  ) then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;
  insert into public.firm_members (firm_id, user_id, role)
  values (invite.firm_id, caller, invite.role)
  on conflict (firm_id, user_id) do nothing;
  delete from public.firm_invites where id = invite.id;
  return invite.firm_id;
end;
$$;

revoke all on function public.accept_firm_invite(text) from public, anon;
grant execute on function public.accept_firm_invite(text) to authenticated;
