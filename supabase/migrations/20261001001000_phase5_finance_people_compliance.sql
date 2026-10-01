-- Phase 5: company facts from the RAKEZ e-licence; finance (invoice lines,
-- bills, budgets, statement imports, category suggestions, P&L and cash
-- series); people (employees, encrypted identity and compensation, leave,
-- onboarding/offboarding checklists, payroll runs with WPS status);
-- compliance (principal confirmation, recurrence, corporate records,
-- minutes, resolutions).
--
-- Sensitive tables (employee_identity, employee_compensation, payroll_runs,
-- payroll_items) are principal-read-only. Nobody writes them directly: every
-- write goes through a SECURITY DEFINER function that checks is_principal(),
-- validates, and encrypts with the Vault key. Amounts and ID numbers are
-- stored only as pgp_sym_encrypt ciphertext.

-- ===========================================================================
-- Encryption helpers (definer, never callable by users)
-- ===========================================================================
create or replace function private.enc(p_value text)
returns bytea language sql stable security definer set search_path = '' as $$
  select case when p_value is null or p_value = '' then null
              else extensions.pgp_sym_encrypt(p_value, private.pii_key()) end
$$;

create or replace function private.dec(p_value bytea)
returns text language sql stable security definer set search_path = '' as $$
  select case when p_value is null then null
              else extensions.pgp_sym_decrypt(p_value, private.pii_key()) end
$$;

create or replace function private.dec_minor(p_value bytea)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(private.dec(p_value)::bigint, 0)
$$;

-- ===========================================================================
-- Company facts (from the RAKEZ e-licence, document ref 1592720-qK16-sjaE-78587935)
-- FDCW2089 is the unit in Compass Building, not a licence number.
-- ===========================================================================
alter table public.company
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists mohre_establishment_id text,
  add column if not exists wps_employer_bank_code text;

update public.company set email = 'info@lantanavision.com' where email is null;
update public.company set licence_no = '7015890, 45033268, 47027560' where licence_no = 'FDCW2089';
update public.company
   set address_lines = array['FDCW2089, Compass Building, Al Shohada Road', 'Al Hamra Industrial Zone-FZ',
                             'Ras Al Khaimah, United Arab Emirates']
 where address_lines = array['Compass Building, Al Shohada Road', 'Al Hamra Industrial Zone-FZ',
                             'Ras Al Khaimah, United Arab Emirates'];

-- ===========================================================================
-- Corporate records: licences, registrations, shareholders, signatories, lease
-- ===========================================================================
create table public.corporate_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('licence', 'registration', 'shareholder', 'signatory', 'lease', 'other')),
  title text not null check (length(trim(title)) > 0),
  reference_no text,
  authority text,
  holder text,            -- the person or entity named (manager, shareholder, signatory)
  detail text,            -- licensed activity, shareholding, scope of authority
  issue_date date,
  expiry_date date,
  document_id uuid references public.documents (id),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz,
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);

insert into public.corporate_records (kind, title, reference_no, authority, holder, detail, issue_date, expiry_date, notes) values
  ('licence', 'General Trading Licence', '7015890', 'RAKEZ', 'Maimouna Baba Diallo (Manager)', 'General Trading',
   '2025-12-26', '2026-12-25', 'Free Zone LLC. RAKEZ e-licence document ref 1592720-qK16-sjaE-78587935.'),
  ('licence', 'E-Commerce Licence', '45033268', 'RAKEZ', 'Maimouna Baba Diallo (Manager)', 'Products and Services E-Trading',
   '2025-12-26', '2026-12-25', 'Free Zone LLC. RAKEZ e-licence document ref 1592720-qK16-sjaE-78587935.'),
  ('licence', 'Services Licence', '47027560', 'RAKEZ', 'Maimouna Baba Diallo (Manager)', 'Information Technology Consultants',
   '2025-12-26', '2026-12-25', 'Free Zone LLC. RAKEZ e-licence document ref 1592720-qK16-sjaE-78587935.');

-- ===========================================================================
-- Compliance: principal confirmation, recurrence, completion
-- ===========================================================================
alter table public.compliance_items
  add column if not exists confirmed_by uuid references public.profiles (id),
  add column if not exists confirmed_at timestamptz,
  add column if not exists document_id uuid references public.documents (id),
  add column if not exists completed_on date,
  add column if not exists next_item_id uuid references public.compliance_items (id);
alter table public.compliance_items
  add constraint compliance_items_recurrence_check check (recurrence is null or recurrence in ('monthly', 'quarterly', 'yearly'));

-- Only a principal takes an item out of 'unconfirmed' (or creates one already
-- confirmed). Rows created by our own triggers (next occurrence) and by
-- migrations/cron (no auth.uid()) pass.
create or replace function private.compliance_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'unconfirmed' then
      if not private.is_principal() then
        raise exception 'only a principal can confirm a compliance obligation; add it as unconfirmed' using errcode = '42501';
      end if;
      new.confirmed_by := auth.uid();
      new.confirmed_at := now();
    end if;
    return new;
  end if;
  if old.status = 'unconfirmed' and new.status <> 'unconfirmed' then
    if not private.is_principal() then
      raise exception 'only a principal can confirm whether this applies' using errcode = '42501';
    end if;
    new.confirmed_by := auth.uid();
    new.confirmed_at := now();
  elsif new.status = 'unconfirmed' and old.status <> 'unconfirmed' and not private.is_principal() then
    raise exception 'only a principal can un-confirm an obligation' using errcode = '42501';
  end if;
  if new.status = 'done' and old.status <> 'done' then
    new.completed_on := coalesce(new.completed_on, private.today_dubai());
  elsif new.status <> 'done' then
    new.completed_on := null;
  end if;
  return new;
end $$;
create trigger compliance_items_guard before insert or update on public.compliance_items
  for each row execute function private.compliance_guard();

-- Completing a recurring item schedules the next one (already confirmed).
create or replace function private.compliance_next()
returns trigger language plpgsql security definer set search_path = '' as $$
declare nid uuid;
begin
  if new.status = 'done' and old.status <> 'done' and new.recurrence is not null
     and new.due_date is not null and new.next_item_id is null then
    insert into public.compliance_items
      (title, category, authority, due_date, recurrence, status, owner_id, notes, is_demo, confirmed_by, confirmed_at)
    values (new.title, new.category, new.authority,
            (new.due_date + case new.recurrence when 'monthly' then interval '1 month'
                                                when 'quarterly' then interval '3 months'
                                                else interval '1 year' end)::date,
            new.recurrence, 'upcoming', new.owner_id, new.notes, new.is_demo, new.confirmed_by, new.confirmed_at)
    returning id into nid;
    update public.compliance_items set next_item_id = nid where id = new.id;
  end if;
  return null;
end $$;
create trigger compliance_items_next after update of status on public.compliance_items
  for each row execute function private.compliance_next();

-- The licence renewal is a real, confirmed obligation (from the e-licence).
insert into public.compliance_items (title, category, authority, due_date, recurrence, status, notes, confirmed_at)
values ('RAKEZ licence renewal (7015890, 45033268, 47027560)', 'licence', 'RAKEZ', '2026-12-25', 'yearly', 'upcoming',
        'All three licences were issued 26 Dec 2025 and expire 25 Dec 2026. Taken from the RAKEZ e-licence '
        || '(document ref 1592720-qK16-sjaE-78587935). Renewal needs a valid lease/co-working agreement.', now());

