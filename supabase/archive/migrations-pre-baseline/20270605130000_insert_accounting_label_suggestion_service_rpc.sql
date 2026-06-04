-- Service-role-only insert of pending accounting label suggestions, for the
-- mercury-webhook Edge Function to pre-tag a transaction the instant it lands.
--
-- The existing public.bulk_insert_accounting_label_suggestions() hard-fails when
-- auth.uid() IS NULL (RAISE 'Not authenticated'), so a service-role Edge call
-- cannot use it. This variant performs the SAME insert (respecting the unique
-- partial index: one 'pending' suggestion per transaction) but with NO auth.uid()
-- check, and is callable ONLY by service_role.

CREATE OR REPLACE FUNCTION public.insert_accounting_label_suggestion_service(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_inserted integer;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
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
  RETURN v_inserted;
END;
$fn$;

COMMENT ON FUNCTION public.insert_accounting_label_suggestion_service(jsonb) IS
  'service_role only: insert pending accounting label suggestions from Edge (mercury-webhook). No auth.uid() check; skips conflicts via the one-pending-per-tx unique index.';

-- Lock down: only the service role (Edge functions) may execute this.
-- NOTE: Supabase grants EXECUTE on new public functions to `authenticated`/`anon`
-- via default privileges, so REVOKE FROM PUBLIC alone is insufficient — revoke
-- those roles explicitly.
REVOKE ALL ON FUNCTION public.insert_accounting_label_suggestion_service(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_accounting_label_suggestion_service(jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.insert_accounting_label_suggestion_service(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.insert_accounting_label_suggestion_service(jsonb) TO service_role;
