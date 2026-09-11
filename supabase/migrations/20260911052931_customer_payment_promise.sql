SET lock_timeout = '3s';

-- "Their Word" PR 2: the customer names the date themselves.
--
-- The portal (submit-portal-request, kind 'payment_promise') has no user
-- session — the capability token is the customer. It calls this RPC with the
-- service key: one promise event per open-bill job (source 'customer',
-- channel 'portal', heard_by NULL), and the one-per-job latest table kept in
-- step under the same transaction-local flag add_job_payment_promise uses,
-- so the v2.3280 trigger stays quiet. Callable by service_role only.
--
-- list_job_promised_pay_dates learns to say who marked the latest promise:
-- 'customer' when the row came from the portal (marked_by NULL and a matching
-- customer-sourced event), the marker's name otherwise — the chips read
-- "✓ Promised Sep 12 · customer". Body lifted from the live definition
-- (20260821110000) and extended; the gate and shape are unchanged.

CREATE OR REPLACE FUNCTION public.add_customer_payment_promise(
  p_customer_id uuid,
  p_job_ids uuid[],
  p_date date,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job uuid;
  v_count integer := 0;
BEGIN
  IF p_customer_id IS NULL OR p_date IS NULL OR p_job_ids IS NULL OR array_length(p_job_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'customer, jobs and a date are required';
  END IF;

  PERFORM set_config('app.promise_event_written', 'on', true);
  FOREACH v_job IN ARRAY p_job_ids LOOP
    -- Only jobs this customer actually pays for (owner or GC).
    IF NOT EXISTS (
      SELECT 1 FROM public.jobs_ledger j
      WHERE j.id = v_job AND (j.customer_id = p_customer_id OR j.gc_customer_id = p_customer_id)
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.job_payment_promises (job_id, customer_id, promised_date, said_by, heard_by, channel, source, note)
    VALUES (v_job, p_customer_id, p_date, NULL, NULL, 'portal', 'customer', NULLIF(trim(p_note), ''));

    INSERT INTO public.job_promised_pay_dates (job_id, promised_date, marked_by, marked_at)
    VALUES (v_job, p_date, NULL, now())
    ON CONFLICT (job_id)
    DO UPDATE SET promised_date = EXCLUDED.promised_date,
                  marked_by = NULL,
                  marked_at = now();
    v_count := v_count + 1;
  END LOOP;
  PERFORM set_config('app.promise_event_written', 'off', true);

  RETURN jsonb_build_object('jobs', v_count, 'promisedDate', p_date);
END;
$$;

COMMENT ON FUNCTION public.add_customer_payment_promise(uuid, uuid[], date, text) IS
  'Portal self-promise: one customer-sourced promise event per open-bill job the customer pays for, and the latest promised date set on each. Service role only (the portal token is the customer).';

REVOKE EXECUTE ON FUNCTION public.add_customer_payment_promise(uuid, uuid[], date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_customer_payment_promise(uuid, uuid[], date, text) TO service_role;

CREATE OR REPLACE FUNCTION public.list_job_promised_pay_dates()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH gate AS (
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid())
             AND u.role IN ('master_technician', 'primary')
         )
      AS ok
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_object_agg(
              p.job_id::text,
              jsonb_build_object(
                'promisedYmd', to_char(p.promised_date, 'YYYY-MM-DD'),
                'markedByName', CASE
                  WHEN p.marked_by IS NULL AND ev.source = 'customer' THEN 'customer'
                  ELSE COALESCE(NULLIF(trim(u.name), ''), 'office')
                END,
                'source', CASE WHEN p.marked_by IS NULL AND ev.source = 'customer' THEN 'customer' ELSE 'office' END,
                'markedAt', p.marked_at
              ))
       FROM public.job_promised_pay_dates p
       LEFT JOIN public.users u ON u.id = p.marked_by
       LEFT JOIN LATERAL (
         SELECT e.source
         FROM public.job_payment_promises e
         WHERE e.job_id = p.job_id AND e.promised_date = p.promised_date AND e.voided_at IS NULL
         ORDER BY e.created_at DESC
         LIMIT 1
       ) ev ON true),
    '{}'::jsonb
  )
END;
$$;

COMMENT ON FUNCTION public.list_job_promised_pay_dates() IS
  'All promised pay dates keyed by job id, with marker names (''customer'' for portal self-promises) and source — the Stages board''s promised chips. NULL outside dev/master/assistant-like/primary.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
