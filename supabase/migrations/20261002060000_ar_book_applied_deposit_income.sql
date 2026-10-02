SET lock_timeout = '3s';

-- v2.4369 — Book it as Income: a deposit that paid a bill, but that a Banking rule labelled
-- as an expense, is booked as Income from Accounts Receivable in one press.
--
-- Read Oct 1: the City of Seguin's $4,890 ACH paid bill #908 on Aug 26, and the rule
-- "City of Seguin - Taxes and Licenses" (it labels everything from the city, money in as
-- well as out) booked it as a tax refund. Apply leaves an existing label alone by design
-- (v2.3514), so the modal could only say "Labelled Taxes and Licenses in Banking, not
-- Income" with nothing to press.
--
--   1. mercury_transaction_ar_income_labels gains previous_label_id (the label it replaced)
--      and relabelled_by, and source 'relabel' beside 'trigger' / 'backfill'.
--   2. ar_book_applied_deposit_income(tx) — AR roles; only a deposit with money applied to
--      a bill; writes Income over the label and records the one it replaced.
--   3. ar_unlabel_deposit_income — when the last payment comes off a relabelled deposit,
--      the label it replaced goes back instead of the deposit going unlabelled.
--
-- Additive; nothing calls the new function until the client ships.

-- 1) The sidecar remembers what it replaced.
ALTER TABLE public.mercury_transaction_ar_income_labels
  ADD COLUMN IF NOT EXISTS previous_label_id uuid REFERENCES public.mercury_drag_sort_labels(id) ON DELETE SET NULL;
ALTER TABLE public.mercury_transaction_ar_income_labels
  ADD COLUMN IF NOT EXISTS relabelled_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.mercury_transaction_ar_income_labels
  DROP CONSTRAINT IF EXISTS mercury_transaction_ar_income_labels_source_check;
ALTER TABLE public.mercury_transaction_ar_income_labels
  ADD CONSTRAINT mercury_transaction_ar_income_labels_source_check
  CHECK (source IN ('trigger', 'backfill', 'relabel'));

COMMENT ON COLUMN public.mercury_transaction_ar_income_labels.previous_label_id IS
  'v2.4369: source ''relabel'' only — the label Book it as Income replaced. ar_unlabel_deposit_income puts it back when the last payment leaves the deposit.';

