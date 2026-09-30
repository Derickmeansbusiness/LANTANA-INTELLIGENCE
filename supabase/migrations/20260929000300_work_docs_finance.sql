-- Projects & tasks, documents & contracts (register only; vault UI is Phase 3),
-- compliance, minimal finance for the KPI strip, meetings, notifications, saved views.

create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'done', 'cancelled');
create type public.priority as enum ('low', 'medium', 'high', 'urgent');
create type public.confidentiality as enum ('public', 'internal', 'confidential', 'restricted');
create type public.document_status as enum ('draft', 'awaiting_signature', 'signed', 'final', 'superseded');
create type public.contract_type as enum ('ncnda', 'mandate_non_circumvention', 'lease', 'employment', 'supplier', 'spv', 'engagement', 'other');
create type public.contract_status as enum ('draft', 'negotiating', 'awaiting_signature', 'active', 'expired', 'terminated');
create type public.renewal_type as enum ('fixed', 'auto_renew');

-- ---------------------------------------------------------------------------
-- Projects & tasks
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  deal_id uuid references public.deals (id),
  owner_id uuid references public.profiles (id),
  status text not null default 'active' check (status in ('planned', 'active', 'on_hold', 'done')),
  start_date date,
  target_date date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.priority not null default 'medium',
  due_date date,
  assignee_id uuid references public.profiles (id),
  project_id uuid references public.projects (id),
  deal_id uuid references public.deals (id),
  organization_id uuid references public.organizations (id),
  contract_id uuid,          -- FK added below
  source text not null default 'manual' check (source in ('manual', 'agent', 'email', 'contract_obligation', 'recurring')),
  recurrence_rule text,      -- RFC 5545 RRULE, Phase 2
  completed_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz,
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored
);
create index tasks_due_idx on public.tasks (due_date) where deleted_at is null;
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_search_idx on public.tasks using gin (search);

create or replace function private.can_see_task(p_assignee uuid, p_created_by uuid, p_deal uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_manager_plus()
    or (private.is_internal() and (
          p_assignee = auth.uid() or p_created_by = auth.uid()
          or (p_deal is not null and private.can_see_deal(p_deal))))
$$;

create or replace function private.tasks_touch()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := coalesce(new.completed_at, private.event_time());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;

create or replace function private.tasks_track()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  sc public.activity_scope := case when new.deal_id is null then 'management' else 'deal' end;
  who uuid[] := array_remove(array[new.assignee_id, new.created_by], null);
begin
  if tg_op = 'INSERT' then
    perform private.emit_activity('created', 'created task ' || new.title, 'task', new.id, sc, new.deal_id, who, new.is_demo);
  elsif new.status = 'done' and old.status <> 'done' then
    perform private.emit_activity('completed', 'completed ' || new.title, 'task', new.id, sc, new.deal_id, who, new.is_demo);
  end if;
  if new.deal_id is not null then
    update public.deals set last_activity_at = private.event_time() where id = new.deal_id;
  end if;
  return null;
end $$;

create trigger tasks_touch before insert or update on public.tasks for each row execute function private.tasks_touch();
create trigger tasks_track after insert or update on public.tasks for each row execute function private.tasks_track();

-- ---------------------------------------------------------------------------
-- Documents (metadata; storage + versions UI in Phase 3)
-- ---------------------------------------------------------------------------
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.folders (id),
  name text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  folder_id uuid references public.folders (id),
  doc_type text not null default 'other' check (doc_type in (
    'agreement', 'letter', 'lease', 'presentation', 'proposal', 'invoice', 'certificate',
    'resolution', 'licence', 'statement', 'other')),
  confidentiality public.confidentiality not null default 'internal',
  status public.document_status not null default 'draft',
  expiry_date date,
  description text,
  current_version_id uuid,
  checked_out_by uuid references public.profiles (id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz,
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored
);
create index documents_search_idx on public.documents using gin (search);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id),
  version_no integer not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  unique (document_id, version_no)
);
alter table public.documents add constraint documents_current_version_fk
  foreign key (current_version_id) references public.document_versions (id);

