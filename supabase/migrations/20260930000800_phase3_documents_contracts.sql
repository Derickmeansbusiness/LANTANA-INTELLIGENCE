-- Phase 3: documents vault and contracts register.
--   * private storage bucket whose policies mirror document visibility
--   * version bookkeeping (numbering, current version, check-out guard)
--   * text chunks with full-text search and optional gte-small embeddings
--   * tags, share links with view log, public link resolution
--   * contract owner, obligations that become tasks
--   * expiry alerts at 90/60/30/7 days, scheduled daily with pg_cron

create extension if not exists pg_cron;

create or replace function private.try_uuid(p text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Document visibility, shared by table and storage policies
-- ---------------------------------------------------------------------------
-- Staff also see non-restricted documents linked to a deal they're on.
create or replace function private.can_see_document(p_doc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_doc
      and (private.is_manager_plus()
           or (private.is_internal() and d.confidentiality in ('public', 'internal'))
           or (private.is_internal() and d.confidentiality <> 'restricted'
               and exists (select 1 from public.document_links l
                           where l.document_id = d.id and l.entity_type = 'deal' and private.can_see_deal(l.entity_id)))))
$$;

-- Writing a new version: must see it, not be locked by someone else, and be
-- a manager+ or the document's creator.
create or replace function private.can_write_document(p_doc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_see_document(p_doc)
    and exists (
      select 1 from public.documents d
      where d.id = p_doc
        and (d.checked_out_by is null or d.checked_out_by = auth.uid())
        and (private.is_manager_plus() or d.created_by = auth.uid()))
$$;

drop policy doc_read on public.documents;
create policy doc_read on public.documents for select to authenticated using (private.can_see_document(id));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

-- Object path: <document_id>/v<version_no>/<file name>
create policy lantana_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and private.can_see_document(private.try_uuid((storage.foldername(name))[1])));
create policy lantana_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and private.can_write_document(private.try_uuid((storage.foldername(name))[1])));
-- No update/delete policies: stored versions are immutable.

-- ---------------------------------------------------------------------------
-- Versions
-- ---------------------------------------------------------------------------
alter table public.document_versions
  add column extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'done', 'no_text', 'needs_ocr', 'failed', 'unsupported')),
  add column page_count integer,
  add column text_chars integer,
  add column ocr_used boolean not null default false,
  add column embedded boolean not null default false,
  add column note text;

create policy docver_update on public.document_versions for update to authenticated
  using (private.can_write_document(document_id)) with check (private.can_write_document(document_id));

drop policy docver_insert on public.document_versions;
create policy docver_insert on public.document_versions for insert to authenticated
  with check (private.can_write_document(document_id));

create or replace function private.versions_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  locked uuid;
begin
  select checked_out_by into locked from public.documents where id = new.document_id for update;
  if locked is not null and locked is distinct from auth.uid() and auth.uid() is not null then
    raise exception 'this document is checked out by someone else' using errcode = '42501';
  end if;
  select coalesce(max(version_no), 0) + 1 into new.version_no from public.document_versions where document_id = new.document_id;
  return new;
end $$;
create trigger versions_before_insert before insert on public.document_versions
  for each row execute function private.versions_before_insert();

create or replace function private.versions_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  d public.documents;
begin
  update public.documents set current_version_id = new.id where id = new.document_id returning * into d;
  perform private.emit_activity('uploaded',
    case when new.version_no = 1 then 'uploaded ' else 'uploaded version ' || new.version_no || ' of ' end || d.title,
    'document', d.id,
    case when d.confidentiality in ('public', 'internal') then 'internal' else 'management' end::public.activity_scope,
    null, '{}', new.is_demo);
  return null;
end $$;
create trigger versions_after_insert after insert on public.document_versions
  for each row execute function private.versions_after_insert();

