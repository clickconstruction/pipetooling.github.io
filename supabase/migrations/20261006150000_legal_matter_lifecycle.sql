SET lock_timeout = '3s';

-- Punch list #85, item 16, PR 2 (v2.4645): a legal matter's lifecycle. The client (v2.4631) already knows every
-- stage below and the functions read one list (supabase/functions/_shared/legalStages.ts); this widens the table.
--
--   1. Stages: post_judgment (abstract / garnishment), payment_plan, uncollectible, dismissed join the CHECK.
--   2. A pull-back carries the office's reason: pulled_at + pulled_reason, required by legal_pull_back, carried
--      in the 'pulled' queue payload so the firm's email says it; the portal keeps the matter readable, slim.
--   3. legal_close_matter closes any of the firm's ends (settled · uncollectible · dismissed) as well as a write-down.
--   4. legal_set_stage: the office accepts a firm step that would have moved the stage backward (it was recorded
--      with meta.proposed and the stage left alone, v2.4631) — the stage moves and the proposal is acknowledged.
--   5. The release / pull-back trigger reads every portal stage, not the first four.

-- 1. The stage CHECK (the inline one from 20260911195745 is legal_matters_stage_check; drop whatever holds stage).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.legal_matters'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%stage%'
      AND conname <> 'legal_matters_stage_check_v2'
  LOOP
    EXECUTE format('ALTER TABLE public.legal_matters DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
DO $$
BEGIN
  ALTER TABLE public.legal_matters ADD CONSTRAINT legal_matters_stage_check_v2 CHECK (stage IN (
    'review', 'referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan',
    'settled', 'uncollectible', 'dismissed', 'written_down', 'pulled'
  )) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.legal_matters VALIDATE CONSTRAINT legal_matters_stage_check_v2;

-- 2. The pull-back's reason.
ALTER TABLE public.legal_matters ADD COLUMN IF NOT EXISTS pulled_at timestamptz;
ALTER TABLE public.legal_matters ADD COLUMN IF NOT EXISTS pulled_reason text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.legal_matters.pulled_at IS 'When the office pulled the matter back from the firm (#85 item 16, v2.4645). Set by legal_pull_back, cleared by a new release. While set and the stage is review, the firm''s portal shows the matter read-only: the reason, its own fees and the conversation, none of the customer''s records.';
COMMENT ON COLUMN public.legal_matters.pulled_reason IS 'The office''s reason for the pull-back, required (v2.4645); the firm reads it on the portal and in the email.';

CREATE OR REPLACE FUNCTION public.legal_pull_back(p_matter_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job uuid;
  v_reason text := COALESCE(NULLIF(TRIM(p_note), ''), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.is_dev() THEN RETURN jsonb_build_object('error', 'Only a dev can pull an account back'); END IF;
  IF v_reason = '' THEN RETURN jsonb_build_object('error', 'Say why: the firm reads the reason'); END IF;
  UPDATE public.legal_matters
    SET stage = 'review', released_at = NULL, ready_marked_at = NULL, ready_marked_by = NULL,
        pulled_at = now(), pulled_reason = v_reason, updated_at = now()
  WHERE id = p_matter_id AND stage NOT IN ('review', 'written_down') AND closed_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Matter not found or not with a firm'); END IF;
  INSERT INTO public.legal_matter_entries (matter_id, kind, body, created_by)
  VALUES (p_matter_id, 'step', 'Pulled back from counsel — ' || v_reason, auth.uid());
  FOR v_job IN SELECT job_id FROM public.legal_matter_jobs WHERE matter_id = p_matter_id LOOP
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES (v_job, 'legal_change', now(), auth.uid(), 'Pulled back from counsel', jsonb_build_object('matter_id', p_matter_id, 'stage', 'review', 'reason', v_reason), false);
  END LOOP;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_pull_back(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_pull_back(uuid, text) TO authenticated;

-- A new release clears the pull-back (the rest is 20260911195745's body, unchanged).
CREATE OR REPLACE FUNCTION public.legal_mark_attorney_ready(
  p_payer_key text,
  p_customer_id uuid,
  p_payer_name text,
  p_job_ids uuid[],
  p_firm_id uuid,
  p_handling_name text DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_firm_name text;
  v_job uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.is_dev() THEN RETURN jsonb_build_object('error', 'Only a dev can mark an account attorney-ready'); END IF;
  SELECT name INTO v_firm_name FROM public.legal_firms WHERE id = p_firm_id AND active;
  IF v_firm_name IS NULL THEN RETURN jsonb_build_object('error', 'Pick an active firm first (Settings → Legal)'); END IF;
  IF p_job_ids IS NULL OR array_length(p_job_ids, 1) IS NULL THEN RETURN jsonb_build_object('error', 'No jobs in this account'); END IF;

  INSERT INTO public.legal_matters (payer_key, customer_id, payer_name, created_by)
  VALUES (p_payer_key, p_customer_id, COALESCE(p_payer_name, ''), auth.uid())
  ON CONFLICT (payer_key) DO UPDATE
    SET customer_id = COALESCE(EXCLUDED.customer_id, public.legal_matters.customer_id),
        payer_name = CASE WHEN EXCLUDED.payer_name <> '' THEN EXCLUDED.payer_name ELSE public.legal_matters.payer_name END
  RETURNING id INTO v_id;

  DELETE FROM public.legal_matter_jobs WHERE matter_id = v_id AND NOT (job_id = ANY (p_job_ids));
  INSERT INTO public.legal_matter_jobs (matter_id, job_id)
  SELECT v_id, j FROM unnest(p_job_ids) AS j ON CONFLICT DO NOTHING;

  UPDATE public.legal_matters
    SET stage = 'referred',
        firm_id = p_firm_id,
        handling_name = COALESCE(NULLIF(TRIM(p_handling_name), ''), ''),
        note_to_firm = COALESCE(NULLIF(TRIM(p_note), ''), ''),
        ready_marked_by = auth.uid(), ready_marked_at = now(), released_at = now(),
        review_requested_by = NULL, review_requested_at = NULL, review_request_note = '',
        closed_at = NULL, closed_reason = '',
        pulled_at = NULL, pulled_reason = '',
        updated_at = now()
  WHERE id = v_id;

  INSERT INTO public.legal_matter_entries (matter_id, kind, body, created_by)
  VALUES (v_id, 'step', 'Marked attorney-ready — released to ' || v_firm_name
    || CASE WHEN COALESCE(NULLIF(TRIM(p_handling_name), ''), '') <> '' THEN ' · handling ' || TRIM(p_handling_name) ELSE '' END,
    auth.uid());

  FOREACH v_job IN ARRAY p_job_ids LOOP
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES (v_job, 'legal_change', now(), auth.uid(), 'Released to counsel — ' || v_firm_name,
      jsonb_build_object('matter_id', v_id, 'stage', 'referred', 'firm_id', p_firm_id), false);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'matter_id', v_id, 'firm', v_firm_name);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_mark_attorney_ready(text, uuid, text, uuid[], uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_mark_attorney_ready(text, uuid, text, uuid[], uuid, text, text) TO authenticated;

-- 3. Close any of the firm's ends, or a write-down.
CREATE OR REPLACE FUNCTION public.legal_close_matter(p_matter_id uuid, p_stage text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_stage NOT IN ('written_down', 'settled', 'uncollectible', 'dismissed') THEN RETURN jsonb_build_object('error', 'Close as written down, settled, uncollectible or dismissed'); END IF;
  UPDATE public.legal_matters
    SET stage = p_stage, closed_at = now(), closed_reason = COALESCE(NULLIF(TRIM(p_note), ''), ''), updated_at = now()
  WHERE id = p_matter_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  INSERT INTO public.legal_matter_entries (matter_id, kind, body, created_by)
  VALUES (p_matter_id, 'step', CASE p_stage WHEN 'written_down' THEN 'Written down' WHEN 'uncollectible' THEN 'Closed as uncollectible' WHEN 'dismissed' THEN 'Closed as dismissed' ELSE 'Settled' END
    || CASE WHEN COALESCE(NULLIF(TRIM(p_note), ''), '') <> '' THEN ' — ' || TRIM(p_note) ELSE '' END, auth.uid());
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_close_matter(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_close_matter(uuid, text, text) TO authenticated;

-- 4. The office accepts a firm step that would have moved the stage back.
CREATE OR REPLACE FUNCTION public.legal_set_stage(p_matter_id uuid, p_stage text, p_entry_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_stage NOT IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed') THEN
    RETURN jsonb_build_object('error', 'Not a stage the firm works');
  END IF;
  SELECT stage INTO v_from FROM public.legal_matters WHERE id = p_matter_id AND closed_at IS NULL AND firm_id IS NOT NULL
    AND stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed')
    FOR UPDATE;
  IF v_from IS NULL THEN RETURN jsonb_build_object('error', 'The matter is not with the firm'); END IF;
  UPDATE public.legal_matters SET stage = p_stage, updated_at = now() WHERE id = p_matter_id;
  IF p_entry_id IS NOT NULL THEN
    UPDATE public.legal_matter_entries SET acknowledged_at = now(), acknowledged_by = auth.uid()
    WHERE id = p_entry_id AND matter_id = p_matter_id AND acknowledged_at IS NULL;
  END IF;
  INSERT INTO public.legal_matter_entries (matter_id, kind, body, meta, created_by)
  VALUES (p_matter_id, 'step', 'Stage moved from ' || replace(v_from, '_', ' ') || ' to ' || replace(p_stage, '_', ' ') || ' by the office',
    jsonb_build_object('stage', p_stage, 'from', v_from, 'proposalId', p_entry_id), auth.uid());
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_set_stage(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_set_stage(uuid, text, uuid) TO authenticated;

-- 5. The release / pull-back trigger over every portal stage; the pull-back's reason rides the payload.
CREATE OR REPLACE FUNCTION public.legal_matters_notify_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_portal text[] := ARRAY['referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed'];
BEGIN
  IF NEW.firm_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.stage = 'referred' AND (OLD.stage IS DISTINCT FROM NEW.stage) AND NOT (OLD.stage = ANY (v_portal)) THEN
    INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
    VALUES (NEW.firm_id, NEW.id, 'referred', jsonb_build_object('payer', NEW.payer_name, 'handling', NEW.handling_name, 'note', NEW.note_to_firm));
  ELSIF NEW.stage = 'review' AND OLD.stage = ANY (v_portal) THEN
    INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
    VALUES (NEW.firm_id, NEW.id, 'pulled', jsonb_build_object('payer', NEW.payer_name, 'reason', NEW.pulled_reason));
  END IF;
  RETURN NEW;
END;
$$;
