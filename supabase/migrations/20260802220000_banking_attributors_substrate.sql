SET lock_timeout = '3s';

-- Non-card attribution substrate (Phase 1 of the ACH/wire/check attribution plan).
--
-- Prod measurement 2026-08-02: 103 non-card money-out transactions / $200,158.86 in the
-- trailing 90 days are 100% unattributed — no job splits, no supply-house invoice link,
-- no payroll flag, no Internal Transfers label. Composition: ~$106k contract-labor ACHs,
-- ~$38k credit-card bill payments, ~$38.6k supply-house ACHs, ~$16.8k true office
-- overhead (rent/insurance). The office-overhead slice never reaches the 90-day overhead
-- pool (People → Overhead / Review) because the pool only reads office-job allocations.
--
-- This migration adds:
--   1. banking_attributors — dev-granted capability: specific users may work the
--      non-card attribution queue without any other Banking access.
--   2. mercury_transaction_attribution_resolutions — "resolved: not an expense in this
--      system" marks (credit-card bill payments and similar), so the queue can reach
--      zero without forcing a bogus job attribution.
--   3. Queue RPCs (list/count) exposing MINIMAL transaction fields, and capability-gated
--      write RPCs: resolve/unresolve, allocate-100%-to-one-job, payroll flag.
--
-- "Unresolved" mirrors the linked-card tally queue (20260709160000): no job allocations,
-- no supply-house invoice links, no is_payroll flag — plus no Internal Transfers label
-- and no resolution row. Scope: kind NOT IN ('debitCardTransaction','internalTransfer'),
-- money-out, not a marked duplicate, posted.

-- 1) Capability table -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.banking_attributors (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.banking_attributors IS
  'Users granted the non-card (ACH/wire/check) attribution capability by dev. Grants access to the unattributed-noncard queue RPCs only — not to the Banking page or any other Mercury data.';

ALTER TABLE public.banking_attributors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_all_banking_attributors ON public.banking_attributors;
CREATE POLICY dev_all_banking_attributors ON public.banking_attributors
  FOR ALL USING (is_dev()) WITH CHECK (is_dev());

DROP POLICY IF EXISTS self_read_banking_attributors ON public.banking_attributors;
CREATE POLICY self_read_banking_attributors ON public.banking_attributors
  FOR SELECT USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.banking_attributors TO authenticated;
GRANT ALL ON TABLE public.banking_attributors TO service_role;

-- 2) Resolution table -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mercury_transaction_attribution_resolutions (
  mercury_transaction_id uuid PRIMARY KEY REFERENCES public.mercury_transactions(id) ON DELETE CASCADE,
  resolution_kind text NOT NULL CHECK (resolution_kind IN ('card_bill_payment', 'not_an_expense_other')),
  note text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mercury_transaction_attribution_resolutions IS
  'Marks a non-card Mercury transaction as resolved without a job attribution: card_bill_payment (e.g. AMEX bill — underlying spend lives on the card statement, counting the payment too would double-count) or not_an_expense_other. Resolves the transaction out of the unattributed-noncard queue. Mutually exclusive with job allocations (enforced in the RPCs).';

ALTER TABLE public.mercury_transaction_attribution_resolutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_all_attribution_resolutions ON public.mercury_transaction_attribution_resolutions;
CREATE POLICY dev_all_attribution_resolutions ON public.mercury_transaction_attribution_resolutions
  FOR ALL USING (is_dev()) WITH CHECK (is_dev());

DROP POLICY IF EXISTS attributor_read_attribution_resolutions ON public.mercury_transaction_attribution_resolutions;
CREATE POLICY attributor_read_attribution_resolutions ON public.mercury_transaction_attribution_resolutions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.banking_attributors ba WHERE ba.user_id = (SELECT auth.uid())
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mercury_transaction_attribution_resolutions TO authenticated;
GRANT ALL ON TABLE public.mercury_transaction_attribution_resolutions TO service_role;

-- 3) Capability helper ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_banking_attributor() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.banking_attributors ba WHERE ba.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_banking_attributor() IS
  'True when the caller holds the dev-granted non-card attribution capability (banking_attributors row).';

-- 4) Queue RPCs -------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_unattributed_noncard_mercury_transactions(p_limit integer DEFAULT 200)
 RETURNS TABLE(mercury_transaction_id uuid, posted_at timestamptz, amount numeric, kind text, counterparty_name text, external_memo text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_unattributed_noncard_mercury_transactions: not authenticated';
  END IF;
  IF NOT (is_dev() OR is_banking_attributor()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT t.id, t.posted_at, t.amount, t.kind, t.counterparty_name, t.external_memo
  FROM public.mercury_transactions t
  WHERE t.posted_at IS NOT NULL
    AND t.kind NOT IN ('debitCardTransaction', 'internalTransfer')
    AND t.duplicate_of_transaction_id IS NULL
    AND t.amount < 0
    AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_job_allocations a
                    WHERE a.mercury_transaction_id = t.id)
    AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_supply_house_invoice_links il
                    WHERE il.mercury_transaction_id = t.id)
    AND NOT EXISTS (SELECT 1 FROM public.mercury_tally_payroll_flags pf
                    WHERE pf.mercury_transaction_id = t.id AND pf.is_payroll)
    AND NOT EXISTS (SELECT 1
                    FROM public.mercury_transaction_drag_sort_assignments dsa
                    JOIN public.mercury_drag_sort_labels dl ON dl.id = dsa.label_id
                    WHERE dsa.mercury_transaction_id = t.id
                      AND dl.default_key = 'internal_transfers')
    AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_attribution_resolutions r
                    WHERE r.mercury_transaction_id = t.id)
  ORDER BY t.posted_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 200), 500));
