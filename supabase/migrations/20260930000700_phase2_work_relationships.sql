-- Phase 2: deals, partners and tasks become editable.
--   * expected close dates for the weighted forecast
--   * milestones, checklists, comments, task dependencies, recurring tasks
--   * interactions (relationship timeline) and notes
--   * move_deal_stage() with a note on the history row
--   * match_investors(): explainable investor ranking for a deal
--   * archive guard: only managers+ (or a task's creator) may soft-delete
--
-- Join tables (deal_members, deal_parties, task_dependencies, checklist
-- items) get DELETE policies: removing a link is not deleting a record, and
-- the audit trigger still records the before-image.

alter table public.deals add column expected_close_date date;

-- ---------------------------------------------------------------------------
-- Milestones
-- ---------------------------------------------------------------------------
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  name text not null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done')),
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);
create index milestones_project_idx on public.milestones (project_id);

alter table public.tasks add column milestone_id uuid references public.milestones (id);
alter table public.tasks add column recurrence_parent_id uuid references public.tasks (id);
create unique index tasks_one_recurrence_child on public.tasks (recurrence_parent_id) where recurrence_parent_id is not null;
alter table public.tasks add constraint tasks_recurrence_rule_format
  check (recurrence_rule is null or recurrence_rule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;INTERVAL=[1-9][0-9]?)?$');

-- ---------------------------------------------------------------------------
-- Task detail
-- ---------------------------------------------------------------------------
create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id),
  label text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id)
);
create index task_checklist_task_idx on public.task_checklist_items (task_id);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id),
  body text not null check (length(body) between 1 and 5000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);

create table public.task_dependencies (
  task_id uuid not null references public.tasks (id),
  depends_on_id uuid not null references public.tasks (id),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  primary key (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);

-- ---------------------------------------------------------------------------
-- Relationship timeline and notes
-- ---------------------------------------------------------------------------
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  contact_id uuid references public.contacts (id),
  deal_id uuid references public.deals (id),
  kind text not null check (kind in ('call', 'meeting', 'email', 'whatsapp', 'visit', 'other')),
  occurred_on date not null,
  summary text not null check (length(summary) between 1 and 5000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz,
  check (organization_id is not null or deal_id is not null)
);
create index interactions_org_idx on public.interactions (organization_id, occurred_on desc);
create index interactions_deal_idx on public.interactions (deal_id, occurred_on desc);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('deal', 'organization', 'project')),
  entity_id uuid not null,
  body text not null check (length(body) between 1 and 10000),
  pinned boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);
create index notes_entity_idx on public.notes (entity_type, entity_id, created_at desc);

