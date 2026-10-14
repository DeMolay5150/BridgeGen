-- Live Decision Rooms: presence, cursors and scenario sync over Supabase
-- Realtime private channels, one per company ("company:<uuid>"). Only members
-- of the company's firm may join or send. Clients must subscribe with
-- `config: { private: true }`; also turn OFF "Allow public access" in the
-- Realtime settings so no public channel can shadow a private topic.

create function public.can_use_company_channel(channel_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if channel_topic is null
     or channel_topic !~ '^company:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1
    from public.companies c
    join public.firm_members m on m.firm_id = c.firm_id
    where c.id = substring(channel_topic from 9)::uuid
      and m.user_id = (select auth.uid())
  );
end;
$$;

revoke all on function public.can_use_company_channel(text) from public, anon;
grant execute on function public.can_use_company_channel(text) to authenticated;

create policy "Firm members receive their companies' room events"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select public.can_use_company_channel((select realtime.topic())))
  );

create policy "Firm members send to their companies' rooms"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select public.can_use_company_channel((select realtime.topic())))
  );