END;
$$;

COMMENT ON FUNCTION public.list_unattributed_noncard_mercury_transactions(integer) IS
  'Unresolved non-card (ACH/wire/check) money-out Mercury transactions: no job allocations, no supply-house invoice link, no payroll flag, no Internal Transfers label, no attribution resolution. Minimal fields only — safe for capability-holders without Banking access. Callers: dev or banking_attributors.';

CREATE OR REPLACE FUNCTION public.count_unattributed_noncard_mercury_transactions() RETURNS bigint
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'count_unattributed_noncard_mercury_transactions: not authenticated';
  END IF;
  IF NOT (is_dev() OR is_banking_attributor()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT count(*)::bigint
    FROM public.mercury_transactions t
    WHERE t.posted_at IS NOT NULL
      AND t.kind NOT IN ('debitCardTransaction', 'internalTransfer')
      AND t.duplicate_of_transaction_id IS NULL
      AND t.amount < 0
      AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_job_allocations a
                      WHERE a.mercury_transaction_id = t.id)
      AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_supply_house_invoice_links il
                      WHERE il.mercury_transaction_id = t.id)
      AND NOT EXISTS (SELECT 1 FROM public.mercury_tally_payroll_flags pf
                      WHERE pf.mercury_transaction_id = t.id AND pf.is_payroll)
      AND NOT EXISTS (SELECT 1
                      FROM public.mercury_transaction_drag_sort_assignments dsa
                      JOIN public.mercury_drag_sort_labels dl ON dl.id = dsa.label_id
                      WHERE dsa.mercury_transaction_id = t.id
                        AND dl.default_key = 'internal_transfers')
      AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_attribution_resolutions r
                      WHERE r.mercury_transaction_id = t.id)
  );
END;
$$;

COMMENT ON FUNCTION public.count_unattributed_noncard_mercury_transactions() IS
  'Count matching list_unattributed_noncard_mercury_transactions (same predicate, same callers). Feeds the queue chip.';