create or replace function private.can_see_entity(p_type text, p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'deal' then private.can_see_deal(p_id)
    when 'organization' then private.can_see_org(p_id)
    when 'project' then private.is_manager_plus()
      or exists (select 1 from public.projects p
                 where p.id = p_id
                   and (p.owner_id = auth.uid()
                        or (p.deal_id is not null and private.can_see_deal(p.deal_id))
                        or exists (select 1 from public.tasks t where t.project_id = p.id and t.assignee_id = auth.uid())))
    else false end
$$;

-- ---------------------------------------------------------------------------
-- Archive guard
-- ---------------------------------------------------------------------------
create or replace function private.guard_archive()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.deleted_at is distinct from old.deleted_at
     and auth.uid() is not null
     and not private.is_manager_plus()
     and not (tg_table_name in ('tasks', 'task_comments', 'notes', 'interactions') and old.created_by = auth.uid()) then
    raise exception 'only a manager or principal can archive this %', tg_table_name using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['deals', 'organizations', 'contacts', 'projects', 'tasks', 'milestones',
                           'task_comments', 'interactions', 'notes'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.guard_archive()', t || '_guard_archive', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Stage moves with a note
-- ---------------------------------------------------------------------------
create or replace function private.deals_track()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  stage_label text;
  note text := nullif(current_setting('app.stage_note', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.deal_stage_history (deal_id, from_stage, to_stage, changed_at, changed_by, note, is_demo)
    values (new.id, null, new.stage, private.event_time(), auth.uid(), note, new.is_demo);
    perform private.emit_activity('created', 'created deal ' || new.name, 'deal', new.id,
                                  'deal', new.id, '{}', new.is_demo);
  elsif new.stage is distinct from old.stage then
    insert into public.deal_stage_history (deal_id, from_stage, to_stage, changed_at, changed_by, note, is_demo)
    values (new.id, old.stage, new.stage, private.event_time(), auth.uid(), note, new.is_demo);
    select s.label into stage_label from public.pipeline_stages s where s.key = new.stage;
    perform private.emit_activity('moved', 'moved ' || new.name || ' to ' || stage_label, 'deal', new.id,
                                  'deal', new.id, '{}', new.is_demo);
  elsif new.deleted_at is distinct from old.deleted_at then
    perform private.emit_activity(case when new.deleted_at is null then 'restored' else 'archived' end,
                                  case when new.deleted_at is null then 'restored deal ' else 'archived deal ' end || new.name,
                                  'deal', new.id, 'deal', new.id, '{}', new.is_demo);
  end if;
  return null;
end $$;

-- Invoker: the UPDATE runs under the caller's RLS. Won/lost pin probability.
create or replace function public.move_deal_stage(p_deal uuid, p_stage text, p_note text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  st public.pipeline_stages;
  n integer;
begin
  select * into st from public.pipeline_stages where key = p_stage;
  if not found then
    raise exception 'unknown stage %', p_stage using errcode = '22023';
  end if;
  if st.is_terminal and coalesce(trim(p_note), '') = '' then
    raise exception 'closing a deal needs a note (why it was won or lost)' using errcode = '22023';
  end if;
  perform set_config('app.stage_note', coalesce(trim(p_note), ''), true);
  update public.deals
     set stage = p_stage,
         probability = case when st.is_won then 100 when st.is_terminal then 0 else probability end
   where id = p_deal and deleted_at is null and stage is distinct from p_stage;
  get diagnostics n = row_count;
  perform set_config('app.stage_note', '', true);
  if n = 0 and not exists (select 1 from public.deals where id = p_deal and stage = p_stage) then
    raise exception 'deal not found or you do not have access' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Investor matcher. Invoker: ranks only investors the caller can see.
-- Scores are additive and returned with reasons so nobody has to trust a
-- black box: sector 40, geography 30, ticket 30.
-- ---------------------------------------------------------------------------
create or replace function public.match_investors(p_deal uuid, p_limit integer default 10)
returns table (
  organization_id uuid, name text, country text, score integer,
  sector_points integer, geo_points integer, ticket_points integer,
  reasons text[], already_involved boolean)
language sql stable security invoker set search_path = '' as $$
  with d as (
    select dl.*, c.region as region,
           private.convert_major(dl.ticket_minor, dl.currency, 'USD', private.today_dubai()) as ticket_usd
    from public.deals dl left join public.countries c on c.code = dl.country
    where dl.id = p_deal and dl.deleted_at is null),
  cand as (
    select o.*, c.name as country_name,
           private.convert_major(o.ticket_min_minor, coalesce(o.ticket_currency, 'USD'), 'USD', private.today_dubai()) as min_usd,
           private.convert_major(o.ticket_max_minor, coalesce(o.ticket_currency, 'USD'), 'USD', private.today_dubai()) as max_usd
    from public.organizations o left join public.countries c on c.code = o.country
    where o.type = 'investor' and o.deleted_at is null),
  scored as (
    select cand.id, cand.name, cand.country_name,
      case when d.sector = any (cand.sectors) then 40 when cardinality(cand.sectors) = 0 then 15 else 0 end as sp,
      case when cand.country is not null and cand.country = d.country then 30
           when d.region = any (cand.regions_of_interest) then 25
           when cand.country is null and cardinality(cand.regions_of_interest) = 0 then 10
           else 0 end as gp,
      case when d.ticket_usd is null or (cand.min_usd is null and cand.max_usd is null) then 10
           when d.ticket_usd between coalesce(cand.min_usd, 0) and coalesce(cand.max_usd, 'infinity'::numeric) then 30
           when d.ticket_usd between coalesce(cand.min_usd, 0) * 0.5 and coalesce(cand.max_usd, 'infinity'::numeric) * 1.5 then 15
           else 0 end as tp,
      d.sector::text as sector, d.ticket_usd, cand.min_usd, cand.max_usd, d.region, cand.regions_of_interest, cand.country as ocountry, d.country as dcountry,
      exists (select 1 from public.deal_parties dp where dp.deal_id = d.id and dp.organization_id = cand.id) as involved
    from cand, d)
  select s.id, s.name, s.country_name, (s.sp + s.gp + s.tp)::int, s.sp, s.gp, s.tp,
    array_remove(array[
      case when s.sp = 40 then 'Invests in ' || replace(s.sector, '_', ' ')
           when s.sp = 15 then 'Generalist (no sector focus recorded)'
           else 'No stated interest in ' || replace(s.sector, '_', ' ') end,
      case when s.gp = 30 then 'Based in the deal country'
           when s.gp = 25 then 'Invests across ' || case s.region when 'gcc' then 'the GCC' else initcap(coalesce(s.region, '')) end
           when s.gp = 10 then 'No geographic focus recorded'
           else 'Outside its stated geography' end,
      case when s.tp = 30 then 'Ticket fits its range'
           when s.tp = 15 then 'Ticket near the edge of its range'
           when s.tp = 10 then 'Ticket range unknown'
           else 'Ticket outside its range' end], null),
    s.involved
  from scored s
  order by (s.sp + s.gp + s.tp) desc, s.name
  limit greatest(1, least(coalesce(p_limit, 10), 50))
$$;

-- ---------------------------------------------------------------------------
-- Recurring tasks: completing one creates the next occurrence (once).
-- Invoker, so the new row passes the same insert policy as a manual create.
-- ---------------------------------------------------------------------------
create or replace function private.tasks_recur()
returns trigger language plpgsql set search_path = '' as $$
declare
  freq text;
  step integer;
  base date;
  next_due date;
begin
  if new.recurrence_rule is null or new.status <> 'done' or old.status = 'done' then
    return null;
  end if;
  if exists (select 1 from public.tasks where recurrence_parent_id = new.id) then
    return null;
  end if;
  freq := substring(new.recurrence_rule from 'FREQ=([A-Z]+)');
  step := coalesce(substring(new.recurrence_rule from 'INTERVAL=([0-9]+)')::int, 1);
  base := coalesce(new.due_date, private.today_dubai());
  next_due := case freq
    when 'DAILY' then base + step
    when 'WEEKLY' then base + 7 * step
    when 'MONTHLY' then (base + make_interval(months => step))::date
    when 'YEARLY' then (base + make_interval(years => step))::date
  end;
  insert into public.tasks (title, description, priority, due_date, assignee_id, project_id, deal_id,
                            organization_id, contract_id, milestone_id, source, recurrence_rule,
                            recurrence_parent_id, is_demo)
  values (new.title, new.description, new.priority, next_due, new.assignee_id, new.project_id, new.deal_id,
          new.organization_id, new.contract_id, null, 'recurring', new.recurrence_rule, new.id, new.is_demo);
  return null;
end $$;

create trigger tasks_recur after update on public.tasks for each row execute function private.tasks_recur();

-- ---------------------------------------------------------------------------
-- Activity + last-contact bookkeeping
-- ---------------------------------------------------------------------------
create or replace function private.interactions_track()
returns trigger language plpgsql security definer set search_path = '' as $$
declare org_name text;
begin
  if new.organization_id is not null then
    update public.organizations
       set last_contact_at = greatest(coalesce(last_contact_at, 'epoch'), new.occurred_on::timestamptz)
     where id = new.organization_id;
    select name into org_name from public.organizations where id = new.organization_id;
  end if;
  if new.deal_id is not null then
    update public.deals set last_activity_at = greatest(last_activity_at, private.event_time()) where id = new.deal_id;
  end if;
  perform private.emit_activity('logged', 'logged a ' || new.kind || coalesce(' with ' || org_name, ''),
    case when new.deal_id is not null then 'deal' else 'organization' end,
    coalesce(new.deal_id, new.organization_id),
    case when new.deal_id is not null then 'deal' else 'management' end::public.activity_scope,
    new.deal_id, '{}', new.is_demo);
  return null;
end $$;
create trigger interactions_track after insert on public.interactions for each row execute function private.interactions_track();

create or replace function private.notes_track()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.entity_type = 'deal' then
    update public.deals set last_activity_at = greatest(last_activity_at, private.event_time()) where id = new.entity_id;
  end if;
  return null;
end $$;
create trigger notes_track after insert on public.notes for each row execute function private.notes_track();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.milestones enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.interactions enable row level security;
alter table public.notes enable row level security;

create policy milestone_read on public.milestones for select to authenticated
  using (private.can_see_entity('project', project_id));
create policy milestone_insert on public.milestones for insert to authenticated with check (
  private.is_manager_plus() or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy milestone_update on public.milestones for update to authenticated
  using (private.is_manager_plus() or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (private.is_manager_plus() or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

-- Task children follow the parent task's visibility.
create policy checklist_read on public.task_checklist_items for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy checklist_insert on public.task_checklist_items for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id));
create policy checklist_update on public.task_checklist_items for update to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id))
  with check (exists (select 1 from public.tasks t where t.id = task_id));
create policy checklist_delete on public.task_checklist_items for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

create policy comment_read on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy comment_insert on public.task_comments for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id));
create policy comment_update on public.task_comments for update to authenticated
  using (created_by = auth.uid() or private.is_manager_plus())
  with check (created_by = auth.uid() or private.is_manager_plus());

create policy dep_read on public.task_dependencies for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy dep_insert on public.task_dependencies for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id)
              and exists (select 1 from public.tasks t where t.id = depends_on_id));
