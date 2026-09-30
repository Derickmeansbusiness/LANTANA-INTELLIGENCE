-- Read models for the Command Center, global search, demo wipe, PII helpers,
-- realtime publication and final grant hardening.
--
-- Every view is security_invoker and every KPI helper is security invoker
-- (except burn, see below), so a Staff user's Command Center is computed
-- only from rows they can see.

-- ---------------------------------------------------------------------------
-- Attention queue
-- ---------------------------------------------------------------------------
create or replace view public.v_attention_queue with (security_invoker = true) as
with today as (select private.today_dubai() as d)
select 'task_overdue'::text as kind,
       case when t.priority in ('high', 'urgent') or today.d - t.due_date > 7 then 'high' else 'medium' end as severity,
       t.title,
       'Overdue by ' || (today.d - t.due_date) || case when today.d - t.due_date = 1 then ' day' else ' days' end as detail,
       t.due_date, 'task'::text as entity_type, t.id as entity_id, t.deal_id, t.is_demo
from public.tasks t, today
where t.deleted_at is null and t.status not in ('done', 'cancelled') and t.due_date < today.d

union all
select 'contract_expiring',
       case when c.end_date - today.d <= 30 then 'high' else 'medium' end,
       c.title, 'Term ends ' || to_char(c.end_date, 'DD Mon YYYY'),
       c.end_date, 'contract', c.id, null::uuid, c.is_demo
from public.contracts c, today
where c.deleted_at is null and c.status = 'active' and c.renewal_type = 'fixed'
  and c.end_date between today.d and today.d + 60

union all
select 'notice_deadline',
       case when (c.end_date - c.notice_period_days) - today.d <= 14 then 'high' else 'medium' end,
       c.title,
       'Auto-renews ' || to_char(c.end_date, 'DD Mon YYYY') || '. Last day to give notice: '
         || to_char(c.end_date - c.notice_period_days, 'DD Mon YYYY'),
       c.end_date - c.notice_period_days, 'contract', c.id, null::uuid, c.is_demo
from public.contracts c, today
where c.deleted_at is null and c.status = 'active' and c.renewal_type = 'auto_renew'
  and c.notice_period_days is not null
  and c.end_date - c.notice_period_days between today.d and today.d + 60

union all
select 'contract_open_issues', 'high', c.title,
       array_to_string(array_remove(array[
         case when not c.signing_authority_confirmed then 'Counterparty signing authority not confirmed' end,
         case when not c.signatory_confirmed then 'Signatory not confirmed' end,
         case when not c.counterparty_address_confirmed then 'Registered address pending' end], null), ' · '),
       null::date, 'contract', c.id, null::uuid, c.is_demo
from public.contracts c
where c.deleted_at is null and c.status not in ('expired', 'terminated')
  and (not c.signing_authority_confirmed or not c.signatory_confirmed or not c.counterparty_address_confirmed)

union all
select 'survival_ending', 'medium', c.title || ' — ' || s.clause,
       'Survival period ends ' || to_char((c.end_date + make_interval(months => s.survival_months))::date, 'DD Mon YYYY'),
       (c.end_date + make_interval(months => s.survival_months))::date, 'contract', c.id, null::uuid, c.is_demo
from public.contracts c
join public.contract_survival_clauses s on s.contract_id = c.id, today
where c.deleted_at is null and c.status in ('expired', 'terminated') and c.end_date is not null
  and (c.end_date + make_interval(months => s.survival_months))::date between today.d and today.d + 60

union all
select 'compliance_due',
       case when ci.due_date - today.d <= 7 then 'high' else 'medium' end,
       ci.title,
       case when ci.due_date < today.d then 'Overdue since ' else 'Due ' end || to_char(ci.due_date, 'DD Mon YYYY'),
       ci.due_date, 'compliance_item', ci.id, null::uuid, ci.is_demo
from public.compliance_items ci, today
where ci.deleted_at is null and ci.status in ('upcoming', 'in_progress') and ci.due_date <= today.d + 30

union all
select 'compliance_unconfirmed', 'low', ci.title,
       'Confirm whether this applies to Lantana' || coalesce(' (' || ci.authority || ')', ''),
       ci.due_date, 'compliance_item', ci.id, null::uuid, ci.is_demo
from public.compliance_items ci
where ci.deleted_at is null and ci.status = 'unconfirmed'

union all
select 'document_unsigned', 'medium', d.title, 'Awaiting signature',
       null::date, 'document', d.id, null::uuid, d.is_demo