-- 5) Capability-gated write RPCs ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_noncard_transaction_attribution(p_mercury_transaction_id uuid, p_resolution_kind text, p_note text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_kind text;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'resolve_noncard_transaction_attribution: not authenticated';
  END IF;
  IF NOT (is_dev() OR is_banking_attributor()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_resolution_kind NOT IN ('card_bill_payment', 'not_an_expense_other') THEN
    RAISE EXCEPTION 'resolve_noncard_transaction_attribution: invalid resolution kind %', p_resolution_kind;
  END IF;

  SELECT t.kind, t.amount INTO v_kind, v_amount
  FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'resolve_noncard_transaction_attribution: transaction not found';
  END IF;
  IF v_kind IN ('debitCardTransaction', 'internalTransfer') OR v_amount >= 0 THEN
    RAISE EXCEPTION 'resolve_noncard_transaction_attribution: transaction is not in the non-card money-out scope';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mercury_transaction_job_allocations a
             WHERE a.mercury_transaction_id = p_mercury_transaction_id) THEN
    RAISE EXCEPTION 'Transaction is allocated to jobs; remove job splits before resolving' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.mercury_transaction_attribution_resolutions (mercury_transaction_id, resolution_kind, note, created_by)
  VALUES (p_mercury_transaction_id, p_resolution_kind, NULLIF(trim(both FROM p_note), ''), auth.uid())
  ON CONFLICT (mercury_transaction_id) DO UPDATE
    SET resolution_kind = EXCLUDED.resolution_kind, note = EXCLUDED.note, created_by = EXCLUDED.created_by, created_at = now();
END;
$$;

COMMENT ON FUNCTION public.resolve_noncard_transaction_attribution(uuid, text, text) IS
  'Mark a non-card money-out transaction resolved without job attribution (card_bill_payment / not_an_expense_other). Blocked while job splits exist. Callers: dev or banking_attributors.';

CREATE OR REPLACE FUNCTION public.unresolve_noncard_transaction_attribution(p_mercury_transaction_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unresolve_noncard_transaction_attribution: not authenticated';
  END IF;
  IF NOT (is_dev() OR is_banking_attributor()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.mercury_transaction_attribution_resolutions
  WHERE mercury_transaction_id = p_mercury_transaction_id;
END;
$$;

COMMENT ON FUNCTION public.unresolve_noncard_transaction_attribution(uuid) IS
  'Remove an attribution resolution so the transaction returns to the unattributed-noncard queue. Callers: dev or banking_attributors.';

CREATE OR REPLACE FUNCTION public.attributor_allocate_transaction_to_job(p_mercury_transaction_id uuid, p_job_id uuid, p_note text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_kind text;
  v_amount numeric(18, 4);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'attributor_allocate_transaction_to_job: not authenticated';
  END IF;
  IF NOT (is_dev() OR is_banking_attributor()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT t.kind, t.amount INTO v_kind, v_amount
  FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'attributor_allocate_transaction_to_job: transaction not found';
  END IF;
  IF v_kind IN ('debitCardTransaction', 'internalTransfer') OR v_amount >= 0 THEN
    RAISE EXCEPTION 'attributor_allocate_transaction_to_job: transaction is not in the non-card money-out scope';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = p_job_id) THEN
    RAISE EXCEPTION 'attributor_allocate_transaction_to_job: invalid job';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mercury_tally_payroll_flags pf
             WHERE pf.mercury_transaction_id = p_mercury_transaction_id AND pf.is_payroll) THEN
    RAISE EXCEPTION 'Transaction is marked payroll; clear the payroll flag before allocating to a job' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mercury_transaction_attribution_resolutions r
             WHERE r.mercury_transaction_id = p_mercury_transaction_id) THEN
    RAISE EXCEPTION 'Transaction has an attribution resolution; unresolve it before allocating to a job' USING ERRCODE = 'P0001';
  END IF;

  -- 100% single-job allocation, same invariant as replace_mercury_transaction_splits:
  -- allocation rows sum exactly to the signed transaction amount.
  DELETE FROM public.mercury_transaction_job_allocations
  WHERE mercury_transaction_id = p_mercury_transaction_id;

  INSERT INTO public.mercury_transaction_job_allocations (mercury_transaction_id, job_id, amount, note, created_by)
  VALUES (p_mercury_transaction_id, p_job_id, v_amount, NULLIF(trim(both FROM p_note), ''), auth.uid());
END;
$$;

COMMENT ON FUNCTION public.attributor_allocate_transaction_to_job(uuid, uuid, text) IS
  'Allocate 100% of a non-card money-out transaction to one job (the queue''s one-tap path, e.g. the office job for rent/insurance). Preserves the splits-sum-to-amount invariant; mutually exclusive with payroll flags and resolutions. Callers: dev or banking_attributors.';

CREATE OR REPLACE FUNCTION public.attributor_flag_transaction_payroll(p_mercury_transaction_id uuid, p_is_payroll boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_kind text;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'attributor_flag_transaction_payroll: not authenticated';
  END IF;
  IF NOT (is_dev() OR is_banking_attributor()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT t.kind, t.amount INTO v_kind, v_amount
  FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'attributor_flag_transaction_payroll: transaction not found';
  END IF;
  IF v_kind IN ('debitCardTransaction', 'internalTransfer') OR v_amount >= 0 THEN
    RAISE EXCEPTION 'attributor_flag_transaction_payroll: transaction is not in the non-card money-out scope';
  END IF;
  IF p_is_payroll AND EXISTS (SELECT 1 FROM public.mercury_transaction_job_allocations a
                              WHERE a.mercury_transaction_id = p_mercury_transaction_id) THEN
    RAISE EXCEPTION 'Transaction is allocated to jobs; remove job splits before marking payroll' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.mercury_tally_payroll_flags (mercury_transaction_id, is_payroll, source, rule_id, created_by, updated_at)
  VALUES (p_mercury_transaction_id, p_is_payroll, 'manual', NULL, auth.uid(), now())
  ON CONFLICT (mercury_transaction_id) DO UPDATE
    SET is_payroll = EXCLUDED.is_payroll, source = 'manual', rule_id = NULL, updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.attributor_flag_transaction_payroll(uuid, boolean) IS
  'Mark a non-card money-out transaction as payroll (contract-labor ACHs etc. — direct labor already counted via hours × wage; splitting the payment too would double-count). Same invariant and manual-source semantics as set_tally_payroll_flag, but callable by banking_attributors as well as dev, and scoped to non-card transactions.';

-- 6) Grants -----------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.is_banking_attributor() FROM anon;
REVOKE ALL ON FUNCTION public.list_unattributed_noncard_mercury_transactions(integer) FROM anon;
REVOKE ALL ON FUNCTION public.count_unattributed_noncard_mercury_transactions() FROM anon;
REVOKE ALL ON FUNCTION public.resolve_noncard_transaction_attribution(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.unresolve_noncard_transaction_attribution(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.attributor_allocate_transaction_to_job(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.attributor_flag_transaction_payroll(uuid, boolean) FROM anon;

GRANT EXECUTE ON FUNCTION public.is_banking_attributor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_unattributed_noncard_mercury_transactions(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_unattributed_noncard_mercury_transactions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_noncard_transaction_attribution(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unresolve_noncard_transaction_attribution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attributor_allocate_transaction_to_job(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attributor_flag_transaction_payroll(uuid, boolean) TO authenticated;

-- 7) New tables get the read-only (training mode) blocks ---------------------------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
