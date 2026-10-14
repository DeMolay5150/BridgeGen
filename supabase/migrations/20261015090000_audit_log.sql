-- Audit trail for Decision Room activity: who issued or replaced a
-- stakeholder link, when answers were saved, when reports left the building.
-- Written only by the server (secret key) after it has authorized the action;
-- read only by the firm's owners and admins; never updated. Never holds
-- stakeholder answers: metadata is small and allow-listed in code.

create table public.audit_events (
  id bigint generated always as identity primary key,
  firm_id uuid not null references public.firms (id) on delete cascade,
  -- Events outlive the company or person they describe.
  company_id uuid references public.companies (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$' and char_length(action) <= 64),
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 2048),
  created_at timestamptz not null default now()
);

create index audit_events_firm_created_idx on public.audit_events (firm_id, created_at desc);
create index audit_events_company_idx on public.audit_events (company_id);

alter table public.audit_events enable row level security;

create policy "Owners and admins read their firm's audit trail"
  on public.audit_events for select to authenticated
  using ((select public.firm_role(firm_id)) in ('owner', 'admin'));

-- No insert, update or delete policies, and no write privileges: only the server writes.
revoke all on table public.audit_events from anon;
revoke insert, update, delete, truncate on table public.audit_events from authenticated;

-- Append-only, even for the server. The one permitted change is what the
-- foreign keys do when a person or company is deleted: clearing actor_id or
-- company_id to null. That can remove an attribution, never forge or alter one.
-- (Rows are deleted only by cascade when their firm is deleted.)
create function public.audit_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id = old.id
     and new.firm_id = old.firm_id
     and new.action = old.action
     and new.metadata = old.metadata
     and new.created_at = old.created_at
     and (new.actor_id is not distinct from old.actor_id or new.actor_id is null)
     and (new.company_id is not distinct from old.company_id or new.company_id is null) then
    return new;
  end if;
  raise exception 'audit_events is append-only';
end;
$$;

create trigger audit_events_append_only
  before update on public.audit_events
  for each row execute function public.audit_events_append_only();
