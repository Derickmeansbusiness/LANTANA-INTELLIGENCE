-- Phase 6: invite-only accounts, external data rooms, reports and schedules.
--
-- Accounts: nobody can create an account unless a principal (or, for data
-- room guests, a manager) invited that address, or an administrator created
-- it with a role in app_metadata. The gate is the auth.users insert trigger,
-- so it holds however the sign-up arrives (magic link, password, API). No
-- service-role key is involved.
--
-- Data rooms: external guests see only rooms they're members of, only the
-- documents placed in them, and only as watermarked PDF/PNG/JPEG streamed by
-- the server under their own session. Every open is logged.

-- ===========================================================================
-- Invites
-- ===========================================================================
create table public.user_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.user_role not null,
  full_name text,
  title text,
  note text,
  invited_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_profile_id uuid references public.profiles (id),
  revoked_at timestamptz,
  is_demo boolean not null default false
);
create unique index user_invites_open_email_uq on public.user_invites (email)
  where accepted_at is null and revoked_at is null;

-- Principals invite anyone; managers may invite external guests only.
create or replace function private.can_invite(p_role public.user_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_principal() or (p_role = 'external' and private.is_manager_plus())
$$;

alter table public.user_invites enable row level security;
create policy invite_read on public.user_invites for select to authenticated using (private.is_manager_plus());
create policy invite_insert on public.user_invites for insert to authenticated with check (private.can_invite(role));
create policy invite_update on public.user_invites for update to authenticated
  using (private.can_invite(role)) with check (private.can_invite(role));

create or replace function private.invite_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- pg_trigger_depth() > 1: the sign-up trigger marking the invite accepted.
  if tg_op = 'UPDATE' and auth.uid() is not null and pg_trigger_depth() <= 1 and (
       new.email is distinct from old.email or new.role is distinct from old.role
       or new.accepted_at is distinct from old.accepted_at or new.accepted_profile_id is distinct from old.accepted_profile_id) then
    raise exception 'an invite can only be revoked or extended; send a new one instead' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from public.profiles p where lower(p.email) = new.email) then
      raise exception 'that address already has an account' using errcode = '23505';
    end if;
  end if;
  return new;
end $$;
create trigger user_invites_guard before insert or update on public.user_invites
  for each row execute function private.invite_guard();

-- New auth users: role from app_metadata (set only by an administrator), else
-- from an open invite, else a dashboard invite (invited_at) gets staff, else
-- the account is refused.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  inv public.user_invites;
  meta_role text := new.raw_app_meta_data ->> 'role';
begin
  select * into inv from public.user_invites i
  where i.email = lower(new.email) and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  order by i.created_at desc limit 1;

  if meta_role is null and inv.id is null and new.invited_at is null then
    raise exception 'Lantana Command is invite-only' using errcode = '42501';
  end if;

  insert into public.profiles (id, email, full_name, title, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(inv.full_name, ''), new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    inv.title,
    coalesce(meta_role::public.user_role, inv.role, 'staff'));

  if inv.id is not null then
    update public.user_invites set accepted_at = now(), accepted_profile_id = new.id where id = inv.id;
  end if;
  return new;
end $$;

-- ===========================================================================
-- Data rooms
-- ===========================================================================
create table public.data_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 1),
  description text,
  deal_id uuid references public.deals (id),
  organization_id uuid references public.organizations (id),
  status text not null default 'open' check (status in ('open', 'closed')),
  expires_on date,
  allow_download boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

create table public.data_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.data_rooms (id),
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text,
  company text,
  profile_id uuid references public.profiles (id),
  invited_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  is_demo boolean not null default false,
  unique (room_id, email)
);

create table public.data_room_documents (
  room_id uuid not null references public.data_rooms (id),
  document_id uuid not null references public.documents (id),
  position integer not null default 0,
  added_by uuid default auth.uid() references public.profiles (id),
  added_at timestamptz not null default now(),
  is_demo boolean not null default false,
  primary key (room_id, document_id)
);

create table public.data_room_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.data_rooms (id),
  document_id uuid references public.documents (id),
  profile_id uuid default auth.uid() references public.profiles (id),
  kind text not null check (kind in ('open_room', 'view', 'download')),
  storage_path text,
  occurred_at timestamptz not null default now(),
  is_demo boolean not null default false
);
create index data_room_events_room_idx on public.data_room_events (room_id, occurred_at desc);

