-- Phase 2: stage moves, archive guard, investor matcher, recurring tasks,
-- task children, notes and interactions visibility. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

create or replace function pg_temp.login(p_sub text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

\set principal '''c0000000-0000-4000-8000-000000000001'''
\set manager   '''c0000000-0000-4000-8000-000000000003'''
\set staff     '''c0000000-0000-4000-8000-000000000004'''
\set mauritania '''d0000000-0000-4000-8000-000000000001'''
\set morogoro   '''d0000000-0000-4000-8000-000000000003'''
\set douala     '''d0000000-0000-4000-8000-000000000005'''
\set faminas    '''a0000000-0000-4000-8000-000000000002'''

-- ------------------------------------------------------------ stage moves
select pg_temp.login(:manager);
select lives_ok(format($$select public.move_deal_stage(%L, 'term_sheet', 'Faminas sent indicative terms')$$, :mauritania),
                'manager can move a deal with a note');
select throws_ok(format($$select public.move_deal_stage(%L, 'closed_won')$$, :mauritania), '22023', null,
                 'closing a deal requires a note');
select throws_ok(format($$select public.move_deal_stage(%L, 'nonsense', 'x')$$, :mauritania), '22023', null,
                 'unknown stage is rejected');
reset role;
select is((select note from public.deal_stage_history where deal_id = :mauritania order by id desc limit 1),
          'Faminas sent indicative terms', 'stage note lands on the history row');
select is((select to_stage from public.deal_stage_history where deal_id = :mauritania order by id desc limit 1),
          'term_sheet', 'history records the new stage');

select pg_temp.login(:manager);
select lives_ok(format($$select public.move_deal_stage(%L, 'closed_lost', 'Ministry chose another supplier')$$, :mauritania),
                'closing with a note works');
reset role;
select is((select probability from public.deals where id = :mauritania), 0::smallint, 'closed-lost pins probability to 0');

select pg_temp.login(:staff);
select throws_ok(format($$select public.move_deal_stage(%L, 'qualified', 'x')$$, :douala), '42501', null,
                 'staff cannot move a deal they are not assigned to');
select lives_ok(format($$select public.move_deal_stage(%L, 'term_sheet', 'IC approved DD scope')$$, :morogoro),
                'staff can move their assigned deal');
-- ---------------------------------------------------------- archive guard
select throws_ok(format($$update public.deals set deleted_at = now() where id = %L$$, :morogoro), '42501', null,
                 'staff cannot archive a deal');
reset role;

select pg_temp.login(:manager);
select lives_ok(format($$update public.deals set deleted_at = now() where id = %L$$, :douala), 'manager can archive a deal');
select lives_ok(format($$update public.deals set deleted_at = null where id = %L$$, :douala), 'manager can restore it');
reset role;
select ok(exists (select 1 from public.activity_events where entity_id = :douala and verb = 'archived'),
          'archive shows up in the activity feed');

-- ------------------------------------------------------------ matcher
select pg_temp.login(:manager);
select is((select name from public.match_investors(:douala) limit 1), 'Faminas Investment Group', 'Faminas ranks first for Douala');
select is((select score from public.match_investors(:douala) limit 1), 95, 'score = sector 40 + region 25 + ticket 30');
select ok((select already_involved from public.match_investors(:douala) limit 1), 'flags an investor already on the deal');
select is((select count(*)::int from public.match_investors('d0000000-0000-4000-8000-00000000ffff')), 0, 'unknown deal returns nothing');
reset role;

-- --------------------------------------------------------- recurring tasks
select pg_temp.login(:principal);
update public.tasks set status = 'done' where title = 'Weekly pipeline review' and recurrence_parent_id is null;
update public.tasks set status = 'todo' where title = 'Weekly pipeline review' and recurrence_parent_id is null;
update public.tasks set status = 'done' where title = 'Weekly pipeline review' and recurrence_parent_id is null;
reset role;
select is((select count(*)::int from public.tasks where title = 'Weekly pipeline review'), 2,
          'completing a recurring task creates exactly one next occurrence, even if re-completed');
select is((select c.due_date - p.due_date from public.tasks c join public.tasks p on p.id = c.recurrence_parent_id
           where c.title = 'Weekly pipeline review'), 7, 'next occurrence is due a week later');
select throws_ok($$insert into public.tasks (title, recurrence_rule) values ('x', 'every tuesday')$$, '23514', null,
                 'recurrence rule format is enforced');

-- ------------------------------------------------ children follow parents
select pg_temp.login(:staff);
select is((select count(*)::int from public.task_comments c join public.tasks t on t.id = c.task_id where t.deal_id = :douala), 0,
          'staff cannot read comments on tasks they cannot see');
select is((select count(*)::int from public.notes where entity_type = 'organization' and entity_id = :faminas), 1,
          'staff sees notes on an organization linked to their deal');
select is((select count(*)::int from public.interactions where deal_id = :douala), 0, 'staff cannot see interactions on other deals');
select throws_ok(format($$insert into public.notes (entity_type, entity_id, body) values ('deal', %L, 'hi')$$, :douala), '42501', null,
                 'staff cannot write notes on a deal they cannot see');
reset role;

-- ------------------------------------------------------ chain verification
select pg_temp.login(:staff);
select throws_ok($$select * from public.verify_introductions_chain(true)$$, '42501', null, 'staff cannot run chain verification');
reset role;
select pg_temp.login(:manager);
select ok((select ok from public.verify_introductions_chain(true)), 'manager verifies the full demo chain');
select lives_ok($$insert into public.introductions (introduced_on, party_a_org_id, party_b_org_id, channel, summary, row_hash, is_demo)
                  values (current_date, 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'email', 'pgTAP entry', '', true)$$,
                'manager can append to the ledger');
reset role;

select * from finish();
rollback;
