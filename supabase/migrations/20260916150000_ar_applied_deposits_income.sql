SET lock_timeout = '3s';

-- Deposits applied in Accounts Receivable count as Income.
--
-- When the office matches a bank deposit to a bill, the app already knows it
-- is a customer payment — but that knowledge never reached the P&L, which
-- only counts deposits carrying the Banking label "Income". Labels are set by
-- counterparty-name rules (one per customer, so a customer who pays once is
-- never caught) or by hand on Banking, which assistants cannot open since
-- v2.3305. Measured 2026-09-16: 24 applied deposits ($171,710) in the last
-- twelve months were unlabelled; 22 of them had no rule at all.
--
-- This migration:
--   1. seeds the ORG switch app_settings.ar_applied_deposits_count_as_income
--      (ships 'false'; dev / master flips it on Banking → Accounting, the
--      same shape as accounting_label_auto_approve_rule_matches, v2.2889);
--   2. adds the provenance sidecar mercury_transaction_ar_income_labels — one
--      row per deposit whose Income label Accounts Receivable set, with the
--      payment / bill / job that earned it (the ledger tooltip reads it, and
--      it is what lets the label be withdrawn if the payment is removed);
--   3. adds the internal writer ar_label_deposit_income(...) and its reverse
--      ar_unlabel_deposit_income(...) — the writer NEVER overwrites a label a
--      person or a rule already set, and the reverse only clears a label the
--      sidecar says AR set, and only once no payment on that deposit remains;
--   4. attaches trigger jobs_ledger_payments_ar_income_label (AFTER INSERT OR
--      UPDATE OF mercury_transaction_id OR DELETE) — so every writer of a
--      payment with a bank link is covered at once: the allocation RPC, the
--      tip RPC, the HouseCall Pro backfill, a recorded payment linked later,
--      and Edit Job's autosave. The trigger body swallows its own errors with
--      a WARNING so a label problem can never abort a payment write;
--   5. adds backfill_ar_applied_income_labels(p_dry_run) for the switch: the
--      dry run counts what would be labelled; the real run labels every
--      applied, unlabelled deposit once (source 'backfill').
--
-- Idempotent; additive. No existing table, column or function changes.

-- 1) Org switch, OFF until a dev or master turns it on.
INSERT INTO public.app_settings (key, value_text)
VALUES ('ar_applied_deposits_count_as_income', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "master_or_dev_update_ar_applied_income" ON public.app_settings;
CREATE POLICY "master_or_dev_update_ar_applied_income"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'ar_applied_deposits_count_as_income' AND public.is_master_or_dev())
  WITH CHECK (key = 'ar_applied_deposits_count_as_income' AND public.is_master_or_dev());