from public.documents d
where d.deleted_at is null and d.status = 'awaiting_signature'

union all
select 'invoice_overdue', 'high', 'Invoice ' || i.invoice_no,
       'Overdue by ' || (today.d - i.due_date) || ' days',
       i.due_date, 'invoice', i.id, i.deal_id, i.is_demo
from public.invoices i, today
where i.deleted_at is null and i.status = 'sent' and i.due_date < today.d

union all
select 'deal_stale', 'medium', d.name,
       'No activity for ' || extract(day from now() - d.last_activity_at)::int || ' days',
       null::date, 'deal', d.id, d.id, d.is_demo
from public.deals d
join public.pipeline_stages s on s.key = d.stage
where d.deleted_at is null and not s.is_terminal and d.last_activity_at < now() - interval '14 days';

-- ---------------------------------------------------------------------------
-- Pipeline & geography
-- ---------------------------------------------------------------------------
create or replace view public.v_pipeline_by_stage with (security_invoker = true) as
select s.key, s.label, s.sort_order, s.is_terminal, s.is_won,
       count(d.id)::int as deal_count,
       coalesce(sum(private.convert_major(d.ticket_minor, d.currency, 'USD', private.today_dubai())), 0) as value_usd,
       coalesce(sum(private.convert_major(d.ticket_minor, d.currency, 'USD', private.today_dubai())
                    * coalesce(d.probability, s.default_probability) / 100.0), 0) as weighted_usd,
       count(d.id) filter (where d.ticket_minor is not null
                           and private.convert_major(d.ticket_minor, d.currency, 'USD', private.today_dubai()) is null)::int as missing_fx
from public.pipeline_stages s
left join public.deals d on d.stage = s.key and d.deleted_at is null
group by s.key, s.label, s.sort_order, s.is_terminal, s.is_won;

create or replace view public.v_deals_by_country with (security_invoker = true) as
select c.code as country, c.name as country_name, c.region,
       count(d.id)::int as deal_count,
       coalesce(sum(private.convert_major(d.ticket_minor, d.currency, 'USD', private.today_dubai())), 0) as value_usd,
       jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'stage', d.stage) order by d.name) as deals
from public.deals d
join public.countries c on c.code = d.country
join public.pipeline_stages s on s.key = d.stage
where d.deleted_at is null and not (s.is_terminal and not s.is_won)
group by c.code, c.name, c.region;

-- ---------------------------------------------------------------------------
-- KPI helpers. Point-in-time values are rebuilt from history (stage history,
-- task completion, dated transactions) rather than from nightly snapshots,
-- so they respect RLS for whoever is asking. Known approximation: ticket
-- size edits are not versioned, so past pipeline value uses today's ticket.
-- ---------------------------------------------------------------------------
create or replace function private.end_of_day(p_day date)
returns timestamptz language sql immutable as $$
  select ((p_day + 1)::timestamp at time zone 'Asia/Dubai')
$$;

create or replace function private.deal_stages_at(p_ts timestamptz)
returns table (deal_id uuid, stage text, ticket_minor bigint, currency char(3))
language sql stable set search_path = '' as $$
  select d.id, h.to_stage, d.ticket_minor, d.currency
  from public.deals d
  join lateral (
    select x.to_stage from public.deal_stage_history x
    where x.deal_id = d.id and x.changed_at < p_ts
    order by x.changed_at desc, x.id desc limit 1) h on true
  where d.deleted_at is null or d.deleted_at >= p_ts
$$;

create or replace function private.kpi_pipeline_usd(p_day date)
returns numeric language sql stable set search_path = '' as $$
  select coalesce(sum(private.convert_major(a.ticket_minor, a.currency, 'USD', p_day)), 0)
  from private.deal_stages_at(private.end_of_day(p_day)) a
  join public.pipeline_stages s on s.key = a.stage
  where not s.is_terminal
$$;

create or replace function private.kpi_advanced_deals(p_day date)
returns integer language sql stable set search_path = '' as $$
  select count(*)::int
  from private.deal_stages_at(private.end_of_day(p_day)) a
  join public.pipeline_stages s on s.key = a.stage
  where s.is_advanced and not s.is_terminal
$$;