create or replace function private.room_open(p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.data_rooms r
                 where r.id = p_room and r.deleted_at is null and r.status = 'open'
                   and (r.expires_on is null or r.expires_on >= private.today_dubai()))
$$;

create or replace function private.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and private.room_open(p_room) and exists (
    select 1 from public.data_room_members m
    where m.room_id = p_room and m.profile_id = auth.uid() and m.revoked_at is null)
$$;

-- Members are matched to accounts by email: on insert, and when the invitee
-- signs up later. A guest without an account gets an external invite.
create or replace function private.room_member_link()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  new.email := lower(trim(new.email));
  select p.id into pid from public.profiles p where lower(p.email) = new.email;
  if pid is not null then
    if exists (select 1 from public.profiles p where p.id = pid and p.role <> 'external') then
      raise exception 'that address belongs to a Lantana colleague, who already sees rooms from inside the app' using errcode = '22023';
    end if;
    new.profile_id := pid;
  elsif tg_op = 'INSERT' then
    insert into public.user_invites (email, role, full_name, note, invited_by, is_demo)
    values (new.email, 'external', new.full_name, 'Data room guest', auth.uid(), new.is_demo)
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger data_room_members_link before insert or update of email on public.data_room_members
  for each row execute function private.room_member_link();

create or replace function private.room_members_claim()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.data_room_members set profile_id = new.id where email = lower(new.email) and profile_id is null;
  return null;
end $$;
create trigger profiles_claim_room_memberships after insert on public.profiles
  for each row execute function private.room_members_claim();

-- Only watermarkable formats go into a room (same rule as share links).
create or replace function private.room_document_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare m text;
begin
  select v.mime_type into m from public.documents d join public.document_versions v on v.id = d.current_version_id
  where d.id = new.document_id and d.deleted_at is null;
  if m is null then
    raise exception 'that document has no file yet' using errcode = '22023';
  end if;
  if m not in ('application/pdf', 'image/png', 'image/jpeg') then
    raise exception 'only PDF, PNG and JPEG files can go in a data room, because only those are watermarked; export Word files to PDF first' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger data_room_documents_guard before insert on public.data_room_documents
  for each row execute function private.room_document_guard();

alter table public.data_rooms enable row level security;
alter table public.data_room_members enable row level security;
alter table public.data_room_documents enable row level security;
alter table public.data_room_events enable row level security;

create policy room_read on public.data_rooms for select to authenticated
  using (private.is_manager_plus() or private.is_room_member(id));
create policy room_insert on public.data_rooms for insert to authenticated with check (private.is_manager_plus());
create policy room_update on public.data_rooms for update to authenticated
  using (private.is_manager_plus()) with check (private.is_manager_plus());

create policy room_member_read on public.data_room_members for select to authenticated
  using (private.is_manager_plus() or profile_id = auth.uid());
create policy room_member_insert on public.data_room_members for insert to authenticated with check (private.is_manager_plus());
create policy room_member_update on public.data_room_members for update to authenticated
  using (private.is_manager_plus()) with check (private.is_manager_plus());

create policy room_doc_read on public.data_room_documents for select to authenticated
  using (private.is_manager_plus() or private.is_room_member(room_id));
create policy room_doc_insert on public.data_room_documents for insert to authenticated with check (private.is_manager_plus());
-- A link row: taking a document out of a room is a delete (audited).
create policy room_doc_delete on public.data_room_documents for delete to authenticated using (private.is_manager_plus());

create policy room_event_read on public.data_room_events for select to authenticated using (private.is_manager_plus());
revoke insert, update, delete, truncate on public.data_room_events from authenticated;

-- What a guest sees in a room: titles and file facts, never storage paths.
create or replace function public.portal_room_documents(p_room uuid)
returns table (document_id uuid, title text, doc_type text, mime_type text, size_bytes bigint, version_no integer,
               updated_at timestamptz, sort_order integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.is_room_member(p_room) or private.is_manager_plus()) then
    return;
  end if;
  return query
  select d.id, d.title, d.doc_type, v.mime_type, v.size_bytes, v.version_no, v.created_at, rd.position
  from public.data_room_documents rd
  join public.documents d on d.id = rd.document_id and d.deleted_at is null
  join public.document_versions v on v.id = d.current_version_id
  where rd.room_id = p_room
  order by rd.position, d.title;
end $$;

