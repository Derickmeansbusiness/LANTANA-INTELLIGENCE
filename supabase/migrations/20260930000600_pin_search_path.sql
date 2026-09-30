-- Pin search_path on the remaining helper/trigger functions (Supabase
-- advisor 0011). Their bodies already schema-qualify every reference.
alter function private.set_updated_at() set search_path = '';
alter function private.block_mutation() set search_path = '';
alter function private.event_time() set search_path = '';
alter function private.today_dubai() set search_path = '';
alter function private.has_mfa() set search_path = '';
alter function private.introductions_guard() set search_path = '';
alter function private.deals_touch() set search_path = '';
alter function private.tasks_touch() set search_path = '';
alter function private.end_of_day(date) set search_path = '';