-- ---------------------------------------------------------------------------
-- Chunks (derived data: replaced on re-index, so delete is allowed)
-- ---------------------------------------------------------------------------
create table public.document_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents (id),
  version_id uuid not null references public.document_versions (id),
  ordinal integer not null,
  content text not null,
  tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  embedding extensions.vector(384),
  created_at timestamptz not null default now(),
  unique (version_id, ordinal)
);
create index document_chunks_tsv_idx on public.document_chunks using gin (tsv);
create index document_chunks_doc_idx on public.document_chunks (document_id);
create index document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.document_chunks enable row level security;
create policy chunk_read on public.document_chunks for select to authenticated using (private.can_see_document(document_id));
create policy chunk_insert on public.document_chunks for insert to authenticated with check (private.can_write_document(document_id));
create policy chunk_update on public.document_chunks for update to authenticated
  using (private.can_write_document(document_id)) with check (private.can_write_document(document_id));
create policy chunk_delete on public.document_chunks for delete to authenticated using (private.can_write_document(document_id));

-- Hybrid search: full-text rank and (when an embedding is supplied) cosine
-- similarity, fused with reciprocal rank fusion. Only the current version of
-- each visible, non-archived document is searched. Title-only hits cover
-- documents with no extracted text yet.
create or replace function public.search_documents(p_query text, p_embedding extensions.vector(384) default null, p_limit integer default 20)
returns table (document_id uuid, title text, doc_type text, status text, snippet text, score double precision, matched text)
language sql stable security invoker set search_path = '' as $$
  with q as (select websearch_to_tsquery('simple', coalesce(p_query, '')) as ts, trim(coalesce(p_query, '')) as raw),
  live as (
    select c.* from public.document_chunks c
    join public.documents d on d.id = c.document_id and d.deleted_at is null and d.current_version_id = c.version_id),
  fts as (
    select l.id, l.document_id, row_number() over (order by ts_rank_cd(l.tsv, q.ts) desc) as r
    from live l, q where q.raw <> '' and l.tsv @@ q.ts
    limit 60),
  vec as (
    select v.id, v.document_id, row_number() over (order by v.dist) as r
    from (select l.id, l.document_id, l.embedding operator(extensions.<=>) p_embedding as dist
          from live l where p_embedding is not null and l.embedding is not null
          order by 3 limit 60) v),
  fused as (
    select id, document_id, sum(1.0 / (60 + r)) as score, string_agg(distinct src, '+') as src
    from (select id, document_id, r, 'text' as src from fts
          union all select id, document_id, r, 'meaning' from vec) x
    group by id, document_id),
  best as (
    select distinct on (f.document_id) f.document_id, f.id, f.score, f.src
    from fused f order by f.document_id, f.score desc),
  titles as (
    select d.id as document_id, null::bigint as id, 0.004::numeric as score, 'title' as src
    from public.documents d, q
    where d.deleted_at is null and q.raw <> ''
      and (d.search @@ q.ts or d.title ilike '%' || q.raw || '%')
      and not exists (select 1 from best b where b.document_id = d.id)),
  hits as (select * from best union all select * from titles)
  select h.document_id, d.title, d.doc_type, d.status::text,
         case when h.id is null then coalesce(d.description, '')
              else ts_headline('simple', c.content, q.ts, 'MaxWords=32, MinWords=14, MaxFragments=1, StartSel=«, StopSel=»') end,
         h.score::double precision, h.src
  from hits h
  join public.documents d on d.id = h.document_id
  left join public.document_chunks c on c.id = h.id, q
  order by h.score desc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
$$;

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 40),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id)
);
create unique index tags_name_key on public.tags (lower(name));

create table public.document_tags (
  document_id uuid not null references public.documents (id),
  tag_id uuid not null references public.tags (id),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  primary key (document_id, tag_id)
);

alter table public.tags enable row level security;
alter table public.document_tags enable row level security;
create policy tag_read on public.tags for select to authenticated using (private.is_internal());
create policy tag_insert on public.tags for insert to authenticated with check (private.is_internal());
create policy doctag_read on public.document_tags for select to authenticated using (private.can_see_document(document_id));
create policy doctag_insert on public.document_tags for insert to authenticated with check (private.can_write_document(document_id));
create policy doctag_delete on public.document_tags for delete to authenticated using (private.can_write_document(document_id));

create policy doclink_delete on public.document_links for delete to authenticated using (private.can_write_document(document_id));
drop policy doclink_insert on public.document_links;
create policy doclink_insert on public.document_links for insert to authenticated with check (private.can_write_document(document_id));
drop policy doclink_read on public.document_links;
create policy doclink_read on public.document_links for select to authenticated using (private.can_see_document(document_id));
drop policy docver_read on public.document_versions;
create policy docver_read on public.document_versions for select to authenticated using (private.can_see_document(document_id));

