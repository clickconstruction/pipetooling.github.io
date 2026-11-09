SET lock_timeout = '3s';

-- The bench's Remove press (punch list #153, v2.6749; to-dos/subs-bench-board/README.md → Where it stands). Until now
-- no screen took a company off Trade partners: the row offered the ask's Will not do it and Cannot do it, the vetting's
-- Decline kept the company listed, and a test company the 2026-10-24 walk put on the bench sat there for a dev to delete
-- by hand. The owner's word of 2026-11-08: a company with no history leaves in one press behind a confirm; a company
-- with any history stays, and only the ask's presses speak for it.
--
--   * gc_remove_bench_company(p_company_id) holds the rule where a stale page cannot bend it. The office team already
--     has FOR ALL on gc_companies (door 2, 20261009040000), so a plain DELETE would go through today and CASCADE the
--     company's asks (gc_invites), its call log (gc_company_contacts), its promises and its paper sends with it: the
--     history the rule exists to keep. So the client never deletes; it calls this, which looks at every table that
--     holds a company's history and refuses in words naming the first it finds (a work order, an ask, a logged
--     contact, a promise, a paper, a file or a message from their portal, a Messages thread, their vetting form, an
--     opened portal), and only then deletes the row. What cascades after the checks is the record itself: the people
--     on it, a portal link never opened, a bid-tab view no ask could have left. The tables that RESTRICT (a work
--     order's reports, an RFI, a back charge, a change request) are the same history, so a violation past the checks
--     is said in the same words instead of a constraint name.
--   * A sub that came from Prospects → Subs goes back on the lane: its prospect_fit_status leaves 'converted' (the FK
--     would null converted_gc_company_id on its own; the update does it first so the comment can name the card) and
--     the card gets a dated note, so the deck shows it to call again with its calls still on it.
--   * SECURITY DEFINER, since the history tables read under narrower policies than the office's (the Messages spine's
--     contacts, person_contract_documents, gc_trade_files). The door is gc_office_team(), said in words; a training
--     account, a digital twin and an archived caller are refused first, since a definer passes their fences.
--   * No table is made, so no fence call. CREATE OR REPLACE, so the push is idempotent.

CREATE OR REPLACE FUNCTION public.gc_remove_bench_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_opened date;
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

  SELECT c.name, c.portal_opened_on INTO v_name, v_opened FROM public.gc_companies c WHERE c.id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That company is not on the bench.' USING ERRCODE = 'P0001';
  END IF;

  -- The first piece of history found names the refusal, in the order the office would miss it.
  v_hold := CASE
    WHEN EXISTS (SELECT 1 FROM public.gc_sows s WHERE s.company_id = p_company_id) THEN 'they hold a work order with us'
    WHEN EXISTS (SELECT 1 FROM public.gc_invites i WHERE i.company_id = p_company_id) THEN 'they were asked to quote'
    WHEN EXISTS (SELECT 1 FROM public.gc_company_contacts x WHERE x.company_id = p_company_id) THEN 'a contact is logged on them'
    WHEN EXISTS (SELECT 1 FROM public.gc_trade_promises p WHERE p.company_id = p_company_id) THEN 'they gave us a promise'
    WHEN EXISTS (SELECT 1 FROM public.gc_paper_sends p WHERE p.company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.person_contract_documents d WHERE d.company_id = p_company_id) THEN 'papers went to them or came in'
    WHEN EXISTS (SELECT 1 FROM public.gc_trade_files f WHERE f.company_id = p_company_id) THEN 'they sent us a file from their portal'
    WHEN EXISTS (SELECT 1 FROM public.gc_trade_messages m WHERE m.company_id = p_company_id) THEN 'they wrote to us from their portal'
    WHEN EXISTS (SELECT 1 FROM public.contacts t WHERE t.gc_company_id = p_company_id) THEN 'they have a Messages thread'
    WHEN EXISTS (SELECT 1 FROM public.gc_company_vetting_forms v WHERE v.company_id = p_company_id) THEN 'they sent us their form'
    WHEN v_opened IS NOT NULL THEN 'they opened their portal'
    WHEN EXISTS (SELECT 1 FROM public.gc_rfis r WHERE r.asked_by_company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.gc_back_charges b WHERE b.company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.gc_trade_change_requests q WHERE q.company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.gc_sow_line_reports l WHERE l.company_id = p_company_id) THEN 'they have a record on a job'
    ELSE NULL
  END;
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
  'Trade partners (v2.6749, punch list #153): Remove from the bench on a company with no history. Refuses in words when the company holds a work order, an ask, a logged contact, a promise, a paper, a portal file or message, a Messages thread, a vetting form or an opened portal; else puts the sub it came from back on Prospects → Subs with a note and deletes the row (the people on it cascade). SECURITY DEFINER: the office team (gc_office_team()); a training account, a digital twin and an archived caller are refused first.';
REVOKE ALL ON FUNCTION public.gc_remove_bench_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_remove_bench_company(uuid) TO authenticated, service_role;
