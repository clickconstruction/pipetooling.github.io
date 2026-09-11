SET lock_timeout = '3s';

-- Legal portal train, PR 2 (v2.3313): the gate between Collections and a law firm.
--
-- A LEGAL MATTER is one paying account (`payer_key` — 'c:<customer uuid>' when the
-- payer has a customers row, 'n:<name>' for name-only jobs) and the Collections jobs it
-- spans. The office curates it on the Legal desk; only a dev marks it attorney-ready,
-- and that mark IS the release: stage 'review' → 'referred' puts it on the firm's portal
-- (PR 3). The firm's later stages (demand · suit · judgment · settled) come back through
-- the portal (PR 4). 'written_down' is the other exit; 'pulled' returns it to review.
--
-- Tables are office-read; every write is a SECURITY DEFINER RPC below with its own gate.
-- Nothing here is readable by anon; the firm's portal reads through the service role.

CREATE TABLE IF NOT EXISTS public.legal_firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  handling_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  contingency_pct numeric NOT NULL DEFAULT 33 CHECK (contingency_pct >= 0 AND contingency_pct <= 100),
  filing_cost numeric NOT NULL DEFAULT 350 CHECK (filing_cost >= 0),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.legal_firms IS 'The collections law firm(s) the office works with (v2.3313). One active row today; the fee model (contingency %, filing cost) drives the Legal desk''s worth panel. Dev-only writes.';

