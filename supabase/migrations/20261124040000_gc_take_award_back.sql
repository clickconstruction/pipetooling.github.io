SET lock_timeout = '3s';

-- GC mode, the Board (v2.8434): taking an award back. gc_award (20261009140000, restated with its flag by the award
-- guard, 20261010025000) writes a trade's award and drafts its statement of work, and gc_trade_packages_award_guard
-- lets a signed-in person change the three award columns only inside gc_award. Nothing took an award back: one made
-- on the wrong company, or on a test trade (punch list #416's walk 1a), stayed for good, since a dev's plain UPDATE is
-- refused too. The owner's word of 2026-11-24: build the tool to unaward.
--
--   * gc_take_award_back(p_package_id) is gc_award's mirror: the same gate (whoever may award may take it back, a dev
--     while GC mode is built, so call W changes both first checks together), the same gc.award_write flag around its
--     UPDATE, one transaction. It clears awarded_invite_id, awarded_by and awarded_on.
--   * The statement of work gc_award drafted goes with the award while it is still a draft with nothing on it: the row
--     and its lines (the paper picked for it is a column of the draft). One that was sent or signed, or that anything
--     stands on, is never deleted here: the function refuses first, in words naming what is in the way and where it
--     is. What can stand on a statement of work: a pay application (gc_draws), a back charge, a change the trade asked
--     for, a change order sent to the trade or signed into a line, the trade's report of work in place, a bill day's
--     answer. What can stand on the award itself, which names the company on the trade: a paper sent for the trade
--     (gc_paper_sends), the trade's submittals, an RFI the company asked on it, a day the company gave us for it. Left
--     behind, those would read as the next company's the day the trade is awarded again.
--   * Everything else reads the award live from the three columns (the board, the send card of a sheet, our number's
--     carry, the scorecard, the trade's portal), so it reads right once they are null. The trade goes back to what it
--     carried: carried_invite_id and carry_budget were never touched by the award.
--   * The trace. An award is recorded only in the columns this clears, and it shows in the company's Activity as a
--     line read from them. So the undo writes a line of the company's own on its call log (gc_company_contacts with no
--     ask, how 'note'), which that same Activity shows: the trade and the job, the day it was awarded, who awarded it
--     and the price, and that it was taken back, by whom (by_user_id, by_name) and when (contacted_on). A note on the
--     ask itself would be kept and shown nowhere: the board's kernels leave an ask's notes out of its story.
--   * SECURITY INVOKER, as gc_award: a dev's policies cover every table it reads and writes. The read-only, twin and
--     archived fences hold as on any write, and each is refused first in its own words: the read-only fence hides the
--     trade from a row lock, so a training dev would otherwise read "No trade with that id." No table is made, so no fence call. CREATE OR REPLACE, so
--     the push is idempotent. The guard and gc_award are not restated.

