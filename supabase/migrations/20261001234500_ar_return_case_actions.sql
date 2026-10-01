SET lock_timeout = '3s';

-- v2.4325 — punch list #76 PR 3: work a check that came back from Accounts Receivable.
--
-- Three writes the case pane needs (the case itself is 20261001230000):
-- 1. take_returned_check_off_jobs(p_mercury_transaction_id) — one press takes every
--    payment the returned deposit still carries off its job, each through
--    remove_jobs_ledger_payment_and_reconcile (the reconcile, the history event with
--    the bank's reason, the bill and the job back to Billed). All or nothing: when one
--    refuses (a Stripe credit note, a bill Stripe holds as paid) nothing comes off and
--    the refusal names the job. Before, a deposit split across three jobs was six
--    presses of Unlink and remove in three Edit Job windows.
-- 2. close_ar_return_case(p_mercury_transaction_id, p_reason, p_note, p_replaced_by) —
--    replaced (with the new deposit), settled_other_way, not_coming.
-- 3. reopen_ar_return_case(p_mercury_transaction_id).
-- The office roles that apply deposits (dev, master_technician, assistant, controller,
-- primary), as everywhere else in Accounts Receivable.

CREATE OR REPLACE FUNCTION public.take_returned_check_off_jobs(p_mercury_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pay record;
  v_res jsonb;
  v_removed integer := 0;
  v_jobs jsonb := '[]'::jsonb;
  v_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'take_returned_check_off_jobs: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'take_returned_check_off_jobs: not authorized';
  END IF;
  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'take_returned_check_off_jobs: deposit required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mercury_transaction_ar_returned r
    WHERE r.mercury_transaction_id = p_mercury_transaction_id AND r.returned
  ) AND NOT EXISTS (
    SELECT 1 FROM public.mercury_transactions t
    WHERE t.id = p_mercury_transaction_id
      AND public.mercury_bank_return_reason(t.status, t.posted_at, t.amount, t.kind, t.raw->>'reasonForFailure') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This check has not come back, so nothing comes off.' USING ERRCODE = 'P0001';
  END IF;

  -- Serialize with anyone else working this deposit.
  PERFORM 1 FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id FOR UPDATE;

  FOR v_pay IN
    SELECT p.id, p.job_id, p.amount,
           coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), '') AS job_number,
           j.job_name
    FROM public.jobs_ledger_payments p
    LEFT JOIN public.jobs_ledger j ON j.id = p.job_id
    WHERE p.mercury_transaction_id = p_mercury_transaction_id
    ORDER BY p.amount DESC, p.id
  LOOP
    v_res := public.remove_jobs_ledger_payment_and_reconcile(v_pay.id);
    v_label := btrim(concat_ws(' ', CASE WHEN v_pay.job_number <> '' THEN '#' || v_pay.job_number END, v_pay.job_name));
    IF v_res IS NULL OR v_res ? 'error' THEN
      RAISE EXCEPTION '%: %', coalesce(nullif(v_label, ''), 'A job'), coalesce(v_res->>'error', 'the payment could not come off')
        USING ERRCODE = 'P0001';
    END IF;
    v_removed := v_removed + 1;
    v_jobs := v_jobs || jsonb_build_object('job_id', v_pay.job_id, 'label', v_label, 'amount', v_pay.amount, 'warning', v_res->>'warning');
  END LOOP;

  -- A hand-marked case keeps its mark; a bank return is marked by the removals above.
  INSERT INTO public.mercury_transaction_ar_returned AS r (mercury_transaction_id, returned, updated_by, source, opened_at)
  VALUES (p_mercury_transaction_id, true, auth.uid(), 'bank', now())
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET returned = true, updated_at = now(), updated_by = auth.uid();

  RETURN jsonb_build_object('ok', true, 'removed', v_removed, 'jobs', v_jobs);
END;
$function$;

REVOKE ALL ON FUNCTION public.take_returned_check_off_jobs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_returned_check_off_jobs(uuid) TO authenticated;

COMMENT ON FUNCTION public.take_returned_check_off_jobs(uuid) IS
  'Accounts Receivable (v2.4325): take every payment a returned deposit still carries off its job in one press, each through remove_jobs_ledger_payment_and_reconcile; all or nothing, a refusal names the job. Only for a deposit that came back. AR roles.';

CREATE OR REPLACE FUNCTION public.close_ar_return_case(
  p_mercury_transaction_id uuid,
  p_reason text,
  p_note text DEFAULT NULL,
  p_replaced_by uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'close_ar_return_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'close_ar_return_case: not authorized';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('replaced', 'settled_other_way', 'not_coming') THEN
    RAISE EXCEPTION 'close_ar_return_case: reason must be replaced, settled_other_way or not_coming';
  END IF;
  IF p_reason = 'replaced' AND p_replaced_by IS NULL THEN
    RAISE EXCEPTION 'close_ar_return_case: a replaced case names the new deposit';
  END IF;
  IF p_replaced_by IS NOT NULL AND p_replaced_by = p_mercury_transaction_id THEN
    RAISE EXCEPTION 'close_ar_return_case: a check cannot replace itself';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'close_ar_return_case: the note is at most 500 characters';
  END IF;

  UPDATE public.mercury_transaction_ar_returned
  SET closed_at = now(),
      closed_by = auth.uid(),
      closed_reason = p_reason,
      closed_note = v_note,
      replaced_by_mercury_transaction_id = CASE WHEN p_reason = 'replaced' THEN p_replaced_by END
  WHERE mercury_transaction_id = p_mercury_transaction_id
    AND returned
    AND closed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This check has no open case to close.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.close_ar_return_case(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_ar_return_case(uuid, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_ar_return_case(p_mercury_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'reopen_ar_return_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'reopen_ar_return_case: not authorized';
  END IF;
  UPDATE public.mercury_transaction_ar_returned
  SET closed_at = NULL, closed_by = NULL, closed_reason = NULL, closed_note = NULL, replaced_by_mercury_transaction_id = NULL,
      updated_at = now(), updated_by = auth.uid()
  WHERE mercury_transaction_id = p_mercury_transaction_id
    AND closed_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This check has no closed case to reopen.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.reopen_ar_return_case(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_ar_return_case(uuid) TO authenticated;
