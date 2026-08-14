SET lock_timeout = '3s';

-- v2.1642: leaving Collections is automatic on Paid. The collections flag was
-- deliberately sticky across status transitions (20260704150000) so the context
-- resurrected if a paid job ever reverted to billed — owner decision 2026-08-14
-- reverses that: a job paid in full is a collections success, so the flag (and
-- its note) clears the moment status transitions into 'paid'.
--
-- One writer for every path to Paid (same reasoning as the v2.1435
-- single-writer status-event trigger): the Stripe webhook's
-- mark_invoice_paid_from_stripe, mark_invoice_paid, mark_job_paid,
-- update_job_status, and any future setter all hit this BEFORE trigger, so no
-- RPC needs its own clearing logic. BEFORE (not AFTER) so the clear rides the
-- same UPDATE — no second write, no recursion.
--
-- The activity event mirrors set_job_collections_flag()'s manual-unflag insert
-- so the job thread shows why the flag vanished; detail.auto=true marks it
-- machine-written, and actor is NULL for service-role writers (Stripe webhook).

CREATE OR REPLACE FUNCTION public.clear_job_collections_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  VALUES (
    NEW.id,
    'collections_change',
    NOW(),
    auth.uid(),
    'Removed from Collections — job paid',
    jsonb_build_object('flagged', false, 'note', NEW.collections_note, 'auto', true),
    true
  );
  NEW.collections_at := NULL;
  NEW.collections_by := NULL;
  NEW.collections_note := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_ledger_clear_collections_on_paid ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_clear_collections_on_paid
  BEFORE UPDATE OF status ON public.jobs_ledger
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.collections_at IS NOT NULL)
  EXECUTE FUNCTION public.clear_job_collections_on_paid();

COMMENT ON COLUMN public.jobs_ledger.collections_at IS
  'When the job was flagged difficult-to-collect. In Collections = status=''billed'' AND collections_at IS NOT NULL (readers filter status-first). Cleared automatically (with by/note) when the job transitions to paid — trigger jobs_ledger_clear_collections_on_paid, v2.1642. Write via set_job_collections_flag().';
