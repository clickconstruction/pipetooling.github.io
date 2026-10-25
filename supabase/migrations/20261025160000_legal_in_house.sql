SET lock_timeout = '3s';

-- A case the office runs itself (punch list #172, v2.5847).
--
-- The Legal desk's exits were Mark attorney ready (a dev releases the case to the firm) and Write it
-- down. A case the office runs itself while counsel is away or not yet engaged had no stage: on job 891
-- the settlement floor went into the narrative as a sentence, the offer and its expiry went onto the
-- Timeline by hand, and the questions saved for counsel lived outside the app. This migration gives the
-- matter an IN HOUSE stage an office role may set (the owner's call of 2026-10-25), with one line of why,
-- and an OFFER kind of entry — made or received, an amount, the day, the day it expires, a status —
-- so offers and their expiry days sit on the Timeline. Questions for counsel are the office's existing
-- asks (kind question), written while in house and read by the firm once the matter is released.
--
--   1. legal_matters: stage CHECK v3 gains 'in_house'; in_house_at / in_house_by / in_house_why.
--   2. legal_set_in_house / legal_leave_in_house — office writes; the matter is made when the account
--      has none; refused while the firm has the matter or once it is closed.
--   3. legal_matter_entries: kind CHECK v4 gains 'offer'; legal_offer_add / legal_offer_set_status;
--      legal_void_entry undoes an offer. Held from counsel under held_overrides key offer:<id>.
--
-- Additive and idempotent; no table is created, so no fence is owed.

-- 1. The stage.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.legal_matters'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%stage%'
      AND conname <> 'legal_matters_stage_check_v3'
  LOOP
    EXECUTE format('ALTER TABLE public.legal_matters DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
DO $$
BEGIN
  ALTER TABLE public.legal_matters ADD CONSTRAINT legal_matters_stage_check_v3 CHECK (stage IN (
    'review', 'in_house', 'referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan',
    'settled', 'uncollectible', 'dismissed', 'written_down', 'pulled'
  )) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.legal_matters VALIDATE CONSTRAINT legal_matters_stage_check_v3;

ALTER TABLE public.legal_matters ADD COLUMN IF NOT EXISTS in_house_at timestamptz;
ALTER TABLE public.legal_matters ADD COLUMN IF NOT EXISTS in_house_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.legal_matters ADD COLUMN IF NOT EXISTS in_house_why text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.legal_matters.in_house_at IS 'v2.5847 (punch list #172): when the office took the case in house (stage in_house); kept as history once the stage moves on.';
COMMENT ON COLUMN public.legal_matters.in_house_why IS 'v2.5847: one line of why — counsel away until …, not yet engaged.';

-- 2. Office: run it in house. The matter is made the way legal_matter_save_review makes it.
CREATE OR REPLACE FUNCTION public.legal_set_in_house(
  p_payer_key text, p_customer_id uuid, p_payer_name text, p_job_ids uuid[], p_why text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_stage text;
  v_closed timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_payer_key IS NULL OR p_payer_key = '' THEN RETURN jsonb_build_object('error', 'Missing payer'); END IF;
  IF length(COALESCE(p_why, '')) > 500 THEN RETURN jsonb_build_object('error', 'Keep the reason under 500 characters'); END IF;

  INSERT INTO public.legal_matters (payer_key, customer_id, payer_name, created_by)
  VALUES (p_payer_key, p_customer_id, COALESCE(p_payer_name, ''), auth.uid())
  ON CONFLICT (payer_key) DO UPDATE
    SET customer_id = COALESCE(EXCLUDED.customer_id, public.legal_matters.customer_id),
        payer_name = CASE WHEN EXCLUDED.payer_name <> '' THEN EXCLUDED.payer_name ELSE public.legal_matters.payer_name END,
        updated_at = now()
  RETURNING id, stage, closed_at INTO v_id, v_stage, v_closed;

  IF v_closed IS NOT NULL THEN RETURN jsonb_build_object('error', 'This matter is closed'); END IF;
  IF v_stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed') THEN
    RETURN jsonb_build_object('error', 'The firm has this matter; pull it back first');
  END IF;

  IF p_job_ids IS NOT NULL THEN
    DELETE FROM public.legal_matter_jobs WHERE matter_id = v_id AND NOT (job_id = ANY (p_job_ids));
    INSERT INTO public.legal_matter_jobs (matter_id, job_id)
    SELECT v_id, j FROM unnest(p_job_ids) AS j
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.legal_matters
    SET stage = 'in_house', in_house_at = now(), in_house_by = auth.uid(), in_house_why = COALESCE(TRIM(p_why), ''), updated_at = now()
  WHERE id = v_id;
  RETURN jsonb_build_object('ok', true, 'matter_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_set_in_house(text, uuid, text, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_set_in_house(text, uuid, text, uuid[], text) TO authenticated;
COMMENT ON FUNCTION public.legal_set_in_house(text, uuid, text, uuid[], text) IS 'Run a legal matter in house (v2.5847, punch list #172): stage in_house with one line of why, by an office role; the matter is made when the account has none; refused while the firm has it or once closed.';

CREATE OR REPLACE FUNCTION public.legal_leave_in_house(p_matter_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stage text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  SELECT stage INTO v_stage FROM public.legal_matters WHERE id = p_matter_id;
  IF v_stage IS NULL THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  IF v_stage <> 'in_house' THEN RETURN jsonb_build_object('error', 'This matter is not in house'); END IF;
  UPDATE public.legal_matters SET stage = 'review', updated_at = now() WHERE id = p_matter_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_leave_in_house(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_leave_in_house(uuid) TO authenticated;
COMMENT ON FUNCTION public.legal_leave_in_house(uuid) IS 'Back to review from in house (v2.5847). Office roles. The in_house_* history stays on the row.';

-- 3. Offers.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.legal_matter_entries'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%kind%'
      AND conname <> 'legal_matter_entries_kind_check_v4'
  LOOP
    EXECUTE format('ALTER TABLE public.legal_matter_entries DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
DO $$
BEGIN
  ALTER TABLE public.legal_matter_entries ADD CONSTRAINT legal_matter_entries_kind_check_v4 CHECK (kind IN (
    'fee', 'cost', 'step', 'question', 'answer', 'payment_received', 'recovery_applied', 'note', 'plan', 'event', 'offer'
  )) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.legal_matter_entries VALIDATE CONSTRAINT legal_matter_entries_kind_check_v4;

COMMENT ON TABLE public.legal_matter_entries IS 'Append-only stream on a legal matter (v2.3313): the firm''s fees and costs, steps (demand · suit · judgment · settled), questions and the office''s answers, payments the firm reports and the office applies, notes — since v2.5800 planned steps (kind ''plan''), since v2.5836 events the office records (kind ''event''), and since v2.5847 offers (kind ''offer'': amount = the offer, occurred_on = the day made or received, meta = { direction made | received, expires_on, status open | countered | accepted | withdrawn | expired, notes, source }; held under offer:<id>). via_portal marks the firm''s own entries (PR 4); acknowledged_at clears them from the office''s Needs You.';

CREATE OR REPLACE FUNCTION public.legal_offer_add(
  p_matter_id uuid, p_direction text, p_amount numeric, p_on date, p_expires_on date DEFAULT NULL, p_notes text DEFAULT '', p_source text DEFAULT 'office'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_dir text := lower(btrim(COALESCE(p_direction, '')));
  v_notes text := COALESCE(TRIM(p_notes), '');
  v_source text := CASE WHEN p_source IN ('office', 'mcp') THEN p_source ELSE 'office' END;
  v_body text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_matters WHERE id = p_matter_id) THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  IF v_dir NOT IN ('made', 'received') THEN RETURN jsonb_build_object('error', 'Say whether the offer was made or received'); END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('error', 'Type the offer''s amount'); END IF;
  IF p_on IS NULL THEN RETURN jsonb_build_object('error', 'Pick the day'); END IF;
  IF p_on > public.app_today() THEN RETURN jsonb_build_object('error', 'The day cannot be ahead of today'); END IF;
  IF p_expires_on IS NOT NULL AND p_expires_on < p_on THEN RETURN jsonb_build_object('error', 'An offer cannot expire before it was made'); END IF;
  IF length(v_notes) > 4000 THEN RETURN jsonb_build_object('error', 'Keep the notes under 4,000 characters'); END IF;
  v_body := CASE WHEN v_dir = 'made' THEN 'Offer made' ELSE 'Offer received' END;
  INSERT INTO public.legal_matter_entries (matter_id, kind, amount, body, occurred_on, meta, created_by)
  VALUES (p_matter_id, 'offer', p_amount, v_body, p_on,
    jsonb_build_object('direction', v_dir, 'expires_on', CASE WHEN p_expires_on IS NULL THEN NULL ELSE to_char(p_expires_on, 'YYYY-MM-DD') END, 'status', 'open', 'notes', v_notes, 'source', v_source), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_offer_add(uuid, text, numeric, date, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_offer_add(uuid, text, numeric, date, date, text, text) TO authenticated;
COMMENT ON FUNCTION public.legal_offer_add(uuid, text, numeric, date, date, text, text) IS 'Log an offer on a legal matter (v2.5847, punch list #172): made or received, the amount, the day (not ahead of today), the day it expires, notes. Office roles.';

CREATE OR REPLACE FUNCTION public.legal_offer_set_status(p_entry_id uuid, p_status text, p_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.legal_matter_entries%ROWTYPE;
  v_status text := lower(btrim(COALESCE(p_status, '')));
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF v_status NOT IN ('open', 'countered', 'accepted', 'withdrawn', 'expired') THEN RETURN jsonb_build_object('error', 'The status must be open, countered, accepted, withdrawn or expired'); END IF;
  SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Offer not found'); END IF;
  IF v_entry.kind <> 'offer' THEN RETURN jsonb_build_object('error', 'Only an offer takes a status'); END IF;
  IF v_entry.voided_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'That offer was undone'); END IF;
  UPDATE public.legal_matter_entries
    SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('status', v_status, 'status_at', now(), 'status_by', auth.uid(), 'status_note', COALESCE(TRIM(p_note), ''))
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', p_entry_id, 'status', v_status);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_offer_set_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_offer_set_status(uuid, text, text) TO authenticated;
COMMENT ON FUNCTION public.legal_offer_set_status(uuid, text, text) IS 'An offer''s status (v2.5847): open · countered · accepted · withdrawn · expired, with a note. Office roles.';

-- legal_void_entry undoes an offer too (20261025120000's body, 'offer' added).
CREATE OR REPLACE FUNCTION public.legal_void_entry(p_entry_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.legal_matter_entries%ROWTYPE;
  v_reason text := COALESCE(NULLIF(TRIM(p_reason), ''), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF v_reason = '' THEN RETURN jsonb_build_object('error', 'Say why: the firm reads the reason'); END IF;
  SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Entry not found'); END IF;
  IF v_entry.via_portal THEN RETURN jsonb_build_object('error', 'The firm undoes its own entries; ask them in the conversation'); END IF;
  IF v_entry.kind NOT IN ('fee', 'cost', 'note', 'plan', 'event', 'offer') THEN RETURN jsonb_build_object('error', 'Only a fee, a cost, a note, a planned step, an event or an offer can be undone here. Reverse an applied payment on the job.'); END IF;
  IF v_entry.voided_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'Already undone'); END IF;
  UPDATE public.legal_matter_entries
    SET voided_at = now(), voided_by = auth.uid(), voided_via_portal = false, void_reason = v_reason
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_void_entry(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_void_entry(uuid, text) TO authenticated;
