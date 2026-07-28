-- Hazmat fee: edit / void / delete (v2.1038).
--
-- Edit: amount, description, photos, testimonials (the terms snapshot stays
-- frozen). An amount change moves THREE places by the same delta atomically:
-- the incident, jobs_ledger.revenue, and the linked OPEN invoice's amount.
-- Void (any office role incl. assistants/controllers): zeroes the fee's
-- financial effect but keeps the evidence record. Delete (dev / master /
-- controller only): removes the incident entirely (BEFORE-DELETE archive
-- trigger added below makes it restorable from Recently deleted).
-- All three refuse once the linked bill has been sent/billed — the customer
-- has the number; send the bill back first.
-- Every mutation writes a job_activity_events row (the audit trail).

ALTER TABLE public.job_hazmat_incidents
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.users(id);

-- Restorable deletes: same trash safety-net as the other job-cascade tables
-- (the table postdates the 2026-07-16 archive sweep, so it was never covered).
DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.job_hazmat_incidents;
CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.job_hazmat_incidents
  FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_record('job_id');

-- ─────────────────────────────────────────────────────────────────────────────
-- update_hazmat_fee_incident: patch amount / description / photo_links /
-- testimonials / exposed_people / stage_label. Only keys present in p_patch
-- are applied. Amount changes ripple to revenue + the linked open invoice.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_hazmat_fee_incident(
  p_incident_id uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inc RECORD;
  v_master_id UUID;
  v_can BOOLEAN;
  v_new_amount NUMERIC;
  v_delta NUMERIC := 0;
  v_inv RECORD;
  v_desc TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_inc FROM public.job_hazmat_incidents WHERE id = p_incident_id FOR UPDATE;
  IF v_inc.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Incident not found');
  END IF;
  IF v_inc.voided_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'This fee is voided and can no longer be edited');
  END IF;

  SELECT jl.master_user_id INTO v_master_id
  FROM public.jobs_ledger jl WHERE jl.id = v_inc.job_id FOR UPDATE;

  -- Office gate (create-parity, plus controllers via is_assistant()).
  v_can := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
    OR public.is_assistant();
  v_can := v_can AND (v_master_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
    OR public.assistants_share_master(auth.uid(), v_master_id));
  IF NOT v_can THEN
    RETURN jsonb_build_object('error', 'Not authorized to edit this hazmat fee');
  END IF;

  -- Field validation (mirror create) — only for keys present in the patch.
  IF p_patch ? 'description' THEN
    v_desc := btrim(coalesce(p_patch->>'description', ''));
    IF v_desc = '' THEN RETURN jsonb_build_object('error', 'Describe the incident'); END IF;
  END IF;
  IF p_patch ? 'photo_links' AND (jsonb_typeof(p_patch->'photo_links') <> 'array' OR jsonb_array_length(p_patch->'photo_links') < 1) THEN
    RETURN jsonb_build_object('error', 'At least one photo link is required');
  END IF;
  IF p_patch ? 'testimonials' AND (jsonb_typeof(p_patch->'testimonials') <> 'array' OR jsonb_array_length(p_patch->'testimonials') < 1) THEN
    RETURN jsonb_build_object('error', 'At least one technician testimonial is required');
  END IF;

  IF p_patch ? 'fee_amount' THEN
    v_new_amount := round((p_patch->>'fee_amount')::numeric, 2);
    IF v_new_amount IS NULL OR v_new_amount <= 0 OR v_new_amount > 100000 THEN
      RETURN jsonb_build_object('error', 'Amount must be between $0.01 and $100,000');
    END IF;
    v_delta := v_new_amount - v_inc.fee_amount;
  ELSE
    v_new_amount := v_inc.fee_amount;
  END IF;

  IF v_delta <> 0 AND v_inc.invoice_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = v_inc.invoice_id FOR UPDATE;
    IF v_inv.id IS NOT NULL THEN
      IF v_inv.status NOT IN ('draft', 'ready_to_bill')
         OR COALESCE(btrim(v_inv.stripe_invoice_id), '') <> ''
         OR v_inv.sent_to_customer_at IS NOT NULL
         OR COALESCE(btrim(v_inv.external_send_channel), '') <> '' THEN
        RETURN jsonb_build_object('error', 'This fee is already on a sent bill — send the bill back before changing the amount');
      END IF;
      IF round(COALESCE(v_inv.amount, 0) + v_delta, 2) < 0.01 THEN
        RETURN jsonb_build_object('error', 'The linked bill would drop below $0.01 — void the fee instead');
      END IF;
      UPDATE public.jobs_ledger_invoices
      SET amount = round(COALESCE(amount, 0) + v_delta, 2)
      WHERE id = v_inv.id;
    END IF;
  END IF;

  IF v_delta <> 0 THEN
    UPDATE public.jobs_ledger
    SET revenue = round(COALESCE(revenue, 0) + v_delta, 2), updated_at = NOW()
    WHERE id = v_inc.job_id;
  END IF;

  UPDATE public.job_hazmat_incidents
  SET fee_amount = v_new_amount,
      description = CASE WHEN p_patch ? 'description' THEN v_desc ELSE description END,
      photo_links = CASE WHEN p_patch ? 'photo_links' THEN p_patch->'photo_links' ELSE photo_links END,
      testimonials = CASE WHEN p_patch ? 'testimonials' THEN p_patch->'testimonials' ELSE testimonials END,
      exposed_people = CASE WHEN p_patch ? 'exposed_people' THEN coalesce(p_patch->>'exposed_people', '') ELSE exposed_people END,
      stage_label = CASE WHEN p_patch ? 'stage_label' THEN nullif(btrim(coalesce(p_patch->>'stage_label', '')), '') ELSE stage_label END,
      edited_at = NOW()
  WHERE id = p_incident_id;

  INSERT INTO public.job_activity_events (job_id, event_type, actor_user_id, summary, detail, financial)
  VALUES (
    v_inc.job_id,
    'hazmat_fee_edited',
    auth.uid(),
    CASE WHEN v_delta <> 0
      THEN 'Hazmat fee changed $' || to_char(v_inc.fee_amount, 'FM999,999,990.00') || ' → $' || to_char(v_new_amount, 'FM999,999,990.00')
      ELSE 'Hazmat incident details edited' END,
    jsonb_build_object('source_id', p_incident_id::text, 'old_amount', v_inc.fee_amount, 'new_amount', v_new_amount,
      'fields', (SELECT jsonb_agg(k) FROM jsonb_object_keys(p_patch) AS k)),
    v_delta <> 0
  );

  RETURN jsonb_build_object('ok', true, 'old_amount', v_inc.fee_amount, 'new_amount', v_new_amount);