-- 2) The press.
CREATE OR REPLACE FUNCTION public.ar_book_applied_deposit_income(p_mercury_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.mercury_transactions%ROWTYPE;
  v_income uuid;
  v_current uuid;
  v_current_name text;
  v_pay public.jobs_ledger_payments%ROWTYPE;
  v_applied numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ar_book_applied_deposit_income: not authenticated';
  END IF;
  IF NOT (
    public.is_office_staff()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary'::public.user_role)
  ) THEN
    RAISE EXCEPTION 'ar_book_applied_deposit_income: not authorized';
  END IF;

  SELECT * INTO v_tx FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id;
  IF NOT FOUND OR v_tx.amount IS NULL OR v_tx.amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That bank deposit no longer exists.');
  END IF;

  SELECT coalesce(sum(p.amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments p
  WHERE p.mercury_transaction_id = p_mercury_transaction_id;
  IF v_applied <= 0.0005 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only a deposit that paid a bill is booked as Income here.');
  END IF;

  SELECT l.id INTO v_income
  FROM public.mercury_drag_sort_labels l
  WHERE l.default_key = 'income_part_i'
  ORDER BY l.sort_order
  LIMIT 1;
  IF v_income IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Banking has no Income label.');
  END IF;

  SELECT d.label_id, l.name INTO v_current, v_current_name
  FROM public.mercury_transaction_drag_sort_assignments d
  JOIN public.mercury_drag_sort_labels l ON l.id = d.label_id
  WHERE d.mercury_transaction_id = p_mercury_transaction_id
  FOR UPDATE OF d;

  IF v_current = v_income THEN
    RETURN jsonb_build_object('ok', true, 'booked', 'kept');
  END IF;

  INSERT INTO public.mercury_transaction_drag_sort_assignments (mercury_transaction_id, label_id)
  VALUES (p_mercury_transaction_id, v_income)
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    label_id = EXCLUDED.label_id,
    assigned_at = now();

  SELECT * INTO v_pay
  FROM public.jobs_ledger_payments p
  WHERE p.mercury_transaction_id = p_mercury_transaction_id
  ORDER BY p.created_at, p.id
  LIMIT 1;

  INSERT INTO public.mercury_transaction_ar_income_labels (
    mercury_transaction_id, job_id, invoice_id, payment_id, source, labelled_at, previous_label_id, relabelled_by
  )
  VALUES (
    p_mercury_transaction_id, v_pay.job_id, v_pay.invoice_id, v_pay.id, 'relabel', now(), v_current, auth.uid()
  )
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    job_id = EXCLUDED.job_id,
    invoice_id = EXCLUDED.invoice_id,
    payment_id = EXCLUDED.payment_id,
    source = EXCLUDED.source,
    labelled_at = EXCLUDED.labelled_at,
    previous_label_id = EXCLUDED.previous_label_id,
    relabelled_by = EXCLUDED.relabelled_by;

  RETURN jsonb_build_object('ok', true, 'booked', 'set', 'previous_label_name', v_current_name);
END;
$function$;

REVOKE ALL ON FUNCTION public.ar_book_applied_deposit_income(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ar_book_applied_deposit_income(uuid) TO authenticated;

COMMENT ON FUNCTION public.ar_book_applied_deposit_income(uuid) IS
  'Book it as Income (v2.4369): label a deposit that paid a bill as Income over whatever a rule or a person put on it, recording the replaced label in mercury_transaction_ar_income_labels (source ''relabel''). AR roles.';

-- 3) Taking the last payment off a relabelled deposit puts its old label back.
CREATE OR REPLACE FUNCTION public.ar_unlabel_deposit_income(p_mercury_transaction_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_income_label uuid;
  v_current uuid;
  v_previous uuid;
BEGIN
  IF p_mercury_transaction_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT s.previous_label_id INTO v_previous
  FROM public.mercury_transaction_ar_income_labels s
  WHERE s.mercury_transaction_id = p_mercury_transaction_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT l.id INTO v_income_label
  FROM public.mercury_drag_sort_labels l
  WHERE l.default_key = 'income_part_i'
  ORDER BY l.sort_order
  LIMIT 1;

  SELECT d.label_id INTO v_current
  FROM public.mercury_transaction_drag_sort_assignments d
  WHERE d.mercury_transaction_id = p_mercury_transaction_id;

  -- Someone relabelled it since: not ours any more. Drop the claim only.
  IF v_current IS NULL OR v_income_label IS NULL OR v_current <> v_income_label THEN
    DELETE FROM public.mercury_transaction_ar_income_labels WHERE mercury_transaction_id = p_mercury_transaction_id;
    RETURN false;
  END IF;

  -- A payment still points at the deposit: the label still stands.
  IF EXISTS (
    SELECT 1 FROM public.jobs_ledger_payments p
    WHERE p.mercury_transaction_id = p_mercury_transaction_id
  ) THEN
    RETURN false;
  END IF;

  -- v2.4369: Book it as Income replaced a label: put it back rather than leave none.
  IF v_previous IS NOT NULL AND EXISTS (SELECT 1 FROM public.mercury_drag_sort_labels l WHERE l.id = v_previous) THEN
    UPDATE public.mercury_transaction_drag_sort_assignments
    SET label_id = v_previous, assigned_at = now()
    WHERE mercury_transaction_id = p_mercury_transaction_id;
  ELSE
    DELETE FROM public.mercury_transaction_drag_sort_assignments WHERE mercury_transaction_id = p_mercury_transaction_id;
  END IF;
  DELETE FROM public.mercury_transaction_ar_income_labels WHERE mercury_transaction_id = p_mercury_transaction_id;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.ar_unlabel_deposit_income(uuid) IS
  'Internal: withdraw an Income label that Accounts Receivable set (per mercury_transaction_ar_income_labels) once no payment on the deposit remains — v2.4369: back to previous_label_id when Book it as Income replaced one. Leaves any label a person changed alone. Called by the jobs_ledger_payments trigger.';

REVOKE ALL ON FUNCTION public.ar_unlabel_deposit_income(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ar_unlabel_deposit_income(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ar_unlabel_deposit_income(uuid) TO service_role;
