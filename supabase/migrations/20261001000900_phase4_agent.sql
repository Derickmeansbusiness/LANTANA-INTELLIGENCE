-- Phase 4: Ask Lantana.
--   * agent threads, messages, proposed actions, token usage
--   * one AI briefing per user per Dubai day
--   * clause reviews (contract vs Lantana template)
--   * nightly scan (overdue tasks, stale deals, unpaid invoices) and Monday digest
-- Everything the agent reads or writes goes through the user's own JWT, so
-- these tables only need to hold the conversation and the audit trail.

-- ---------------------------------------------------------------------------
-- Threads and messages: private to their owner. Not audited row by row (they
-- are a chat log, not business records); the actions they propose are.
-- ---------------------------------------------------------------------------
create table public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id),
  title text not null default 'New conversation' check (length(title) between 1 and 200),
  entity_type text check (entity_type in ('deal', 'organization', 'contact', 'task', 'contract', 'document', 'project')),
  entity_id uuid,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((entity_type is null) = (entity_id is null))
);
create index agent_threads_user_idx on public.agent_threads (user_id, updated_at desc);
create trigger agent_threads_updated_at before update on public.agent_threads
  for each row execute function private.set_updated_at();

create table public.agent_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.agent_threads (id),
  role text not null check (role in ('user', 'assistant')),
  -- Exactly what was sent to / received from the Messages API, replayed
  -- unchanged on the next turn (thinking blocks included).
  content jsonb not null check (jsonb_typeof(content) = 'array'),
  model text,
  created_at timestamptz not null default now()
);
create index agent_messages_thread_idx on public.agent_messages (thread_id, id);

alter table public.agent_threads enable row level security;
alter table public.agent_messages enable row level security;
create policy thread_read on public.agent_threads for select to authenticated using (user_id = auth.uid());
create policy thread_insert on public.agent_threads for insert to authenticated
  with check (user_id = auth.uid() and private.is_internal());
create policy thread_update on public.agent_threads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function private.owns_thread(p_thread uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.agent_threads t where t.id = p_thread and t.user_id = auth.uid())
$$;
create policy msg_read on public.agent_messages for select to authenticated using (private.owns_thread(thread_id));
create policy msg_insert on public.agent_messages for insert to authenticated with check (private.owns_thread(thread_id));

-- Touch the thread so the list sorts by last activity.
create or replace function private.agent_messages_touch()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.agent_threads set updated_at = now() where id = new.thread_id;
  return null;
end $$;
create trigger agent_messages_touch after insert on public.agent_messages
  for each row execute function private.agent_messages_touch();

-- ---------------------------------------------------------------------------
-- Proposed actions. A write tool never executes: it inserts a row here and the
-- UI shows a confirmation card. Confirming runs the change through the domain
-- layer under the user's JWT at that moment, so permissions are re-checked.
-- ---------------------------------------------------------------------------
create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.agent_threads (id),
  user_id uuid not null default auth.uid() references public.profiles (id),
  tool_use_id text,
  tool text not null,
  summary text not null check (length(summary) between 1 and 500),
  payload jsonb not null,
  preview jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed', 'executed', 'rejected', 'failed', 'expired')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  executed_at timestamptz
);
create index agent_actions_user_idx on public.agent_actions (user_id, created_at desc);
create index agent_actions_thread_idx on public.agent_actions (thread_id);

alter table public.agent_actions enable row level security;
create policy action_read on public.agent_actions for select to authenticated
  using (user_id = auth.uid() or private.is_principal());
create policy action_insert on public.agent_actions for insert to authenticated
  with check (user_id = auth.uid() and status = 'proposed' and private.is_internal());
create policy action_update on public.agent_actions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A proposal is decided once: proposed -> executed | rejected | failed | expired.
-- What it proposes can't be edited after the fact.
create or replace function private.agent_actions_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'proposed' then
    raise exception 'this action was already %', old.status using errcode = '42501';
  end if;
  if new.tool <> old.tool or new.payload <> old.payload or new.preview <> old.preview or new.summary <> old.summary
     or new.user_id <> old.user_id or new.thread_id is distinct from old.thread_id
     or new.tool_use_id is distinct from old.tool_use_id then
    raise exception 'a proposed action can only be decided, not edited' using errcode = '42501';
  end if;
  new.decided_at := now();
  if new.status = 'executed' then
    new.executed_at := now();
  end if;
  return new;
end $$;
create trigger agent_actions_guard before update on public.agent_actions
  for each row execute function private.agent_actions_guard();
create trigger agent_actions_audit after insert or update on public.agent_actions
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Token usage, per call. Everyone sees their own; principals see everyone's.
-- ---------------------------------------------------------------------------
create table public.agent_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id),
  thread_id uuid references public.agent_threads (id),
  kind text not null check (kind in ('chat', 'briefing', 'clause_review', 'ocr')),
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  created_at timestamptz not null default now()
);
create index agent_usage_user_idx on public.agent_usage (user_id, created_at desc);
alter table public.agent_usage enable row level security;
create policy usage_read on public.agent_usage for select to authenticated
  using (user_id = auth.uid() or private.is_principal());
