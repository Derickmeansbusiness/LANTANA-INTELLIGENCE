-- RLS and integrity tests. Run with: pnpm db:test
-- Relies on the local seed (supabase/seed/*.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

create or replace function pg_temp.login(p_sub text, p_aal text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', p_aal)::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.logout()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ids from supabase/seed/00_dev_users.sql
\set principal '''c0000000-0000-4000-8000-000000000001'''
\set manager   '''c0000000-0000-4000-8000-000000000003'''
\set staff     '''c0000000-0000-4000-8000-000000000004'''

-- ---------------------------------------------------------------- staff
select pg_temp.login(:staff);
select is((select count(*)::int from public.bank_accounts), 0, 'staff: no bank accounts');
select is((select count(*)::int from public.transactions), 0, 'staff: no transactions');
select is((select count(*)::int from public.audit_log), 0, 'staff: no audit log');
select is((select count(*)::int from public.contracts), 0, 'staff: no contracts');
select is((select count(*)::int from public.invoices), 0, 'staff: no invoices');
select is((select count(*)::int from public.compliance_items), 0, 'staff: no compliance items');
select is((select count(*)::int from public.deals), 1, 'staff: only the assigned deal');
select is((select count(*)::int from public.documents where confidentiality in ('confidential', 'restricted')), 0,
          'staff: no confidential documents');
select is((select count(*)::int from public.activity_events where scope = 'management'), 0,
          'staff: no management-scope activity');
select is((public.command_center_kpis(current_date - 7, current_date, 2) -> 'series' -> 1 ->> 'cash_aed'), null,
          'staff: cash KPI is null');
select is((public.command_center_kpis(current_date - 7, current_date, 2) -> 'series' -> 1 ->> 'burn_aed'), null,
          'staff: burn KPI is null');
select throws_ok($$insert into public.deals (name, sector) values ('x', 'energy')$$, '42501', null,
          'staff: cannot create deals');
select throws_ok($$select public.wipe_demo_data('WIPE DEMO DATA')$$, '42501', null, 'staff: cannot wipe demo data');
select throws_ok($$select public.set_user_role('c0000000-0000-4000-8000-000000000004', 'principal')$$, '42501', null,
          'staff: cannot change roles');
select throws_ok($$update public.profiles set role = 'principal' where id = auth.uid()$$, '42501', null,
          'staff: cannot self-promote via profiles');
select is_empty($$delete from public.tasks returning id$$, 'staff: delete removes nothing (no delete policy)');
select pg_temp.logout();

-- -------------------------------------------------------------- manager
select pg_temp.login(:manager);
select is((select count(*)::int from public.bank_accounts), 0, 'manager: no bank accounts');
select is((select count(*)::int from public.transactions where is_payroll), 0, 'manager: no payroll rows');
select ok((select count(*) from public.transactions) > 0, 'manager: sees non-payroll ledger');
select is((select count(*)::int from public.audit_log), 0, 'manager: no audit log');
select is((select count(*)::int from public.deals), 7, 'manager: all deals');
select ok((public.command_center_kpis(current_date - 7, current_date, 2) -> 'series' -> 1 ->> 'burn_aed') is not null,
          'manager: burn KPI visible');
select is((public.command_center_kpis(current_date - 7, current_date, 2) -> 'series' -> 1 ->> 'cash_aed'), null,
          'manager: cash KPI is null');
select pg_temp.logout();

-- ------------------------------------------------------------ principal
update public.company set require_principal_mfa = true;
select pg_temp.login(:principal, 'aal1');
select is((select count(*)::int from public.bank_accounts), 0, 'principal at aal1 with MFA required: no bank accounts');
select is((select count(*)::int from public.deals), 7, 'principal at aal1: still manager-level access');
select pg_temp.logout();
select pg_temp.login(:principal, 'aal2');
select is((select count(*)::int from public.bank_accounts), 1, 'principal at aal2: bank accounts visible');
select ok((select count(*) from public.transactions where is_payroll) > 0, 'principal at aal2: payroll rows visible');
select ok((select count(*) from public.audit_log) > 0, 'principal at aal2: audit log visible');
select pg_temp.logout();

-- ----------------------------------------------------------------- anon
set local role anon;
select throws_ok($$select count(*) from public.deals$$, '42501', null, 'anon: no table access');
reset role;

-- ------------------------------------------------------------ integrity
select throws_ok($$update public.audit_log set action = 'x'$$, '42501', null, 'audit log: update blocked even for owner');
select throws_ok($$delete from public.audit_log$$, '42501', null, 'audit log: delete blocked even for owner');
select throws_ok($$update public.introductions set summary = 'tampered'$$, '42501', null,
          'introductions: update blocked');
select ok((select ok from public.verify_introductions_chain(true)), 'introductions: demo hash chain verifies');

-- audit trail captures a mutation with actor
select pg_temp.login(:manager);
update public.deals set next_step = 'pgTAP check' where id = 'd0000000-0000-4000-8000-000000000001';
select pg_temp.logout();
select ok(exists (select 1 from public.audit_log
                  where table_name = 'deals' and row_id = 'd0000000-0000-4000-8000-000000000001'
                    and actor_id = 'c0000000-0000-4000-8000-000000000003'
                    and after ->> 'next_step' = 'pgTAP check'),
          'audit: deal update logged with actor and after-image');

select * from finish();
rollback;
