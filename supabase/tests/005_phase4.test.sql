-- Phase 4: agent threads are private, proposals are decided once, usage
-- visibility, clause reviews are management-only, nightly scan and digest.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

create or replace function pg_temp.login(p_sub text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

\set principal '''c0000000-0000-4000-8000-000000000001'''
\set manager   '''c0000000-0000-4000-8000-000000000003'''
\set staff     '''c0000000-0000-4000-8000-000000000004'''
\set k_fam     '''e0000000-0000-4000-8000-000000000002'''

-- ------------------------------------------------------------ threads
select pg_temp.login(:staff);
insert into public.agent_threads (id, title) values ('a9000000-0000-4000-8000-000000000001', 'Staff question');
insert into public.agent_messages (thread_id, role, content)
values ('a9000000-0000-4000-8000-000000000001', 'user', '[{"type":"text","text":"What is due today?"}]');
select is((select count(*)::int from public.agent_messages where thread_id = 'a9000000-0000-4000-8000-000000000001'), 1,
          'staff reads their own conversation');
select throws_ok(
  $$insert into public.agent_threads (user_id, title) values ('c0000000-0000-4000-8000-000000000003', 'spoofed')$$,
  '42501', null, 'nobody can open a thread in someone else''s name');
reset role;

select pg_temp.login(:manager);
select is((select count(*)::int from public.agent_threads where id = 'a9000000-0000-4000-8000-000000000001'), 0,
          'a manager cannot read a staff member''s thread');
select is((select count(*)::int from public.agent_messages where thread_id = 'a9000000-0000-4000-8000-000000000001'), 0,
          'or its messages');
select throws_ok(
  $$insert into public.agent_messages (thread_id, role, content) values ('a9000000-0000-4000-8000-000000000001', 'user', '[]')$$,
  '42501', null, 'or write into it');
reset role;

-- ------------------------------------------------------------ proposals
select pg_temp.login(:staff);
insert into public.agent_actions (id, thread_id, tool, summary, payload)
values ('a9000000-0000-4000-8000-0000000000a1', 'a9000000-0000-4000-8000-000000000001', 'create_task',
        'Create task: call PJM', '{"title":"Call PJM"}');
select throws_ok(
  $$insert into public.agent_actions (tool, summary, payload, status) values ('create_task', 'x', '{}', 'executed')$$,
  '42501', null, 'an action cannot be inserted as already executed');
select throws_ok(
  $$update public.agent_actions set payload = '{"title":"Something else"}' where id = 'a9000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'a proposal''s payload cannot be edited');
update public.agent_actions set status = 'executed', result = '{"id":"x"}' where id = 'a9000000-0000-4000-8000-0000000000a1';
select isnt((select executed_at from public.agent_actions where id = 'a9000000-0000-4000-8000-0000000000a1'), null,
            'executing stamps executed_at');
select throws_ok(
  $$update public.agent_actions set status = 'rejected' where id = 'a9000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'a decided proposal cannot be decided again');
reset role;

select pg_temp.login(:manager);
select is_empty($$update public.agent_actions set status = 'rejected' where id = 'a9000000-0000-4000-8000-0000000000a1' returning id$$,
                'someone else cannot decide your proposal');
reset role;
select ok(exists (select 1 from public.audit_log where table_name = 'agent_actions'
                  and row_id = 'a9000000-0000-4000-8000-0000000000a1' and action = 'update'),
          'deciding a proposal is audited');

-- ------------------------------------------------------------ usage
select pg_temp.login(:staff);
insert into public.agent_usage (kind, model, input_tokens, output_tokens) values ('chat', 'test-model', 1200, 300);
reset role;
select pg_temp.login(:manager);
insert into public.agent_usage (kind, model, input_tokens, output_tokens) values ('chat', 'test-model', 500, 100);
select is((select count(*)::int from public.agent_usage), 1, 'a manager sees only their own usage');
reset role;
select pg_temp.login(:principal);
select is((select count(*)::int from public.agent_usage), 2, 'a principal sees everyone''s usage');
select is((select sum(input_tokens)::int from public.agent_usage_month), 1700, 'monthly view sums this month');
reset role;

-- ------------------------------------------------------------ briefings
select pg_temp.login(:principal);
insert into public.briefings (content) values ('Morning.');
select throws_ok($$insert into public.briefings (content) values ('Again.')$$, '23505', null, 'one briefing per person per day');
reset role;
select pg_temp.login(:manager);
select is((select count(*)::int from public.briefings), 0, 'briefings are private to their reader');
reset role;

-- ------------------------------------------------------------ clause reviews
select pg_temp.login(:staff);
select throws_ok(
  format($$insert into public.clause_reviews (contract_id, template_id, summary) values (%L, 'mandate', 'x')$$, :k_fam),
  '42501', null, 'staff cannot run clause reviews');
reset role;
select pg_temp.login(:manager);
insert into public.clause_reviews (contract_id, template_id, summary, findings)
values (:k_fam, 'mandate', 'Two departures from the standard mandate.', '[{"clause":"Disputes","severity":"high"}]');
select is((select count(*)::int from public.clause_reviews where contract_id = :k_fam), 1, 'managers record clause reviews');
reset role;

-- ------------------------------------------------------------ nightly scan + digest
select pg_temp.login(:staff);
select throws_ok($$select public.run_nightly_scan_now()$$, '42501', null, 'staff cannot run the nightly scan');
reset role;
select ok(private.run_nightly_scan() > 0, 'the scan raises notifications for overdue work');
select is(private.run_nightly_scan(), 0, 'running it again sends nothing new');
select ok(exists (select 1 from public.notifications where kind = 'invoice_overdue'
                  and user_id = 'c0000000-0000-4000-8000-000000000003'), 'unpaid invoices go to managers');
select ok(not exists (select 1 from public.notifications where kind = 'invoice_overdue'
                      and user_id = 'c0000000-0000-4000-8000-000000000004'), 'and not to staff');
select is(private.run_weekly_digest(), (select count(*)::int from public.profiles where is_active and role in ('principal', 'manager', 'staff')),
          'the Monday digest reaches every active person once');
select is(private.run_weekly_digest(), 0, 'and only once per week');

select * from finish();
rollback;
