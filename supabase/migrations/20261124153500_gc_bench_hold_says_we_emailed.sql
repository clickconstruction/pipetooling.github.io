SET lock_timeout = '3s';

-- The bench's Remove press refused in the wrong words (punch list #416, the 2026-11-24 walk of 1c; v2.8491).
-- gc_remove_bench_company (20261109004500) refuses a company with history and names the first piece it finds. One
-- of its checks reads gc_trade_messages and said 'they wrote to us from their portal'. That table holds every email
-- WE sent to a trade company, as it went (20261008050000: written by gc-trade-email, and since by
-- document-builder-send and the signing sends). Nothing a company writes lands there. So a test company that was
-- emailed one sheet and never wrote a word was refused as having written to us.
--
--   * The fix is the words alone: that check now says 'we emailed them'. The rule is unchanged: an email that went
--     to a company is history, and the company stays. Every other check, their order, the prospect going back on
--     the lane, the delete and its fallback are restated byte for byte from 20261109004500.
--   * No table is made, so no fence call. CREATE OR REPLACE with the same signature, so the grants stay; they are
--     restated all the same, and the push is idempotent.
--   * The client calls nothing new: the press reads the refusal's words as the function raises them.

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
    WHEN EXISTS (SELECT 1 FROM public.gc_trade_messages m WHERE m.company_id = p_company_id) THEN 'we emailed them'
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
  'Trade partners (v2.6749, punch list #153; an email we sent said as ours since v2.8491): Remove from the bench on a company with no history. Refuses in words when the company holds a work order, an ask, a logged contact, a promise, a paper, a file from their portal, an email we sent them, a Messages thread, a vetting form or an opened portal; else puts the sub it came from back on Prospects → Subs with a note and deletes the row (the people on it cascade). SECURITY DEFINER: the office team (gc_office_team()); a training account, a digital twin and an archived caller are refused first.';
REVOKE ALL ON FUNCTION public.gc_remove_bench_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_remove_bench_company(uuid) TO authenticated, service_role;
