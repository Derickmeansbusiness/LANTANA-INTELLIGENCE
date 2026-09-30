-- Phase 3: document visibility (tables + storage), chunks and search,
-- versions + check-out, share links, obligations → tasks, expiry alerts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

create or replace function pg_temp.login(p_sub text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

\set principal '''c0000000-0000-4000-8000-000000000001'''
\set manager   '''c0000000-0000-4000-8000-000000000003'''
\set staff     '''c0000000-0000-4000-8000-000000000004'''
\set doc_pjm   '''f0000000-0000-4000-8000-000000000001'''
\set doc_fam   '''f0000000-0000-4000-8000-000000000002'''
\set doc_pre   '''f0000000-0000-4000-8000-000000000006'''
\set k_pjm     '''e0000000-0000-4000-8000-000000000001'''

-- ------------------------------------------------------- visibility
select pg_temp.login(:staff);
select ok(exists (select 1 from public.documents where id = :doc_pjm), 'staff sees a confidential doc linked to their deal');
select ok(not exists (select 1 from public.documents where id = :doc_fam), 'staff does not see other confidential docs');
select ok(exists (select 1 from public.documents where id = :doc_pre), 'staff sees public docs');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('documents', %L)$$, :doc_fam || '/v1/x.pdf'),
  '42501', null, 'staff cannot upload into a document they cannot see');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('documents', 'not-a-uuid/v1/x.pdf')$$,
  '42501', null, 'storage rejects paths that are not a document id');
reset role;

-- --------------------------------------------------- versions + checkout
select pg_temp.login(:manager);
insert into public.document_versions (document_id, version_no, storage_path, file_name, mime_type)
values (:doc_fam, 99, :doc_fam || '/v1/mandate.pdf', 'mandate.pdf', 'application/pdf');
select is((select version_no from public.document_versions where document_id = :doc_fam order by version_no desc limit 1), 1,
          'version numbers are assigned by the database, not the caller');
select is((select current_version_id from public.documents where id = :doc_fam),
          (select id from public.document_versions where document_id = :doc_fam and version_no = 1), 'new version becomes current');
reset role;

select pg_temp.login(:principal);
update public.documents set checked_out_by = auth.uid() where id = :doc_fam;
reset role;
select pg_temp.login(:manager);
select throws_ok(
  format($$insert into public.document_versions (document_id, version_no, storage_path, file_name) values (%L, 0, 'x', 'x')$$, :doc_fam),
  '42501', null, 'cannot upload a version while someone else has it checked out');
reset role;
select pg_temp.login(:principal);
update public.documents set checked_out_by = null where id = :doc_fam;
reset role;

-- ------------------------------------------------------ chunks + search
select pg_temp.login(:manager);
insert into public.document_chunks (document_id, version_id, ordinal, content)
select :doc_fam, current_version_id, 0, 'The non-circumvention obligations survive for twenty-four months after termination.'
from public.documents where id = :doc_fam;
select is((select document_id from public.search_documents('survive termination') limit 1), :doc_fam::uuid, 'full-text search finds the clause');
select ok((select snippet from public.search_documents('survive termination') limit 1) like '%«survive»%', 'snippet highlights the match');
reset role;
select pg_temp.login(:staff);
select is((select count(*)::int from public.search_documents('survive termination') where document_id = :doc_fam), 0,
          'search never returns documents the caller cannot see');
select is((select count(*)::int from public.document_chunks where document_id = :doc_fam), 0, 'staff cannot read those chunks');
reset role;

-- ----------------------------------------------------------- share links
select pg_temp.login(:manager);
insert into public.document_share_links (document_id, version_id, token_hash, recipient_name, expires_at, max_views)
select :doc_fam, current_version_id, encode(extensions.digest('test-token-abcdefghijklmnop', 'sha256'), 'hex'), 'Faminas legal', now() + interval '7 days', 2
from public.documents where id = :doc_fam;
select throws_ok(
  format($$insert into public.document_share_links (document_id, version_id, token_hash, recipient_name, expires_at)
           select %L, current_version_id, 'h2', 'X', now() + interval '60 days' from public.documents where id = %L$$, :doc_fam, :doc_fam),
  '23514', null, 'links cannot live longer than 31 days');