-- Open a document in a room: checks membership, logs the event, and returns
-- what the server needs to stream a watermarked copy. The storage policy
-- below opens that one object to this user for two minutes after the log.
create or replace function public.open_room_document(p_room uuid, p_document uuid, p_download boolean default false)
returns table (title text, storage_path text, mime_type text, file_name text, room_name text, viewer_email text, allow_download boolean)
language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.data_rooms;
  v public.document_versions;
  t text;
  em text;
begin
  if not private.is_room_member(p_room) then
    return;
  end if;
  select * into r from public.data_rooms where id = p_room;
  if p_download and not r.allow_download then
    return;
  end if;
  select v2.* into v
  from public.data_room_documents rd
  join public.documents d on d.id = rd.document_id and d.deleted_at is null
  join public.document_versions v2 on v2.id = d.current_version_id
  where rd.room_id = p_room and rd.document_id = p_document;
  if v.id is null then
    return;
  end if;
  select d.title into t from public.documents d where d.id = p_document;
  select p.email into em from public.profiles p where p.id = auth.uid();
  insert into public.data_room_events (room_id, document_id, profile_id, kind, storage_path, is_demo)
  values (p_room, p_document, auth.uid(), case when p_download then 'download' else 'view' end, v.storage_path, r.is_demo);
  return query select t, v.storage_path, v.mime_type, v.file_name, r.name, em, r.allow_download;
end $$;

create or replace function public.log_room_open(p_room uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.is_room_member(p_room) then
    insert into public.data_room_events (room_id, profile_id, kind, is_demo)
    select p_room, auth.uid(), 'open_room', r.is_demo from public.data_rooms r where r.id = p_room;
  end if;
end $$;

create or replace function private.room_object_open(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.data_room_events e
    where e.storage_path = p_name and e.profile_id = auth.uid() and e.kind in ('view', 'download')
      and e.occurred_at > now() - interval '2 minutes'
      and private.is_room_member(e.room_id))
$$;

create policy lantana_docs_room_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and private.room_object_open(name));

-- ===========================================================================
-- Reports
-- ===========================================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 1),
  sections text[] not null check (cardinality(sections) between 1 and 20),
  period text not null default 'last_30'
    check (period in ('last_7', 'last_30', 'month_to_date', 'last_month', 'quarter_to_date', 'year_to_date')),
  shared boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

-- A schedule points at a built-in pack or a saved report.
create table public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  pack text check (pack in ('weekly_management', 'monthly_board', 'pipeline', 'finance', 'people_compliance')),
  report_id uuid references public.reports (id),
  cadence text not null check (cadence in ('weekly', 'monthly')),
  recipient_ids uuid[] not null default '{}',
  active boolean not null default true,
  last_notified_on date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz,
  check ((pack is null) <> (report_id is null)),
  check (cardinality(recipient_ids) between 1 and 20)
);

create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  pack text,
  report_id uuid references public.reports (id),
  name text not null,
  period_from date not null,
  period_to date not null,
  document_id uuid references public.documents (id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id)
);
create index report_runs_created_idx on public.report_runs (created_at desc);

alter table public.reports enable row level security;
alter table public.report_schedules enable row level security;
alter table public.report_runs enable row level security;

create policy report_read on public.reports for select to authenticated
  using (private.is_manager_plus() and (shared or created_by = auth.uid() or private.is_principal()));
create policy report_insert on public.reports for insert to authenticated with check (private.is_manager_plus());
create policy report_update on public.reports for update to authenticated
  using (private.is_manager_plus() and (created_by = auth.uid() or private.is_principal()))
  with check (private.is_manager_plus());

create policy schedule_read on public.report_schedules for select to authenticated using (private.is_manager_plus());
create policy schedule_insert on public.report_schedules for insert to authenticated with check (private.is_manager_plus());
create policy schedule_update on public.report_schedules for update to authenticated
  using (private.is_manager_plus()) with check (private.is_manager_plus());

create policy run_read on public.report_runs for select to authenticated
  using (private.is_manager_plus() and (created_by = auth.uid() or private.is_principal()));
create policy run_insert on public.report_runs for insert to authenticated
  with check (private.is_manager_plus() and created_by = auth.uid());

-- Reports are rendered in the app under the reader's own session (so a pack
-- never shows them more than they may see). The schedule job only tells each
-- recipient that a pack is due; opening the notification generates it.
create or replace function private.run_report_schedules(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, private.today_dubai());
  s record;
  sent integer := 0;
  label text;
