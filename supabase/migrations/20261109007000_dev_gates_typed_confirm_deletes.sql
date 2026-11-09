SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 12, v2.6765: the typed confirms on the single-row deletes, rows 72, 73, 78 and
-- 79 of the audit table, every recommendation taken as written by the owner on 2026-11-08. Each door opens wider
-- behind a typed word in the client; this is the database side of the deletes only a dev could make:
--   row 73  delete a report — the owner too (the row lands in Recently deleted).
--   row 78  delete a pay report — the controller too (her report).
--   row 79  delete a submitted write-up — the owner too.
-- Row 72 (delete a supply house) needs nothing: can_manage_supply_house_directory() admits the office already.
-- Additive and idempotent: no table is created, so no fence call is owed.

DROP POLICY IF EXISTS "Owner deletes reports" ON public.reports;
CREATE POLICY "Owner deletes reports" ON public.reports FOR DELETE USING (public.is_master_or_dev());

DROP POLICY IF EXISTS "Controller deletes pay stubs" ON public.pay_stubs;
CREATE POLICY "Controller deletes pay stubs" ON public.pay_stubs FOR DELETE USING (public.is_controller());

DROP POLICY IF EXISTS "Writeups owner delete submitted" ON public.writeups;
CREATE POLICY "Writeups owner delete submitted" ON public.writeups FOR DELETE USING (public.is_master_or_dev() AND status = 'submitted');
