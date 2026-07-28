-- Hazmat notice email tracking + incident→invoice linking (v2.1039).
--
-- 1. notice_emailed_at / notice_emailed_to on job_hazmat_incidents: the
--    send-hazmat-notice-email edge function stamps them (service role) after
--    every successful send, so the office can see whether a fee's notice has
--    ever reached the customer (the Bill Customer checkbox no longer defaults
--    to on, so this is the only record).
-- 2. link_hazmat_fee_incident_to_invoice RPC: the billing modal's post-send
--    "repoint" was a direct client UPDATE, which the table's RLS (no client
--    write policies — by design) silently ignored, leaving fees unlinked from
--    the bill that carried them. All writes go through RPCs; this adds the
--    missing one.
-- 3. One-row data fix: job 857's incident shipped inside its sent Stripe
--    invoice on 2026-07-28 but stayed unlinked because of (2).

ALTER TABLE public.job_hazmat_incidents
  ADD COLUMN IF NOT EXISTS notice_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notice_emailed_to text;

-- ─────────────────────────────────────────────────────────────────────────────
-- link_hazmat_fee_incident_to_invoice: point an incident at the invoice that
-- carries its fee. Idempotent; refuses cross-job links and voided incidents.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.link_hazmat_fee_incident_to_invoice(
  p_incident_id uuid,
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inc RECORD;
  v_inv RECORD;
  v_master_id UUID;
  v_can BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_inc FROM public.job_hazmat_incidents WHERE id = p_incident_id FOR UPDATE;
  IF v_inc.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Incident not found');
  END IF;
  IF v_inc.voided_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'This fee is voided; it cannot be linked to an invoice');
  END IF;
  IF v_inc.invoice_id = p_invoice_id THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT id, job_id INTO v_inv FROM public.jobs_ledger_invoices WHERE id = p_invoice_id;
  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;
  IF v_inv.job_id <> v_inc.job_id THEN
    RETURN jsonb_build_object('error', 'Invoice belongs to a different job');
  END IF;

  SELECT jl.master_user_id INTO v_master_id
  FROM public.jobs_ledger jl WHERE jl.id = v_inc.job_id;

  -- Office gate (same shape as update/void_hazmat_fee_incident).
  v_can := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
    OR public.is_assistant();
  v_can := v_can AND (v_master_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
    OR public.assistants_share_master(auth.uid(), v_master_id));
  IF NOT v_can THEN
    RETURN jsonb_build_object('error', 'Not authorized to link this hazmat fee');
  END IF;

  UPDATE public.job_hazmat_incidents SET invoice_id = p_invoice_id WHERE id = p_incident_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.link_hazmat_fee_incident_to_invoice(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_hazmat_fee_incident_to_invoice(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Data fix: job 857 (TJ Brace) — its $500 fee shipped inside Stripe invoice
-- in_1Ty1gREwoysIcjDdLFxeFYHZ (sent 2026-07-28 03:28Z) but the client-side
-- repoint was silently blocked by RLS. Idempotent; no-op if already linked.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.job_hazmat_incidents
SET invoice_id = '00b56d1e-23f0-45e3-953b-21f1ab3859ae'
WHERE id = '65830ee2-b8b1-49c3-a124-993565e85d75'
  AND invoice_id IS NULL
  AND EXISTS (SELECT 1 FROM public.jobs_ledger_invoices WHERE id = '00b56d1e-23f0-45e3-953b-21f1ab3859ae');