begin
  for s in
    select sc.*, r.name as report_name
    from public.report_schedules sc left join public.reports r on r.id = sc.report_id
    where sc.deleted_at is null and sc.active
      and (sc.last_notified_on is null or sc.last_notified_on < today)
      and ((sc.cadence = 'weekly' and extract(isodow from today) = 1)
           or (sc.cadence = 'monthly' and extract(day from today) = 1))
  loop
    label := coalesce(s.report_name, case s.pack
      when 'weekly_management' then 'Weekly management pack'
      when 'monthly_board' then 'Monthly board pack'
      when 'pipeline' then 'Pipeline and introductions report'
      when 'finance' then 'Finance pack'
      else 'People and compliance pack' end);
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, is_demo)
    select p.id, 'report_due', label || ' is ready to generate',
           'Open it to build the PDF on the letterhead from today''s figures.', 'report_schedule', s.id, s.is_demo
    from public.profiles p
    where p.id = any (s.recipient_ids) and p.is_active and p.role in ('principal', 'manager');
    update public.report_schedules set last_notified_on = today where id = s.id;
    sent := sent + 1;
  end loop;
  return sent;
end $$;

-- 03:30 UTC = 07:30 Dubai.
select cron.schedule('lantana-report-schedules', '30 3 * * *', 'select private.run_report_schedules()');

-- ===========================================================================
-- Backup / export: one audited call per table, principal only, run under
-- the principal's own session (RLS applies; encrypted columns are skipped).
-- ===========================================================================
create or replace function public.log_export(p_scope text, p_tables text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, table_name, context)
  values (auth.uid(), 'export', null, jsonb_build_object('scope', p_scope, 'tables', to_jsonb(p_tables)));
end $$;

-- ===========================================================================
-- Audit, updated_at, archive guard, demo wipe hook
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array['user_invites', 'data_rooms', 'data_room_members', 'data_room_documents', 'reports', 'report_schedules', 'report_runs'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
  foreach t in array array['data_rooms', 'reports', 'report_schedules'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.guard_archive()', t || '_guard_archive', t);
  end loop;
end $$;

-- The demo wipe runs before demo documents and deals go: clear rows that
-- point at them. Hooked onto the contracts delete like the agent rows.
create or replace function private.wipe_demo_phase6_rows()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.data_room_events where is_demo or room_id in (select id from public.data_rooms where is_demo)
                                         or document_id in (select id from public.documents where is_demo);
  delete from public.data_room_documents where is_demo or room_id in (select id from public.data_rooms where is_demo)
                                            or document_id in (select id from public.documents where is_demo);
  delete from public.data_room_members where is_demo or room_id in (select id from public.data_rooms where is_demo);
  delete from public.data_rooms where is_demo;
  delete from public.report_runs where is_demo or document_id in (select id from public.documents where is_demo);
  delete from public.report_schedules where is_demo;
  delete from public.reports where is_demo;
  delete from public.user_invites where is_demo;
end $$;

create or replace function private.before_demo_contract_delete_p6()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.wiping_demo', true) = 'on' then
    perform private.wipe_demo_phase6_rows();
  end if;
  return null;
end $$;
create trigger contracts_demo_wipe_phase6 before delete on public.contracts
  for each statement execute function private.before_demo_contract_delete_p6();

-- ===========================================================================
-- Grants. Keep anon out of everything new; re-grant the share window.
-- ===========================================================================
revoke all on public.user_invites, public.data_rooms, public.data_room_members, public.data_room_documents,
              public.data_room_events, public.reports, public.report_schedules, public.report_runs from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.open_share_link(text, text, text) to anon;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
grant execute on function private.share_object_open(text) to anon;
revoke execute on function private.pii_key() from authenticated;
revoke execute on function private.enc(text) from authenticated;
revoke execute on function private.dec(bytea) from authenticated;
revoke execute on function private.dec_minor(bytea) from authenticated;
revoke execute on function private.run_expiry_alerts(date) from authenticated;
revoke execute on function private.run_nightly_scan(date) from authenticated;
revoke execute on function private.run_weekly_digest(date) from authenticated;
revoke execute on function private.wipe_demo_agent_rows() from authenticated;
revoke execute on function private.wipe_demo_phase6_rows() from authenticated;
revoke execute on function private.run_report_schedules(date) from authenticated;