-- ===========================================================================
-- Meetings: governance kind + minutes; resolutions
-- ===========================================================================
alter table public.meetings
  add column if not exists kind text not null default 'meeting'
    check (kind in ('meeting', 'board', 'shareholders', 'management')),
  add column if not exists minutes text,
  add column if not exists minutes_document_id uuid references public.documents (id),
  add column if not exists minutes_approved_at timestamptz;

create table public.resolutions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings (id),
  ref_no text,
  title text not null check (length(trim(title)) > 0),
  body text,
  kind text not null default 'board' check (kind in ('board', 'shareholders', 'manager')),
  status text not null default 'draft' check (status in ('draft', 'passed', 'rejected', 'withdrawn')),
  passed_on date,
  document_id uuid references public.documents (id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz,
  check (status <> 'passed' or passed_on is not null)
);

-- ===========================================================================
-- Finance
-- ===========================================================================
create table public.transaction_imports (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid references public.bank_accounts (id),
  file_name text not null,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id)
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  supplier_org_id uuid references public.organizations (id),
  supplier_name text,
  reference text,
  description text not null check (length(trim(description)) > 0),
  account_id uuid references public.accounts (id),
  issue_date date not null,
  due_date date not null,
  currency char(3) not null references public.currencies (code),
  total_minor bigint not null check (total_minor > 0),
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  paid_at date,
  document_id uuid references public.documents (id),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz,
  check (supplier_org_id is not null or coalesce(trim(supplier_name), '') <> ''),
  check (due_date >= issue_date),
  check ((status = 'paid') = (paid_at is not null))
);

alter table public.transactions
  add column if not exists reference text,
  add column if not exists notes text,
  add column if not exists category_source text not null default 'manual'
    check (category_source in ('manual', 'rule', 'history', 'agent')),
  add column if not exists import_id uuid references public.transaction_imports (id),
  add column if not exists import_hash text,
  add column if not exists invoice_id uuid references public.invoices (id),
  add column if not exists bill_id uuid references public.bills (id);
create unique index transactions_import_hash_uq on public.transactions (import_hash)
  where import_hash is not null and deleted_at is null;
create index transactions_account_idx on public.transactions (account_id, txn_date);

create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  pattern text not null check (length(trim(pattern)) >= 2),
  account_id uuid not null references public.accounts (id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id),
  month date not null check (extract(day from month) = 1),
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'AED' references public.currencies (code),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);
create unique index budgets_account_month_uq on public.budgets (account_id, month) where deleted_at is null;

-- Invoice lines. The invoice's subtotal, VAT and total follow its lines while
-- it is a draft; once issued, amounts are frozen.
alter table public.invoices
  add column if not exists subtotal_minor bigint,
  add column if not exists vat_rate numeric(5, 2) not null default 0 check (vat_rate between 0 and 100),
  add column if not exists vat_minor bigint not null default 0,
  add column if not exists reference text,
  add column if not exists notes text;

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id),
  position integer not null default 0,
  description text not null check (length(trim(description)) > 0),
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  amount_minor bigint not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id)
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id, position);

create or replace function private.invoice_item_amount()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.invoices i where i.id = new.invoice_id and i.status = 'draft')
     and current_setting('app.wiping_demo', true) is distinct from 'on' then
    raise exception 'only a draft invoice''s lines can change' using errcode = '42501';
  end if;
  new.amount_minor := round(new.quantity * new.unit_price_minor);
  return new;
end $$;
create trigger invoice_items_amount before insert or update on public.invoice_items
  for each row execute function private.invoice_item_amount();

create or replace function private.invoice_recalc(p_invoice uuid)
returns void language sql set search_path = '' as $$
  update public.invoices i
     set subtotal_minor = s.sub,
         vat_minor = round(s.sub * i.vat_rate / 100),
         total_minor = s.sub + round(s.sub * i.vat_rate / 100)
    from (select coalesce(sum(it.amount_minor), 0)::bigint as sub, count(*) as n
          from public.invoice_items it where it.invoice_id = p_invoice) s
   where i.id = p_invoice and i.status = 'draft' and s.n > 0
$$;

create or replace function private.invoice_items_changed()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('app.wiping_demo', true) = 'on' then
    return null;
  end if;
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.invoices i where i.id = old.invoice_id and i.status = 'draft') then
      raise exception 'only a draft invoice''s lines can change' using errcode = '42501';
    end if;
    perform private.invoice_recalc(old.invoice_id);
  else
    perform private.invoice_recalc(new.invoice_id);
  end if;
  return null;
end $$;
create trigger invoice_items_recalc after insert or update or delete on public.invoice_items
  for each row execute function private.invoice_items_changed();

create or replace function private.invoice_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' and (
       new.invoice_no is distinct from old.invoice_no or new.currency is distinct from old.currency
       or new.total_minor is distinct from old.total_minor or new.subtotal_minor is distinct from old.subtotal_minor
       or new.vat_rate is distinct from old.vat_rate or new.issue_date is distinct from old.issue_date
       or new.organization_id is distinct from old.organization_id) then
    raise exception 'an issued invoice can''t be edited; void it and issue a new one' using errcode = '42501';
  end if;
  if new.status = 'draft' and old.status <> 'draft' then
    raise exception 'an issued invoice can''t go back to draft' using errcode = '42501';
  end if;
  if old.status = 'void' and new.status <> 'void' then
    raise exception 'a void invoice stays void' using errcode = '42501';
  end if;
  if new.status = 'paid' then
    new.paid_at := coalesce(new.paid_at, private.today_dubai());
  else
    new.paid_at := null;
  end if;
  if new.status = 'draft' and new.vat_rate is distinct from old.vat_rate and new.subtotal_minor is not null then
    new.vat_minor := round(new.subtotal_minor * new.vat_rate / 100);
    new.total_minor := new.subtotal_minor + new.vat_minor;
  end if;
  return new;
end $$;
create trigger invoices_guard before update on public.invoices
  for each row execute function private.invoice_guard();

-- Category suggestions for imported lines: the longest matching rule wins,
-- else the most similar past categorised transaction (trigram similarity).
-- security invoker: suggestions only draw on rows the caller can see.
create or replace function public.suggest_transaction_categories(p_descriptions text[])
returns table (ord integer, account_id uuid, source text, reason text)
language sql stable security invoker set search_path = '' as $$
  with d as (
    select u.ord::int, lower(trim(u.txt)) as txt
    from unnest(p_descriptions) with ordinality as u(txt, ord))
  select d.ord,
         coalesce(r.account_id, h.account_id),
         case when r.account_id is not null then 'rule' when h.account_id is not null then 'history' end,
         case when r.account_id is not null then 'Matches rule "' || r.pattern || '"'
              when h.account_id is not null then 'Like "' || h.description || '" on ' || to_char(h.txn_date, 'DD Mon YYYY') end
  from d
  left join lateral (
    select cr.account_id, cr.pattern from public.category_rules cr
    where cr.deleted_at is null and d.txt like '%' || lower(trim(cr.pattern)) || '%'
    order by length(cr.pattern) desc limit 1) r on true
  left join lateral (
    select t.account_id, t.description, t.txn_date from public.transactions t
    where t.deleted_at is null and t.account_id is not null
      and extensions.similarity(lower(t.description), d.txt) >= 0.45
    order by extensions.similarity(lower(t.description), d.txt) desc, t.txn_date desc limit 1) h on r.account_id is null
  order by d.ord