-- ---------------------------------------------------------------------------
-- Share links. Only the SHA-256 of the token is stored; the token itself is
-- shown once to the person who creates the link.
-- ---------------------------------------------------------------------------
create table public.document_share_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id),
  version_id uuid not null references public.document_versions (id),
  token_hash text not null unique,
  recipient_name text not null check (length(recipient_name) between 2 and 160),
  recipient_email text,
  expires_at timestamptz not null,
  max_views integer check (max_views is null or max_views between 1 and 1000),
  view_count integer not null default 0,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  check (expires_at > created_at and expires_at <= created_at + interval '31 days')
);
create index share_links_doc_idx on public.document_share_links (document_id);

create table public.document_share_views (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.document_share_links (id),
  viewed_at timestamptz not null default now(),
  outcome text not null check (outcome in ('ok', 'expired', 'revoked', 'limit')),
  ip_hash text,
  user_agent text
);
create index share_views_link_idx on public.document_share_views (link_id, viewed_at desc);

alter table public.document_share_links enable row level security;
alter table public.document_share_views enable row level security;
create policy share_read on public.document_share_links for select to authenticated
  using (private.is_manager_plus() or created_by = auth.uid());
create policy share_insert on public.document_share_links for insert to authenticated with check (
  created_by = auth.uid()
  and private.can_see_document(document_id)
  and exists (select 1 from public.documents d where d.id = document_id
              and (d.confidentiality <> 'restricted' or private.is_principal())));
create policy share_update on public.document_share_links for update to authenticated
  using (private.is_manager_plus() or created_by = auth.uid())
  with check (private.is_manager_plus() or created_by = auth.uid());
create policy share_views_read on public.document_share_views for select to authenticated
  using (exists (select 1 from public.document_share_links l where l.id = link_id));

-- Called by the public /s/<token> page (anon). Validates the link, logs the
-- view whatever the outcome, and returns what the page needs to stream the
-- file. Nothing is returned for unknown tokens.
create or replace function public.open_share_link(p_token text, p_ip_hash text default null, p_user_agent text default null)
returns table (ok boolean, reason text, link_id uuid, document_title text, storage_path text, mime_type text, file_name text,
               recipient_name text, expires_at timestamptz, views_left integer)
language plpgsql volatile security definer set search_path = '' as $$
declare
  l public.document_share_links;
  v public.document_versions;
  t text;
  outcome text;
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 200 then
    return;
  end if;
  select * into l from public.document_share_links
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found then
    return;
  end if;
  outcome := case
    when l.revoked_at is not null then 'revoked'
    when l.expires_at <= now() then 'expired'
    when l.max_views is not null and l.view_count >= l.max_views then 'limit'
    else 'ok' end;
  insert into public.document_share_views (link_id, outcome, ip_hash, user_agent)
  values (l.id, outcome, left(p_ip_hash, 128), left(p_user_agent, 300));
  insert into public.audit_log (actor_id, action, table_name, row_id, context)
  values (null, 'share_view', 'document_share_links', l.id::text, jsonb_build_object('outcome', outcome, 'document_id', l.document_id));
  if outcome <> 'ok' then
    return query select false, outcome, l.id, null::text, null::text, null::text, null::text, l.recipient_name, l.expires_at, 0;
    return;
  end if;
  update public.document_share_links set view_count = view_count + 1 where id = l.id;
  select * into v from public.document_versions where id = l.version_id;
  select title into t from public.documents where id = l.document_id;
  return query select true, 'ok', l.id, t, v.storage_path, v.mime_type, v.file_name, l.recipient_name, l.expires_at,
    case when l.max_views is null then null else l.max_views - l.view_count - 1 end;
end $$;

