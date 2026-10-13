-- BridgeGen initial schema: saved client companies, Decision Room invites and
-- confidential Decision Room responses.

-- ---------------------------------------------------------------------------
-- Shared: keep updated_at current
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- companies: one row per client company an advisor models
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  baseline jsonb not null default '{}'::jsonb,
  scenario jsonb not null default '{}'::jsonb,
  governance jsonb not null default '{}'::jsonb,
  fork jsonb not null default '{}'::jsonb,
  priorities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_owner_id_idx on public.companies (owner_id);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

alter table public.companies enable row level security;

create policy "Owners read their companies"
  on public.companies for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners create companies"
  on public.companies for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners update their companies"
  on public.companies for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners delete their companies"
  on public.companies for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.companies from anon;

-- ---------------------------------------------------------------------------
-- room_invites: one private link per stakeholder per company.
-- Only a SHA-256 hash of the link token is stored.
-- ---------------------------------------------------------------------------
create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  stakeholder text not null check (stakeholder in ('founder', 'nextGen', 'board', 'lender')),
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_at timestamptz not null default now(),
  unique (company_id, stakeholder)
);

alter table public.room_invites enable row level security;

create policy "Owners read their invites"
  on public.room_invites for select to authenticated
  using (exists (
    select 1 from public.companies c
    where c.id = company_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners create invites"
  on public.room_invites for insert to authenticated
  with check (exists (
    select 1 from public.companies c
    where c.id = company_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners replace invites"
  on public.room_invites for update to authenticated
  using (exists (
    select 1 from public.companies c
    where c.id = company_id and c.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.companies c
    where c.id = company_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners delete invites"
  on public.room_invites for delete to authenticated
  using (exists (
    select 1 from public.companies c
    where c.id = company_id and c.owner_id = (select auth.uid())
  ));

revoke all on table public.room_invites from anon;

-- ---------------------------------------------------------------------------
-- room_responses: stakeholders' confidential answers.
-- RLS is enabled with NO policies, and API roles lose all privileges:
-- only the server (secret key) can read or write. The advisor never sees
-- raw answers; the gaps route returns derived gaps only.
-- ---------------------------------------------------------------------------
create table public.room_responses (
  company_id uuid not null references public.companies (id) on delete cascade,
  stakeholder text not null check (stakeholder in ('founder', 'nextGen', 'board', 'lender')),
  positions jsonb not null default '{}'::jsonb,
  predictions jsonb not null default '{}'::jsonb,
  submitted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (company_id, stakeholder)
);

create trigger room_responses_set_updated_at
  before update on public.room_responses
  for each row execute function public.set_updated_at();

alter table public.room_responses enable row level security;

revoke all on table public.room_responses from anon, authenticated;