$$;

-- Monthly totals per account, in AED at each transaction's date. Definer so
-- managers get true totals with payroll included in aggregate (the decision
-- already taken for burn); individual payroll rows stay principal-only.
create or replace function public.finance_monthly(p_from date, p_to date)
returns table (month date, account_id uuid, code text, name text, type text, amount_aed numeric, missing_fx integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_manager_plus() then
    raise exception 'managers and principals only' using errcode = '42501';
  end if;
  return query
  select date_trunc('month', t.txn_date)::date, a.id, a.code, a.name, a.type,
         coalesce(sum(private.convert_major(t.amount_minor, t.currency, 'AED', t.txn_date)), 0),
         (count(*) filter (where private.convert_major(t.amount_minor, t.currency, 'AED', t.txn_date) is null))::int
  from public.transactions t
  left join public.accounts a on a.id = t.account_id
  where t.deleted_at is null and not t.is_transfer and t.txn_date between p_from and p_to
  group by 1, 2, 3, 4, 5
  order by 1, 3 nulls last;
end $$;

-- Cash by month across all bank accounts (principal only: it reveals balances).
create or replace function public.finance_cash_monthly(p_from date, p_to date)
returns table (month date, inflow_aed numeric, outflow_aed numeric, closing_aed numeric)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not private.is_principal() then
    return;
  end if;
  return query
  select m::date,
         coalesce((select sum(private.convert_major(t.amount_minor, t.currency, 'AED', t.txn_date))
                   from public.transactions t
                   where t.deleted_at is null and t.bank_account_id is not null and t.amount_minor > 0
                     and t.txn_date >= m and t.txn_date < m + interval '1 month'), 0),
         coalesce((select -sum(private.convert_major(t.amount_minor, t.currency, 'AED', t.txn_date))
                   from public.transactions t
                   where t.deleted_at is null and t.bank_account_id is not null and t.amount_minor < 0
                     and t.txn_date >= m and t.txn_date < m + interval '1 month'), 0),
         private.kpi_cash_aed(least((m + interval '1 month' - interval '1 day')::date, p_to))
  from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') m;
end $$;

-- ===========================================================================
-- People
-- ===========================================================================
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id),
  full_name text not null check (length(trim(full_name)) > 0),
  job_title text,
  department text,
  work_email text,
  phone text,
  manager_id uuid references public.employees (id),
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'part_time', 'contractor', 'intern')),
  status text not null default 'active' check (status in ('onboarding', 'active', 'offboarding', 'left')),
  -- false for people paid outside payroll (e.g. principals drawing dividends)
  on_payroll boolean not null default true,
  start_date date,
  end_date date,
  probation_end date,
  work_location text,
  -- Expiry dates aren't secret (they drive alerts); the numbers are, and
  -- live encrypted in employee_identity.
  visa_expiry date,
  emirates_id_expiry date,
  labour_card_expiry date,
  passport_expiry date,
  insurance_expiry date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz,
  check (end_date is null or start_date is null or end_date >= start_date)
);

create or replace function private.is_my_employee(p_employee uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.employees e
                 where e.id = p_employee and e.profile_id = auth.uid() and e.deleted_at is null)
$$;

-- Principal-only. Numbers are ciphertext; last4 columns are for display.
create table public.employee_identity (
  employee_id uuid primary key references public.employees (id),
  nationality text,
  date_of_birth date,
  passport_no_enc bytea,
  emirates_id_no_enc bytea,
  visa_file_no_enc bytea,
  labour_card_no_enc bytea,
  mohre_person_code_enc bytea,
  iban_enc bytea,
  passport_last4 text,
  emirates_id_last4 text,
  iban_last4 text,
  bank_name text,
  bank_routing_code text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id)
);

-- Principal-only, effective-dated. Amounts are ciphertext of minor units.
create table public.employee_compensation (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  effective_from date not null,
  currency char(3) not null default 'AED' references public.currencies (code),
  basic_enc bytea not null,
  housing_enc bytea,
  transport_enc bytea,
  other_enc bytea,
  note text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);
create unique index employee_compensation_effective_uq on public.employee_compensation (employee_id, effective_from)
  where deleted_at is null;

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  kind text not null check (kind in ('annual', 'sick', 'maternity', 'parental', 'compassionate', 'study', 'hajj', 'unpaid', 'other')),
  start_date date not null,
  end_date date not null,
  days numeric(5, 1) not null check (days > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz,
  check (end_date >= start_date)
);
create index leave_requests_employee_idx on public.leave_requests (employee_id, start_date);

-- Staff may request (pending) and cancel their own leave; only manager+
-- decides, and a manager can't decide their own request.
create or replace function private.leave_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' and not private.is_manager_plus() then
      raise exception 'a request starts as pending' using errcode = '42501';
    end if;
    if new.status in ('approved', 'rejected') then
      new.decided_by := auth.uid();
      new.decided_at := now();
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status in ('approved', 'rejected') then
      if not private.is_manager_plus() then
        raise exception 'only a manager or principal can approve leave' using errcode = '42501';
      end if;
      if private.is_my_employee(new.employee_id) and not private.is_principal() then
        raise exception 'you can''t decide your own leave request' using errcode = '42501';
      end if;
      new.decided_by := auth.uid();
      new.decided_at := now();
    elsif new.status = 'cancelled' then
      if old.status not in ('pending', 'approved') then
        raise exception 'only a pending or approved request can be cancelled' using errcode = '22023';
      end if;
      if old.status = 'approved' and not private.is_manager_plus() then
        raise exception 'ask a manager to cancel approved leave' using errcode = '42501';
      end if;
    elsif new.status = 'pending' then
      raise exception 'a decided request can''t go back to pending' using errcode = '22023';
    end if;
  end if;
  if not private.is_manager_plus() and (
       new.employee_id is distinct from old.employee_id
       or (old.status <> 'pending' and (new.start_date, new.end_date, new.days, new.kind)
                                      is distinct from (old.start_date, old.end_date, old.days, old.kind))
       or new.decided_by is distinct from old.decided_by or new.decision_note is distinct from old.decision_note) then
    raise exception 'only a pending request can be edited' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger leave_requests_guard before insert or update on public.leave_requests
  for each row execute function private.leave_guard();

create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  year integer not null check (year between 2000 and 2100),
  kind text not null check (kind in ('annual', 'sick', 'maternity', 'parental', 'compassionate', 'study', 'hajj', 'unpaid', 'other')),
  entitled_days numeric(5, 1) not null check (entitled_days >= 0),
  carried_over numeric(5, 1) not null default 0 check (carried_over >= 0),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  unique (employee_id, year, kind)
);

