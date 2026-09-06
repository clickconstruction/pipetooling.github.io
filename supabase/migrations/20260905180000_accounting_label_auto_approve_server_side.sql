SET lock_timeout = '3s';

-- Bank-label rule matches approve themselves server-side (journey-map Tier-2 #27).
--
-- The suggestion machine is always-on and server-side (mercury-webhook mints a
-- pending mercury_accounting_label_suggestions row on every delivery that a
-- rule matches), but the only approver was the per-user "Approve by default"
-- browser checkbox (v2.581) — a client effect that ran only while someone had
-- Banking → Accounting mounted. 349 rule matches (~$139K "Unlabeled" in the
-- P&L / Card Review / Visuals, oldest 16 days) were waiting for nobody.
--
-- This migration:
--   1. seeds the ORG switch app_settings.accounting_label_auto_approve_rule_matches
--      (ships 'false'; a dev/master flips it on Banking → Accounting);
--   2. lets master_technician (not just dev) flip that one key;
--   3. adds the writer auto_approve_pending_accounting_label_suggestions(uuid[]) —
--      approves pending rule matches for the given transactions with EXACTLY the
--      rows bulk_approve_accounting_label_suggestions writes (assignment upsert,
--      rule attribution, suggestion status), resolved_by NULL = "by the rule";
--      skips Internal Transfers × job-split conflicts and hand-labeled txs;
--   4. makes bulk_insert_accounting_label_suggestions (client Apply rules) call
--      the writer for the rows it just minted — mercury-webhook calls it via RPC;
--   5. adds count_pending_accounting_label_suggestions(min_age_days) for the
--      Dashboard / Quickfill Needs You "label-approvals" card (gate inside).
--
-- No data sweep: existing pending rows stay until someone clicks Approve all
-- (the Needs You card points at them). Idempotent; additive.

-- 1) Org switch, OFF until a dev turns it on.
INSERT INTO public.app_settings (key, value_text)
VALUES ('accounting_label_auto_approve_rule_matches', 'false')
ON CONFLICT (key) DO NOTHING;

-- 2) dev already has "Devs can manage app settings"; masters may flip this one key.
DROP POLICY IF EXISTS "master_or_dev_update_accounting_label_auto_approve" ON public.app_settings;
CREATE POLICY "master_or_dev_update_accounting_label_auto_approve"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'accounting_label_auto_approve_rule_matches' AND public.is_master_or_dev())
  WITH CHECK (key = 'accounting_label_auto_approve_rule_matches' AND public.is_master_or_dev());

COMMENT ON COLUMN public.mercury_accounting_label_suggestions.resolved_by IS
  'Approver/rejecter. NULL on an approved row = approved server-side by its rule (auto_approve_pending_accounting_label_suggestions, org switch accounting_label_auto_approve_rule_matches) — the `by: rule` half of label_suggestion_approved telemetry; client approvals always write auth.uid().';

-- 3) The writer. Internal — not callable by authenticated users; service_role
--    (mercury-webhook) and the SECURITY DEFINER RPCs below call it.
CREATE OR REPLACE FUNCTION public.auto_approve_pending_accounting_label_suggestions(p_tx_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_on boolean;
  v_ids uuid[];
  v_updated integer;
BEGIN
  IF p_tx_ids IS NULL OR cardinality(p_tx_ids) = 0 THEN
    RETURN 0;
  END IF;

  -- Gate 1: the org switch (mirrors shouldAutoApproveSuggestion → 'switch_off').
  SELECT lower(trim(coalesce(a.value_text, ''))) = 'true'
    INTO v_on
  FROM public.app_settings a
  WHERE a.key = 'accounting_label_auto_approve_rule_matches';
  IF NOT coalesce(v_on, false) THEN
    RETURN 0;
  END IF;

  -- Gates 2–5, same order as the kernel: pending; rule present + enabled; no
  -- hand-set assignment; not Internal Transfers on a transaction with job splits.
  SELECT array_agg(s.id)
    INTO v_ids
  FROM public.mercury_accounting_label_suggestions s
  INNER JOIN public.mercury_accounting_label_rules r ON r.id = s.rule_id AND r.enabled
  INNER JOIN public.mercury_drag_sort_labels l ON l.id = s.suggested_label_id
  WHERE s.mercury_transaction_id = ANY (p_tx_ids)
    AND s.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.mercury_transaction_drag_sort_assignments d
      WHERE d.mercury_transaction_id = s.mercury_transaction_id
    )
    AND NOT (
      coalesce(l.default_key, '') = 'internal_transfers'
      AND EXISTS (
        SELECT 1 FROM public.mercury_transaction_job_allocations j
        WHERE j.mercury_transaction_id = s.mercury_transaction_id
      )
    );

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN 0;
  END IF;

  -- Same three writes as bulk_approve_accounting_label_suggestions, in order.
  INSERT INTO public.mercury_transaction_drag_sort_assignments (mercury_transaction_id, label_id)
  SELECT s.mercury_transaction_id, s.suggested_label_id
  FROM public.mercury_accounting_label_suggestions s
  WHERE s.id = ANY (v_ids)
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    label_id = EXCLUDED.label_id,
    assigned_at = now();

  -- People in Rules (v2.1725): a rule may also attribute a person. ON CONFLICT
  -- DO NOTHING = a hand-set attribution always wins.
  INSERT INTO public.mercury_transaction_attributions (mercury_transaction_id, person_id, user_id)
  SELECT DISTINCT ON (s.mercury_transaction_id)
    s.mercury_transaction_id,
    r.attributed_person_id,
    r.attributed_user_id
  FROM public.mercury_accounting_label_suggestions s
  INNER JOIN public.mercury_accounting_label_rules r ON r.id = s.rule_id
  WHERE s.id = ANY (v_ids)
    AND (r.attributed_person_id IS NOT NULL OR r.attributed_user_id IS NOT NULL)
  ON CONFLICT (mercury_transaction_id) DO NOTHING;

  UPDATE public.mercury_accounting_label_suggestions s
  SET
    status = 'approved',
    final_label_id = s.suggested_label_id,
    resolved_at = now(),
    resolved_by = NULL  -- by the rule, not a person (see column comment)
  WHERE s.id = ANY (v_ids)
    AND s.status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.auto_approve_pending_accounting_label_suggestions(uuid[]) IS
  'Internal writer: when app_settings.accounting_label_auto_approve_rule_matches = true, approve the pending rule-matched suggestions for these transactions exactly as bulk_approve_accounting_label_suggestions would (assignment upsert + rule attribution + status), resolved_by NULL. Skips disabled rules, hand-labeled txs, and Internal Transfers on split txs. Called by bulk_insert_accounting_label_suggestions and by mercury-webhook (service_role). Returns rows approved.';