create policy usage_insert on public.agent_usage for insert to authenticated
  with check (user_id = auth.uid());

-- Usage for the current Dubai month, per person, only rows the caller may see.
create or replace view public.agent_usage_month with (security_invoker = true) as
select u.user_id, p.full_name, u.kind,
       count(*)::int as calls,
       sum(u.input_tokens)::bigint as input_tokens,
       sum(u.output_tokens)::bigint as output_tokens,
       sum(u.cache_read_tokens)::bigint as cache_read_tokens,
       sum(u.cache_write_tokens)::bigint as cache_write_tokens
from public.agent_usage u
join public.profiles p on p.id = u.user_id
where u.created_at >= (date_trunc('month', private.today_dubai()::timestamp) at time zone 'Asia/Dubai')
group by u.user_id, p.full_name, u.kind;

-- ---------------------------------------------------------------------------
-- Daily briefing: generated on first visit each Dubai day under the reader's
-- own JWT (so it only ever contains what they may see), then cached.
-- ---------------------------------------------------------------------------
create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id),
  briefing_date date not null default private.today_dubai(),
  content text not null,
  facts jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz not null default now(),
  unique (user_id, briefing_date)
);
alter table public.briefings enable row level security;
create policy briefing_read on public.briefings for select to authenticated using (user_id = auth.uid());
create policy briefing_insert on public.briefings for insert to authenticated with check (user_id = auth.uid());
create policy briefing_update on public.briefings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Clause reviews: a counterparty's draft compared with Lantana's template.
-- ---------------------------------------------------------------------------
create table public.clause_reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id),
  document_id uuid references public.documents (id),
  version_id uuid references public.document_versions (id),
  template_id text not null,
  summary text not null,
  findings jsonb not null default '[]'::jsonb check (jsonb_typeof(findings) = 'array'),
  model text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);
create index clause_reviews_contract_idx on public.clause_reviews (contract_id, created_at desc);
alter table public.clause_reviews enable row level security;
create policy review_read on public.clause_reviews for select to authenticated using (private.is_manager_plus());
create policy review_insert on public.clause_reviews for insert to authenticated with check (private.is_manager_plus());
create trigger clause_reviews_audit after insert or update or delete on public.clause_reviews
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Nightly scan, 06:45 Dubai. One notification per item per state, deduped
-- through alerts_sent (threshold 0 = "not a countdown").
-- ---------------------------------------------------------------------------
create or replace function private.run_nightly_scan(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, private.today_dubai());
  item record;
  sent integer := 0;
  n integer;
begin
  for item in
    -- Overdue tasks, to the assignee (or the creator if unassigned).
    select 'task_overdue' as kind, 'task' as etype, t.id, t.due_date as target, t.is_demo,
           coalesce(t.assignee_id, t.created_by) as recipient,
           'Overdue: ' || t.title as title,
           'Was due ' || to_char(t.due_date, 'DD Mon YYYY') || '.' as body,
           false as managers
    from public.tasks t
    where t.deleted_at is null and t.status not in ('done', 'cancelled') and t.due_date < today
    union all
    -- Deals with no activity for 14 days, to the owner. Re-alerts if activity resumes and stops again.
    select 'deal_stale', 'deal', d.id, (d.last_activity_at at time zone 'Asia/Dubai')::date, d.is_demo,
           d.owner_id,
           'No movement on ' || d.name,
           'Last activity ' || (today - (d.last_activity_at at time zone 'Asia/Dubai')::date) || ' days ago.',
           false
    from public.deals d
    join public.pipeline_stages s on s.key = d.stage
    where d.deleted_at is null and not s.is_terminal
      and (d.last_activity_at at time zone 'Asia/Dubai')::date <= today - 14
    union all
    -- Sent invoices past due, to managers and principals.
    select 'invoice_overdue', 'invoice', i.id, i.due_date, i.is_demo, null::uuid,
           'Unpaid invoice ' || i.invoice_no,
           'Due ' || to_char(i.due_date, 'DD Mon YYYY') || ', ' || (today - i.due_date) || ' days ago.',
           true
    from public.invoices i
    where i.deleted_at is null and i.status = 'sent' and i.due_date < today
  loop
    continue when item.recipient is null and not item.managers;
    insert into public.alerts_sent (kind, entity_type, entity_id, threshold_days, target_date)
    values (item.kind, item.etype, item.id, 0, item.target)
    on conflict do nothing;
    get diagnostics n = row_count;
    continue when n = 0;
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, is_demo)
    select p.id, item.kind, item.title, item.body, item.etype, item.id, item.is_demo
    from public.profiles p
    where p.is_active
      and ((item.managers and p.role in ('principal', 'manager')) or (not item.managers and p.id = item.recipient));
    sent := sent + 1;
  end loop;
  return sent;