create or replace view public.v_leave_balances with (security_invoker = true) as
select b.employee_id, b.year, b.kind, b.entitled_days, b.carried_over,
       coalesce(sum(r.days) filter (where r.status = 'approved'), 0) as taken_days,
       coalesce(sum(r.days) filter (where r.status = 'pending'), 0) as pending_days,
       b.entitled_days + b.carried_over - coalesce(sum(r.days) filter (where r.status = 'approved'), 0) as remaining_days
from public.leave_balances b
left join public.leave_requests r
  on r.employee_id = b.employee_id and r.kind = b.kind and r.deleted_at is null
 and extract(year from r.start_date) = b.year
group by b.employee_id, b.year, b.kind, b.entitled_days, b.carried_over;

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  kind text not null check (kind in ('onboarding', 'offboarding')),
  title text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists (id),
  position integer not null default 0,
  title text not null check (length(trim(title)) > 0),
  owner_id uuid references public.profiles (id),
  due_date date,
  done_at timestamptz,
  done_by uuid references public.profiles (id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id)
);
create index checklist_items_checklist_idx on public.checklist_items (checklist_id, position);

create or replace function private.checklist_employee(p_checklist uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select c.employee_id from public.checklists c where c.id = p_checklist
$$;

-- Payroll (principal-only; written only through the functions below).
create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period date not null check (extract(day from period) = 1),
  pay_date date,
  currency char(3) not null default 'AED' references public.currencies (code),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'void')),
  wps_status text not null default 'not_submitted'
    check (wps_status in ('not_submitted', 'submitted', 'accepted', 'rejected', 'not_required')),
  wps_reference text,
  wps_note text,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  paid_at date,
  transaction_id uuid references public.transactions (id),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  deleted_at timestamptz
);
create unique index payroll_runs_period_uq on public.payroll_runs (period) where deleted_at is null and status <> 'void';

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs (id),
  employee_id uuid not null references public.employees (id),
  days_paid integer not null check (days_paid between 0 and 31),
  days_in_period integer not null check (days_in_period between 28 and 31),
  basic_enc bytea not null,
  allowances_enc bytea,
  variable_enc bytea,
  deductions_enc bytea,
  note text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  unique (run_id, employee_id)
);

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.corporate_records enable row level security;
alter table public.resolutions enable row level security;
alter table public.transaction_imports enable row level security;
alter table public.bills enable row level security;
alter table public.category_rules enable row level security;
alter table public.budgets enable row level security;
alter table public.invoice_items enable row level security;
alter table public.employees enable row level security;
alter table public.employee_identity enable row level security;
alter table public.employee_compensation enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_balances enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['corporate_records', 'resolutions', 'transaction_imports', 'bills', 'category_rules',
                           'budgets', 'invoice_items'] loop
    execute format('create policy mgmt_read on public.%I for select to authenticated using (private.is_manager_plus())', t);
    execute format('create policy mgmt_insert on public.%I for insert to authenticated with check (private.is_manager_plus())', t);
    execute format('create policy mgmt_update on public.%I for update to authenticated using (private.is_manager_plus()) with check (private.is_manager_plus())', t);
  end loop;
  -- Sensitive tables: principals read; nobody writes except definer functions.
  foreach t in array array['employee_identity', 'employee_compensation', 'payroll_runs', 'payroll_items'] loop
    execute format('create policy principal_read on public.%I for select to authenticated using (private.is_principal())', t);
  end loop;
end $$;

-- Draft invoice lines may be removed (a link-like row; still audited).
create policy mgmt_delete on public.invoice_items for delete to authenticated using (private.is_manager_plus());

create policy employee_read on public.employees for select to authenticated
  using (private.is_manager_plus() or profile_id = auth.uid());
create policy employee_insert on public.employees for insert to authenticated with check (private.is_manager_plus());
create policy employee_update on public.employees for update to authenticated
  using (private.is_manager_plus()) with check (private.is_manager_plus());

create policy leave_read on public.leave_requests for select to authenticated
  using (private.is_manager_plus() or private.is_my_employee(employee_id));
create policy leave_insert on public.leave_requests for insert to authenticated
  with check (private.is_manager_plus() or private.is_my_employee(employee_id));
create policy leave_update on public.leave_requests for update to authenticated
  using (private.is_manager_plus() or private.is_my_employee(employee_id))
  with check (private.is_manager_plus() or private.is_my_employee(employee_id));

create policy balance_read on public.leave_balances for select to authenticated
  using (private.is_manager_plus() or private.is_my_employee(employee_id));
create policy balance_insert on public.leave_balances for insert to authenticated with check (private.is_manager_plus());
create policy balance_update on public.leave_balances for update to authenticated
  using (private.is_manager_plus()) with check (private.is_manager_plus());

create policy checklist_read on public.checklists for select to authenticated
  using (private.is_manager_plus() or private.is_my_employee(employee_id));
create policy checklist_insert on public.checklists for insert to authenticated with check (private.is_manager_plus());
create policy checklist_update on public.checklists for update to authenticated
  using (private.is_manager_plus()) with check (private.is_manager_plus());

create policy checklist_item_read on public.checklist_items for select to authenticated
  using (private.is_manager_plus() or owner_id = auth.uid()
         or private.is_my_employee(private.checklist_employee(checklist_id)));
create policy checklist_item_insert on public.checklist_items for insert to authenticated with check (private.is_manager_plus());
-- Item owners may tick off their own items.
create policy checklist_item_update on public.checklist_items for update to authenticated
  using (private.is_manager_plus() or owner_id = auth.uid())
  with check (private.is_manager_plus() or owner_id = auth.uid());

create or replace function private.checklist_item_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_manager_plus()
     and (new.title, new.owner_id, new.due_date, new.position, new.checklist_id)
         is distinct from (old.title, old.owner_id, old.due_date, old.position, old.checklist_id) then
    raise exception 'you can only tick this item off' using errcode = '42501';
  end if;
  if new.done_at is not null and old.done_at is null then
    new.done_by := auth.uid();
  elsif new.done_at is null then
    new.done_by := null;
  end if;
  return new;
end $$;
create trigger checklist_items_guard before update on public.checklist_items
  for each row execute function private.checklist_item_guard();

-- Rows hanging off an employee are demo exactly when the employee is, so a
-- leave request filed against a demo person never blocks the demo wipe.
create or replace function private.inherit_demo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'checklist_items' then
    new.is_demo := coalesce((select c.is_demo from public.checklists c where c.id = new.checklist_id), new.is_demo);
  elsif tg_table_name = 'invoice_items' then
    new.is_demo := coalesce((select i.is_demo from public.invoices i where i.id = new.invoice_id), new.is_demo);
  else
    new.is_demo := coalesce((select e.is_demo from public.employees e where e.id = new.employee_id), new.is_demo);
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['leave_requests', 'leave_balances', 'checklists', 'checklist_items', 'invoice_items'] loop
    execute format('create trigger %I before insert on public.%I for each row execute function private.inherit_demo()', t || '_inherit_demo', t);
  end loop;
end $$;

-- ===========================================================================
-- People functions
-- ===========================================================================

