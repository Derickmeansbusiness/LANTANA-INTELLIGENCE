-- Reference data, organizations, contacts, deals, introductions ledger.

-- ---------------------------------------------------------------------------
-- Reference
-- ---------------------------------------------------------------------------
create table public.currencies (
  code char(3) primary key,
  name text not null,
  minor_unit smallint not null check (minor_unit between 0 and 4),  -- ISO 4217 exponent
  symbol text
);

create table public.countries (
  code char(2) primary key,
  name text not null,
  region text not null check (region in ('africa', 'gcc', 'other'))
);

-- 1 unit of base = rate units of quote. We store everything against AED.
create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  rate_date date not null,
  base char(3) not null references public.currencies (code),
  quote char(3) not null references public.currencies (code),
  rate numeric(20, 10) not null check (rate > 0),
  source text not null default 'manual',   -- manual | peg | feed | demo
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  unique (rate_date, base, quote)
);

create table public.pipeline_stages (
  key text primary key,
  label text not null,
  sort_order smallint not null unique,
  default_probability smallint not null check (default_probability between 0 and 100),
  is_advanced boolean not null default false,
  is_terminal boolean not null default false,
  is_won boolean not null default false
);

-- ---------------------------------------------------------------------------
-- FX helpers (security invoker: fx_rates is readable by all internal users)
-- ---------------------------------------------------------------------------
create or replace function private.rate_to_aed(p_currency char(3), p_on date)
returns numeric language sql stable set search_path = '' as $$
  select case when p_currency = 'AED' then 1::numeric else (
    select r.rate from public.fx_rates r
    where r.base = p_currency and r.quote = 'AED' and r.rate_date <= p_on
    order by r.rate_date desc limit 1)
  end
$$;

-- Convert integer minor units to MAJOR units of the target currency.
-- Returns null when a rate is missing; callers must surface that.
create or replace function private.convert_major(p_amount_minor bigint, p_from char(3), p_to char(3), p_on date)
returns numeric language sql stable set search_path = '' as $$
  select (p_amount_minor::numeric / power(10, cf.minor_unit))
         * private.rate_to_aed(p_from, p_on) / nullif(private.rate_to_aed(p_to, p_on), 0)
  from public.currencies cf where cf.code = p_from
$$;

-- ---------------------------------------------------------------------------
-- Organizations & contacts
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.org_type not null,
  country char(2) references public.countries (code),
  regions_of_interest text[] not null default '{}',
  sectors public.sector[] not null default '{}',
  ticket_min_minor bigint,
  ticket_max_minor bigint,
  ticket_currency char(3) references public.currencies (code),
  website text,
  description text,
  relationship_owner_id uuid references public.profiles (id),
  status text not null default 'active' check (status in ('prospect', 'active', 'dormant', 'closed')),
  linked_profile_id uuid references public.profiles (id),  -- an individual introducer who is also a user
  last_contact_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz,
  search tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored
);
create index organizations_search_idx on public.organizations using gin (search);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  full_name text not null,
  job_title text,
  email text,
  phone text,
  country char(2) references public.countries (code),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);
create index contacts_org_idx on public.contacts (organization_id);

-- ---------------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------------
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country char(2) references public.countries (code),
  sector public.sector not null,
  ticket_minor bigint,
  currency char(3) not null default 'USD' references public.currencies (code),
  stage text not null default 'lead' references public.pipeline_stages (key),
  probability smallint check (probability between 0 and 100),
  project_owner_org_id uuid references public.organizations (id),
  introducer_org_id uuid references public.organizations (id),
  fee_terms text,
  fee_pct numeric(5, 2),
  spv_planned boolean not null default false,
  next_step text,
  next_step_due date,
  owner_id uuid references public.profiles (id),
  summary text,
  last_activity_at timestamptz not null default now(),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz,
  search tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(next_step, ''))
  ) stored
);
create index deals_stage_idx on public.deals (stage);
create index deals_search_idx on public.deals using gin (search);

create table public.deal_members (
  deal_id uuid not null references public.deals (id),
  user_id uuid not null references public.profiles (id),
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (deal_id, user_id)
);

