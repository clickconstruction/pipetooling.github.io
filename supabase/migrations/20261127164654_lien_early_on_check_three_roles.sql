SET lock_timeout = '3s';

-- Lien desk (punch list #437, the held check, call 4): the database refuses what the screen already holds to a leader,
-- a controller and a dev.
--
-- Two things let a lien's release go before the bank has cleared the check that paid it:
--
--   * Release it anyway…, on the Release of record tab: a job_lien_filings row of kind release_of_record whose fields
--     carry releasedBeforeClearedReason, the reason the person typed.
--   * The bank confirmed the funds, on a Payoffs place card: fields.fundsConfirmed on the lien's row, { by, name, at,
--     note }. With it on the lien, the release is offered to anyone who may make one.
--
-- The screen draws both for dev, master_technician and controller alone (v2.8632 for the funds, v2.8735 for the
-- release: EARLY_ON_CHECK_ROLES in src/lib/jobs/checkCleared.ts). The table did not ask: a release is an insert under
-- job_lien_filings_insert_office and the confirmation a plain update of fields under job_lien_filings_update_office,
-- and both policies pass the whole office and a job's own leader. So an assistant with a request written by hand
-- could do either. The person's answer of 2026-11-27, asked whether the database also refuses an early lien release
-- from anyone but the three roles, and whether Release it anyway is held to the same three: "yes to 1 and 2".
--
-- One BEFORE INSERT OR UPDATE trigger on job_lien_filings holds both. For a signed-in caller who is not a dev, a
-- leader (master_technician) or a controller it refuses:
--
--   1. a release_of_record row that gains releasedBeforeClearedReason: an insert that carries the key, or an update
--      that adds it or changes its words;
--   2. any row whose fields.fundsConfirmed is set, changed or taken off: an insert that carries the key, or an update
--      where the key's value before and after differ.
--
-- A trigger and not a policy, because rule 2 has to hold the row as it was against the row as it would be, which a
-- policy's check cannot: an assistant who keeps the day a release was asked for on a lien that already carries a
-- confirmation changes fields and leaves fundsConfirmed as it was, and that update must still pass.
--
-- Everything else is as it was. Every other insert and update of the table passes the trigger untouched, for every
-- role the policies pass: a notice, an affidavit, a release with no reason, a release that went out with money still
-- open (releasedUnpaidReason, which call 4 did not ask about), a release that rests on a confirmation
-- (releasedOnConfirmedFunds, the copy the release row carries), the stamps, the sends, a void. No policy, grant,
-- column or row is changed.
--
-- A caller with no sign-in behind it passes: the service role and the edge functions that use it (the mail refresh
-- stamps sends and served_at), as users_guard_privileged_columns lets them. anon holds no policy on the table, so
-- its insert is refused after the trigger as before.
--
-- What it does not do: tell an early release from an ordinary one by itself. The database reads no bank row, so a
-- release row that leaves the reason out is an ordinary release to it. The screen is what knows a check has not
-- cleared; this file makes sure the two things the screen writes then cannot be written by anyone else.
--
-- The trigger answers a signed-in caller before the row policy is asked. It reads the new row, the old row and the
-- caller's own role, and nothing else, so its two refusals tell a caller nothing about any row.
--
-- What the push leaves on prod: one function and one trigger on job_lien_filings. No table, column, row, policy or
-- grant is made or changed. CREATE TRIGGER takes a brief lock on the table that waits behind open statements on it,
-- under the 3 s timeout. Safe to run twice.

CREATE OR REPLACE FUNCTION public.job_lien_filings_early_on_check_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- No sign-in (the service role, an edge function, postgres): allow. Edge functions gate in code.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- A leader, a dev or a controller may do both.
  IF public.is_master_or_dev() OR public.is_controller() THEN
    RETURN NEW;
  END IF;

  IF NEW.kind = 'release_of_record' AND (NEW.fields ? 'releasedBeforeClearedReason')
     AND (TG_OP = 'INSERT' OR (OLD.fields -> 'releasedBeforeClearedReason') IS DISTINCT FROM (NEW.fields -> 'releasedBeforeClearedReason')) THEN
    RAISE EXCEPTION 'Only a leader, a controller or a dev can release a lien before its check clears.' USING ERRCODE = '42501';
  END IF;

  IF (TG_OP = 'INSERT' AND (NEW.fields ? 'fundsConfirmed'))
     OR (TG_OP = 'UPDATE' AND (OLD.fields -> 'fundsConfirmed') IS DISTINCT FROM (NEW.fields -> 'fundsConfirmed')) THEN
    RAISE EXCEPTION 'Only a leader, a controller or a dev can say the bank confirmed the funds, or take that back.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$fn$;

COMMENT ON FUNCTION public.job_lien_filings_early_on_check_guard() IS
  'Lien desk (v2.8742, punch list #437 call 4): before a check clears, only a leader (master_technician), a controller or a dev may write the two things that let a release go: a release_of_record row''s releasedBeforeClearedReason, and fields.fundsConfirmed on any row (set, changed or taken off). Every other insert and update passes. A caller with no sign-in (the service role) passes. The screen holds the same three roles (EARLY_ON_CHECK_ROLES).';

REVOKE ALL ON FUNCTION public.job_lien_filings_early_on_check_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_lien_filings_early_on_check_guard ON public.job_lien_filings;
CREATE TRIGGER job_lien_filings_early_on_check_guard
  BEFORE INSERT OR UPDATE ON public.job_lien_filings
  FOR EACH ROW EXECUTE FUNCTION public.job_lien_filings_early_on_check_guard();
