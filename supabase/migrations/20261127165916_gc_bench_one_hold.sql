SET lock_timeout = '3s';

-- Trade partners: one hold, read by the Remove press's function and by the list (punch list #443's finding 338,
-- part 2; v2.8747).
--
-- gc_remove_bench_company (20261109004500, its words mended by 20261124153500) refuses a company with history, and
-- names the first piece it finds out of eleven kinds. The screen drew the press from a rule of its own
-- (benchRemoveHold in src/lib/gc/benchRemove.ts) that counts eight: it cannot see a file from the company's portal,
-- an email we sent them or a Messages thread, since those tables are not the list's to read. So the press showed on
-- a company the function would refuse every time: the walk of 2026-11-27 pressed it on a test company that had been
-- emailed once and was answered "stays on the bench, since we emailed them". The person's answer the same day, asked
-- for one hold that both the function and the list read so the press shows only where it would work: "Picks stand"
-- (the pick was yes).
--
-- Three functions:
--
--   1. gc_bench_company_hold(p_company_id) is the hold by itself: the CASE lifted out of gc_remove_bench_company
--      byte for byte, every check in its order and every reason in its words. It answers the reason, or NULL for a
--      company with no history (and for an id that is no company). A definer's function, since the history tables
--      read under narrower policies than the office's. Executable by nobody: only the two functions below call it,
--      as their owner, so it is not a door of its own.
--   2. gc_remove_bench_company(p_company_id) is restated from 20261124153500 with its CASE replaced by one call of
--      the hold. Its doors, its refusals' words, the prospect going back on the lane, the delete and its fallback
--      are as they were. Same signature, so its grants stay; they are restated all the same.
--   3. gc_bench_holds() is the list's read: one row a company on the bench, its id and its hold, NULL where the
--      press would work. For the office team alone (gc_office_team()), the people the table's own policy lets read
--      the bench. Anyone else, a digital twin and an archived caller read no row: a definer passes the twin fence
--      and the archived seal, so each is said here. A training account reads it, as it reads the bench; the remove
--      itself still refuses it. It answers the reason's words and nothing else: no row of any history table, no
--      count, no date.
--
-- What a caller can learn from the list's read: for a company it can already see, which of eleven kinds of history
-- comes first. Three of those the office could not see before on this screen: that a file came from the portal, that
-- we emailed them, that a Messages thread stands. Each is the office's own work, and the remove's refusal already
-- said the same words on a press.
--
-- The client is not changed here. Until it reads gc_bench_holds() the screen draws the press by its own rule as
-- before, and the function refuses as before. The client's step comes after the push, since it calls a function
-- only this migration creates.
--
-- What the push leaves on prod: two new functions and one replaced. No table, column, row, policy or trigger is made
-- or changed, and no table is locked. Safe to run twice.

-- The order below: the remove first, then the hold it calls, then the list's read. A plpgsql body is not checked
-- for the functions it names when it is made, so the remove may come first; the list's read is a SQL function, which
-- is checked, so the hold comes before it. The remove leads so that its words can still be read from its definition
-- down, as src/lib/gc/benchRemove.test.ts reads them.

CREATE OR REPLACE FUNCTION public.gc_remove_bench_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_hold text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to remove a company from the bench.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office removes a company from the bench.' USING ERRCODE = '42501';
  END IF;
  -- A definer passes the read-only blocks, the twin fence and the archived seal, so each is said here before the write.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot remove a company from the bench.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot remove a company from the bench.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot remove a company from the bench.' USING ERRCODE = '42501';
  END IF;

  SELECT c.name INTO v_name FROM public.gc_companies c WHERE c.id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That company is not on the bench.' USING ERRCODE = 'P0001';
  END IF;

  -- The hold is the one the list reads too (gc_bench_company_hold, below): the first piece of history found,
  -- in the order the office would miss it.
  v_hold := public.gc_bench_company_hold(p_company_id);
  IF v_hold IS NOT NULL THEN
    RAISE EXCEPTION '% stays on the bench, since %.', v_name, v_hold USING ERRCODE = 'P0001';
  END IF;

  -- The sub it came from, if any, goes back on the lane with a note on its card.
  WITH back AS (
    UPDATE public.prospects
    SET prospect_fit_status = CASE WHEN prospect_fit_status = 'converted' THEN NULL ELSE prospect_fit_status END,
        converted_gc_company_id = NULL
    WHERE converted_gc_company_id = p_company_id
    RETURNING id
  )
  INSERT INTO public.prospect_comments (prospect_id, created_by, comment_text, interaction_type)
  SELECT back.id, auth.uid(), format('Removed from the bench: %s. Back on the Subs lane to call.', v_name), 'user_comment'
  FROM back;

  BEGIN
    DELETE FROM public.gc_companies WHERE id = p_company_id;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION '% stays on the bench, since they have a record on a job.', v_name USING ERRCODE = 'P0001';
  END;