-- The directory every internal user may see: names, roles, contact, manager.
create or replace function public.people_directory()
returns table (id uuid, full_name text, job_title text, department text, work_email text, phone text,
               manager_name text, status text, is_self boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_internal() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  select e.id, e.full_name, e.job_title, e.department, e.work_email, e.phone, m.full_name, e.status,
         coalesce(e.profile_id = auth.uid(), false)
  from public.employees e left join public.employees m on m.id = e.manager_id
  where e.deleted_at is null and e.status <> 'left'
  order by e.full_name;
end $$;

-- Keys absent from p_values stay unchanged; an empty string clears a field.
create or replace function public.set_employee_identity(p_employee uuid, p_values jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v text;
  clean text;
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.employees e where e.id = p_employee) then
    raise exception 'employee not found' using errcode = '22023';
  end if;
  insert into public.employee_identity (employee_id, is_demo)
  select p_employee, e.is_demo from public.employees e where e.id = p_employee
  on conflict (employee_id) do nothing;

  if p_values ? 'nationality' then
    update public.employee_identity set nationality = nullif(upper(trim(p_values ->> 'nationality')), '') where employee_id = p_employee;
  end if;
  if p_values ? 'date_of_birth' then
    update public.employee_identity set date_of_birth = nullif(p_values ->> 'date_of_birth', '')::date where employee_id = p_employee;
  end if;
  if p_values ? 'bank_name' then
    update public.employee_identity set bank_name = nullif(trim(p_values ->> 'bank_name'), '') where employee_id = p_employee;
  end if;
  if p_values ? 'bank_routing_code' then
    clean := regexp_replace(coalesce(p_values ->> 'bank_routing_code', ''), '\s', '', 'g');
    if clean <> '' and clean !~ '^[0-9]{9}$' then
      raise exception 'the bank routing (agent) code is 9 digits' using errcode = '22023';
    end if;
    update public.employee_identity set bank_routing_code = nullif(clean, '') where employee_id = p_employee;
  end if;
  if p_values ? 'passport_no' then
    clean := upper(regexp_replace(coalesce(p_values ->> 'passport_no', ''), '\s', '', 'g'));
    if clean <> '' and clean !~ '^[A-Z0-9]{5,15}$' then
      raise exception 'that does not look like a passport number' using errcode = '22023';
    end if;
    update public.employee_identity set passport_no_enc = private.enc(clean), passport_last4 = nullif(right(clean, 4), '')
     where employee_id = p_employee;
  end if;
  if p_values ? 'emirates_id_no' then
    clean := regexp_replace(coalesce(p_values ->> 'emirates_id_no', ''), '[\s-]', '', 'g');
    if clean <> '' and clean !~ '^784[0-9]{12}$' then
      raise exception 'an Emirates ID number is 15 digits starting 784' using errcode = '22023';
    end if;
    update public.employee_identity set emirates_id_no_enc = private.enc(clean), emirates_id_last4 = nullif(right(clean, 4), '')
     where employee_id = p_employee;
  end if;
  if p_values ? 'visa_file_no' then
    v := nullif(trim(p_values ->> 'visa_file_no'), '');
    update public.employee_identity set visa_file_no_enc = private.enc(v) where employee_id = p_employee;
  end if;
  if p_values ? 'labour_card_no' then
    v := nullif(trim(p_values ->> 'labour_card_no'), '');
    update public.employee_identity set labour_card_no_enc = private.enc(v) where employee_id = p_employee;
  end if;
  if p_values ? 'mohre_person_code' then
    clean := regexp_replace(coalesce(p_values ->> 'mohre_person_code', ''), '\s', '', 'g');
    if clean <> '' and clean !~ '^[0-9]{14}$' then
      raise exception 'the MOHRE person code is 14 digits' using errcode = '22023';
    end if;
    update public.employee_identity set mohre_person_code_enc = private.enc(clean) where employee_id = p_employee;
  end if;
  if p_values ? 'iban' then
    clean := upper(regexp_replace(coalesce(p_values ->> 'iban', ''), '\s', '', 'g'));
    if clean <> '' and clean !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$' then
      raise exception 'that does not look like an IBAN' using errcode = '22023';
    end if;
    if clean like 'AE%' and clean !~ '^AE[0-9]{21}$' then
      raise exception 'a UAE IBAN is AE followed by 21 digits' using errcode = '22023';
    end if;
    update public.employee_identity set iban_enc = private.enc(clean), iban_last4 = nullif(right(clean, 4), '')
     where employee_id = p_employee;
  end if;
end $$;

create or replace function public.reveal_employee_identity(p_employee uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'passport_no', private.dec(i.passport_no_enc),
           'emirates_id_no', private.dec(i.emirates_id_no_enc),
           'visa_file_no', private.dec(i.visa_file_no_enc),
           'labour_card_no', private.dec(i.labour_card_no_enc),
           'mohre_person_code', private.dec(i.mohre_person_code_enc),
           'iban', private.dec(i.iban_enc))
    into r
  from public.employee_identity i where i.employee_id = p_employee;
  insert into public.audit_log (actor_id, action, table_name, row_id)
  values (auth.uid(), 'reveal', 'employee_identity', p_employee::text);
  return coalesce(r, '{}'::jsonb);
end $$;

create or replace function public.add_employee_compensation(
  p_employee uuid, p_effective_from date, p_currency char(3), p_basic_minor bigint,
  p_housing_minor bigint default 0, p_transport_minor bigint default 0, p_other_minor bigint default 0,
  p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare nid uuid;
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  if p_basic_minor is null or p_basic_minor <= 0 then
    raise exception 'basic salary must be more than zero' using errcode = '22023';
  end if;
  if least(coalesce(p_housing_minor, 0), coalesce(p_transport_minor, 0), coalesce(p_other_minor, 0)) < 0 then
    raise exception 'allowances can''t be negative' using errcode = '22023';
  end if;
  if p_effective_from is null then
    raise exception 'effective date is required' using errcode = '22023';
  end if;
  insert into public.employee_compensation
    (employee_id, effective_from, currency, basic_enc, housing_enc, transport_enc, other_enc, note, is_demo)
  select p_employee, p_effective_from, coalesce(p_currency, 'AED'), private.enc(p_basic_minor::text),
         private.enc(nullif(p_housing_minor, 0)::text), private.enc(nullif(p_transport_minor, 0)::text),
         private.enc(nullif(p_other_minor, 0)::text), nullif(trim(p_note), ''), e.is_demo
  from public.employees e where e.id = p_employee
  returning id into nid;
  if nid is null then
    raise exception 'employee not found' using errcode = '22023';
  end if;
  return nid;
end $$;

create or replace function public.employee_compensation_history(p_employee uuid)
returns table (id uuid, effective_from date, currency char(3), basic_minor bigint, housing_minor bigint,
               transport_minor bigint, other_minor bigint, total_minor bigint, note text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id)
  values (auth.uid(), 'reveal', 'employee_compensation', p_employee::text);
  return query
  select c.id, c.effective_from, c.currency, private.dec_minor(c.basic_enc), private.dec_minor(c.housing_enc),
         private.dec_minor(c.transport_enc), private.dec_minor(c.other_enc),
         private.dec_minor(c.basic_enc) + private.dec_minor(c.housing_enc)
           + private.dec_minor(c.transport_enc) + private.dec_minor(c.other_enc),
         c.note, c.created_at
  from public.employee_compensation c
  where c.employee_id = p_employee and c.deleted_at is null
  order by c.effective_from desc;
end $$;

-- ---------------------------------------------------------------- payroll
create or replace function public.create_payroll_run(p_period date, p_pay_date date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  period_start date := date_trunc('month', p_period)::date;
  period_end date := (date_trunc('month', p_period) + interval '1 month - 1 day')::date;
  dim integer := extract(day from (date_trunc('month', p_period) + interval '1 month - 1 day'))::int;
  rid uuid;
  e record;
  c record;
  paid integer;
  skipped text[] := '{}';
  added integer := 0;
  demo boolean;
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  if exists (select 1 from public.payroll_runs r where r.period = period_start and r.deleted_at is null and r.status <> 'void') then
    raise exception 'a payroll run for % already exists', to_char(period_start, 'Mon YYYY') using errcode = '23505';
  end if;
  -- A run is demo only when every employee on it is demo.
  select coalesce(bool_and(e2.is_demo), false) into demo
  from public.employees e2
  where e2.deleted_at is null and e2.on_payroll and coalesce(e2.start_date, period_start) <= period_end
    and (e2.end_date is null or e2.end_date >= period_start);

  insert into public.payroll_runs (period, pay_date, currency, is_demo)
  values (period_start, coalesce(p_pay_date, period_end), 'AED', demo)
  returning id into rid;

  for e in
    select * from public.employees e2
    where e2.deleted_at is null and e2.on_payroll and e2.employment_type <> 'contractor'
      and coalesce(e2.start_date, period_start) <= period_end
      and (e2.end_date is null or e2.end_date >= period_start)
    order by e2.full_name
  loop
    select * into c from public.employee_compensation ec
    where ec.employee_id = e.id and ec.deleted_at is null and ec.effective_from <= period_end
    order by ec.effective_from desc limit 1;
    if c.id is null then
      skipped := skipped || e.full_name;
      continue;
    end if;
    if c.currency <> 'AED' then
      skipped := skipped || (e.full_name || ' (salary not in AED)');
      continue;
    end if;
    paid := (least(coalesce(e.end_date, period_end), period_end) - greatest(coalesce(e.start_date, period_start), period_start)) + 1;
    insert into public.payroll_items (run_id, employee_id, days_paid, days_in_period, basic_enc, allowances_enc, is_demo)
    values (rid, e.id, paid, dim,
            private.enc(round(private.dec_minor(c.basic_enc)::numeric * paid / dim)::bigint::text),
            private.enc(round((private.dec_minor(c.housing_enc) + private.dec_minor(c.transport_enc)
                               + private.dec_minor(c.other_enc))::numeric * paid / dim)::bigint::text),
            e.is_demo);
    added := added + 1;
  end loop;
  return jsonb_build_object('id', rid, 'employees', added, 'skipped', to_jsonb(skipped));
end $$;

create or replace function public.payroll_run_detail(p_run uuid)
returns table (item_id uuid, employee_id uuid, full_name text, days_paid integer, days_in_period integer,
               basic_minor bigint, allowances_minor bigint, variable_minor bigint, deductions_minor bigint,
               net_minor bigint, note text)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id)
  values (auth.uid(), 'reveal', 'payroll_runs', p_run::text);
  return query
  select i.id, i.employee_id, e.full_name, i.days_paid, i.days_in_period,
         private.dec_minor(i.basic_enc), private.dec_minor(i.allowances_enc),
         private.dec_minor(i.variable_enc), private.dec_minor(i.deductions_enc),
         private.dec_minor(i.basic_enc) + private.dec_minor(i.allowances_enc)
           + private.dec_minor(i.variable_enc) - private.dec_minor(i.deductions_enc),
         i.note
  from public.payroll_items i join public.employees e on e.id = i.employee_id
  where i.run_id = p_run
  order by e.full_name;
end $$;

create or replace function public.update_payroll_item(p_item uuid, p_variable_minor bigint, p_deductions_minor bigint, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  if least(coalesce(p_variable_minor, 0), coalesce(p_deductions_minor, 0)) < 0 then
    raise exception 'amounts can''t be negative' using errcode = '22023';
  end if;
  if not exists (select 1 from public.payroll_items i join public.payroll_runs r on r.id = i.run_id
                 where i.id = p_item and r.status = 'draft') then
    raise exception 'only a draft run can be edited' using errcode = '42501';
  end if;
  update public.payroll_items
     set variable_enc = private.enc(nullif(p_variable_minor, 0)::text),
         deductions_enc = private.enc(nullif(p_deductions_minor, 0)::text),
         note = nullif(trim(p_note), ''),
         updated_at = now()
   where id = p_item;
  if exists (select 1 from public.payroll_items i where i.id = p_item
             and private.dec_minor(i.basic_enc) + private.dec_minor(i.allowances_enc)
                 + private.dec_minor(i.variable_enc) - private.dec_minor(i.deductions_enc) < 0) then
    raise exception 'deductions can''t exceed pay' using errcode = '22023';
  end if;
end $$;

-- draft → approved → paid; draft/approved → void; approved → draft (reopen).
-- Paying records one payroll transaction (principal-only, is_payroll).
create or replace function public.set_payroll_status(p_run uuid, p_status text, p_bank_account uuid default null,
                                                     p_account uuid default null, p_paid_on date default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.payroll_runs;
  total bigint;
  tid uuid;
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  select * into r from public.payroll_runs where id = p_run and deleted_at is null for update;
  if r.id is null then
    raise exception 'payroll run not found' using errcode = '22023';
  end if;
  if not ((r.status = 'draft' and p_status in ('approved', 'void'))
          or (r.status = 'approved' and p_status in ('draft', 'paid', 'void'))) then
    raise exception 'a % run can''t become %', r.status, p_status using errcode = '22023';
  end if;
  if p_status = 'approved' then
    if not exists (select 1 from public.payroll_items i where i.run_id = p_run) then
      raise exception 'the run has nobody on it' using errcode = '22023';
    end if;
    update public.payroll_runs set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_run;
  elsif p_status = 'draft' then
    update public.payroll_runs set status = 'draft', approved_by = null, approved_at = null where id = p_run;
  elsif p_status = 'void' then
    update public.payroll_runs set status = 'void' where id = p_run;
  else
    if p_bank_account is null or p_account is null then
      raise exception 'choose the bank account it was paid from and the salaries account' using errcode = '22023';
    end if;
    select sum(private.dec_minor(i.basic_enc) + private.dec_minor(i.allowances_enc)
               + private.dec_minor(i.variable_enc) - private.dec_minor(i.deductions_enc))
      into total from public.payroll_items i where i.run_id = p_run;
    insert into public.transactions (txn_date, description, account_id, bank_account_id, amount_minor, currency,
                                     is_payroll, category_source, reference, is_demo)
    values (coalesce(p_paid_on, r.pay_date, private.today_dubai()),
            'Payroll ' || to_char(r.period, 'Mon YYYY'), p_account, p_bank_account, -total, r.currency,
            true, 'manual', 'PAYROLL-' || to_char(r.period, 'YYYY-MM'), r.is_demo)
    returning id into tid;
    update public.payroll_runs
       set status = 'paid', paid_at = coalesce(p_paid_on, r.pay_date, private.today_dubai()), transaction_id = tid
     where id = p_run;
  end if;
end $$;

create or replace function public.set_payroll_wps(p_run uuid, p_status text, p_reference text default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  if p_status not in ('not_submitted', 'submitted', 'accepted', 'rejected', 'not_required') then
    raise exception 'unknown WPS status' using errcode = '22023';
  end if;
  update public.payroll_runs
     set wps_status = p_status, wps_reference = nullif(trim(p_reference), ''), wps_note = nullif(trim(p_note), '')
   where id = p_run and deleted_at is null;
end $$;

-- Data for a WPS Salary Information File. Principal only; audited.
create or replace function public.payroll_wps_data(p_run uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare res jsonb;
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id, context)
  values (auth.uid(), 'reveal', 'payroll_runs', p_run::text, '{"purpose":"wps_sif"}');
  select jsonb_build_object(
    'period', r.period, 'pay_date', r.pay_date, 'currency', r.currency,
    'employer_id', c.mohre_establishment_id, 'employer_bank_code', c.wps_employer_bank_code,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'employee_id', e.id, 'full_name', e.full_name,
        'person_code', private.dec(idn.mohre_person_code_enc),
        'routing_code', idn.bank_routing_code,
        'iban', private.dec(idn.iban_enc),
        'days_paid', i.days_paid,
        'fixed_minor', private.dec_minor(i.basic_enc) + private.dec_minor(i.allowances_enc) - private.dec_minor(i.deductions_enc),
        'variable_minor', private.dec_minor(i.variable_enc),
        'start_date', greatest(coalesce(e.start_date, r.period), r.period),
        'end_date', least(coalesce(e.end_date, (r.period + interval '1 month - 1 day')::date),
                          (r.period + interval '1 month - 1 day')::date))
        order by e.full_name)
      from public.payroll_items i
      join public.employees e on e.id = i.employee_id
      left join public.employee_identity idn on idn.employee_id = e.id
      where i.run_id = r.id), '[]'::jsonb))
  into res
  from public.payroll_runs r cross join public.company c
  where r.id = p_run;
  return res;
end $$;

-- What a salary certificate may state: the latest PAID payroll record.
create or replace function public.salary_certificate_data(p_employee uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare res jsonb;
begin
  if not private.is_principal() then
    raise exception 'principal only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'full_name', e.full_name, 'job_title', e.job_title, 'start_date', e.start_date,
    'nationality', idn.nationality, 'passport_no', private.dec(idn.passport_no_enc),
    'period', r.period, 'currency', r.currency,
    'basic_minor', round(private.dec_minor(i.basic_enc)::numeric * i.days_in_period / greatest(i.days_paid, 1)),
    'allowances_minor', round(private.dec_minor(i.allowances_enc)::numeric * i.days_in_period / greatest(i.days_paid, 1)),
    'payroll_item_id', i.id)
  into res
  from public.payroll_items i
  join public.payroll_runs r on r.id = i.run_id
  join public.employees e on e.id = i.employee_id
  left join public.employee_identity idn on idn.employee_id = e.id
  where i.employee_id = p_employee and r.status = 'paid' and r.deleted_at is null and i.days_paid > 0
  order by r.period desc limit 1;
  if res is not null then
    insert into public.audit_log (actor_id, action, table_name, row_id, context)
    values (auth.uid(), 'reveal', 'payroll_items', res ->> 'payroll_item_id', '{"purpose":"salary_certificate"}');
  end if;
  return res;
end $$;

-- ===========================================================================
-- Attention queue: adds bills, staff document expiries, pending leave and
-- corporate records. Same columns, same order.
-- ===========================================================================
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
where d.deleted_at is null and not s.is_terminal and d.last_activity_at < now() - interval '14 days'

union all
select 'bill_overdue', 'high', 'Bill: ' || b.description,
       'Overdue by ' || (today.d - b.due_date) || case when today.d - b.due_date = 1 then ' day' else ' days' end,
       b.due_date, 'bill', b.id, null::uuid, b.is_demo
from public.bills b, today
where b.deleted_at is null and b.status = 'open' and b.due_date < today.d

union all
select 'staff_document_expiring',
       case when x.expires - today.d <= 30 then 'high' else 'medium' end,
       e.full_name || ': ' || x.what,
       case when x.expires < today.d then 'Expired ' else 'Expires ' end || to_char(x.expires, 'DD Mon YYYY'),
       x.expires, 'employee', e.id, null::uuid, e.is_demo
from public.employees e
cross join lateral (values ('residence visa', e.visa_expiry), ('Emirates ID', e.emirates_id_expiry),
                           ('labour card', e.labour_card_expiry), ('passport', e.passport_expiry),
                           ('health insurance', e.insurance_expiry)) as x(what, expires), today
where e.deleted_at is null and e.status <> 'left' and x.expires is not null and x.expires <= today.d + 60

union all
select 'leave_pending', 'medium', e.full_name || ': ' || r.kind || ' leave',
       'Awaiting approval · ' || to_char(r.start_date, 'DD Mon') || ' – ' || to_char(r.end_date, 'DD Mon YYYY'),
       r.start_date, 'employee', e.id, null::uuid, r.is_demo
from public.leave_requests r
join public.employees e on e.id = r.employee_id
where r.deleted_at is null and r.status = 'pending'

union all
select 'record_expiring',
       case when cr.expiry_date - today.d <= 30 then 'high' else 'medium' end,
       cr.title || coalesce(' ' || cr.reference_no, ''),
       case when cr.expiry_date < today.d then 'Expired ' else 'Expires ' end || to_char(cr.expiry_date, 'DD Mon YYYY'),
       cr.expiry_date, 'corporate_record', cr.id, null::uuid, cr.is_demo
from public.corporate_records cr, today
where cr.deleted_at is null and cr.expiry_date is not null and cr.expiry_date <= today.d + 60;

-- ===========================================================================
-- Expiry alerts: add staff documents and corporate records
-- ===========================================================================
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
           'Contract ends' as what, false as principal_only
    from public.contracts c
    where c.deleted_at is null and c.status = 'active' and c.renewal_type = 'fixed' and c.end_date is not null
    union all
    select 'notice_deadline', 'contract', c.id, c.title, c.end_date - c.notice_period_days, c.owner_id, c.is_demo,
           'Last day to give notice (auto-renews ' || to_char(c.end_date, 'DD Mon YYYY') || ')', false
    from public.contracts c
    where c.deleted_at is null and c.status = 'active' and c.renewal_type = 'auto_renew'
      and c.end_date is not null and c.notice_period_days is not null
    union all
    select 'survival_end', 'contract', c.id, c.title || ' — ' || s.clause, (c.end_date + make_interval(months => s.survival_months))::date,
           c.owner_id, c.is_demo, 'Survival period ends', false
    from public.contracts c join public.contract_survival_clauses s on s.contract_id = c.id
    where c.deleted_at is null and c.status in ('expired', 'terminated') and c.end_date is not null
    union all
    select 'document_expiry', 'document', d.id, d.title, d.expiry_date, d.created_by, d.is_demo, 'Document expires', false
    from public.documents d
    where d.deleted_at is null and d.expiry_date is not null
    union all
    select 'compliance_due', 'compliance_item', ci.id, ci.title, ci.due_date, ci.owner_id, ci.is_demo, 'Compliance deadline', false
    from public.compliance_items ci
    where ci.deleted_at is null and ci.status in ('upcoming', 'in_progress') and ci.due_date is not null
    union all
    select 'record_expiry', 'corporate_record', cr.id, cr.title || coalesce(' ' || cr.reference_no, ''), cr.expiry_date,
           null::uuid, cr.is_demo, 'Expires', false
    from public.corporate_records cr
    where cr.deleted_at is null and cr.expiry_date is not null
    union all
    select 'staff_document_expiry:' || x.what, 'employee', e.id, e.full_name || ': ' || x.what, x.expires,
           e.profile_id, e.is_demo, initcap(x.what) || ' expires', false
    from public.employees e
    cross join lateral (values ('residence visa', e.visa_expiry), ('Emirates ID', e.emirates_id_expiry),
                               ('labour card', e.labour_card_expiry), ('passport', e.passport_expiry),
                               ('health insurance', e.insurance_expiry)) as x(what, expires)
    where e.deleted_at is null and e.status <> 'left' and x.expires is not null
  loop
    band := private.alert_band(item.target - today);
    continue when band is null;
    insert into public.alerts_sent (kind, entity_type, entity_id, threshold_days, target_date)
    values (item.kind, item.etype, item.id, band, item.target)
    on conflict do nothing;
    get diagnostics n = row_count;
    continue when n = 0;
    insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, is_demo)
    select p.id, split_part(item.kind, ':', 1),
           item.title || ': ' || (item.target - today) || case when item.target - today = 1 then ' day left' else ' days left' end,
           item.what || ' on ' || to_char(item.target, 'DD Mon YYYY') || '.',
           item.etype, item.id, item.is_demo
    from public.profiles p
    where p.is_active and (p.role in ('principal', 'manager') or p.id = item.owner_id);
    sent := sent + 1;
  end loop;
  return sent;