CREATE OR REPLACE FUNCTION public.gc_take_award_back(p_package_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v record;
  v_sow public.gc_sows%ROWTYPE;
  v_hold text;
  v_by text;
  v_awarded text;
BEGIN
  -- Who may take an award back: whoever may award (call W, the owner's). A dev while GC mode is built.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev takes an award back while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;
  -- The fences would stop these at the first write, or hide the trade from the lock below so the refusal read "No
  -- trade with that id." Each is said here in its own words instead.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot take an award back.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot take an award back.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot take an award back.' USING ERRCODE = '42501';
  END IF;
  SELECT k.id, k.trade, k.awarded_invite_id, k.awarded_by, k.awarded_on, i.company_id, c.name AS company, p.name AS project
  INTO v
  FROM public.gc_trade_packages k
  JOIN public.projects p ON p.id = k.project_id
  LEFT JOIN public.gc_invites i ON i.id = k.awarded_invite_id
  LEFT JOIN public.gc_companies c ON c.id = i.company_id
  WHERE k.id = p_package_id
  FOR UPDATE OF k;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.awarded_invite_id IS NULL THEN
    RAISE EXCEPTION '% is not awarded.', v.trade USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_sow FROM public.gc_sows s WHERE s.package_id = p_package_id FOR UPDATE;

  -- The first thing found names the refusal: the statement of work's own step, then what stands on it, then what
  -- stands on the award. Each says where it is.
  v_hold := CASE
    WHEN v_sow.status = 'signed' THEN format('they signed the statement of work on %s. A signed statement of work changes through Change orders on the job''s card.',
      coalesce(to_char(v_sow.signed_on, 'Mon FMDD'), 'an earlier day'))
    WHEN v_sow.status = 'sent' THEN format('the statement of work went to them to sign on %s. Nothing takes a sent statement of work back yet.',
      coalesce(to_char(v_sow.sent_on, 'Mon FMDD'), 'an earlier day'))
    WHEN v_sow.id IS NOT NULL AND v_sow.status <> 'draft' THEN 'its statement of work is not a draft any more.'
    WHEN EXISTS (SELECT 1 FROM public.gc_draws d WHERE d.sow_id = v_sow.id)
      THEN 'they sent a pay application on it. Open Draws on the job''s card.'
    WHEN EXISTS (SELECT 1 FROM public.gc_back_charges b WHERE b.sow_id = v_sow.id)
      THEN 'a back charge is on it. Open Draws on the job''s card.'
    WHEN EXISTS (SELECT 1 FROM public.gc_trade_change_requests q WHERE q.sow_id = v_sow.id)
      THEN 'they asked for a change on it. Open Change orders on the job''s card.'
    WHEN EXISTS (SELECT 1 FROM public.gc_change_order_trade_sends t WHERE t.sow_id = v_sow.id)
      OR EXISTS (SELECT 1 FROM public.gc_sow_lines l WHERE l.sow_id = v_sow.id AND l.change_order_id IS NOT NULL)
      THEN 'a change order went to them on it. Open Change orders on the job''s card.'
    WHEN EXISTS (SELECT 1 FROM public.gc_sow_line_reports r JOIN public.gc_sow_lines l ON l.id = r.sow_line_id WHERE l.sow_id = v_sow.id)
      THEN 'they reported work in place on it. Open Draws on the job''s card.'
    WHEN EXISTS (SELECT 1 FROM public.gc_bill_day_nothing n WHERE n.sow_id = v_sow.id)
      THEN 'they answered a bill day on it. Open Bill day on the job''s card.'
    WHEN EXISTS (SELECT 1 FROM public.gc_paper_sends p WHERE p.package_id = p_package_id AND p.company_id = v.company_id)
      THEN 'a paper for this trade went to them. Open the company on Trade partners.'
    WHEN EXISTS (SELECT 1 FROM public.gc_submittals s WHERE s.package_id = p_package_id)
      THEN 'the trade has submittals. Open Submittals on the job''s card.'
    WHEN EXISTS (SELECT 1 FROM public.gc_rfis r WHERE r.package_id = p_package_id AND r.asked_by_company_id = v.company_id)
      THEN 'they asked an RFI on it. Open RFIs on the job''s card.'
    WHEN EXISTS (SELECT 1 FROM public.gc_trade_promises p WHERE p.package_id = p_package_id AND p.company_id = v.company_id)
      THEN 'they gave us a day for this trade. Open the company on Trade partners.'
    ELSE NULL
  END;
  IF v_hold IS NOT NULL THEN
    RAISE EXCEPTION '% stays awarded to %, since %', v.trade, v.company, v_hold USING ERRCODE = 'P0001';
  END IF;

  -- The trace's words are read before the award goes.
  SELECT u.name INTO v_awarded FROM public.users u WHERE u.id = v.awarded_by;
  SELECT u.name INTO v_by FROM public.users u WHERE u.id = auth.uid();

  -- The draft goes with the award: the row, and its lines by cascade. The checks above found nothing else on it.
  DELETE FROM public.gc_sows WHERE id = v_sow.id;

  PERFORM set_config('gc.award_write', 'on', true);
  UPDATE public.gc_trade_packages
  SET awarded_invite_id = NULL, awarded_by = NULL, awarded_on = NULL
  WHERE id = p_package_id;
  PERFORM set_config('gc.award_write', '', true);

  INSERT INTO public.gc_company_contacts (company_id, contacted_on, by_name, how, note)
  VALUES (
    v.company_id, public.app_today(), coalesce(v_by, ''), 'note',
    'Award taken back on ' || v.trade || ', ' || v.project || '. Awarded ' || coalesce(to_char(v.awarded_on, 'Mon FMDD'), 'an earlier day')
      || CASE WHEN coalesce(v_awarded, '') <> '' THEN ' by ' || v_awarded ELSE '' END
      || CASE WHEN v_sow.id IS NOT NULL THEN ' for $' || to_char(round(v_sow.price), 'FM999,999,999,990') || '. The drafted statement of work went with it.' ELSE '.' END
  );
END;
$$;

COMMENT ON FUNCTION public.gc_take_award_back(uuid) IS
  'GC mode (v2.8434): take a trade''s award back, gc_award''s mirror, dev only until call W. Refuses a training account, a digital twin and an archived caller in words, a trade not awarded, and in words a statement of work that was sent or signed or that a pay application, a back charge, a change request, a change order, a report of work or a bill day answer stands on, and an award a paper send, a submittal, the company''s RFI or its promise stands on. Else deletes the drafted statement of work with its lines, clears the award under gc.award_write, and writes the undo on the company''s own call log (gc_company_contacts with no ask, how note), which its Activity shows, with who and when. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_take_award_back(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_take_award_back(uuid) TO authenticated;

COMMENT ON COLUMN public.gc_trade_packages.awarded_invite_id IS
  'GC mode (B6-a, v2.4934): the ask whose quote this trade is awarded to. Written by gc_award and cleared by gc_take_award_back (v2.8434) only, with awarded_by and awarded_on; gc_trade_packages_award_guard holds the three (v2.5100).';