end $$;

-- ---------------------------------------------------------------------------
-- Monday digest, 07:00 Dubai: one notification per active person, counting
-- only what their role lets them see.
-- ---------------------------------------------------------------------------
create or replace function private.run_weekly_digest(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, private.today_dubai());
  monday date := today - ((extract(isodow from today)::int) - 1);
  p record;
  due_week integer;
  overdue integer;
  stale integer;
  key_dates integer;
  body text;
  sent integer := 0;
  n integer;
begin
  for p in select id, role from public.profiles where is_active and role in ('principal', 'manager', 'staff') loop
    select count(*) filter (where t.due_date between today and monday + 6),
           count(*) filter (where t.due_date < today)
      into due_week, overdue
    from public.tasks t
    where t.deleted_at is null and t.status not in ('done', 'cancelled') and t.assignee_id = p.id;

    select count(*) into stale
    from public.deals d join public.pipeline_stages s on s.key = d.stage
    where d.deleted_at is null and not s.is_terminal and d.owner_id = p.id
      and d.last_activity_at < now() - interval '14 days';

    key_dates := 0;
    if p.role in ('principal', 'manager') then
      select count(*) into key_dates
      from public.contracts c
      where c.deleted_at is null and c.status = 'active' and c.end_date is not null
        and (c.end_date between today and today + 30
             or (c.renewal_type = 'auto_renew' and c.notice_period_days is not null
                 and c.end_date - c.notice_period_days between today and today + 30));
    end if;

    body := due_week || ' task' || case when due_week = 1 then '' else 's' end || ' due this week, '
         || overdue || ' overdue, ' || stale || ' stale deal' || case when stale = 1 then '' else 's' end
         || case when p.role in ('principal', 'manager') then ', ' || key_dates || ' contract date' || case when key_dates = 1 then '' else 's' end || ' in the next 30 days' else '' end
         || '.';

    insert into public.alerts_sent (kind, entity_type, entity_id, threshold_days, target_date)
    values ('weekly_digest', 'profile', p.id, 0, monday)
    on conflict do nothing;
    get diagnostics n = row_count;
    continue when n = 0;
    insert into public.notifications (user_id, kind, title, body)
    values (p.id, 'weekly_digest', 'Your week', body);
    sent := sent + 1;
  end loop;
  return sent;
end $$;

-- Manual trigger from Settings, managers and principals only.
create or replace function public.run_nightly_scan_now()
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_manager_plus() then
    raise exception 'managers and principals only' using errcode = '42501';
  end if;
  return private.run_nightly_scan();
end $$;

-- 02:45 UTC = 06:45 Dubai; Mondays 03:00 UTC = 07:00 Dubai.
select cron.schedule('lantana-nightly-scan', '45 2 * * *', 'select private.run_nightly_scan()');
select cron.schedule('lantana-weekly-digest', '0 3 * * 1', 'select private.run_weekly_digest()');

-- ---------------------------------------------------------------------------
-- Demo wipe: agent rows hang off demo records only through threads and
-- reviews; clear those that point at demo data.
-- ---------------------------------------------------------------------------
create or replace function private.wipe_demo_agent_rows()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.clause_reviews where is_demo or contract_id in (select id from public.contracts where is_demo);
  delete from public.alerts_sent where entity_id in (select id from public.tasks where is_demo)
                                    or entity_id in (select id from public.deals where is_demo)
                                    or entity_id in (select id from public.invoices where is_demo);
end $$;

-- Hook it into the existing wipe without rewriting it: run first when the
-- wipe flag is set on the contracts delete.
create or replace function private.before_demo_contract_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.wiping_demo', true) = 'on' then
    perform private.wipe_demo_agent_rows();
  end if;
  return null;
end $$;
create trigger contracts_demo_wipe_agent before delete on public.contracts
  for each statement execute function private.before_demo_contract_delete();

-- ---------------------------------------------------------------------------
-- Grants. Keep anon out of everything new; re-grant the share window.
-- ---------------------------------------------------------------------------
revoke all on public.agent_threads, public.agent_messages, public.agent_actions, public.agent_usage,
              public.agent_usage_month, public.briefings, public.clause_reviews from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.open_share_link(text, text, text) to anon;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
grant execute on function private.share_object_open(text) to anon;
revoke execute on function private.pii_key() from authenticated;
revoke execute on function private.run_expiry_alerts(date) from authenticated;
revoke execute on function private.run_nightly_scan(date) from authenticated;
revoke execute on function private.run_weekly_digest(date) from authenticated;
revoke execute on function private.wipe_demo_agent_rows() from authenticated;