create table public.document_links (
  document_id uuid not null references public.documents (id),
  entity_type text not null check (entity_type in ('deal', 'organization', 'contract', 'project', 'employee')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  primary key (document_id, entity_type, entity_id)
);
create index document_links_entity_idx on public.document_links (entity_type, entity_id);

alter table public.introductions add constraint introductions_evidence_fk
  foreign key (evidence_document_id) references public.documents (id);

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  contract_type public.contract_type not null,
  counterparty_org_id uuid references public.organizations (id),
  document_id uuid references public.documents (id),
  effective_date date,
  term_months integer,
  end_date date,                    -- end of the current term
  renewal_type public.renewal_type not null default 'fixed',
  notice_period_days integer,
  governing_law text,
  forum text,
  exclusivity text,
  fee_terms text,
  signatory_name text,
  signatory_confirmed boolean not null default false,
  signing_authority_confirmed boolean not null default false,
  counterparty_address_confirmed boolean not null default true,
  status public.contract_status not null default 'draft',
  esign_status text,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

alter table public.tasks add constraint tasks_contract_fk foreign key (contract_id) references public.contracts (id);

create table public.contract_survival_clauses (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id),
  clause text not null,
  survival_months integer not null check (survival_months > 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id)
);

create table public.contract_obligations (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id),
  description text not null,
  due_date date,
  owner_id uuid references public.profiles (id),
  task_id uuid references public.tasks (id),
  status text not null default 'open' check (status in ('open', 'done', 'waived')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id)
);

-- ---------------------------------------------------------------------------
-- Compliance
-- ---------------------------------------------------------------------------
create table public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('licence', 'tax', 'filing', 'lease', 'insurance', 'visa', 'other')),
  authority text,
  due_date date,
  recurrence text,
  -- 'unconfirmed' = we think it may apply; a human must confirm before it drives alerts
  status text not null default 'unconfirmed' check (status in ('unconfirmed', 'upcoming', 'in_progress', 'done', 'not_applicable')),
  owner_id uuid references public.profiles (id),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Finance (minimal for Phase 1 KPIs; full module in Phase 5)
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null check (type in ('asset', 'liability', 'equity', 'income', 'expense')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

-- Principal-only. Opening balance lives here, so managers who can read the
-- ledger still can't derive the balance.
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bank_name text,
  currency char(3) not null references public.currencies (code),
  iban_encrypted bytea,
  iban_last4 text,
  opening_balance_minor bigint not null default 0,
  opening_date date not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  txn_date date not null,
  description text not null,
  account_id uuid references public.accounts (id),
  bank_account_id uuid references public.bank_accounts (id),
  amount_minor bigint not null,            -- signed: negative = outflow
  currency char(3) not null references public.currencies (code),
  counterparty_org_id uuid references public.organizations (id),
  deal_id uuid references public.deals (id),
  is_transfer boolean not null default false,
  is_payroll boolean not null default false,  -- payroll rows are principal-only (they reveal salaries)
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);
create index transactions_date_idx on public.transactions (txn_date);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  organization_id uuid references public.organizations (id),
  deal_id uuid references public.deals (id),
  kind text not null default 'other' check (kind in ('success_fee', 'retainer', 'advisory', 'other')),
  issue_date date not null,
  due_date date not null,
  currency char(3) not null references public.currencies (code),
  total_minor bigint not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  paid_at date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Meetings, notifications, saved views
-- ---------------------------------------------------------------------------
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  deal_id uuid references public.deals (id),
  organization_id uuid references public.organizations (id),
  attendee_ids uuid[] not null default '{}',
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  kind text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id),
  module text not null,
  name text not null,
  config jsonb not null default '{}',
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Activity triggers for contracts/documents
-- ---------------------------------------------------------------------------
create or replace function private.contracts_track()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.emit_activity('created', 'registered contract ' || new.title, 'contract', new.id, 'management', null, '{}', new.is_demo);
  elsif new.status is distinct from old.status then
    perform private.emit_activity('updated', 'marked ' || new.title || ' as ' || replace(new.status::text, '_', ' '), 'contract', new.id, 'management', null, '{}', new.is_demo);
  end if;
  return null;
end $$;
create trigger contracts_track after insert or update on public.contracts for each row execute function private.contracts_track();

create or replace function private.documents_track()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.emit_activity('created', 'added document ' || new.title, 'document', new.id,
    case when new.confidentiality in ('public', 'internal') then 'internal' else 'management' end::public.activity_scope,
    null, '{}', new.is_demo);
  return null;
end $$;
create trigger documents_track after insert on public.documents for each row execute function private.documents_track();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_links enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_survival_clauses enable row level security;
alter table public.contract_obligations enable row level security;
alter table public.compliance_items enable row level security;
alter table public.accounts enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.invoices enable row level security;
alter table public.meetings enable row level security;
alter table public.notifications enable row level security;
alter table public.saved_views enable row level security;

-- Management-only tables: manager+ read/insert/update, nobody deletes.
do $$
declare t text;
begin
  foreach t in array array['contracts', 'contract_survival_clauses', 'contract_obligations',
                           'compliance_items', 'accounts', 'invoices'] loop
    execute format('create policy mgmt_read on public.%I for select to authenticated using (private.is_manager_plus())', t);
    execute format('create policy mgmt_insert on public.%I for insert to authenticated with check (private.is_manager_plus())', t);
    execute format('create policy mgmt_update on public.%I for update to authenticated using (private.is_manager_plus()) with check (private.is_manager_plus())', t);
  end loop;