-- Capital introduced YTD: ticket of every deal that first reached
-- "Introduced" or later (not counting a jump straight to Closed-lost)
-- during the calendar year of p_day.
create or replace function private.kpi_capital_introduced_ytd(p_day date)
returns numeric language sql stable set search_path = '' as $$
  with intro as (select sort_order from public.pipeline_stages where key = 'introduced'),
  firsts as (
    select h.deal_id, min(h.changed_at) as first_at
    from public.deal_stage_history h
    join public.pipeline_stages s on s.key = h.to_stage, intro
    where s.sort_order >= intro.sort_order and not (s.is_terminal and not s.is_won)
    group by h.deal_id)
  select coalesce(sum(private.convert_major(d.ticket_minor, d.currency, 'USD', p_day)), 0)
  from firsts f
  join public.deals d on d.id = f.deal_id and d.deleted_at is null
  where f.first_at >= (date_trunc('year', p_day)::date)::timestamp at time zone 'Asia/Dubai'
    and f.first_at < private.end_of_day(p_day)
$$;

-- Cash on hand: principal only (bank_accounts RLS returns nothing otherwise).
create or replace function private.kpi_cash_aed(p_day date)
returns numeric language sql stable set search_path = '' as $$
  select sum(
    private.convert_major(b.opening_balance_minor, b.currency, 'AED', p_day)
    + coalesce((select sum(private.convert_major(t.amount_minor, t.currency, 'AED', p_day))
                from public.transactions t
                where t.bank_account_id = b.id and t.deleted_at is null
                  and t.txn_date between b.opening_date and p_day), 0))
  from public.bank_accounts b
  where b.deleted_at is null and b.opening_date <= p_day
$$;

-- Monthly burn (trailing 30 days of outflows, excluding transfers).
-- security definer so managers get the true figure including payroll in
-- aggregate; individual payroll rows stay principal-only.
create or replace function private.kpi_burn_aed(p_day date)
returns numeric language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_manager_plus() then
    return null;
  end if;
  return (select coalesce(sum(-private.convert_major(t.amount_minor, t.currency, 'AED', p_day)), 0)
          from public.transactions t
          where t.deleted_at is null and not t.is_transfer and t.amount_minor < 0
            and t.txn_date > p_day - 30 and t.txn_date <= p_day);
end $$;

create or replace function private.kpi_overdue_tasks(p_day date)
returns integer language sql stable set search_path = '' as $$
  select count(*)::int from public.tasks t
  where t.deleted_at is null and t.status <> 'cancelled'
    and t.due_date < p_day
    and t.created_at < private.end_of_day(p_day)
    and (t.completed_at is null or t.completed_at >= private.end_of_day(p_day))
$$;

