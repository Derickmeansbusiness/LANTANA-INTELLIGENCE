-- Phase 5: compensation, identity and payroll are principal-only and
-- encrypted; leave and checklists follow ownership; finance aggregates;
-- compliance confirmation; invoice locking; demo wipe keeps real records.
begin;
create extension if not exists pgtap with schema extensions;
select plan(54);

create or replace function pg_temp.login(p_sub text, p_aal text default 'aal2')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', p_aal)::text, true);
  execute 'set local role authenticated';
end $$;

\set principal '''c0000000-0000-4000-8000-000000000001'''
\set fai       '''c0000000-0000-4000-8000-000000000002'''
\set manager   '''c0000000-0000-4000-8000-000000000003'''
\set staff     '''c0000000-0000-4000-8000-000000000004'''
\set e_mgr     '''c5000000-0000-4000-8000-000000000003'''
\set e_stf     '''c5000000-0000-4000-8000-000000000004'''

-- ------------------------------------------------------------ sensitive tables
select pg_temp.login(:staff);
select is((select count(*)::int from public.employee_compensation), 0, 'staff: no compensation rows');
select is((select count(*)::int from public.employee_identity), 0, 'staff: no identity rows');
select is((select count(*)::int from public.payroll_runs), 0, 'staff: no payroll runs');
select is((select count(*)::int from public.payroll_items), 0, 'staff: no payroll items');
select is((select count(*)::int from public.transactions where is_payroll), 0, 'staff: no payroll transactions');
select throws_ok($$select public.employee_compensation_history('c5000000-0000-4000-8000-000000000004')$$, '42501', null,
                 'staff cannot read their own salary history through the function');
select throws_ok($$select public.reveal_employee_identity('c5000000-0000-4000-8000-000000000004')$$, '42501', null,
                 'staff cannot reveal ID numbers');
select throws_ok($$select public.salary_certificate_data('c5000000-0000-4000-8000-000000000004')$$, '42501', null,
                 'staff cannot pull salary certificate data');
select throws_ok($$insert into public.employee_compensation (employee_id, effective_from, basic_enc)
                   values ('c5000000-0000-4000-8000-000000000004', current_date, 'x')$$, '42501', null,
                 'staff cannot write compensation directly');
reset role;

select pg_temp.login(:manager);
select is((select count(*)::int from public.employee_compensation), 0, 'manager: no compensation rows');
select is((select count(*)::int from public.employee_identity), 0, 'manager: no identity rows');
select is((select count(*)::int from public.payroll_runs), 0, 'manager: no payroll runs');
select is((select count(*)::int from public.payroll_items), 0, 'manager: no payroll items');
select is((select count(*)::int from public.transactions where is_payroll), 0, 'manager: no payroll transactions');
select throws_ok($$select * from public.payroll_run_detail((select id from public.payroll_runs limit 1))$$, '42501', null,
                 'manager cannot read a payroll run');
select throws_ok($$select public.create_payroll_run(date '2030-01-01')$$, '42501', null, 'manager cannot create a payroll run');
select is((select count(*)::int from public.employees), 5, 'manager sees every employee record');
reset role;

-- A principal without a second factor is treated as a manager.
update public.company set require_principal_mfa = true;
select pg_temp.login(:principal, 'aal1');
select is((select count(*)::int from public.employee_compensation), 0, 'principal at aal1: no compensation rows');
select throws_ok($$select public.reveal_employee_identity('c5000000-0000-4000-8000-000000000004')$$, '42501', null,
                 'principal at aal1 cannot reveal ID numbers');
reset role;
update public.company set require_principal_mfa = false;

select pg_temp.login(:principal);
select ok((select count(*) from public.employee_compensation) > 0, 'principal reads compensation rows');
select ok((select bool_and(encode(basic_enc, 'hex') like 'c30d%') from public.employee_compensation),
          'salary amounts are stored as pgp ciphertext');
select is((select basic_minor from public.employee_compensation_history('c5000000-0000-4000-8000-000000000004') limit 1),
          500000::bigint, 'principal decrypts salary history');
select ok(exists (select 1 from public.audit_log where action = 'reveal' and table_name = 'employee_compensation'
                  and row_id = 'c5000000-0000-4000-8000-000000000004'), 'reading salary history is audited');
select is((public.reveal_employee_identity('c5000000-0000-4000-8000-000000000004') ->> 'iban'), 'AE070330000000000000002',
          'principal reveals an IBAN');
select throws_ok($$select public.set_employee_identity('c5000000-0000-4000-8000-000000000004', '{"emirates_id_no":"12345"}')$$,
                 '22023', null, 'a malformed Emirates ID is rejected');
select throws_ok($$update public.payroll_items set note = 'x'$$, '42501', null,
                 'even a principal writes payroll only through the functions');
select ok((select bool_and(after ->> 'basic_enc' = '[redacted]') from public.audit_log
           where table_name = 'employee_compensation' and action = 'insert'), 'audit log never stores salary ciphertext');
select is((select count(*)::int from public.payroll_run_detail((select id from public.payroll_runs where status = 'paid'))), 2,
          'the paid run has two people on it');