END;
$$;

COMMENT ON FUNCTION public.gc_remove_bench_company(uuid) IS
  'Trade partners (v2.6749, punch list #153; an email we sent said as ours since v2.8491; the hold read from gc_bench_company_hold since v2.8747): Remove from the bench on a company with no history. Refuses in words when the company holds a work order, an ask, a logged contact, a promise, a paper, a file from their portal, an email we sent them, a Messages thread, a vetting form or an opened portal; else puts the sub it came from back on Prospects → Subs with a note and deletes the row (the people on it cascade). SECURITY DEFINER: the office team (gc_office_team()); a training account, a digital twin and an archived caller are refused first.';
REVOKE ALL ON FUNCTION public.gc_remove_bench_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_remove_bench_company(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gc_bench_company_hold(p_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- The first piece of history found names the hold, in the order the office would miss it.
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.gc_sows s WHERE s.company_id = p_company_id) THEN 'they hold a work order with us'
    WHEN EXISTS (SELECT 1 FROM public.gc_invites i WHERE i.company_id = p_company_id) THEN 'they were asked to quote'
    WHEN EXISTS (SELECT 1 FROM public.gc_company_contacts x WHERE x.company_id = p_company_id) THEN 'a contact is logged on them'
    WHEN EXISTS (SELECT 1 FROM public.gc_trade_promises p WHERE p.company_id = p_company_id) THEN 'they gave us a promise'
    WHEN EXISTS (SELECT 1 FROM public.gc_paper_sends p WHERE p.company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.person_contract_documents d WHERE d.company_id = p_company_id) THEN 'papers went to them or came in'
    WHEN EXISTS (SELECT 1 FROM public.gc_trade_files f WHERE f.company_id = p_company_id) THEN 'they sent us a file from their portal'
    WHEN EXISTS (SELECT 1 FROM public.gc_trade_messages m WHERE m.company_id = p_company_id) THEN 'we emailed them'
    WHEN EXISTS (SELECT 1 FROM public.contacts t WHERE t.gc_company_id = p_company_id) THEN 'they have a Messages thread'
    WHEN EXISTS (SELECT 1 FROM public.gc_company_vetting_forms v WHERE v.company_id = p_company_id) THEN 'they sent us their form'
    WHEN (SELECT c.portal_opened_on FROM public.gc_companies c WHERE c.id = p_company_id) IS NOT NULL THEN 'they opened their portal'
    WHEN EXISTS (SELECT 1 FROM public.gc_rfis r WHERE r.asked_by_company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.gc_back_charges b WHERE b.company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.gc_trade_change_requests q WHERE q.company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.gc_sow_line_reports l WHERE l.company_id = p_company_id) THEN 'they have a record on a job'
    ELSE NULL
  END
$$;

COMMENT ON FUNCTION public.gc_bench_company_hold(uuid) IS
  'Trade partners (v2.8747, punch list #443): why a company stays on the bench, as the first piece of history found: a work order, an ask, a logged contact, a promise, a paper, a file from their portal, an email we sent them, a Messages thread, a vetting form, an opened portal or a record on a job. NULL when it holds none. The one hold gc_remove_bench_company and gc_bench_holds both read. SECURITY DEFINER and executable by nobody: only those two call it, as their owner.';
REVOKE ALL ON FUNCTION public.gc_bench_company_hold(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gc_bench_holds()
RETURNS TABLE (company_id uuid, hold text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, public.gc_bench_company_hold(c.id)
  FROM public.gc_companies c
  WHERE auth.uid() IS NOT NULL
    AND public.gc_office_team()
    AND NOT public.is_digital_twin()
    AND NOT public.caller_is_archived()
$$;

COMMENT ON FUNCTION public.gc_bench_holds() IS
  'Trade partners (v2.8747, punch list #443): the list''s read of the hold. One row a company on the bench: its id and why it stays (gc_bench_company_hold), NULL where Remove from the bench would work. The reason''s words and nothing else. SECURITY DEFINER: the office team (gc_office_team()) reads it; anyone else, a digital twin and an archived caller read no row.';
REVOKE ALL ON FUNCTION public.gc_bench_holds() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_bench_holds() TO authenticated;
