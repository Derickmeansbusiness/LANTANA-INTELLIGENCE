-- Advisor 0011: pin search_path on the one Phase 3 helper that missed it.
alter function private.alert_band(integer) set search_path = '';