select ok((select (public.salary_certificate_data('c5000000-0000-4000-8000-000000000004') ->> 'basic_minor')::bigint = 500000),
          'salary certificate data comes from the paid run');
select is(public.salary_certificate_data('c5000000-0000-4000-8000-000000000005'), null,
          'no certificate for someone never paid');
select throws_ok($$select public.create_payroll_run(date_trunc('month', current_date)::date)$$, '23505', null,
                 'one live run per month');
reset role;

-- ------------------------------------------------------------ directory, leave, checklists
select pg_temp.login(:staff);
select is((select count(*)::int from public.employees), 1, 'staff reads only their own employee record');
select is((select count(*)::int from public.people_directory()), 5, 'but sees the whole directory');
select is((select count(*)::int from public.leave_requests), 1, 'staff sees only their own leave');
select throws_ok($$insert into public.leave_requests (employee_id, kind, start_date, end_date, days)
                   values ('c5000000-0000-4000-8000-000000000003', 'annual', current_date, current_date, 1)$$,
                 '42501', null, 'staff cannot request leave for someone else');
select throws_ok($$update public.leave_requests set status = 'approved' where employee_id = 'c5000000-0000-4000-8000-000000000004'$$,
                 '42501', null, 'staff cannot approve their own leave');
update public.leave_requests set status = 'cancelled' where employee_id = 'c5000000-0000-4000-8000-000000000004' and status = 'pending';
select is((select status from public.leave_requests where employee_id = 'c5000000-0000-4000-8000-000000000004' order by created_at desc limit 1),
          'cancelled', 'staff can cancel their own pending request');
update public.checklist_items set done_at = now() where title = 'Confidentiality undertaking signed';
select is((select done_by::text from public.checklist_items where title = 'Confidentiality undertaking signed'), :staff,
          'an item owner can tick off their item');
select throws_ok($$update public.checklist_items set title = 'Renamed' where title = 'Confidentiality undertaking signed'$$,
                 '42501', null, 'but cannot rename it');
select is((select count(*)::int from public.bills), 0, 'staff: no bills');
select throws_ok($$select * from public.finance_monthly(current_date - 90, current_date)$$, '42501', null,
                 'staff cannot run the P&L');
reset role;

select pg_temp.login(:manager);
insert into public.leave_requests (employee_id, kind, start_date, end_date, days)
values ('c5000000-0000-4000-8000-000000000003', 'sick', current_date, current_date, 1);
select throws_ok($$update public.leave_requests set status = 'approved' where employee_id = 'c5000000-0000-4000-8000-000000000003' and kind = 'sick'$$,
                 '42501', null, 'a manager cannot approve their own leave');
select ok((select coalesce(sum(-amount_aed), 0) from public.finance_monthly(current_date - 60, current_date) where code = '5500') > 0,
          'manager P&L includes payroll in aggregate');
select is((select count(*)::int from public.finance_cash_monthly(current_date - 90, current_date)), 0,
          'manager gets no cash series');
select is((select account_id from public.suggest_transaction_categories(array['Emirates EK 725 DXB-DAR'])),
          (select id from public.accounts where code = '5200' and is_demo), 'rules suggest a category');

-- compliance
select throws_ok($$update public.compliance_items set status = 'upcoming', due_date = current_date + 40 where title = 'VAT registration'$$,
                 '42501', null, 'a manager cannot confirm a compliance obligation');
-- invoices
select throws_ok($$update public.invoices set total_minor = 1 where invoice_no = 'INV-DEMO-002'$$, '42501', null,
                 'an issued invoice is frozen');
insert into public.invoice_items (invoice_id, description, quantity, unit_price_minor)
select id, 'Extra day', 1, 75000 from public.invoices where invoice_no = 'INV-DEMO-003';
select is((select total_minor from public.invoices where invoice_no = 'INV-DEMO-003'), 761250::bigint,
          'draft invoice total follows its lines plus VAT');
reset role;

select pg_temp.login(:principal);
update public.compliance_items set status = 'upcoming', due_date = current_date + 40, recurrence = 'yearly' where title = 'VAT registration';
select is((select confirmed_by::text from public.compliance_items where title = 'VAT registration' and confirmed_at is not null limit 1),
          :principal, 'a principal confirms and is recorded');
update public.compliance_items set status = 'done' where title = 'VAT registration' and status = 'upcoming';
select is((select count(*)::int from public.compliance_items where title = 'VAT registration' and status = 'upcoming'
           and due_date = current_date + 40 + interval '1 year'), 1, 'completing a yearly item schedules the next one');
select ok((select count(*) from public.finance_cash_monthly(current_date - 90, current_date)) > 0, 'principal gets the cash series');

-- ------------------------------------------------------------ demo wipe keeps real facts
select lives_ok($$select public.wipe_demo_data('WIPE DEMO DATA')$$, 'demo wipe runs with phase 5 data');
select is((select count(*)::int from public.employees), 0, 'demo employees are gone');
select is((select count(*)::int from public.corporate_records where reference_no in ('7015890', '45033268', '47027560')), 3,
          'the real licence records stay');
reset role;

select * from finish();
rollback;
