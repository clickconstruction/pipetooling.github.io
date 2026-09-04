SET lock_timeout = '3s';

-- v2.2743 — Signed agreements stream.
--   signed_agreement_notify_recipients(master): who gets the "Signed —" email. The explicit list
--     in app_settings.signed_agreements_notify_recipients_v1 (JSON array of user ids); when it is
--     empty, everyone who is an assistant, master, controller or dev. Always run through the
--     existing org-scope + has-email filter.
--   auto_create_job_from_signed_estimate(estimate): the one-call job for a signed estimate or
--     bid-room proposal — returns the existing job when one is already linked (or already made
--     for the same bid), otherwise creates it through the real create_job_from_estimate RPC,
--     acting as the estimate's owner, with the next job number and the accepted lines as
--     Specific Work. Service role only (the signature edge functions call it).
--   The old org-wide "estimate accepted" list is folded into the new stream's list once.

CREATE OR REPLACE FUNCTION public.signed_agreement_notify_recipients(p_master_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txt text;
  v_ids uuid[];
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
  RETURN COALESCE(public.estimate_accept_notify_filter_eligible_user_ids(p_master_user_id, v_ids), ARRAY[]::uuid[]);
END;
$$;
REVOKE ALL ON FUNCTION public.signed_agreement_notify_recipients(uuid) FROM public, anon, authenticated;
COMMENT ON FUNCTION public.signed_agreement_notify_recipients(uuid) IS
  'v2.2743: recipients of the Signed agreements email — the explicit settings list, else every active assistant/master/controller/dev — filtered to the master''s org scope. Service role only.';

CREATE OR REPLACE FUNCTION public.auto_create_job_from_signed_estimate(p_estimate_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e record;
  v_job uuid;
  v_fixtures jsonb;
  v_name text;
BEGIN
  SELECT id, status, job_ledger_id, bid_id, master_user_id, customer_id, title, for_address, line_items_snapshot
    INTO e
    FROM public.estimates
   WHERE id = p_estimate_id;
  IF e.id IS NULL THEN
    RAISE EXCEPTION 'estimate not found';
  END IF;
  IF e.job_ledger_id IS NOT NULL THEN
    RETURN e.job_ledger_id;
  END IF;
  IF e.status <> 'customer_accepted' THEN
    RAISE EXCEPTION 'estimate must be customer_accepted';
  END IF;

  -- A job someone already made for this bid by hand: link it, never duplicate it.
  IF e.bid_id IS NOT NULL THEN
    SELECT id INTO v_job FROM public.jobs_ledger WHERE bid_id = e.bid_id ORDER BY created_at DESC LIMIT 1;
    IF v_job IS NOT NULL THEN
      UPDATE public.estimates SET job_ledger_id = v_job WHERE id = e.id;
      RETURN v_job;
    END IF;
  END IF;

  -- Specific Work from the accepted lines — the same mapping as
  -- src/lib/createJobFromEstimateSubmit.ts#fixturesPayloadForCreateJobFromEstimate.
  SELECT COALESCE(
           jsonb_agg(jsonb_build_object(
             'name', s.name,
             'count', s.qty,
             'line_unit_price', s.unit_price,
             'line_description', s.line_description,
             'sequence_order', s.ord - 1
           ) ORDER BY s.ord),
           '[]'::jsonb)
    INTO v_fixtures
    FROM (
      SELECT t.ord,
             COALESCE(NULLIF(btrim(t.li->>'line_item'), ''),
                      NULLIF(btrim(t.li->>'description'), ''),
                      CASE WHEN COALESCE((t.li->>'amount_cents')::numeric, 0) > 0 THEN 'Item' END) AS name,
             COALESCE((t.li->>'quantity')::numeric, 1) AS qty,
             round(COALESCE((t.li->>'unit_price_cents')::numeric, (t.li->>'amount_cents')::numeric, 0) / 100.0, 2) AS unit_price,
             CASE WHEN NULLIF(btrim(t.li->>'line_item'), '') IS NOT NULL THEN NULLIF(btrim(t.li->>'description'), '') END AS line_description
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(e.line_items_snapshot::jsonb) = 'array' THEN e.line_items_snapshot::jsonb ELSE '[]'::jsonb END
             ) WITH ORDINALITY AS t(li, ord)
    ) s
   WHERE s.name IS NOT NULL;

  -- Act as the estimate's owner so create_job_from_estimate's authorization and job-owner
  -- rules apply exactly as if they had pressed Create job themselves (transaction-local).
  PERFORM set_config('request.jwt.claim.sub', e.master_user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e.master_user_id, 'role', 'authenticated')::text, true);

  v_name := COALESCE(NULLIF(btrim(e.title), ''), 'Job from signed agreement');
  v_job := public.create_job_from_estimate(
    p_estimate_id,
    public.next_job_number_suggestion(),
    v_name,
    e.for_address,
    NULL::numeric,
    e.customer_id,
    v_fixtures
  );
  RETURN v_job;
END;
$$;
REVOKE ALL ON FUNCTION public.auto_create_job_from_signed_estimate(uuid) FROM public, anon, authenticated;
COMMENT ON FUNCTION public.auto_create_job_from_signed_estimate(uuid) IS
  'v2.2743: the job for a signed estimate / bid-room proposal — existing link or same-bid job first, else create_job_from_estimate as the owner with the next job number. Service role only.';

-- Fold the old org-wide "estimate accepted" list into the stream's list, once, if the stream has none.
INSERT INTO public.app_settings (key, value_text)
SELECT 'signed_agreements_notify_recipients_v1', old.value_text
  FROM public.app_settings old
 WHERE old.key = 'estimate_accepted_notify_recipients_v1'
   AND NULLIF(btrim(old.value_text), '') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.app_settings n WHERE n.key = 'signed_agreements_notify_recipients_v1')
ON CONFLICT (key) DO NOTHING;
