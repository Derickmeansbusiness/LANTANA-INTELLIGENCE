-- Phase 6: invite-only accounts, external guests see only their data rooms,
-- room documents open through a logged two-minute window, report schedules.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

create or replace function pg_temp.login(p_sub text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.new_auth_user(p_id uuid, p_email text)
returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, '', now(),
          '{"provider":"email"}', '{}', now(), now())
$$;

\set principal '''c0000000-0000-4000-8000-000000000001'''
\set manager   '''c0000000-0000-4000-8000-000000000003'''
\set staff     '''c0000000-0000-4000-8000-000000000004'''
\set guest     '''c0000000-0000-4000-8000-000000000005'''
\set room      '''c6000000-0000-4000-8000-000000000001'''

-- ------------------------------------------------------------ invite-only accounts
select throws_ok($$select pg_temp.new_auth_user('c7000000-0000-4000-8000-000000000001', 'stranger@example.com')$$,
                 '42501', null, 'an address nobody invited cannot get an account');
select lives_ok($$select pg_temp.new_auth_user('c7000000-0000-4000-8000-000000000002', 'analyst@faminas.example')$$,
                'an invited data-room guest can sign up');
select is((select role::text from public.profiles where id = 'c7000000-0000-4000-8000-000000000002'), 'external',
          'the guest gets the external role from the invite');
select ok((select accepted_at is not null from public.user_invites where email = 'analyst@faminas.example'), 'the invite is marked accepted');
select is((select profile_id from public.data_room_members where email = 'analyst@faminas.example'),
          'c7000000-0000-4000-8000-000000000002'::uuid, 'their room membership is claimed on sign-up');

select pg_temp.login(:staff);
select throws_ok($$insert into public.user_invites (email, role) values ('newhire@example.com', 'staff')$$,
                 '42501', null, 'staff cannot invite anyone');
reset role;
select pg_temp.login(:manager);
select throws_ok($$insert into public.user_invites (email, role) values ('newhire@example.com', 'staff')$$,
                 '42501', null, 'a manager cannot invite colleagues');
select lives_ok($$insert into public.user_invites (email, role) values ('advisor@example.com', 'external')$$,
                'a manager can invite an external guest');
reset role;
select pg_temp.login(:principal);
select lives_ok($$insert into public.user_invites (email, role, full_name) values ('newhire@example.com', 'staff', 'New Hire')$$,
                'a principal can invite a colleague');
select throws_ok($$insert into public.user_invites (email, role) values ('staff@lantana.test', 'staff')$$,
                 '23505', null, 'no invite for an address that already has an account');
select throws_ok($$update public.user_invites set role = 'principal' where email = 'newhire@example.com'$$,
                 '42501', null, 'an invite''s role cannot be changed afterwards');
reset role;
select lives_ok($$select pg_temp.new_auth_user('c7000000-0000-4000-8000-000000000003', 'newhire@example.com')$$,
                'the invited colleague can sign up');
select is((select role::text from public.profiles where id = 'c7000000-0000-4000-8000-000000000003'), 'staff', 'with the invited role');

-- ------------------------------------------------------------ a room with two documents
-- Files are inserted directly (the vault upload path is covered elsewhere).
insert into public.documents (id, title, doc_type, confidentiality, status, is_demo)
values ('c8000000-0000-4000-8000-000000000001', 'Morogoro teaser', 'presentation', 'confidential', 'final', true),
       ('c8000000-0000-4000-8000-000000000002', 'Morogoro model', 'other', 'confidential', 'final', true),
       ('c8000000-0000-4000-8000-000000000003', 'Board minutes', 'other', 'restricted', 'final', true);
