SET lock_timeout = '3s';

-- Security hardening (FRAGILITY_REMEDIATION_PLAN.md step A0).
--
-- mark_invoice_paid_from_stripe and complete_job_collect_payment_flow_for_invoice
-- are SECURITY DEFINER functions meant to be called ONLY by the stripe-webhook
-- edge function through its service-role client. The baseline granted EXECUTE to
-- anon and authenticated, so any logged-in user (or the anon key) could mark an
-- arbitrary invoice paid / complete a collect-payment flow by guessing a UUID or
-- Stripe invoice id. Repo-wide caller audit (2026-07-30) confirms the webhook is
-- the sole caller; no client code invokes either RPC.

REVOKE EXECUTE ON FUNCTION "public"."mark_invoice_paid_from_stripe"("p_invoice_id" "uuid", "p_payment_type" "text", "p_reference_number" "text", "p_paid_on" "date", "p_internal_note" "text") FROM PUBLIC, "anon", "authenticated";

REVOKE EXECUTE ON FUNCTION "public"."complete_job_collect_payment_flow_for_invoice"("p_stripe_invoice_id" "text") FROM PUBLIC, "anon", "authenticated";

-- service_role retains EXECUTE (granted in the baseline); the webhook path is
-- unchanged. REVOKE is idempotent, so this migration is safe to re-run.