create or replace function public.command_center_kpis(p_from date, p_to date, p_points integer default 12)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  n integer := greatest(2, least(coalesce(p_points, 12), 60));
  series jsonb := '[]'::jsonb;
  t date;
  missing text[];
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid date range' using errcode = '22023';
  end if;
  for i in 0 .. n - 1 loop
    t := p_from + ((p_to - p_from) * i / (n - 1));
    series := series || jsonb_build_object(
      'date', t,
      'pipeline_usd', private.kpi_pipeline_usd(t),
      'advanced_deals', private.kpi_advanced_deals(t),
      'capital_introduced_usd', private.kpi_capital_introduced_ytd(t),
      'cash_aed', private.kpi_cash_aed(t),
      'burn_aed', private.kpi_burn_aed(t),
      'overdue_tasks', private.kpi_overdue_tasks(t));
  end loop;

  select array_agg(distinct d.currency::text) into missing
  from public.deals d
  where d.deleted_at is null and d.ticket_minor is not null
    and private.convert_major(d.ticket_minor, d.currency, 'USD', p_to) is null;

  return jsonb_build_object(
    'series', series,
    'role', private.user_role(),
    'can_see_cash', private.is_principal(),
    'can_see_burn', private.is_manager_plus(),
    'missing_fx', coalesce(to_jsonb(missing), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- Global search (Cmd+K). Invoker, so results are RLS-filtered.
-- ---------------------------------------------------------------------------
create or replace function public.search_everything(p_query text, p_limit integer default 20)
returns table (entity_type text, entity_id uuid, title text, subtitle text, rank real)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select trim(p_query) as raw,
           case when trim(p_query) = '' then null
                else websearch_to_tsquery('simple', trim(p_query)) end as ts)
  select * from (
    select 'deal', d.id, d.name, s.label || coalesce(' · ' || c.name, ''),
           ts_rank(d.search, q.ts) + case when d.name ilike '%' || q.raw || '%' then 1 else 0 end
    from public.deals d join public.pipeline_stages s on s.key = d.stage
    left join public.countries c on c.code = d.country, q
    where d.deleted_at is null and (d.search @@ q.ts or d.name ilike '%' || q.raw || '%')
    union all
    select 'organization', o.id, o.name, replace(o.type::text, '_', ' ') || coalesce(' · ' || c.name, ''),
           ts_rank(o.search, q.ts) + case when o.name ilike '%' || q.raw || '%' then 1 else 0 end
    from public.organizations o left join public.countries c on c.code = o.country, q
    where o.deleted_at is null and (o.search @@ q.ts or o.name ilike '%' || q.raw || '%')
    union all
    select 'contact', ct.id, ct.full_name, coalesce(ct.job_title, 'Contact'),
           case when ct.full_name ilike '%' || q.raw || '%' then 1 else 0 end::real
    from public.contacts ct, q
    where ct.deleted_at is null and ct.full_name ilike '%' || q.raw || '%'
    union all
    select 'task', t.id, t.title, 'Task · ' || replace(t.status::text, '_', ' '),
           ts_rank(t.search, q.ts) + case when t.title ilike '%' || q.raw || '%' then 0.5 else 0 end
    from public.tasks t, q
    where t.deleted_at is null and (t.search @@ q.ts or t.title ilike '%' || q.raw || '%')
    union all
    select 'document', dc.id, dc.title, 'Document · ' || dc.doc_type,
           ts_rank(dc.search, q.ts) + case when dc.title ilike '%' || q.raw || '%' then 0.5 else 0 end
    from public.documents dc, q
    where dc.deleted_at is null and (dc.search @@ q.ts or dc.title ilike '%' || q.raw || '%')
    union all
    select 'contract', k.id, k.title, 'Contract · ' || replace(k.contract_type::text, '_', ' '),
           case when k.title ilike '%' || q.raw || '%' then 0.8 else 0 end::real
    from public.contracts k, q
    where k.deleted_at is null and k.title ilike '%' || q.raw || '%'
  ) r(entity_type, entity_id, title, subtitle, rank)
  where (select raw from q) <> ''
  order by rank desc, title
  limit greatest(1, least(coalesce(p_limit, 20), 50))
$$;

-- ---------------------------------------------------------------------------
-- PII encryption (key in Supabase Vault, one per environment)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'pii_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'pii_key',
                                'Symmetric key for pgcrypto column encryption (IBANs, ID numbers, salaries)');
  end if;
end $$;

create or replace function private.pii_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'pii_key'
$$;
revoke execute on function private.pii_key() from public, authenticated;

create or replace function public.set_bank_account_iban(p_id uuid, p_iban text)
returns void language plpgsql security definer set search_path = '' as $$
declare clean text := upper(regexp_replace(coalesce(p_iban, ''), '\s', '', 'g'));
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  if clean !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$' then
    raise exception 'that does not look like an IBAN' using errcode = '22023';
  end if;
  update public.bank_accounts
     set iban_encrypted = extensions.pgp_sym_encrypt(clean, private.pii_key()),
         iban_last4 = right(clean, 4)
   where id = p_id;
end $$;

create or replace function public.reveal_bank_account_iban(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  select extensions.pgp_sym_decrypt(b.iban_encrypted, private.pii_key()) into v
  from public.bank_accounts b where b.id = p_id;
  insert into public.audit_log (actor_id, action, table_name, row_id)
  values (auth.uid(), 'reveal', 'bank_accounts', p_id::text);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Demo data
-- ---------------------------------------------------------------------------
create or replace function public.demo_data_counts()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'deals', (select count(*) from public.deals where is_demo),
    'organizations', (select count(*) from public.organizations where is_demo),
    'tasks', (select count(*) from public.tasks where is_demo),
    'contracts', (select count(*) from public.contracts where is_demo),
    'documents', (select count(*) from public.documents where is_demo),
    'transactions', (select count(*) from public.transactions where is_demo))
$$;

-- The only hard delete in the system. Principal only, typed confirmation,
-- logged before it runs. Fails as a whole if real rows reference demo rows.
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

  foreach t in array array[
    'activity_events', 'notifications', 'introductions', 'deal_stage_history', 'deal_parties',
    'contract_obligations', 'tasks', 'contract_survival_clauses', 'contracts', 'meetings',
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
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.activity_events, public.notifications;

-- ---------------------------------------------------------------------------
-- Grant hardening: anon gets nothing; functions are not executable by PUBLIC.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on function private.pii_key() from authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

-- The audit log stays append-only even for service_role.
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated, service_role;
revoke update, delete, truncate on public.introductions from anon, authenticated, service_role;