end $$;

create policy principal_read on public.bank_accounts for select to authenticated using (private.is_principal());
create policy principal_insert on public.bank_accounts for insert to authenticated with check (private.is_principal());
create policy principal_update on public.bank_accounts for update to authenticated
  using (private.is_principal()) with check (private.is_principal());

create policy txn_read on public.transactions for select to authenticated
  using (private.is_principal() or (private.is_manager_plus() and not is_payroll));
create policy txn_insert on public.transactions for insert to authenticated
  with check (private.is_principal() or (private.is_manager_plus() and not is_payroll));
create policy txn_update on public.transactions for update to authenticated
  using (private.is_principal() or (private.is_manager_plus() and not is_payroll))
  with check (private.is_principal() or (private.is_manager_plus() and not is_payroll));

create policy project_read on public.projects for select to authenticated using (
  private.is_manager_plus() or owner_id = auth.uid()
  or (deal_id is not null and private.can_see_deal(deal_id))
  or exists (select 1 from public.tasks t where t.project_id = projects.id and t.assignee_id = auth.uid()));
create policy project_insert on public.projects for insert to authenticated with check (private.is_internal());
create policy project_update on public.projects for update to authenticated
  using (private.is_manager_plus() or owner_id = auth.uid())
  with check (private.is_manager_plus() or owner_id = auth.uid());

create policy task_read on public.tasks for select to authenticated
  using (private.can_see_task(assignee_id, created_by, deal_id));
create policy task_insert on public.tasks for insert to authenticated with check (
  private.is_manager_plus()
  or (private.is_internal() and (deal_id is null or private.can_see_deal(deal_id))));
create policy task_update on public.tasks for update to authenticated
  using (private.can_see_task(assignee_id, created_by, deal_id))
  with check (private.can_see_task(assignee_id, created_by, deal_id));

create policy folder_read on public.folders for select to authenticated using (private.is_internal());
create policy folder_write on public.folders for insert to authenticated with check (private.is_manager_plus());
create policy folder_update on public.folders for update to authenticated
  using (private.is_manager_plus()) with check (private.is_manager_plus());

create policy doc_read on public.documents for select to authenticated using (
  private.is_manager_plus() or (private.is_internal() and confidentiality in ('public', 'internal')));
create policy doc_insert on public.documents for insert to authenticated with check (private.is_internal());
create policy doc_update on public.documents for update to authenticated
  using (private.is_manager_plus() or created_by = auth.uid())
  with check (private.is_manager_plus() or created_by = auth.uid());

create policy docver_read on public.document_versions for select to authenticated using (
  exists (select 1 from public.documents d where d.id = document_id));
create policy docver_insert on public.document_versions for insert to authenticated with check (
  exists (select 1 from public.documents d where d.id = document_id));

create policy doclink_read on public.document_links for select to authenticated using (
  exists (select 1 from public.documents d where d.id = document_id));
create policy doclink_insert on public.document_links for insert to authenticated with check (private.is_internal());

create policy meeting_read on public.meetings for select to authenticated using (
  private.is_manager_plus() or auth.uid() = any (attendee_ids)
  or (deal_id is not null and private.can_see_deal(deal_id)));
create policy meeting_insert on public.meetings for insert to authenticated with check (private.is_internal());
create policy meeting_update on public.meetings for update to authenticated
  using (private.is_manager_plus() or created_by = auth.uid())
  with check (private.is_manager_plus() or created_by = auth.uid());

create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy views_read on public.saved_views for select to authenticated
  using (user_id = auth.uid() or (is_shared and private.is_internal()));
create policy views_insert on public.saved_views for insert to authenticated with check (user_id = auth.uid());
create policy views_update on public.saved_views for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Audit + updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['projects', 'tasks', 'folders', 'documents', 'document_versions', 'document_links',
                           'contracts', 'contract_survival_clauses', 'contract_obligations', 'compliance_items',
                           'accounts', 'transactions', 'invoices', 'meetings', 'saved_views'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
  foreach t in array array['projects', 'tasks', 'folders', 'documents', 'contracts', 'contract_obligations',
                           'compliance_items', 'accounts', 'bank_accounts', 'transactions', 'invoices',
                           'meetings', 'saved_views'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

create trigger bank_accounts_audit after insert or update or delete on public.bank_accounts
  for each row execute function private.audit_row('iban_encrypted', 'opening_balance_minor');

grant execute on all functions in schema private to authenticated, service_role;