end $$;

-- ===========================================================================
-- Search: employees (as the caller sees them) and corporate records
-- ===========================================================================
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
    union all
    select 'employee', e.id, e.full_name, coalesce(e.job_title, 'Employee'),
           case when e.full_name ilike '%' || q.raw || '%' then 0.9 else 0 end::real
    from public.employees e, q
    where e.deleted_at is null and e.full_name ilike '%' || q.raw || '%'
    union all
    select 'corporate_record', cr.id, cr.title, 'Corporate record' || coalesce(' · ' || cr.reference_no, ''),
           case when cr.title ilike '%' || q.raw || '%' or cr.reference_no ilike '%' || q.raw || '%' then 0.7 else 0 end::real
    from public.corporate_records cr, q
    where cr.deleted_at is null and (cr.title ilike '%' || q.raw || '%' or cr.reference_no ilike '%' || q.raw || '%')
  ) r(entity_type, entity_id, title, subtitle, rank)
  where (select raw from q) <> ''
  order by rank desc, title
  limit greatest(1, least(coalesce(p_limit, 20), 50))
$$;

-- ===========================================================================
-- Demo wipe and counts
-- ===========================================================================
create or replace function public.demo_data_counts()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'deals', (select count(*) from public.deals where is_demo),
    'organizations', (select count(*) from public.organizations where is_demo),
    'tasks', (select count(*) from public.tasks where is_demo),
    'contracts', (select count(*) from public.contracts where is_demo),
    'documents', (select count(*) from public.documents where is_demo),
    'transactions', (select count(*) from public.transactions where is_demo),
    'employees', (select count(*) from public.employees where is_demo))