insert into public.document_versions (id, document_id, version_no, storage_path, file_name, mime_type, size_bytes, is_demo)
values ('c8100000-0000-4000-8000-000000000001', 'c8000000-0000-4000-8000-000000000001', 1, 'c8000000-0000-4000-8000-000000000001/x/teaser.pdf', 'teaser.pdf', 'application/pdf', 1000, true),
       ('c8100000-0000-4000-8000-000000000002', 'c8000000-0000-4000-8000-000000000002', 1, 'c8000000-0000-4000-8000-000000000002/x/model.xlsx', 'model.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 1000, true),
       ('c8100000-0000-4000-8000-000000000003', 'c8000000-0000-4000-8000-000000000003', 1, 'c8000000-0000-4000-8000-000000000003/x/minutes.pdf', 'minutes.pdf', 'application/pdf', 1000, true);
update public.documents set current_version_id = ('c8100000' || substr(id::text, 9))::uuid
where id in ('c8000000-0000-4000-8000-000000000001', 'c8000000-0000-4000-8000-000000000002', 'c8000000-0000-4000-8000-000000000003');

select pg_temp.login(:manager);
select lives_ok($$insert into public.data_room_documents (room_id, document_id) values ('c6000000-0000-4000-8000-000000000001', 'c8000000-0000-4000-8000-000000000001')$$,
                'a manager puts a PDF in the room');
select throws_ok($$insert into public.data_room_documents (room_id, document_id) values ('c6000000-0000-4000-8000-000000000001', 'c8000000-0000-4000-8000-000000000002')$$,
                 '22023', null, 'a spreadsheet cannot go in a room (it could not be watermarked)');
select throws_ok($$insert into public.data_room_members (room_id, email) values ('c6000000-0000-4000-8000-000000000001', 'staff@lantana.test')$$,
                 '22023', null, 'colleagues are not added as guests');
reset role;
select pg_temp.login(:staff);
select is((select count(*)::int from public.data_rooms), 0, 'staff do not see data rooms');
select is((select count(*)::int from public.portal_room_documents('c6000000-0000-4000-8000-000000000001')), 0,
          'or their documents');
reset role;

-- ------------------------------------------------------------ the guest's view
select pg_temp.login(:guest);
select is((select count(*)::int from public.data_rooms), 1, 'the guest sees their one room');
select is((select count(*)::int from public.data_room_members), 1, 'and only their own membership');
select is((select count(*)::int from public.documents), 0, 'no documents table rows at all');
select is((select count(*)::int from public.document_versions), 0, 'and no storage paths');
select is((select count(*)::int from public.deals) + (select count(*)::int from public.tasks)
          + (select count(*)::int from public.organizations) + (select count(*)::int from public.contracts), 0,
          'nothing from deals, tasks, partners or contracts');
select is((select count(*)::int from public.profiles), 1, 'only their own profile');
select is((select count(*)::int from public.employees) + (select count(*)::int from public.transactions)
          + (select count(*)::int from public.activity_events), 0, 'nothing from people, finance or the activity feed');
select is((select title from public.portal_room_documents('c6000000-0000-4000-8000-000000000001')), 'Morogoro teaser',
          'the room lists its document');
select is((select count(*)::int from public.open_room_document('c6000000-0000-4000-8000-000000000001', 'c8000000-0000-4000-8000-000000000003')), 0,
          'a document outside the room will not open');
select is((select count(*)::int from public.open_room_document('c6000000-0000-4000-8000-000000000001', 'c8000000-0000-4000-8000-000000000001', true)), 0,
          'no download when the room is view-only');
select is((select storage_path from public.open_room_document('c6000000-0000-4000-8000-000000000001', 'c8000000-0000-4000-8000-000000000001')),
          'c8000000-0000-4000-8000-000000000001/x/teaser.pdf', 'opening a room document returns it to the server');
select ok(private.room_object_open('c8000000-0000-4000-8000-000000000001/x/teaser.pdf'), 'and opens that file for two minutes');
select ok(not private.room_object_open('c8000000-0000-4000-8000-000000000003/x/minutes.pdf'), 'but no other file');
select throws_ok($$insert into public.data_room_events (room_id, kind) values ('c6000000-0000-4000-8000-000000000001', 'view')$$,
                 '42501', null, 'guests cannot write the view log themselves');
reset role;
select is((select count(*)::int from public.data_room_events where profile_id = 'c0000000-0000-4000-8000-000000000005' and kind = 'view'), 1,
          'the view is logged');

update public.data_rooms set status = 'closed' where id = 'c6000000-0000-4000-8000-000000000001';
select pg_temp.login(:guest);
select is((select count(*)::int from public.data_rooms), 0, 'a closed room disappears for the guest');
select ok(not private.room_object_open('c8000000-0000-4000-8000-000000000001/x/teaser.pdf'), 'and its files close immediately');
reset role;

-- ------------------------------------------------------------ report schedules
select pg_temp.login(:staff);
select is((select count(*)::int from public.report_schedules), 0, 'staff see no report schedules');
reset role;
select ok(private.run_report_schedules(date '2026-10-05') >= 1, 'a Monday notifies weekly schedules');
select is((select count(*)::int from public.notifications where kind = 'report_due'
             and user_id = 'c0000000-0000-4000-8000-000000000001'), 1, 'each recipient gets one notification');

select * from finish();
rollback;
