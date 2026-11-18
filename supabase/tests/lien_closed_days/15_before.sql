-- The windows reader as 20261113200000_lien_months_from_bill.sql left it, kept under another name before the migration
-- under test replaces it, so the scenario can ask the old body and the new one on the same rows.
-- See scripts/pgtest-lien-closed-days.sh. Never against prod.
\set ON_ERROR_STOP on
ALTER FUNCTION public.list_lien_affidavit_windows(integer) RENAME TO list_lien_affidavit_windows_before;
