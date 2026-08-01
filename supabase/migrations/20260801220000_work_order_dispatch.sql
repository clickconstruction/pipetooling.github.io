SET lock_timeout = '3s';

-- RUN_SUBS_PLAN Phase 4, PR 4.1: the offer/answer loop for sub work orders.
--
-- (1) step_commitments grows the dispatch shape: a 'declined' status,
--     decline bookkeeping, and the proposed work window an offer carries.
-- (2) respond_to_work_order(): the SUB's answer path — SECURITY DEFINER,
--     callable only by the commitment's own account-linked person, only
--     while the order is 'offered'. Accepting writes the step's expected
--     dates when they are EMPTY (never overwrites office-set dates — the
--     report flags a mismatch instead, per plan decision).
-- (3) Three email_templates rows so send-workflow-notification can carry
--     the loop with NO edge-function change (it 404s on unknown types).

-- ── (1) schema ───────────────────────────────────────────────────────────

ALTER TABLE public.step_commitments
  DROP CONSTRAINT IF EXISTS step_commitments_status_check;
ALTER TABLE public.step_commitments
  ADD CONSTRAINT step_commitments_status_check
  CHECK (status IN ('draft','offered','accepted','declined','approved','settled','cancelled'));

ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS decline_reason text;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS proposed_start date;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS proposed_end date;

COMMENT ON COLUMN public.step_commitments.proposed_start IS
  'Work window proposed with the offer (seeded from the step''s expected dates). Written to the step''s expected dates on acceptance when those are empty.';
COMMENT ON COLUMN public.step_commitments.decline_reason IS
  'Required when the sub declines; shown to the office with re-offer paths.';

-- A declined order still occupies the live (step, person) slot — re-offering
-- reuses the row — so the existing partial unique (status <> 'cancelled')
-- already covers it. No index changes.

-- ── (2) the sub's answer path ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.respond_to_work_order("p_commitment_id" uuid, "p_accept" boolean, "p_reason" text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_c public.step_commitments%ROWTYPE;
  v_step public.project_workflow_steps%ROWTYPE;
  v_dates_written boolean := false;
  v_dates_mismatch boolean := false;
BEGIN
  SELECT * INTO v_c FROM public.step_commitments WHERE id = p_commitment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;

  -- Only the commitment's own person may answer — account link only, no
  -- name fallback for WRITES (an unlinked roster sub has no login anyway).
  IF NOT EXISTS (
    SELECT 1 FROM public.people p
    WHERE p.id = v_c.person_id AND p.account_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_c.status <> 'offered' THEN
    RAISE EXCEPTION 'This work order is no longer open (status: %)', v_c.status;
  END IF;

  IF p_accept THEN
    UPDATE public.step_commitments
    SET status = 'accepted', accepted_at = now()
    WHERE id = p_commitment_id;

    IF v_c.proposed_start IS NOT NULL OR v_c.proposed_end IS NOT NULL THEN
      SELECT * INTO v_step FROM public.project_workflow_steps WHERE id = v_c.step_id;
      IF v_step.scheduled_start_date IS NULL AND v_step.scheduled_end_date IS NULL THEN
        UPDATE public.project_workflow_steps
        SET scheduled_start_date = v_c.proposed_start,
            scheduled_end_date = v_c.proposed_end
        WHERE id = v_c.step_id;
        v_dates_written := true;
      ELSIF v_step.scheduled_start_date IS DISTINCT FROM v_c.proposed_start
         OR v_step.scheduled_end_date IS DISTINCT FROM v_c.proposed_end THEN
        v_dates_mismatch := true;
      END IF;
    END IF;
  ELSE
    IF btrim(COALESCE(p_reason, '')) = '' THEN
      RAISE EXCEPTION 'A reason is required to decline';
    END IF;
    UPDATE public.step_commitments
    SET status = 'declined', declined_at = now(), decline_reason = btrim(p_reason)
    WHERE id = p_commitment_id;
  END IF;

  RETURN jsonb_build_object(
    'commitment_id', p_commitment_id,
    'accepted', p_accept,
    'dates_written', v_dates_written,
    'dates_mismatch', v_dates_mismatch
  );
END;
$$;

COMMENT ON FUNCTION public.respond_to_work_order(uuid, boolean, text) IS
  'Sub answers an offered work order: accept (writes the step''s expected dates when empty; flags mismatch otherwise) or decline with a required reason. Callable only by the commitment''s account-linked person, only from offered.';

GRANT ALL ON FUNCTION public.respond_to_work_order(uuid, boolean, text) TO anon;
GRANT ALL ON FUNCTION public.respond_to_work_order(uuid, boolean, text) TO authenticated;
GRANT ALL ON FUNCTION public.respond_to_work_order(uuid, boolean, text) TO service_role;

-- ── (3) notification templates (idempotent seeds) ───────────────────────

-- email_templates.template_type carries a CHECK whitelist (the original
-- eleven types) — widen it first or the seeds below violate it. (Caught on
-- the first push attempt: this migration merged but never applied, so an
-- in-place fix is drift-safe.)
ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_template_type_check;
ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_template_type_check
  CHECK (template_type = ANY (ARRAY[
    'invitation'::text, 'sign_in'::text, 'login_as'::text,
    'stage_assigned_started'::text, 'stage_assigned_complete'::text, 'stage_assigned_reopened'::text,
    'stage_me_started'::text, 'stage_me_complete'::text, 'stage_me_reopened'::text,
    'stage_next_complete_or_approved'::text, 'stage_prior_rejected'::text,
    'work_order_offered'::text, 'work_order_accepted'::text, 'work_order_declined'::text
  ]));

INSERT INTO public.email_templates (template_type, subject, body)
SELECT 'work_order_offered',
       'New work order: {{stage_name}} at {{project_name}}',
       'Hi {{name}},' || chr(10) || chr(10) ||
       '{{offered_by}} offered you a work order:' || chr(10) || chr(10) ||
       '{{stage_name}} at {{project_name}}' || chr(10) ||
       'Amount: {{amount}}' || chr(10) ||
       'Proposed window: {{window}}' || chr(10) || chr(10) ||
       'Open your dashboard to accept or decline: {{workflow_link}}'
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'work_order_offered');

INSERT INTO public.email_templates (template_type, subject, body)
SELECT 'work_order_accepted',
       '{{responder}} accepted: {{stage_name}} at {{project_name}}',
       '{{responder}} accepted the work order for {{stage_name}} at {{project_name}} ({{amount}}).' || chr(10) || chr(10) ||
       'Window: {{window}}' || chr(10) || chr(10) ||
       'Open the workflow: {{workflow_link}}'
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'work_order_accepted');

INSERT INTO public.email_templates (template_type, subject, body)
SELECT 'work_order_declined',
       '{{responder}} declined: {{stage_name}} at {{project_name}}',
       '{{responder}} declined the work order for {{stage_name}} at {{project_name}} ({{amount}}).' || chr(10) || chr(10) ||
       'Reason: {{reason}}' || chr(10) || chr(10) ||
       'Re-price or offer someone else: {{workflow_link}}'
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE template_type = 'work_order_declined');
