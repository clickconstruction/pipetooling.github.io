SET lock_timeout = '3s';

-- Punch list #85, a review residual (v2.8228): two overlapping runs of legal-notify-dispatch could
-- send the same email twice. Each read the open rows, sent, and only then wrote what it had sent, so
-- a second run that started before the first finished read the same rows and sent them again.
--
-- A run now claims its rows before it sends. A claim is a lease: a time the row is held until.
--
-- legal_notification_queue.claimed_until — the run that holds this event's "now" emails holds it
--   until then. The dispatcher clears it in the same write that keeps the ledger (sent_to), so an
--   event whose send failed is free for the next five-minute tick. NULL or past: free.
-- legal_firm_recipients.digest_claimed_until — the same for a person's weekly digest.
-- legal_notify_claim_events(firm, limit, lease) — claims a firm's oldest open events that are free
--   and answers them as they stand now. FOR UPDATE SKIP LOCKED: a second run in the same instant
--   takes the rows the first did not, and waits on none.
-- legal_notify_claim_digest(recipient, last digest, lease) — claims one person's digest when it is
--   free and their last_digest_at is still what the run read, so a run that read the list before
--   another run finished the digest cannot send it again.
--
-- A lease is ten minutes, longer than a run can live, so it outlives its run only when the run died;
-- the row is then tried again, not lost. Additive, nullable columns: no rewrite, no new table.

ALTER TABLE public.legal_notification_queue ADD COLUMN IF NOT EXISTS claimed_until timestamptz;
COMMENT ON COLUMN public.legal_notification_queue.claimed_until IS 'The dispatcher run that holds this event''s "now" emails holds it until then (v2.8228). Cleared with the ledger write, so a failed send is free for the next tick; NULL or past means free.';

ALTER TABLE public.legal_firm_recipients ADD COLUMN IF NOT EXISTS digest_claimed_until timestamptz;
COMMENT ON COLUMN public.legal_firm_recipients.digest_claimed_until IS 'The dispatcher run that holds this person''s digest holds it until then (v2.8228). Cleared when the digest is stamped or its send fails; NULL or past means free.';

CREATE OR REPLACE FUNCTION public.legal_notify_claim_events(p_firm_id uuid, p_limit int DEFAULT 50, p_lease_seconds int DEFAULT 600)
RETURNS SETOF public.legal_notification_queue
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  -- Materialized, so the rows are picked and locked once, whatever plan the update takes.
  WITH due AS MATERIALIZED (
    SELECT c.id
      FROM public.legal_notification_queue c
     WHERE c.firm_id = p_firm_id
       AND c.sent_now_at IS NULL
       AND (c.claimed_until IS NULL OR c.claimed_until <= now())
     ORDER BY c.created_at
     LIMIT greatest(least(coalesce(p_limit, 50), 200), 1)
       FOR UPDATE SKIP LOCKED
  )
  UPDATE public.legal_notification_queue q
     SET claimed_until = now() + make_interval(secs => greatest(least(coalesce(p_lease_seconds, 600), 3600), 1))
    FROM due
   WHERE q.id = due.id
  RETURNING q.*;
$$;
COMMENT ON FUNCTION public.legal_notify_claim_events(uuid, int, int) IS 'legal-notify-dispatch claims a firm''s oldest open, free events before it sends (v2.8228): each is held for the lease and answered as it stands now. Service role only.';
REVOKE EXECUTE ON FUNCTION public.legal_notify_claim_events(uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legal_notify_claim_events(uuid, int, int) TO service_role;

CREATE OR REPLACE FUNCTION public.legal_notify_claim_digest(p_recipient_id uuid, p_last_digest_at timestamptz, p_lease_seconds int DEFAULT 600)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n int;
BEGIN
  UPDATE public.legal_firm_recipients r
     SET digest_claimed_until = now() + make_interval(secs => greatest(least(coalesce(p_lease_seconds, 600), 3600), 1))
   WHERE r.id = p_recipient_id
     AND (r.digest_claimed_until IS NULL OR r.digest_claimed_until <= now())
     AND r.last_digest_at IS NOT DISTINCT FROM p_last_digest_at;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END;
$$;
COMMENT ON FUNCTION public.legal_notify_claim_digest(uuid, timestamptz, int) IS 'legal-notify-dispatch claims one person''s digest before it sends (v2.8228): true when it was free and their last_digest_at is still what the run read. Service role only.';
REVOKE EXECUTE ON FUNCTION public.legal_notify_claim_digest(uuid, timestamptz, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legal_notify_claim_digest(uuid, timestamptz, int) TO service_role;