create policy dep_delete on public.task_dependencies for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

create policy interaction_read on public.interactions for select to authenticated using (
  private.is_manager_plus() or (deal_id is not null and private.can_see_deal(deal_id)));
create policy interaction_insert on public.interactions for insert to authenticated with check (
  private.is_manager_plus() or (deal_id is not null and private.can_see_deal(deal_id)));
create policy interaction_update on public.interactions for update to authenticated
  using (private.is_manager_plus() or created_by = auth.uid())
  with check (private.is_manager_plus() or created_by = auth.uid());

create policy note_read on public.notes for select to authenticated
  using (private.can_see_entity(entity_type, entity_id));
create policy note_insert on public.notes for insert to authenticated
  with check (created_by = auth.uid() and private.can_see_entity(entity_type, entity_id));
create policy note_update on public.notes for update to authenticated
  using (created_by = auth.uid() or private.is_manager_plus())
  with check (created_by = auth.uid() or private.is_manager_plus());

create policy deal_members_delete on public.deal_members for delete to authenticated using (private.is_manager_plus());
create policy deal_parties_delete on public.deal_parties for delete to authenticated using (private.is_manager_plus());
create policy deal_parties_update on public.deal_parties for update to authenticated
  using (private.can_see_deal(deal_id)) with check (private.can_see_deal(deal_id));