END;
$$;

COMMENT ON FUNCTION public.update_hazmat_fee_incident(uuid, jsonb) IS
  'Edits a hazmat incident (v2.1038): amount / description / photo_links / testimonials / exposed_people / stage_label — only keys present in p_patch apply; the TOS snapshot is immutable. Amount changes move the incident, jobs_ledger.revenue, and the linked OPEN invoice by the same delta atomically; refused once the linked bill is sent/billed. Refused on voided incidents. Office roles (dev/master/assistant-like incl. controller) with master access. Writes a hazmat_fee_edited job_activity_events row (financial when the amount moved). Sets edited_at (shown on the notice).';

-- ─────────────────────────────────────────────────────────────────────────────
-- void_hazmat_fee_incident: keep the evidence, zero the money.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_hazmat_fee_incident(p_incident_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inc RECORD;
  v_master_id UUID;
  v_can BOOLEAN;
  v_inv RECORD;
  v_new_inv NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_inc FROM public.job_hazmat_incidents WHERE id = p_incident_id FOR UPDATE;
  IF v_inc.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Incident not found');
  END IF;
  IF v_inc.voided_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'This fee is already voided');
  END IF;

  SELECT jl.master_user_id INTO v_master_id
  FROM public.jobs_ledger jl WHERE jl.id = v_inc.job_id FOR UPDATE;

  v_can := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
    OR public.is_assistant();
  v_can := v_can AND (v_master_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
    OR public.assistants_share_master(auth.uid(), v_master_id));
  IF NOT v_can THEN
    RETURN jsonb_build_object('error', 'Not authorized to void this hazmat fee');
  END IF;

  IF v_inc.invoice_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = v_inc.invoice_id FOR UPDATE;
    IF v_inv.id IS NOT NULL THEN
      IF v_inv.status NOT IN ('draft', 'ready_to_bill')
         OR COALESCE(btrim(v_inv.stripe_invoice_id), '') <> ''
         OR v_inv.sent_to_customer_at IS NOT NULL
         OR COALESCE(btrim(v_inv.external_send_channel), '') <> '' THEN
        RETURN jsonb_build_object('error', 'This fee is already on a sent bill — send the bill back before voiding');
      END IF;
      v_new_inv := round(COALESCE(v_inv.amount, 0) - v_inc.fee_amount, 2);
      IF v_inv.is_primary_rtb_bundle = false AND v_new_inv < 0.01 THEN
        DELETE FROM public.jobs_ledger_invoices WHERE id = v_inv.id;
      ELSE
        UPDATE public.jobs_ledger_invoices SET amount = GREATEST(v_new_inv, 0) WHERE id = v_inv.id;
      END IF;
    END IF;
  END IF;

  UPDATE public.jobs_ledger
  SET revenue = round(COALESCE(revenue, 0) - v_inc.fee_amount, 2), updated_at = NOW()
  WHERE id = v_inc.job_id;

  UPDATE public.job_hazmat_incidents
  SET voided_at = NOW(), voided_by = auth.uid(), invoice_id = NULL
  WHERE id = p_incident_id;

  INSERT INTO public.job_activity_events (job_id, event_type, actor_user_id, summary, detail, financial)
  VALUES (
    v_inc.job_id, 'hazmat_fee_voided', auth.uid(),
    'Hazmat fee voided ($' || to_char(v_inc.fee_amount, 'FM999,999,990.00') || ')',
    jsonb_build_object('source_id', p_incident_id::text, 'amount', v_inc.fee_amount),
    true
  );

  RETURN jsonb_build_object('ok', true, 'amount', v_inc.fee_amount);