create table public.deal_parties (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id),
  organization_id uuid not null references public.organizations (id),
  role text not null check (role in ('investor_introduced', 'investor_interested', 'buyer', 'supplier', 'co_advisor', 'lender', 'other')),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  unique (deal_id, organization_id, role)
);

create table public.deal_stage_history (
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.deals (id),
  from_stage text references public.pipeline_stages (key),
  to_stage text not null references public.pipeline_stages (key),
  changed_at timestamptz not null default now(),
  changed_by uuid references public.profiles (id),
  note text,
  is_demo boolean not null default false
);
create index deal_stage_history_deal_idx on public.deal_stage_history (deal_id, changed_at);

-- ---------------------------------------------------------------------------
-- Visibility helpers that depend on deals
-- ---------------------------------------------------------------------------
create or replace function private.can_see_deal(p_deal uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_manager_plus()
    or (private.user_role() = 'staff' and exists (
      select 1 from public.deals d
      where d.id = p_deal
        and (d.owner_id = auth.uid()
             or exists (select 1 from public.deal_members m where m.deal_id = d.id and m.user_id = auth.uid()))))
$$;

create or replace function private.can_see_org(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_manager_plus()
    or (private.user_role() = 'staff' and exists (
      select 1 from public.deals d
      where (d.project_owner_org_id = p_org or d.introducer_org_id = p_org
             or exists (select 1 from public.deal_parties dp where dp.deal_id = d.id and dp.organization_id = p_org))
        and private.can_see_deal(d.id)))
$$;

-- ---------------------------------------------------------------------------
-- Introductions ledger: append-only, sha256 hash chain.
-- Demo and real rows chain separately so wiping demo data keeps the real
-- chain verifiable.
-- ---------------------------------------------------------------------------
create table public.introductions (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  introduced_on date not null,
  deal_id uuid references public.deals (id),
  party_a_org_id uuid not null references public.organizations (id),
  party_a_contact_id uuid references public.contacts (id),
  party_b_org_id uuid not null references public.organizations (id),
  party_b_contact_id uuid references public.contacts (id),
  channel text not null check (channel in ('email', 'meeting', 'call', 'letter', 'whatsapp', 'video_call', 'other')),
  summary text not null,
  evidence_document_id uuid,      -- FK added with documents
  corrects_id uuid references public.introductions (id),
  recorded_at timestamptz not null default now(),
  recorded_by uuid default auth.uid() references public.profiles (id),
  prev_hash text,
  row_hash text not null,
  is_demo boolean not null default false,
  check (party_a_org_id <> party_b_org_id)
);
create index introductions_deal_idx on public.introductions (deal_id);

create or replace function private.introductions_chain()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- serialise appends so two concurrent inserts can't share a prev_hash
  perform pg_advisory_xact_lock(hashtext('introductions_chain'));
  new.recorded_at := now();
  new.recorded_by := coalesce(auth.uid(), new.recorded_by);
  select i.row_hash into new.prev_hash
  from public.introductions i
  where i.is_demo = new.is_demo
  order by i.seq desc limit 1;
  new.row_hash := encode(extensions.digest(
    coalesce(new.prev_hash, 'GENESIS') || '|' ||
    new.id::text || '|' || new.introduced_on::text || '|' ||
    coalesce(new.deal_id::text, '') || '|' ||
    new.party_a_org_id::text || '|' || coalesce(new.party_a_contact_id::text, '') || '|' ||
    new.party_b_org_id::text || '|' || coalesce(new.party_b_contact_id::text, '') || '|' ||
    new.channel || '|' || new.summary || '|' ||
    coalesce(new.evidence_document_id::text, '') || '|' ||
    coalesce(new.corrects_id::text, '') || '|' ||
    to_char(new.recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
    coalesce(new.recorded_by::text, ''),
    'sha256'), 'hex');
  return new;
end $$;

create trigger introductions_chain before insert on public.introductions
  for each row execute function private.introductions_chain();

-- Allow deletion only inside the demo wipe, and only of demo rows.
create or replace function private.introductions_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.is_demo and current_setting('app.wiping_demo', true) = 'on' then
    return old;
  end if;
  raise exception 'introductions ledger is append-only; record a correction instead' using errcode = '42501';
end $$;

create trigger introductions_immutable before update or delete on public.introductions
  for each row execute function private.introductions_guard();

-- Verify the chain. Returns the first broken seq (null if intact) and the head hash.
create or replace function public.verify_introductions_chain(p_demo boolean default false)
returns table (ok boolean, rows_checked bigint, first_broken_seq bigint, head_hash text)
language plpgsql stable security invoker set search_path = '' as $$
declare
  r record;
  prev text := null;
  expected text;
  n bigint := 0;
begin
  for r in select * from public.introductions i where i.is_demo = p_demo order by i.seq loop
    n := n + 1;
    expected := encode(extensions.digest(
      coalesce(prev, 'GENESIS') || '|' ||
      r.id::text || '|' || r.introduced_on::text || '|' ||
      coalesce(r.deal_id::text, '') || '|' ||
      r.party_a_org_id::text || '|' || coalesce(r.party_a_contact_id::text, '') || '|' ||
      r.party_b_org_id::text || '|' || coalesce(r.party_b_contact_id::text, '') || '|' ||
      r.channel || '|' || r.summary || '|' ||
      coalesce(r.evidence_document_id::text, '') || '|' ||
      coalesce(r.corrects_id::text, '') || '|' ||
      to_char(r.recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
      coalesce(r.recorded_by::text, ''),
      'sha256'), 'hex');
    if r.prev_hash is distinct from prev or r.row_hash <> expected then
      return query select false, n, r.seq, prev;
      return;
    end if;
    prev := r.row_hash;
  end loop;
  return query select true, n, null::bigint, prev;
end $$;

-- ---------------------------------------------------------------------------
-- Deal triggers: stage history, last activity, activity feed
-- ---------------------------------------------------------------------------
create or replace function private.deals_track()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  stage_label text;
begin
  if tg_op = 'INSERT' then
    insert into public.deal_stage_history (deal_id, from_stage, to_stage, changed_at, changed_by, is_demo)
    values (new.id, null, new.stage, private.event_time(), auth.uid(), new.is_demo);
    perform private.emit_activity('created', 'created deal ' || new.name, 'deal', new.id,
                                  'deal', new.id, '{}', new.is_demo);
  elsif new.stage is distinct from old.stage then
    insert into public.deal_stage_history (deal_id, from_stage, to_stage, changed_at, changed_by, is_demo)
    values (new.id, old.stage, new.stage, private.event_time(), auth.uid(), new.is_demo);
    select s.label into stage_label from public.pipeline_stages s where s.key = new.stage;
    perform private.emit_activity('moved', 'moved ' || new.name || ' to ' || stage_label, 'deal', new.id,
                                  'deal', new.id, '{}', new.is_demo);
  end if;
  return null;
end $$;

create or replace function private.deals_touch()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage or new.next_step is distinct from old.next_step then
    new.last_activity_at := private.event_time();
  end if;
  return new;
end $$;

create trigger deals_touch before insert or update on public.deals
  for each row execute function private.deals_touch();
create trigger deals_track after insert or update on public.deals
  for each row execute function private.deals_track();

create or replace function private.introductions_track()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  a text; b text;
begin
  select name into a from public.organizations where id = new.party_a_org_id;
  select name into b from public.organizations where id = new.party_b_org_id;
  if new.deal_id is not null then
    update public.deals set last_activity_at = private.event_time() where id = new.deal_id;
  end if;
  update public.organizations set last_contact_at = greatest(coalesce(last_contact_at, 'epoch'), new.introduced_on::timestamptz)
  where id in (new.party_a_org_id, new.party_b_org_id);
  perform private.emit_activity('logged', 'logged an introduction: ' || a || ' ↔ ' || b, 'introduction', new.id,
                                case when new.deal_id is null then 'management' else 'deal' end::public.activity_scope,
                                new.deal_id, '{}', new.is_demo);
  return null;
end $$;

create trigger introductions_track after insert on public.introductions
  for each row execute function private.introductions_track();

create or replace function private.organizations_track()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.emit_activity('created', 'added ' || new.name || ' to partners', 'organization', new.id,
                                'management', null, '{}', new.is_demo);
  return null;
end $$;

create trigger organizations_track after insert on public.organizations
  for each row execute function private.organizations_track();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.currencies enable row level security;
alter table public.countries enable row level security;
alter table public.fx_rates enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.organizations enable row level security;
alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.deal_members enable row level security;
alter table public.deal_parties enable row level security;
alter table public.deal_stage_history enable row level security;
alter table public.introductions enable row level security;

create policy ref_read on public.currencies for select to authenticated using (private.is_internal());
create policy ref_read on public.countries for select to authenticated using (private.is_internal());
create policy ref_read on public.pipeline_stages for select to authenticated using (private.is_internal());
create policy stages_write on public.pipeline_stages for all to authenticated
  using (private.is_principal()) with check (private.is_principal());

create policy fx_read on public.fx_rates for select to authenticated using (private.is_internal());
create policy fx_insert on public.fx_rates for insert to authenticated with check (private.is_manager_plus());
create policy fx_update on public.fx_rates for update to authenticated
  using (private.is_manager_plus()) with check (private.is_manager_plus());

create policy org_read on public.organizations for select to authenticated using (private.can_see_org(id));
create policy org_insert on public.organizations for insert to authenticated with check (private.is_manager_plus());
create policy org_update on public.organizations for update to authenticated
  using (private.is_manager_plus()) with check (private.is_manager_plus());

create policy contact_read on public.contacts for select to authenticated
  using (private.is_manager_plus() or (organization_id is not null and private.can_see_org(organization_id)));
create policy contact_insert on public.contacts for insert to authenticated with check (private.is_manager_plus());
create policy contact_update on public.contacts for update to authenticated
  using (private.is_manager_plus()) with check (private.is_manager_plus());

create policy deal_read on public.deals for select to authenticated using (private.can_see_deal(id));
create policy deal_insert on public.deals for insert to authenticated with check (private.is_manager_plus());
create policy deal_update on public.deals for update to authenticated
  using (private.can_see_deal(id)) with check (private.can_see_deal(id));

create policy deal_members_read on public.deal_members for select to authenticated
  using (private.can_see_deal(deal_id));
create policy deal_members_write on public.deal_members for insert to authenticated
  with check (private.is_manager_plus());

create policy deal_parties_read on public.deal_parties for select to authenticated
  using (private.can_see_deal(deal_id));
create policy deal_parties_insert on public.deal_parties for insert to authenticated
  with check (private.can_see_deal(deal_id));

create policy stage_history_read on public.deal_stage_history for select to authenticated
  using (private.can_see_deal(deal_id));

create policy intro_read on public.introductions for select to authenticated
  using (private.is_manager_plus() or (deal_id is not null and private.can_see_deal(deal_id)));
create policy intro_insert on public.introductions for insert to authenticated
  with check (private.is_manager_plus());

create policy activity_read on public.activity_events for select to authenticated using (
  private.is_principal()
  or (private.is_manager_plus() and scope <> 'principal')
  or (private.is_internal() and (
        scope = 'internal'
        or (deal_id is not null and scope = 'deal' and private.can_see_deal(deal_id))
        or auth.uid() = any (user_ids))));

-- Audit triggers
create trigger fx_rates_audit after insert or update or delete on public.fx_rates for each row execute function private.audit_row();
create trigger pipeline_stages_audit after insert or update or delete on public.pipeline_stages for each row execute function private.audit_row();
create trigger organizations_audit after insert or update or delete on public.organizations for each row execute function private.audit_row();
create trigger contacts_audit after insert or update or delete on public.contacts for each row execute function private.audit_row();
create trigger deals_audit after insert or update or delete on public.deals for each row execute function private.audit_row();
create trigger deal_members_audit after insert or update or delete on public.deal_members for each row execute function private.audit_row();
create trigger deal_parties_audit after insert or update or delete on public.deal_parties for each row execute function private.audit_row();
create trigger introductions_audit after insert on public.introductions for each row execute function private.audit_row();

create trigger organizations_updated_at before update on public.organizations for each row execute function private.set_updated_at();
create trigger contacts_updated_at before update on public.contacts for each row execute function private.set_updated_at();
create trigger deals_updated_at before update on public.deals for each row execute function private.set_updated_at();

grant execute on all functions in schema private to authenticated, service_role;
