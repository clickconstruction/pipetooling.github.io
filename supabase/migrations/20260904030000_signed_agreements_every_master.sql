SET lock_timeout = '3s';

-- v2.2748 — every master is notified of every signature, regardless of whose estimate it is.
-- The org-scope filter (estimate_accept_notify_filter_eligible_user_ids) keeps recipients inside
-- the estimate master's org; masters in the candidate set now bypass it (they still need an
-- active, non-twin account with an email). Everyone else is filtered exactly as before.

CREATE OR REPLACE FUNCTION public.signed_agreement_notify_recipients(p_master_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txt text;
  v_ids uuid[];
  v_scoped uuid[];
  v_masters uuid[];
BEGIN
  SELECT value_text INTO v_txt FROM public.app_settings WHERE key = 'signed_agreements_notify_recipients_v1';
  BEGIN
    SELECT array_agg(x::uuid) INTO v_ids
      FROM jsonb_array_elements_text(COALESCE(NULLIF(btrim(v_txt), '')::jsonb, '[]'::jsonb)) AS t(x)
     WHERE x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  EXCEPTION WHEN others THEN
    v_ids := NULL;
  END;
  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    SELECT array_agg(u.id) INTO v_ids
      FROM public.users u
     WHERE u.archived_at IS NULL
       AND COALESCE(u.is_digital_twin, false) = false
       AND u.role IN ('dev', 'master_technician', 'assistant', 'controller');
  END IF;
  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  -- Everyone in the candidate set, inside the estimate master's org scope (has an email).
  v_scoped := COALESCE(public.estimate_accept_notify_filter_eligible_user_ids(p_master_user_id, v_ids), ARRAY[]::uuid[]);

  -- Masters in the candidate set: every one of them, whichever org the estimate belongs to.
  SELECT array_agg(u.id) INTO v_masters
    FROM public.users u
   WHERE u.id = ANY (v_ids)
     AND u.role = 'master_technician'
     AND u.archived_at IS NULL
     AND COALESCE(u.is_digital_twin, false) = false
     AND NULLIF(btrim(u.email), '') IS NOT NULL;

  RETURN ARRAY(SELECT DISTINCT x FROM unnest(v_scoped || COALESCE(v_masters, ARRAY[]::uuid[])) AS t(x));
END;
$$;
REVOKE ALL ON FUNCTION public.signed_agreement_notify_recipients(uuid) FROM public, anon, authenticated;
COMMENT ON FUNCTION public.signed_agreement_notify_recipients(uuid) IS
  'v2.2748: recipients of the Signed agreements email — the explicit settings list, else every active assistant/master/controller/dev — filtered to the master''s org scope, except masters, who always receive. Service role only.';
