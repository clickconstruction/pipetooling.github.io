SET lock_timeout = '3s';

-- People in Rules (v2.1725): an accounting rule can also name WHO a payment
-- goes to. Approving a suggestion from such a rule writes the same
-- mercury_transaction_attributions row the "Link to person and jobs" window
-- writes — never overwriting an attribution someone already set by hand.

-- 1) Rules gain an optional attribution target (person XOR user, mirroring
--    mercury_transaction_attributions).
ALTER TABLE public.mercury_accounting_label_rules
  ADD COLUMN IF NOT EXISTS attributed_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attributed_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mercury_accounting_label_rules_person_xor_user'
      AND conrelid = 'public.mercury_accounting_label_rules'::regclass
  ) THEN
    ALTER TABLE public.mercury_accounting_label_rules
      ADD CONSTRAINT mercury_accounting_label_rules_person_xor_user
      CHECK (NOT (attributed_person_id IS NOT NULL AND attributed_user_id IS NOT NULL));
  END IF;
END
$$;

-- 2) Bulk approve also writes the rule's attribution. Full function body is
--    the baseline version plus the attributions INSERT (ON CONFLICT DO
--    NOTHING = a hand-set attribution always wins).
CREATE OR REPLACE FUNCTION "public"."bulk_approve_accounting_label_suggestions"("p_items" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n_payload integer;
  v_n_valid integer;
  v_updated integer;
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

  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  SELECT count(*)::integer INTO v_n_payload FROM jsonb_array_elements(p_items) AS _;

  IF v_n_payload = 0 THEN
    RETURN 0;
  END IF;

  IF v_n_payload > 500 THEN
    RAISE EXCEPTION 'At most 500 suggestions per request';
  END IF;

  CREATE TEMP TABLE _approve_acct_payload ON COMMIT DROP AS
  SELECT
    (elem->>'suggestion_id')::uuid AS suggestion_id,
    (elem->>'mercury_transaction_id')::uuid AS mercury_transaction_id,
    (elem->>'label_id')::uuid AS label_id
  FROM jsonb_array_elements(p_items) AS t(elem);

  IF EXISTS (
    SELECT 1 FROM _approve_acct_payload p
    WHERE p.suggestion_id IS NULL
       OR p.mercury_transaction_id IS NULL
       OR p.label_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Each item must include suggestion_id, mercury_transaction_id, and label_id';
  END IF;

  SELECT count(*)::integer INTO v_n_valid
  FROM _approve_acct_payload p
  INNER JOIN public.mercury_accounting_label_suggestions s
    ON s.id = p.suggestion_id
   AND s.mercury_transaction_id = p.mercury_transaction_id
   AND s.status = 'pending';

  IF v_n_valid IS DISTINCT FROM v_n_payload THEN
    RAISE EXCEPTION 'One or more suggestions are missing, not pending, or transaction id mismatch';
  END IF;

  INSERT INTO public.mercury_transaction_drag_sort_assignments (mercury_transaction_id, label_id)
  SELECT p.mercury_transaction_id, p.label_id
  FROM _approve_acct_payload p
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    label_id = EXCLUDED.label_id,
    assigned_at = now();

  -- People in Rules (v2.1725): the approving rule may also attribute a person.
  -- DISTINCT ON guards duplicate txs in one payload; ON CONFLICT DO NOTHING
  -- keeps any attribution that already exists (hand-set wins, forever).
  INSERT INTO public.mercury_transaction_attributions (mercury_transaction_id, person_id, user_id)
  SELECT DISTINCT ON (p.mercury_transaction_id)
    p.mercury_transaction_id,
    r.attributed_person_id,
    r.attributed_user_id
  FROM _approve_acct_payload p
  INNER JOIN public.mercury_accounting_label_suggestions s ON s.id = p.suggestion_id
  INNER JOIN public.mercury_accounting_label_rules r ON r.id = s.rule_id
  WHERE (r.attributed_person_id IS NOT NULL OR r.attributed_user_id IS NOT NULL)
  ON CONFLICT (mercury_transaction_id) DO NOTHING;

  UPDATE public.mercury_accounting_label_suggestions s
  SET
    status = 'approved',
    final_label_id = p.label_id,
    resolved_at = now(),
    resolved_by = v_uid
  FROM _approve_acct_payload p
  WHERE s.id = p.suggestion_id
    AND s.status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;