select throws_ok(
  $$update public.document_share_links set expires_at = expires_at + interval '1 day' where recipient_name = 'Faminas legal'$$,
  '42501', null, 'links cannot be extended');
reset role;

set local role anon;
select is((select ok from public.open_share_link('test-token-abcdefghijklmnop', 'iphash', 'test')), true, 'anon opens a valid link');
select is((select storage_path from public.open_share_link('test-token-abcdefghijklmnop')), :doc_fam || '/v1/mandate.pdf', 'returns the pinned version');
select is((select reason from public.open_share_link('test-token-abcdefghijklmnop')), 'limit', 'max views is enforced');
select is((select count(*)::int from public.open_share_link('wrong-token-abcdefghijklmnop')), 0, 'unknown token returns nothing');
select throws_ok($$select * from public.documents$$, '42501', null, 'anon still cannot read tables');
reset role;
select is((select count(*)::int from public.document_share_views v join public.document_share_links l on l.id = v.link_id
           where l.recipient_name = 'Faminas legal'), 3, 'every attempt is logged, including refused ones');

select pg_temp.login(:manager);
update public.document_share_links set revoked_at = now() where recipient_name = 'Faminas legal';
select throws_ok($$update public.document_share_links set revoked_at = null where recipient_name = 'Faminas legal'$$, '42501', null,
                 'a revoked link cannot be re-opened');
reset role;
set local role anon;
select is((select reason from public.open_share_link('test-token-abcdefghijklmnop')), 'revoked', 'revoked links refuse');
reset role;

select pg_temp.login(:manager);
update public.documents set confidentiality = 'restricted' where id = :doc_pre;
select throws_ok(
  format($$insert into public.document_share_links (document_id, version_id, token_hash, recipient_name, expires_at)
           values (%L, %L, 'h3', 'X', now() + interval '1 day')$$, :doc_pre, (select id from public.document_versions limit 1)),
  '42501', null, 'managers cannot share restricted documents');
reset role;

-- ------------------------------------------------ obligations → tasks
select pg_temp.login(:manager);
insert into public.contract_obligations (contract_id, description, due_date) values (:k_pjm, 'Send quarterly pipeline update', current_date + 20);
reset role;
select ok(exists (select 1 from public.tasks where title = 'Obligation: Send quarterly pipeline update' and source = 'contract_obligation'
                  and contract_id = :k_pjm and assignee_id = 'c0000000-0000-4000-8000-000000000002'),
          'an obligation with a date becomes a task for the contract owner');
select ok((select task_id is not null from public.contract_obligations where description = 'Send quarterly pipeline update'), 'obligation links to its task');

-- ------------------------------------------------------------ alerts
select ok(private.run_expiry_alerts() > 0, 'the alert run sends notifications');
select is(private.run_expiry_alerts(), 0, 'a second run the same day sends nothing new');
select ok(exists (select 1 from public.notifications where kind = 'notice_deadline'
                  and user_id = 'c0000000-0000-4000-8000-000000000001' and title like 'Mandate & Non-Circumvention%'),
          'principals are told about the Faminas notice deadline');
select ok(not exists (select 1 from public.notifications where kind = 'notice_deadline' and user_id = 'c0000000-0000-4000-8000-000000000004'),
          'staff are not sent contract alerts they cannot open');
select pg_temp.login(:staff);
select throws_ok($$select public.run_expiry_alerts_now()$$, '42501', null, 'staff cannot trigger the alert run');
reset role;
select ok(exists (select 1 from cron.job where jobname = 'lantana-expiry-alerts' and schedule = '15 3 * * *'), 'alerts are scheduled daily at 07:15 Dubai');

select * from finish();
rollback;