CREATE TABLE IF NOT EXISTS public.legal_matters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_key text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  payer_name text NOT NULL DEFAULT '',
  firm_id uuid REFERENCES public.legal_firms(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'review'
    CHECK (stage IN ('review', 'referred', 'demand', 'suit', 'judgment', 'settled', 'written_down', 'pulled')),
  ready_marked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ready_marked_at timestamptz,
  released_at timestamptz,
  handling_name text NOT NULL DEFAULT '',
  note_to_firm text NOT NULL DEFAULT '',
  review_requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  review_requested_at timestamptz,
  review_request_note text NOT NULL DEFAULT '',
  held_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  fees_to_statement boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  closed_reason text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.legal_matters IS 'One row per paying account the office has parked in Collections and touched on the Legal desk (v2.3313). stage review → referred (a dev''s attorney-ready mark IS the release) → the firm''s stages; written_down / pulled are the exits. held_overrides: {"<timeline key>": true|false} — true holds an entry back from counsel, false shares one dated before the first bill.';
COMMENT ON COLUMN public.legal_matters.payer_key IS 'c:<customer uuid> for a customer/GC payer, n:<lowercased name> for a name-only job (src/lib/legal/legalPacket.ts payerForJob).';

CREATE TABLE IF NOT EXISTS public.legal_matter_jobs (
  matter_id uuid NOT NULL REFERENCES public.legal_matters(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  PRIMARY KEY (matter_id, job_id)
);
CREATE INDEX IF NOT EXISTS legal_matter_jobs_job_idx ON public.legal_matter_jobs (job_id);

CREATE TABLE IF NOT EXISTS public.legal_matter_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.legal_matters(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('fee', 'cost', 'step', 'question', 'answer', 'payment_received', 'recovery_applied', 'note')),
  amount numeric,
  body text NOT NULL DEFAULT '',
  occurred_on date NOT NULL DEFAULT public.app_today(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  via_portal boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS legal_matter_entries_matter_idx ON public.legal_matter_entries (matter_id, created_at);
COMMENT ON TABLE public.legal_matter_entries IS 'Append-only stream on a legal matter (v2.3313): the firm''s fees and costs, steps (demand · suit · judgment · settled), questions and the office''s answers, payments the firm reports and the office applies, notes. via_portal marks the firm''s own entries (PR 4); acknowledged_at clears them from the office''s Needs You.';

ALTER TABLE public.legal_firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_matter_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_matter_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.legal_office_can_read()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.legal_office_can_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_office_can_read() TO authenticated;

DROP POLICY IF EXISTS legal_firms_office_select ON public.legal_firms;
CREATE POLICY legal_firms_office_select ON public.legal_firms FOR SELECT TO authenticated USING (public.legal_office_can_read());
DROP POLICY IF EXISTS legal_firms_dev_insert ON public.legal_firms;
CREATE POLICY legal_firms_dev_insert ON public.legal_firms FOR INSERT TO authenticated WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS legal_firms_dev_update ON public.legal_firms;
CREATE POLICY legal_firms_dev_update ON public.legal_firms FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());

DROP POLICY IF EXISTS legal_matters_office_select ON public.legal_matters;
CREATE POLICY legal_matters_office_select ON public.legal_matters FOR SELECT TO authenticated USING (public.legal_office_can_read());
DROP POLICY IF EXISTS legal_matter_jobs_office_select ON public.legal_matter_jobs;
CREATE POLICY legal_matter_jobs_office_select ON public.legal_matter_jobs FOR SELECT TO authenticated USING (public.legal_office_can_read());
DROP POLICY IF EXISTS legal_matter_entries_office_select ON public.legal_matter_entries;
CREATE POLICY legal_matter_entries_office_select ON public.legal_matter_entries FOR SELECT TO authenticated USING (public.legal_office_can_read());

-- ---------------------------------------------------------------------------
-- Writes: one RPC per act, each with its own gate.
-- ---------------------------------------------------------------------------

-- Office: create or refresh the matter in review — its job set, held-entry overrides,
-- and the "ask a dev to review" flag. Never changes the stage.
CREATE OR REPLACE FUNCTION public.legal_matter_save_review(
  p_payer_key text,
  p_customer_id uuid,
  p_payer_name text,
  p_job_ids uuid[],
  p_held_overrides jsonb DEFAULT NULL,
  p_request_review boolean DEFAULT NULL,
  p_review_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_payer_key IS NULL OR p_payer_key = '' THEN RETURN jsonb_build_object('error', 'Missing payer'); END IF;

  INSERT INTO public.legal_matters (payer_key, customer_id, payer_name, created_by)
  VALUES (p_payer_key, p_customer_id, COALESCE(p_payer_name, ''), auth.uid())
  ON CONFLICT (payer_key) DO UPDATE
    SET customer_id = COALESCE(EXCLUDED.customer_id, public.legal_matters.customer_id),
        payer_name = CASE WHEN EXCLUDED.payer_name <> '' THEN EXCLUDED.payer_name ELSE public.legal_matters.payer_name END,
        updated_at = now()
  RETURNING id INTO v_id;

  IF p_job_ids IS NOT NULL THEN
    DELETE FROM public.legal_matter_jobs WHERE matter_id = v_id AND NOT (job_id = ANY (p_job_ids));
    INSERT INTO public.legal_matter_jobs (matter_id, job_id)
    SELECT v_id, j FROM unnest(p_job_ids) AS j
    ON CONFLICT DO NOTHING;
  END IF;

  IF p_held_overrides IS NOT NULL THEN
    UPDATE public.legal_matters SET held_overrides = p_held_overrides, updated_at = now() WHERE id = v_id;
  END IF;

  IF p_request_review IS TRUE THEN
    UPDATE public.legal_matters
      SET review_requested_by = auth.uid(), review_requested_at = now(),
          review_request_note = COALESCE(NULLIF(TRIM(p_review_note), ''), ''), updated_at = now()
    WHERE id = v_id;
  ELSIF p_request_review IS FALSE THEN
    UPDATE public.legal_matters
      SET review_requested_by = NULL, review_requested_at = NULL, review_request_note = '', updated_at = now()
    WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'matter_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_matter_save_review(text, uuid, text, uuid[], jsonb, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_matter_save_review(text, uuid, text, uuid[], jsonb, boolean, text) TO authenticated;

-- Dev only: attorney-ready IS the release. Stage → referred, firm + handling person + note
-- stamped, the review request cleared, a step entry written, and one activity event per job.
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

-- Dev only: pull a released matter back to review. The firm stops seeing it (PR 3 reads stage).
CREATE OR REPLACE FUNCTION public.legal_pull_back(p_matter_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.is_dev() THEN RETURN jsonb_build_object('error', 'Only a dev can pull an account back'); END IF;
  UPDATE public.legal_matters
    SET stage = 'review', released_at = NULL, ready_marked_at = NULL, ready_marked_by = NULL, updated_at = now()
  WHERE id = p_matter_id AND stage NOT IN ('review', 'written_down');
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Matter not found or not with a firm'); END IF;
  INSERT INTO public.legal_matter_entries (matter_id, kind, body, created_by)
  VALUES (p_matter_id, 'step', 'Pulled back from counsel' || CASE WHEN COALESCE(NULLIF(TRIM(p_note), ''), '') <> '' THEN ' — ' || TRIM(p_note) ELSE '' END, auth.uid());
  FOR v_job IN SELECT job_id FROM public.legal_matter_jobs WHERE matter_id = p_matter_id LOOP
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES (v_job, 'legal_change', now(), auth.uid(), 'Pulled back from counsel', jsonb_build_object('matter_id', p_matter_id, 'stage', 'review'), false);
  END LOOP;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_pull_back(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_pull_back(uuid, text) TO authenticated;

-- Office: close a matter — written_down (the other exit; the write-down itself happens on
-- the bill line) or settled. Idempotent on the stage.
CREATE OR REPLACE FUNCTION public.legal_close_matter(p_matter_id uuid, p_stage text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_stage NOT IN ('written_down', 'settled') THEN RETURN jsonb_build_object('error', 'Close as written_down or settled'); END IF;
  UPDATE public.legal_matters
    SET stage = p_stage, closed_at = now(), closed_reason = COALESCE(NULLIF(TRIM(p_note), ''), ''), updated_at = now()
  WHERE id = p_matter_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  INSERT INTO public.legal_matter_entries (matter_id, kind, body, created_by)
  VALUES (p_matter_id, 'step', CASE WHEN p_stage = 'written_down' THEN 'Written down' ELSE 'Settled' END
    || CASE WHEN COALESCE(NULLIF(TRIM(p_note), ''), '') <> '' THEN ' — ' || TRIM(p_note) ELSE '' END, auth.uid());
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_close_matter(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_close_matter(uuid, text, text) TO authenticated;

-- Office: append an entry (answer a question, note, a recovery applied, a fee/cost/step
-- recorded on the firm's behalf). The firm's own entries arrive via the portal (PR 4).
CREATE OR REPLACE FUNCTION public.legal_add_entry(
  p_matter_id uuid, p_kind text, p_amount numeric DEFAULT NULL, p_body text DEFAULT '', p_occurred_on date DEFAULT NULL, p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_matters WHERE id = p_matter_id) THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  INSERT INTO public.legal_matter_entries (matter_id, kind, amount, body, occurred_on, meta, created_by)
  VALUES (p_matter_id, p_kind, p_amount, COALESCE(p_body, ''), COALESCE(p_occurred_on, public.app_today()), COALESCE(p_meta, '{}'::jsonb), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_add_entry(uuid, text, numeric, text, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_add_entry(uuid, text, numeric, text, date, jsonb) TO authenticated;

-- Office: acknowledge a firm entry (clears it from Needs You).
CREATE OR REPLACE FUNCTION public.legal_acknowledge_entry(p_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  UPDATE public.legal_matter_entries SET acknowledged_at = now(), acknowledged_by = auth.uid() WHERE id = p_entry_id AND acknowledged_at IS NULL;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_acknowledge_entry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_acknowledge_entry(uuid) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