REVOKE ALL ON FUNCTION public.auto_approve_pending_accounting_label_suggestions(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_approve_pending_accounting_label_suggestions(uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_approve_pending_accounting_label_suggestions(uuid[]) TO service_role;

-- 4) Client "Apply rules" mints go through the same writer. Body = baseline
--    (20250101000000) plus the tail PERFORM; the return value is still the
--    number of suggestions inserted (the toast reads it), whether or not they
--    then approved themselves.
CREATE OR REPLACE FUNCTION public.bulk_insert_accounting_label_suggestions(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n_payload integer;
  v_inserted integer;
  v_tx_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_uid
      AND u.role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  SELECT count(*)::integer INTO v_n_payload FROM jsonb_array_elements(p_rows) AS _;

  IF v_n_payload = 0 THEN
    RETURN 0;
  END IF;

  IF v_n_payload > 2000 THEN
    RAISE EXCEPTION 'At most 2000 suggestion rows per request';
  END IF;

  INSERT INTO public.mercury_accounting_label_suggestions (
    mercury_transaction_id,
    rule_id,
    suggested_label_id,
    status
  )
  SELECT
    (elem->>'mercury_transaction_id')::uuid,
    (elem->>'rule_id')::uuid,
    (elem->>'suggested_label_id')::uuid,
    'pending'::text
  FROM jsonb_array_elements(p_rows) AS t(elem)
  WHERE (elem->>'mercury_transaction_id') IS NOT NULL
    AND (elem->>'rule_id') IS NOT NULL
    AND (elem->>'suggested_label_id') IS NOT NULL
  ON CONFLICT (mercury_transaction_id) WHERE (status = 'pending') DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Tier-2 #27: rule matches approve themselves where they are minted when the
  -- org switch is on (no-op otherwise). Only the txs in this payload.
  IF v_inserted > 0 THEN
    SELECT array_agg(DISTINCT (elem->>'mercury_transaction_id')::uuid)
      INTO v_tx_ids
    FROM jsonb_array_elements(p_rows) AS t(elem)
    WHERE (elem->>'mercury_transaction_id') IS NOT NULL;
    PERFORM public.auto_approve_pending_accounting_label_suggestions(v_tx_ids);
  END IF;

  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.bulk_insert_accounting_label_suggestions(jsonb) IS
  'Banking staff: insert pending accounting label suggestions in bulk; skips conflicts (max 2000). When app_settings.accounting_label_auto_approve_rule_matches is true the new rows approve themselves (auto_approve_pending_accounting_label_suggestions). Returns rows inserted.';

-- 5) Needs You card feed. Gate inside (list_bulk_deletion_alerts precedent):
--    the roles that can work the queue (bulk_approve's own list) get numbers,
--    everyone else the zero row — controller stays out until the Banking data
--    admits it (journey map N2 / Tier-2 #28).
CREATE OR REPLACE FUNCTION public.count_pending_accounting_label_suggestions(p_min_age_days integer DEFAULT 3)
RETURNS TABLE(pending integer, stale integer, stale_amount numeric, oldest_created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RETURN QUERY SELECT 0, 0, 0::numeric, NULL::timestamptz;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    count(*)::int,
    (count(*) FILTER (WHERE s.created_at <= now() - make_interval(days => greatest(coalesce(p_min_age_days, 0), 0))))::int,
    (coalesce(sum(abs(t.amount)) FILTER (WHERE s.created_at <= now() - make_interval(days => greatest(coalesce(p_min_age_days, 0), 0))), 0))::numeric,
    min(s.created_at)
  FROM public.mercury_accounting_label_suggestions s
  LEFT JOIN public.mercury_transactions t ON t.id = s.mercury_transaction_id
  WHERE s.status = 'pending';
END;
$$;

COMMENT ON FUNCTION public.count_pending_accounting_label_suggestions(integer) IS
  'Pending bank-label suggestions for the Needs You label-approvals card: (pending, stale = pending older than p_min_age_days, stale $ as sum of |amount|, oldest created_at). Gate inside: dev/master/assistant get numbers, everyone else the zero row.';

GRANT EXECUTE ON FUNCTION public.count_pending_accounting_label_suggestions(integer) TO authenticated;