-- Share links can only be revoked or shortened, never re-opened or re-pointed.
-- open_share_link() runs as the owner and may bump view_count by one.
create or replace function private.share_links_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'postgres' and new.view_count = old.view_count + 1
     and new.revoked_at is not distinct from old.revoked_at and new.expires_at = old.expires_at then
    return new;
  end if;
  if old.revoked_at is not null then
    raise exception 'this link is already revoked' using errcode = '42501';
  end if;
  if new.token_hash <> old.token_hash or new.document_id <> old.document_id or new.version_id <> old.version_id
     or new.expires_at > old.expires_at or new.view_count <> old.view_count then
    raise exception 'share links can only be revoked or shortened' using errcode = '42501';
  end if;
  if new.revoked_at is not null then
    new.revoked_by := auth.uid();
  end if;
  return new;
end $$;

create trigger share_links_guard before update on public.document_share_links
  for each row execute function private.share_links_guard();

-- ---------------------------------------------------------------------------
-- Contracts: owner, obligations that become tasks
-- ---------------------------------------------------------------------------
alter table public.contracts add column owner_id uuid references public.profiles (id);

create policy survival_delete on public.contract_survival_clauses for delete to authenticated using (private.is_manager_plus());

create or replace function private.obligations_to_task()
returns trigger language plpgsql set search_path = '' as $$
declare
  k public.contracts;
  tid uuid;
begin
  if new.task_id is not null or new.due_date is null then
    return new;
  end if;
  select * into k from public.contracts where id = new.contract_id;
  insert into public.tasks (title, description, priority, due_date, assignee_id, contract_id, organization_id, source, is_demo)
  values (left('Obligation: ' || new.description, 300),
          'From contract: ' || k.title,
          'high', new.due_date, coalesce(new.owner_id, k.owner_id), k.id, k.counterparty_org_id, 'contract_obligation', new.is_demo)
  returning id into tid;
  new.task_id := tid;
  return new;
end $$;
create trigger obligations_to_task before insert on public.contract_obligations
  for each row execute function private.obligations_to_task();

-- ---------------------------------------------------------------------------
-- Expiry alerts. Each item gets one notification per threshold band
-- (90/60/30/7 days). Bands, not exact days, so a missed run catches up.
-- ---------------------------------------------------------------------------
create table public.alerts_sent (
  id bigint generated always as identity primary key,
  kind text not null,
  entity_type text not null,
  entity_id uuid not null,
  threshold_days integer not null,
  target_date date not null,
  sent_at timestamptz not null default now(),
  unique (kind, entity_id, threshold_days, target_date)
);
alter table public.alerts_sent enable row level security;
create policy alerts_read on public.alerts_sent for select to authenticated using (private.is_manager_plus());

create or replace function private.alert_band(p_days integer)
returns integer language sql immutable as $$
  select case when p_days < 0 then null when p_days <= 7 then 7 when p_days <= 30 then 30
              when p_days <= 60 then 60 when p_days <= 90 then 90 end
$$;

create or replace function private.run_expiry_alerts(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, private.today_dubai());
  item record;
  band integer;
  sent integer := 0;
  n integer;
begin
  for item in
    select 'contract_end' as kind, 'contract' as etype, c.id, c.title, c.end_date as target, c.owner_id, c.is_demo,
           'Contract ends' as what
    from public.contracts c
    where c.deleted_at is null and c.status = 'active' and c.renewal_type = 'fixed' and c.end_date is not null
    union all
    select 'notice_deadline', 'contract', c.id, c.title, c.end_date - c.notice_period_days, c.owner_id, c.is_demo,
           'Last day to give notice (auto-renews ' || to_char(c.end_date, 'DD Mon YYYY') || ')'
    from public.contracts c
    where c.deleted_at is null and c.status = 'active' and c.renewal_type = 'auto_renew'
      and c.end_date is not null and c.notice_period_days is not null
    union all
    select 'survival_end', 'contract', c.id, c.title || ' — ' || s.clause, (c.end_date + make_interval(months => s.survival_months))::date,
           c.owner_id, c.is_demo, 'Survival period ends'
    from public.contracts c join public.contract_survival_clauses s on s.contract_id = c.id
    where c.deleted_at is null and c.status in ('expired', 'terminated') and c.end_date is not null
    union all
    select 'document_expiry', 'document', d.id, d.title, d.expiry_date, d.created_by, d.is_demo, 'Document expires'
    from public.documents d
    where d.deleted_at is null and d.expiry_date is not null
    union all
    select 'compliance_due', 'compliance_item', ci.id, ci.title, ci.due_date, ci.owner_id, ci.is_demo, 'Compliance deadline'
    from public.compliance_items ci
    where ci.deleted_at is null and ci.status in ('upcoming', 'in_progress') and ci.due_date is not null
  loop
    band := private.alert_band(item.target - today);
    continue when band is null;
    insert into public.alerts_sent (kind, entity_type, entity_id, threshold_days, target_date)
    values (item.kind, item.etype, item.id, band, item.target)
    on conflict do nothing;
    get diagnostics n = row_count;
    continue when n = 0;
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, is_demo)
    select p.id, item.kind,
           item.title || ': ' || (item.target - today) || case when item.target - today = 1 then ' day left' else ' days left' end,
           item.what || ' on ' || to_char(item.target, 'DD Mon YYYY') || '.',
           item.etype, item.id, item.is_demo
    from public.profiles p
    where p.is_active and (p.role in ('principal', 'manager') or p.id = item.owner_id);
    sent := sent + 1;
  end loop;
  return sent;
