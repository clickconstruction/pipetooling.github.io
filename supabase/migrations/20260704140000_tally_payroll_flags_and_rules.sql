-- Job Parts Tally "mark as payroll" — flags + auto-rules (dev-only).
--
-- Robert sometimes pays payroll on the company card. Those Mercury charges must NOT be split
-- across jobs (per-job labor already counts payroll via clocked hours x wage — splitting the
-- card charge too would double-count). Marking a transaction "payroll" resolves it (drops it
-- from the Tally unlinked queue) without any job allocation. Rules auto-mark by counterparty /
-- amount / bank description, mirroring banking accounting.
--
-- Invariant: a payroll flag and job allocations are mutually exclusive (enforced in the RPCs).

CREATE TABLE IF NOT EXISTS public.mercury_tally_payroll_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  criteria jsonb NOT NULL DEFAULT '{"v":1}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mercury_tally_payroll_flags (
  mercury_transaction_id uuid PRIMARY KEY REFERENCES public.mercury_transactions(id) ON DELETE CASCADE,
  is_payroll boolean NOT NULL,
  -- 'manual' rows (incl. is_payroll=false tombstones) are never overwritten by rule application.
  source text NOT NULL CHECK (source IN ('manual','rule')),
  rule_id uuid REFERENCES public.mercury_tally_payroll_rules(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mercury_tally_payroll_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercury_tally_payroll_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_all_payroll_rules ON public.mercury_tally_payroll_rules;
DROP POLICY IF EXISTS dev_all_payroll_flags ON public.mercury_tally_payroll_flags;
CREATE POLICY dev_all_payroll_rules ON public.mercury_tally_payroll_rules FOR ALL USING (is_dev()) WITH CHECK (is_dev());
CREATE POLICY dev_all_payroll_flags ON public.mercury_tally_payroll_flags FOR ALL USING (is_dev()) WITH CHECK (is_dev());

-- Manual mark/unmark with the block-when-split invariant. Unmark writes an is_payroll=false
-- 'manual' tombstone so a rule can't re-mark a transaction the user deliberately cleared.
CREATE OR REPLACE FUNCTION public.set_tally_payroll_flag(p_mercury_transaction_id uuid, p_is_payroll boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT is_dev() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  IF p_is_payroll AND EXISTS (SELECT 1 FROM mercury_transaction_job_allocations WHERE mercury_transaction_id = p_mercury_transaction_id) THEN
    RAISE EXCEPTION 'Transaction is allocated to jobs; remove job splits before marking payroll' USING ERRCODE='P0001';
  END IF;
  INSERT INTO mercury_tally_payroll_flags (mercury_transaction_id, is_payroll, source, rule_id, created_by, updated_at)
  VALUES (p_mercury_transaction_id, p_is_payroll, 'manual', NULL, auth.uid(), now())
  ON CONFLICT (mercury_transaction_id) DO UPDATE
    SET is_payroll = EXCLUDED.is_payroll, source = 'manual', rule_id = NULL, updated_at = now();
END $fn$;

-- Rule application: insert source='rule' flags only where no flag row exists (manual wins) and
-- the transaction has no job allocations. Returns inserted count.
CREATE OR REPLACE FUNCTION public.bulk_apply_tally_payroll_rule_flags(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_count integer;
BEGIN
  IF NOT is_dev() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  WITH rows AS (
    SELECT (x->>'mercury_transaction_id')::uuid AS tx, (x->>'rule_id')::uuid AS rule
    FROM jsonb_array_elements(p_rows) x
  ), ins AS (
    INSERT INTO mercury_tally_payroll_flags (mercury_transaction_id, is_payroll, source, rule_id, created_by)
    SELECT r.tx, true, 'rule', r.rule, auth.uid() FROM rows r
    WHERE NOT EXISTS (SELECT 1 FROM mercury_transaction_job_allocations a WHERE a.mercury_transaction_id = r.tx)
    ON CONFLICT (mercury_transaction_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END $fn$;

GRANT EXECUTE ON FUNCTION public.set_tally_payroll_flag(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_apply_tally_payroll_rule_flags(jsonb) TO authenticated;
