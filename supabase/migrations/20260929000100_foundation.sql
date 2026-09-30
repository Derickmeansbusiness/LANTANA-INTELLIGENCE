-- Foundation: extensions, enums, role helpers, profiles, audit log, activity feed.
--
-- Conventions (see CLAUDE.md):
--   * private schema holds helpers and is never exposed through the Data API.
--   * RLS is the security boundary. No DELETE policies anywhere: rows are
--     soft-deleted with deleted_at. The only hard delete is the demo wipe.
--   * SELECT policies do NOT filter deleted_at (doing so breaks UPDATE ...
--     RETURNING on soft delete). Queries and views filter it instead.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('principal', 'manager', 'staff', 'external');
create type public.org_type as enum (
  'investor', 'project_owner', 'strategic_partner', 'introducer', 'government', 'supplier'
);
create type public.sector as enum (
  'agriculture', 'energy', 'real_estate', 'infrastructure', 'commodities',
  'industry', 'education', 'telecoms'
);
create type public.activity_scope as enum ('principal', 'management', 'deal', 'internal');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Seeds and imports can replay history by setting app.occurred_at; everything
-- else uses now(). Only used for event timestamps, never for security.
create or replace function private.event_time()
returns timestamptz language sql stable as $$
  select coalesce(nullif(current_setting('app.occurred_at', true), '')::timestamptz, now())
$$;

create or replace function private.today_dubai()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Dubai')::date
$$;

-- ---------------------------------------------------------------------------
-- Company singleton
-- ---------------------------------------------------------------------------
create table public.company (
  id boolean primary key default true check (id),
  legal_name text not null,
  licence_no text,
  licensing_authority text,
  address_lines text[] not null default '{}',
  website text,
  base_currency char(3) not null default 'AED',
  timezone text not null default 'Asia/Dubai',
  -- When true, a principal must be at aal2 (TOTP verified) to get principal
  -- visibility. At aal1 they are treated as a manager.
  require_principal_mfa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  title text,
  role public.user_role not null default 'staff',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'staff')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role helpers. security definer so policies can call them without recursing
-- through profiles' own RLS.
-- ---------------------------------------------------------------------------
create or replace function private.user_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function private.has_mfa()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

create or replace function private.is_principal()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    private.user_role() = 'principal'
      and (private.has_mfa() or not coalesce((select c.require_principal_mfa from public.company c), true)),
    false)
$$;

-- Principal (at any aal) or manager.
create or replace function private.is_manager_plus()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.user_role() in ('principal', 'manager'), false)
$$;

create or replace function private.is_internal()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.user_role() in ('principal', 'manager', 'staff'), false)
$$;

grant execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Audit log: append-only. Written only by triggers / log_event().
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  action text not null,           -- insert | update | delete | download | share | agent_* | wipe_demo ...
  table_name text,
  row_id text,
  before jsonb,
  after jsonb,
  context jsonb not null default '{}'
);
create index audit_log_row_idx on public.audit_log (table_name, row_id);
create index audit_log_time_idx on public.audit_log (occurred_at desc);

create or replace function private.block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;

create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function private.block_mutation();

-- Row audit. TG_ARGV lists columns to redact (encrypted / sensitive fields).
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  b jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  a jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  col text;
begin
  foreach col in array coalesce(tg_argv, '{}'::text[]) loop
    if b ? col then b := jsonb_set(b, array[col], '"[redacted]"'); end if;
    if a ? col then a := jsonb_set(a, array[col], '"[redacted]"'); end if;
  end loop;
  if tg_op = 'UPDATE' and b = a then
    return null;
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id, before, after)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(a ->> 'id', b ->> 'id'), b, a);
  return null;
end $$;

-- Non-row events (downloads, shares, agent actions, reveals). Callable by any
-- internal user; actor is always the caller, never a parameter.
create or replace function public.log_event(p_action text, p_table text, p_row_id text, p_context jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_internal() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id, context)
  values (auth.uid(), p_action, p_table, p_row_id, coalesce(p_context, '{}'));
end $$;

-- ---------------------------------------------------------------------------
-- Activity feed: sanitized sentences, RLS-scoped, safe for Realtime.
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id),
  verb text not null,              -- created | moved | completed | logged | updated
  summary text not null,           -- e.g. "moved Mauritania fertilizer supply to Term sheet"
  entity_type text not null,
  entity_id uuid,
  scope public.activity_scope not null,
  deal_id uuid,
  user_ids uuid[] not null default '{}',
  is_demo boolean not null default false
);
create index activity_events_time_idx on public.activity_events (occurred_at desc);

create or replace function private.emit_activity(
  p_verb text, p_summary text, p_entity_type text, p_entity_id uuid,
  p_scope public.activity_scope, p_deal_id uuid default null,
  p_user_ids uuid[] default '{}', p_is_demo boolean default false)
returns void language sql security definer set search_path = '' as $$
  insert into public.activity_events
    (occurred_at, actor_id, verb, summary, entity_type, entity_id, scope, deal_id, user_ids, is_demo)
  values (private.event_time(), auth.uid(), p_verb, p_summary, p_entity_type, p_entity_id,
          p_scope, p_deal_id, coalesce(p_user_ids, '{}'), coalesce(p_is_demo, false))
$$;

-- ---------------------------------------------------------------------------
-- RLS: company, profiles, audit_log
-- ---------------------------------------------------------------------------
alter table public.company enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;
alter table public.activity_events enable row level security;

create policy company_read on public.company for select to authenticated
  using (private.is_internal());
create policy company_update on public.company for update to authenticated
  using (private.is_principal()) with check (private.is_principal());

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_internal());
-- Users may edit their own display fields; role changes go through set_user_role().
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, title, avatar_url) on public.profiles to authenticated;

create policy audit_read on public.audit_log for select to authenticated
  using (private.is_principal());
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated, service_role;

create or replace function public.set_user_role(p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_principal() then
    raise exception 'only a principal can change roles' using errcode = '42501';
  end if;
  if p_user = auth.uid() and p_role <> 'principal' then
    raise exception 'you cannot demote yourself' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger company_updated_at before update on public.company
  for each row execute function private.set_updated_at();
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function private.audit_row();
create trigger company_audit after insert or update or delete on public.company
  for each row execute function private.audit_row();