$$;

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
                                    or entity_id in (select id from public.documents where is_demo)
                                    or entity_id in (select id from public.employees where is_demo)
                                    or entity_id in (select id from public.corporate_records where is_demo)
                                    or entity_id in (select id from public.compliance_items where is_demo);
  update public.documents set current_version_id = null where is_demo;
  update public.tasks set recurrence_parent_id = null where is_demo;
  update public.contract_obligations set task_id = null where is_demo;
  update public.compliance_items set next_item_id = null where is_demo;
  update public.employees set manager_id = null where is_demo;
  update public.payroll_runs set transaction_id = null where is_demo;

  foreach t in array array[
    'activity_events', 'notifications', 'introductions', 'deal_stage_history', 'deal_parties',
    'notes', 'interactions', 'task_dependencies', 'task_comments', 'task_checklist_items',
    'contract_obligations', 'tasks', 'milestones', 'contract_survival_clauses', 'contracts',
    'resolutions', 'meetings',
    'payroll_items', 'payroll_runs', 'checklist_items', 'checklists', 'leave_requests', 'leave_balances',
    'employee_compensation', 'employee_identity', 'employees',
    'invoice_items', 'budgets', 'category_rules', 'transactions', 'transaction_imports', 'bills', 'invoices',
    'bank_accounts', 'accounts', 'compliance_items', 'corporate_records',
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

-- ===========================================================================
-- Audit + updated_at + archive guard
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array['corporate_records', 'resolutions', 'transaction_imports', 'bills', 'category_rules',
                           'budgets', 'invoice_items', 'employees', 'leave_requests', 'leave_balances',
                           'checklists', 'checklist_items'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
  foreach t in array array['corporate_records', 'resolutions', 'bills', 'category_rules', 'budgets', 'invoice_items',
                           'employees', 'employee_identity', 'employee_compensation', 'leave_requests',
                           'leave_balances', 'checklists', 'checklist_items', 'payroll_runs', 'payroll_items'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_updated_at', t);
  end loop;
  foreach t in array array['employees', 'bills', 'corporate_records', 'resolutions', 'budgets', 'leave_requests',
                           'checklists'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.guard_archive()', t || '_guard_archive', t);
  end loop;
end $$;

-- Encrypted columns are written to the audit log as "[redacted]".
create trigger employee_identity_audit after insert or update or delete on public.employee_identity
  for each row execute function private.audit_row('passport_no_enc', 'emirates_id_no_enc', 'visa_file_no_enc',
                                                  'labour_card_no_enc', 'mohre_person_code_enc', 'iban_enc');
create trigger employee_compensation_audit after insert or update or delete on public.employee_compensation
  for each row execute function private.audit_row('basic_enc', 'housing_enc', 'transport_enc', 'other_enc');
create trigger payroll_runs_audit after insert or update or delete on public.payroll_runs
  for each row execute function private.audit_row();
create trigger payroll_items_audit after insert or update or delete on public.payroll_items
  for each row execute function private.audit_row('basic_enc', 'allowances_enc', 'variable_enc', 'deductions_enc');

-- ===========================================================================
-- Grants. Keep anon out of everything new; re-grant the share window.
-- ===========================================================================
revoke all on public.corporate_records, public.resolutions, public.transaction_imports, public.bills,
              public.category_rules, public.budgets, public.invoice_items, public.employees,
              public.employee_identity, public.employee_compensation, public.leave_requests,
              public.leave_balances, public.v_leave_balances, public.checklists, public.checklist_items,
              public.payroll_runs, public.payroll_items from anon;
-- Sensitive tables: read through RLS only; writes only through the functions.
revoke insert, update, delete, truncate on public.employee_identity, public.employee_compensation,
              public.payroll_runs, public.payroll_items from authenticated;
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
