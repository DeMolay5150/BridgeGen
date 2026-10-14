-- Follow-ups from the Supabase security and performance advisors after the
-- firms, audit and realtime migrations.

-- Trigger functions were callable through /rest/v1/rpc. Postgres refuses to
-- run them outside a trigger, but the grant shouldn't exist. Firing a trigger
-- doesn't check EXECUTE, so revoking it changes nothing for the triggers.
revoke execute on function public.companies_default_firm() from public, anon, authenticated;
revoke execute on function public.firms_delete_empty() from public, anon, authenticated;
revoke execute on function public.users_create_personal_firm() from public, anon, authenticated;
revoke execute on function public.firm_members_keep_owner() from public, anon, authenticated;
revoke execute on function public.audit_events_append_only() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Deleting an account clears audit_events.actor_id; index it so that stays fast.
create index audit_events_actor_id_idx on public.audit_events (actor_id);