end $$;

-- Manual trigger for principals/managers (Settings → Run alerts now).
create or replace function public.run_expiry_alerts_now()
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_manager_plus() then
    raise exception 'managers and principals only' using errcode = '42501';
  end if;
  return private.run_expiry_alerts();
end $$;

-- 03:15 UTC = 07:15 Dubai, ahead of the 07:30 briefing.
select cron.schedule('lantana-expiry-alerts', '15 3 * * *', 'select private.run_expiry_alerts()');

-- ---------------------------------------------------------------------------
-- Audit, updated_at, demo wipe, grants
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['tags', 'document_tags'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end $$;
create trigger document_share_links_audit after insert or update or delete on public.document_share_links
  for each row execute function private.audit_row('token_hash');

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
  delete from public.document_tags where document_id in (select id from public.documents where is_demo);
  delete from public.document_chunks where document_id in (select id from public.documents where is_demo);
  delete from public.document_share_views where link_id in (select id from public.document_share_links where is_demo);
  delete from public.alerts_sent where entity_id in (select id from public.contracts where is_demo)
                                    or entity_id in (select id from public.documents where is_demo);
  update public.documents set current_version_id = null where is_demo;
  update public.tasks set recurrence_parent_id = null where is_demo;
  update public.contract_obligations set task_id = null where is_demo;

  foreach t in array array[
    'activity_events', 'notifications', 'introductions', 'deal_stage_history', 'deal_parties',
    'notes', 'interactions', 'task_dependencies', 'task_comments', 'task_checklist_items',
    'contract_obligations', 'tasks', 'milestones', 'contract_survival_clauses', 'contracts', 'meetings',
    'invoices', 'transactions', 'bank_accounts', 'accounts', 'compliance_items',
    'document_share_links', 'document_versions', 'documents', 'tags', 'folders', 'projects', 'deals', 'contacts',
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

revoke all on public.document_chunks, public.tags, public.document_tags, public.document_share_links,
              public.document_share_views, public.alerts_sent from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
-- The one anonymous entry point: the public share page.
grant execute on function public.open_share_link(text, text, text) to anon;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on function private.pii_key() from authenticated;
revoke execute on function private.run_expiry_alerts(date) from authenticated;

-- ---------------------------------------------------------------------------
-- Public share viewer: a two-minute read window, no service-role key.
-- anon may read one stored object only right after open_share_link() logged
-- a successful view of the version stored at that exact path. The path holds
-- two random UUIDs and is never sent to the browser: the server streams it.
-- ---------------------------------------------------------------------------
create or replace function private.share_object_open(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.document_share_views sv
    join public.document_share_links l on l.id = sv.link_id
    join public.document_versions v on v.id = l.version_id
    where v.storage_path = p_name
      and sv.outcome = 'ok'
      and sv.viewed_at > now() - interval '2 minutes'
      and l.revoked_at is null
      and l.expires_at > now())
$$;

grant usage on schema private to anon;
revoke execute on function private.share_object_open(text) from public;
grant execute on function private.share_object_open(text) to anon, authenticated;

create policy lantana_docs_share_read on storage.objects for select to anon
  using (bucket_id = 'documents' and private.share_object_open(name));