-- ---------------------------------------------------------------------------
-- Audit + updated_at
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['milestones', 'task_checklist_items', 'task_comments', 'task_dependencies', 'interactions', 'notes'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
  foreach t in array array['milestones', 'task_checklist_items', 'task_comments', 'interactions', 'notes'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Demo wipe learns about the new tables
-- ---------------------------------------------------------------------------
alter table public.task_dependencies add column is_demo boolean not null default false;

create or replace function public.wipe_demo_data(p_confirm text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  counts jsonb := '{}'::jsonb;
  n bigint;
  t text;
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  if p_confirm is distinct from 'WIPE DEMO DATA' then
    raise exception 'type WIPE DEMO DATA to confirm' using errcode = '22023';
  end if;

  insert into public.audit_log (actor_id, action, table_name, context)
  values (auth.uid(), 'wipe_demo', null, jsonb_build_object('started_at', now()));

  perform set_config('app.wiping_demo', 'on', true);

  delete from public.deal_members where deal_id in (select id from public.deals where is_demo);
  delete from public.document_links where document_id in (select id from public.documents where is_demo);
  update public.documents set current_version_id = null where is_demo;
  update public.tasks set recurrence_parent_id = null where is_demo;

  foreach t in array array[
    'activity_events', 'notifications', 'introductions', 'deal_stage_history', 'deal_parties',
    'notes', 'interactions', 'task_dependencies', 'task_comments', 'task_checklist_items',
    'contract_obligations', 'tasks', 'milestones', 'contract_survival_clauses', 'contracts', 'meetings',
    'invoices', 'transactions', 'bank_accounts', 'accounts', 'compliance_items',
    'document_versions', 'documents', 'folders', 'projects', 'deals', 'contacts',
    'organizations', 'fx_rates'] loop
    execute format('delete from public.%I where is_demo', t);
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object(t, n);
  end loop;

  perform set_config('app.wiping_demo', 'off', true);
  insert into public.audit_log (actor_id, action, table_name, context)
  values (auth.uid(), 'wipe_demo_done', null, counts);
  return counts;
end $$;

-- ---------------------------------------------------------------------------
-- Grants (new functions in public are not executable by anon)
-- ---------------------------------------------------------------------------
revoke all on public.milestones, public.task_checklist_items, public.task_comments,
              public.task_dependencies, public.interactions, public.notes from anon;
revoke execute on function public.move_deal_stage(uuid, text, text), public.match_investors(uuid, integer) from public, anon;
grant execute on function public.move_deal_stage(uuid, text, text), public.match_investors(uuid, integer) to authenticated, service_role;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on function private.pii_key() from authenticated;

-- Saved views are personal preferences, not business records: owners may delete them.
create policy views_delete on public.saved_views for delete to authenticated using (user_id = auth.uid());

-- Chain verification must read every row to recompute hashes, but staff only
-- see rows on their own deals. Run it as definer, and only for managers+
-- (it reveals the company-wide entry count and head hash).
create or replace function public.verify_introductions_chain(p_demo boolean default false)
returns table (ok boolean, rows_checked bigint, first_broken_seq bigint, head_hash text)
language plpgsql stable security definer set search_path = '' as $$
declare
  r record;
  prev text := null;
  expected text;
  n bigint := 0;
begin
  if auth.uid() is not null and not private.is_manager_plus() then
    raise exception 'chain verification is available to managers and principals' using errcode = '42501';
  end if;
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
revoke execute on function public.verify_introductions_chain(boolean) from public, anon;
grant execute on function public.verify_introductions_chain(boolean) to authenticated, service_role;