-- 2) Provenance sidecar. Written only by the SECURITY DEFINER functions below.
CREATE TABLE IF NOT EXISTS public.mercury_transaction_ar_income_labels (
  mercury_transaction_id uuid PRIMARY KEY REFERENCES public.mercury_transactions(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.jobs_ledger_invoices(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.jobs_ledger_payments(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'trigger' CHECK (source IN ('trigger', 'backfill')),
  labelled_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mercury_transaction_ar_income_labels IS
  'One row per bank deposit whose Banking label "Income" was set by Accounts Receivable (trigger on jobs_ledger_payments, or the one-time backfill) rather than by a rule or a person. Read by the AR modal and the Banking ledger tooltip; deleted when the label is withdrawn or the label is no longer AR''s to withdraw.';

ALTER TABLE public.mercury_transaction_ar_income_labels ENABLE ROW LEVEL SECURITY;

-- Office staff read it (the AR modal is an assistant surface); nobody writes
-- it from the client — the functions below own every write.
DROP POLICY IF EXISTS "mercury_transaction_ar_income_labels office staff select" ON public.mercury_transaction_ar_income_labels;
CREATE POLICY "mercury_transaction_ar_income_labels office staff select"
  ON public.mercury_transaction_ar_income_labels
  FOR SELECT
  TO authenticated
  USING (public.is_office_staff());

-- 3a) The writer. Returns true when it labelled the deposit, false when it
--     left it alone (switch off, no such deposit, not a deposit, already
--     labelled by anyone, or no Income label configured).
CREATE OR REPLACE FUNCTION public.ar_label_deposit_income(
  p_mercury_transaction_id uuid,
  p_job_id uuid,
  p_invoice_id uuid,
  p_payment_id uuid,
  p_source text DEFAULT 'trigger'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_on boolean;
  v_income_label uuid;
  v_amount numeric;
  v_dup uuid;
BEGIN
  IF p_mercury_transaction_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(trim(coalesce(a.value_text, ''))) = 'true'
    INTO v_on
  FROM public.app_settings a
  WHERE a.key = 'ar_applied_deposits_count_as_income';
  IF NOT coalesce(v_on, false) THEN
    RETURN false;
  END IF;

  SELECT l.id INTO v_income_label
  FROM public.mercury_drag_sort_labels l
  WHERE l.default_key = 'income_part_i'
  ORDER BY l.sort_order
  LIMIT 1;
  IF v_income_label IS NULL THEN
    RETURN false;
  END IF;

  SELECT t.amount, t.duplicate_of_transaction_id
    INTO v_amount, v_dup
  FROM public.mercury_transactions t
  WHERE t.id = p_mercury_transaction_id;
  IF v_amount IS NULL OR v_amount <= 0 OR v_dup IS NOT NULL THEN
    RETURN false;
  END IF;

  -- Never overwrite a label anyone already set: a rule, a person, or an
  -- earlier pass of this function.
  IF EXISTS (
    SELECT 1 FROM public.mercury_transaction_drag_sort_assignments d
    WHERE d.mercury_transaction_id = p_mercury_transaction_id
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.mercury_transaction_drag_sort_assignments (mercury_transaction_id, label_id)
  VALUES (p_mercury_transaction_id, v_income_label)
  ON CONFLICT (mercury_transaction_id) DO NOTHING;

  INSERT INTO public.mercury_transaction_ar_income_labels (mercury_transaction_id, job_id, invoice_id, payment_id, source)
  VALUES (p_mercury_transaction_id, p_job_id, p_invoice_id, p_payment_id, coalesce(p_source, 'trigger'))
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    job_id = EXCLUDED.job_id,
    invoice_id = EXCLUDED.invoice_id,
    payment_id = EXCLUDED.payment_id,
    source = EXCLUDED.source,
    labelled_at = now();

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.ar_label_deposit_income(uuid, uuid, uuid, uuid, text) IS
  'Internal writer: when app_settings.ar_applied_deposits_count_as_income = true and the deposit carries no Banking label yet, label it Income and record the provenance in mercury_transaction_ar_income_labels. Never overwrites an existing label. Called by the jobs_ledger_payments trigger and by backfill_ar_applied_income_labels.';

REVOKE ALL ON FUNCTION public.ar_label_deposit_income(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ar_label_deposit_income(uuid, uuid, uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ar_label_deposit_income(uuid, uuid, uuid, uuid, text) TO service_role;

-- 3b) The reverse. Only a label the sidecar says AR set, only while it still
--     reads Income, and only once no payment on the deposit remains. A label
--     a person changed to something else is left alone and the stale sidecar
--     row is dropped so the tooltip stops claiming it.
CREATE OR REPLACE FUNCTION public.ar_unlabel_deposit_income(p_mercury_transaction_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_income_label uuid;
  v_current uuid;
BEGIN
  IF p_mercury_transaction_id IS NULL THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mercury_transaction_ar_income_labels s
    WHERE s.mercury_transaction_id = p_mercury_transaction_id
  ) THEN
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

  DELETE FROM public.mercury_transaction_drag_sort_assignments WHERE mercury_transaction_id = p_mercury_transaction_id;
  DELETE FROM public.mercury_transaction_ar_income_labels WHERE mercury_transaction_id = p_mercury_transaction_id;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.ar_unlabel_deposit_income(uuid) IS
  'Internal: withdraw an Income label that Accounts Receivable set (per mercury_transaction_ar_income_labels) once no payment on the deposit remains. Leaves any label a person changed alone. Called by the jobs_ledger_payments trigger.';

REVOKE ALL ON FUNCTION public.ar_unlabel_deposit_income(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ar_unlabel_deposit_income(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ar_unlabel_deposit_income(uuid) TO service_role;

-- 4) The trigger. AFTER, row-level, and it never raises: a labelling problem
--    must not abort the payment write it rides on.
CREATE OR REPLACE FUNCTION public.jobs_ledger_payments_ar_income_label_tr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      IF NEW.mercury_transaction_id IS NOT NULL THEN
        PERFORM public.ar_label_deposit_income(NEW.mercury_transaction_id, NEW.job_id, NEW.invoice_id, NEW.id, 'trigger');
      END IF;
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.mercury_transaction_id IS DISTINCT FROM OLD.mercury_transaction_id THEN
        IF OLD.mercury_transaction_id IS NOT NULL THEN
          PERFORM public.ar_unlabel_deposit_income(OLD.mercury_transaction_id);
        END IF;
        IF NEW.mercury_transaction_id IS NOT NULL THEN
          PERFORM public.ar_label_deposit_income(NEW.mercury_transaction_id, NEW.job_id, NEW.invoice_id, NEW.id, 'trigger');
        END IF;
      END IF;
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      IF OLD.mercury_transaction_id IS NOT NULL THEN
        PERFORM public.ar_unlabel_deposit_income(OLD.mercury_transaction_id);
      END IF;
      RETURN OLD;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'jobs_ledger_payments_ar_income_label_tr: % (%)', SQLERRM, SQLSTATE;
  END;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_ledger_payments_ar_income_label ON public.jobs_ledger_payments;
CREATE TRIGGER jobs_ledger_payments_ar_income_label
  AFTER INSERT OR UPDATE OF mercury_transaction_id OR DELETE ON public.jobs_ledger_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_ledger_payments_ar_income_label_tr();

-- 5) The backfill behind the switch. Dry run by default: counts what the real
--    run would label. The real run requires the switch to be on already (the
--    client flips the setting first, then calls this) and labels each
--    candidate through the same writer the trigger uses, source 'backfill'.
CREATE OR REPLACE FUNCTION public.backfill_ar_applied_income_labels(p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_on boolean;
  v_count integer := 0;
  v_dollars numeric := 0;
  r record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_master_or_dev() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  IF NOT coalesce(p_dry_run, true) THEN
    SELECT lower(trim(coalesce(a.value_text, ''))) = 'true'
      INTO v_on
    FROM public.app_settings a
    WHERE a.key = 'ar_applied_deposits_count_as_income';
    IF NOT coalesce(v_on, false) THEN
      RETURN jsonb_build_object('error', 'The switch is off — turn it on first.');
    END IF;
  END IF;

  FOR r IN
    SELECT t.id, t.amount,
           p.job_id, p.invoice_id, p.id AS payment_id
    FROM public.mercury_transactions t
    JOIN LATERAL (
      SELECT p.job_id, p.invoice_id, p.id
      FROM public.jobs_ledger_payments p
      WHERE p.mercury_transaction_id = t.id
      ORDER BY p.created_at NULLS LAST, p.sequence_order
      LIMIT 1
    ) p ON true
    WHERE t.amount > 0
      AND t.duplicate_of_transaction_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.mercury_transaction_drag_sort_assignments d
        WHERE d.mercury_transaction_id = t.id
      )
    ORDER BY t.posted_at
  LOOP
    IF coalesce(p_dry_run, true) THEN
      v_count := v_count + 1;
      v_dollars := v_dollars + r.amount;
    ELSIF public.ar_label_deposit_income(r.id, r.job_id, r.invoice_id, r.payment_id, 'backfill') THEN
      v_count := v_count + 1;
      v_dollars := v_dollars + r.amount;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'dry_run', coalesce(p_dry_run, true), 'count', v_count, 'dollars', round(v_dollars, 2));
END;
$$;

COMMENT ON FUNCTION public.backfill_ar_applied_income_labels(boolean) IS
  'dev / master only. Dry run (default): how many applied, unlabelled deposits the rule would label and their sum. Real run (switch must already be on): labels them Income through ar_label_deposit_income, source ''backfill''. Returns {ok, dry_run, count, dollars} or {error}.';

REVOKE ALL ON FUNCTION public.backfill_ar_applied_income_labels(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_ar_applied_income_labels(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.backfill_ar_applied_income_labels(boolean) TO authenticated, service_role;

-- New table: training-mode read-only users must be blocked from writing it,
-- even through SECURITY DEFINER RPCs (CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