END;
$$;

COMMENT ON FUNCTION public.void_hazmat_fee_incident(uuid) IS
  'Voids a hazmat fee (v2.1038): keeps the evidence record (notice stays viewable, marked VOIDED) but unwinds the money — revenue −= fee, linked OPEN invoice −= fee (a zeroed legacy rider row is deleted), incident unlinked + voided_at/by stamped. Refused once the linked bill is sent/billed. Office roles incl. assistants and controllers. Writes a hazmat_fee_voided job_activity_events row.';

-- ─────────────────────────────────────────────────────────────────────────────
-- delete_hazmat_fee_incident: remove the record entirely (dev/master/controller).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_hazmat_fee_incident(p_incident_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inc RECORD;
  v_master_id UUID;
  v_can BOOLEAN;
  v_inv RECORD;
  v_new_inv NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_inc FROM public.job_hazmat_incidents WHERE id = p_incident_id FOR UPDATE;
  IF v_inc.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Incident not found');
  END IF;

  SELECT jl.master_user_id INTO v_master_id
  FROM public.jobs_ledger jl WHERE jl.id = v_inc.job_id FOR UPDATE;

  -- Delete is for devs, masters, and controllers; assistants void instead.
  v_can := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'controller'));
  v_can := v_can AND (v_master_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
    OR public.assistants_share_master(auth.uid(), v_master_id));
  IF NOT v_can THEN
    RETURN jsonb_build_object('error', 'Only devs, masters, and controllers can delete a hazmat fee — assistants can void it instead');
  END IF;

  IF v_inc.voided_at IS NULL AND v_inc.invoice_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = v_inc.invoice_id FOR UPDATE;
    IF v_inv.id IS NOT NULL THEN
      IF v_inv.status NOT IN ('draft', 'ready_to_bill')
         OR COALESCE(btrim(v_inv.stripe_invoice_id), '') <> ''
         OR v_inv.sent_to_customer_at IS NOT NULL
         OR COALESCE(btrim(v_inv.external_send_channel), '') <> '' THEN
        RETURN jsonb_build_object('error', 'This fee is already on a sent bill — send the bill back before deleting');
      END IF;
      v_new_inv := round(COALESCE(v_inv.amount, 0) - v_inc.fee_amount, 2);
      IF v_inv.is_primary_rtb_bundle = false AND v_new_inv < 0.01 THEN
        DELETE FROM public.jobs_ledger_invoices WHERE id = v_inv.id;
      ELSE
        UPDATE public.jobs_ledger_invoices SET amount = GREATEST(v_new_inv, 0) WHERE id = v_inv.id;
      END IF;
    END IF;
  END IF;

  IF v_inc.voided_at IS NULL THEN
    UPDATE public.jobs_ledger
    SET revenue = round(COALESCE(revenue, 0) - v_inc.fee_amount, 2), updated_at = NOW()
    WHERE id = v_inc.job_id;
  END IF;

  INSERT INTO public.job_activity_events (job_id, event_type, actor_user_id, summary, detail, financial)
  VALUES (
    v_inc.job_id, 'hazmat_fee_deleted', auth.uid(),
    'Hazmat fee deleted ($' || to_char(v_inc.fee_amount, 'FM999,999,990.00') || ')',
    jsonb_build_object('source_id', p_incident_id::text, 'amount', v_inc.fee_amount, 'was_voided', v_inc.voided_at IS NOT NULL),
    v_inc.voided_at IS NULL
  );

  DELETE FROM public.job_hazmat_incidents WHERE id = p_incident_id;

  RETURN jsonb_build_object('ok', true, 'amount', v_inc.fee_amount);
END;
$$;

COMMENT ON FUNCTION public.delete_hazmat_fee_incident(uuid) IS
  'Deletes a hazmat incident entirely (v2.1038): devs, masters, and controllers only — assistants void instead. Unwinds the money first when not already voided (revenue −= fee; linked OPEN invoice −= fee, zeroed legacy rider rows removed); refused once the linked bill is sent/billed. The BEFORE-DELETE archive trigger snapshots the row into deleted_records_archive (restorable from Settings → Recently deleted). Writes a hazmat_fee_deleted job_activity_events row.';
