SET lock_timeout = '3s';

-- Sub-portal train, PR: sheet status + pay-timing fields, payment visibility.
--
-- The portal's job cards answer the sub's only real question — WHEN. Three
-- nullable columns on the sheet (all optional; a blank sheet shows the open
-- balance with no promise) and a per-payment memo escape hatch (memos are
-- sub-visible by design; the amount always shows).
--
-- Client writes go through the two RPCs below rather than direct updates so
-- the pre-regen client stays typecheck-clean and the office gate lives in
-- one place.

ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS portal_status text
    CHECK (portal_status IN ('in_progress', 'complete'));
ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS payable_after date;
ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS pay_hold_reason text;

COMMENT ON COLUMN public.people_labor_jobs.portal_status IS
  'Sub-portal status override for the job card chip. NULL = derive from the anchored project step where one exists, else show nothing.';
COMMENT ON COLUMN public.people_labor_jobs.payable_after IS
  'Earliest date the open balance becomes payable (shown to the sub). NULL = no promise shown.';
COMMENT ON COLUMN public.people_labor_jobs.pay_hold_reason IS
  'Plain-words reason the open balance is waiting (the sub reads this verbatim), e.g. "Builder''s walk-through — scheduled Sep 9".';

ALTER TABLE public.people_labor_job_payments
  ADD COLUMN IF NOT EXISTS hidden_from_sub boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.people_labor_job_payments.hidden_from_sub IS
  'Hide this payment''s MEMO from the sub portal (the amount always shows). Escape hatch for office-internal memos.';

CREATE OR REPLACE FUNCTION public.set_sub_sheet_portal_fields(
  p_labor_job_id uuid,
  p_portal_status text DEFAULT NULL,
  p_payable_after date DEFAULT NULL,
  p_pay_hold_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;
  IF p_portal_status IS NOT NULL AND p_portal_status NOT IN ('in_progress', 'complete') THEN
    RETURN jsonb_build_object('error', 'Unknown status');
  END IF;

  UPDATE public.people_labor_jobs
  SET portal_status = p_portal_status,
      payable_after = p_payable_after,
      pay_hold_reason = nullif(btrim(coalesce(p_pay_hold_reason, '')), '')
  WHERE id = p_labor_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sheet not found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.set_sub_sheet_portal_fields(uuid, text, date, text) IS
  'Set the sub-portal fields on a Sub Labor sheet (status override, payable-after, hold reason). Office writers; NULLs clear.';

REVOKE EXECUTE ON FUNCTION public.set_sub_sheet_portal_fields(uuid, text, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_sub_sheet_portal_fields(uuid, text, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_sub_sheet_portal_fields(uuid, text, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_sub_payment_visibility(
  p_payment_id uuid,
  p_hidden boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  UPDATE public.people_labor_job_payments
  SET hidden_from_sub = COALESCE(p_hidden, false)
  WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Payment not found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.set_sub_payment_visibility(uuid, boolean) IS
  'Toggle hidden_from_sub on a sub-labor payment (hides the memo on the portal; the amount always shows). Office writers.';

REVOKE EXECUTE ON FUNCTION public.set_sub_payment_visibility(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_sub_payment_visibility(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_sub_payment_visibility(uuid, boolean) TO authenticated;
