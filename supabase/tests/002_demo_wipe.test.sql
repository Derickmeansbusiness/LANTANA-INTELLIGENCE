-- Demo wipe: principal-only, typed confirmation, removes every demo row,
-- keeps real rows and the audit trail. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create or replace function pg_temp.login(p_sub text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

-- a real (non-demo) record that must survive
insert into public.organizations (id, name, type, is_demo)
values ('99999999-0000-4000-8000-000000000001', 'Real Partner Ltd', 'investor', false);

select pg_temp.login('c0000000-0000-4000-8000-000000000003');
select throws_ok($$select public.wipe_demo_data('WIPE DEMO DATA')$$, '42501', null, 'manager cannot wipe');
reset role;

select pg_temp.login('c0000000-0000-4000-8000-000000000001');
select throws_ok($$select public.wipe_demo_data('yes')$$, '22023', null, 'wrong confirmation is refused');
select lives_ok($$select public.wipe_demo_data('WIPE DEMO DATA')$$, 'principal can wipe with the exact phrase');
reset role;

select is((select count(*)::int from public.deals where is_demo), 0, 'no demo deals left');
select is((select count(*)::int from public.introductions where is_demo), 0, 'demo introductions removed');
select is((select count(*)::int from public.transactions where is_demo), 0, 'demo ledger removed');
select is((select count(*)::int from public.organizations where id = '99999999-0000-4000-8000-000000000001'), 1, 'real rows survive');
select ok(exists (select 1 from public.audit_log where action = 'wipe_demo_done'), 'wipe is recorded in the audit log');
select is((select count(*)::int from public.pipeline_stages), 10, 'reference data untouched');

select * from finish();
rollback;
