SET lock_timeout = '3s';

-- Owner of record, PR 3 (v2.3450) — the nightly save-from-the-roll switch
-- (decision 5, taken as recommended: built, OFF on day one).
--
-- 1. `app_settings.owner_auto_confirm_from_roll_v1` = 'false' — the switch on
--    Settings → Jobs & billing. Masters and devs may flip it (dev already
--    manages every app_settings row; the key-scoped UPDATE policy is the
--    accounting_label_auto_approve pattern, 20260905180000).
-- 2. `list_jobs_owner_to_confirm()` (v2.3447) also answers the service role,
--    so the nightly edge function reads the same list the Fix-ups chip counts.
-- 3. pg_cron calls `owner-confirm-nightly` every night at 08:15 UTC (03:15
--    Central in summer, 02:15 in winter) with the vault CRON_SECRET (the
--    billed-report-email pattern, 20260803100000). The function is a no-op
--    while the switch is off, so scheduling it is safe on its own.
--
-- Additive and idempotent.

-- ---------- 1 · the switch, off ----------

INSERT INTO public.app_settings (key, value_text)
VALUES ('owner_auto_confirm_from_roll_v1', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "master_or_dev_update_owner_auto_confirm_from_roll" ON public.app_settings;
CREATE POLICY "master_or_dev_update_owner_auto_confirm_from_roll"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'owner_auto_confirm_from_roll_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'owner_auto_confirm_from_roll_v1' AND public.is_master_or_dev());

-- ---------- 2 · the list answers the service role too ----------

CREATE OR REPLACE FUNCTION public.list_jobs_owner_to_confirm()
RETURNS TABLE (
  job_id uuid,
  hcp_number text,
  click_number text,
  job_address text,
  status text,
  customer_id uuid,
  customer_name text,
  gc_customer_id uuid,
  gc_name text,
  customer_address_id uuid,
  has_owner boolean,
  owner_confirmed boolean,
  property_kind text,
  first_work_month text,
  first_deadline date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT public.is_dev()
        OR public.is_assistant()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
        OR (SELECT auth.role()) = 'service_role' AS ok
  ),
  builders AS (
    SELECT DISTINCT b.gc_customer_id AS customer_id
    FROM public.jobs_ledger b
    WHERE b.gc_customer_id IS NOT NULL
  ),
  jobs AS (
    SELECT j.id,
           j.hcp_number,
           j.click_number,
           j.job_address,
           j.status,
           j.customer_id,
           j.gc_customer_id,
           j.customer_address_id,
           COALESCE(ca.property_kind, '') AS property_kind,
           (
             COALESCE(btrim(jpo.mailing_address), '') <> ''
             OR (
               COALESCE(btrim(ca.owner_mailing_address), '') <> ''
               AND (COALESCE(btrim(ca.owner_name), '') <> '' OR COALESCE(btrim(ca.owner_company), '') <> '')
             )
           ) AS has_owner,
           (ca.owner_confirmed_at IS NOT NULL) AS owner_confirmed
    FROM public.jobs_ledger j
    LEFT JOIN public.customer_addresses ca ON ca.id = j.customer_address_id
    LEFT JOIN public.job_property_owners jpo ON jpo.job_id = j.id
    WHERE (SELECT ok FROM me)
      AND j.status IN ('waiting', 'working', 'ready_to_bill', 'billed')
      AND (
        j.gc_customer_id IS NOT NULL
        OR (j.customer_id IS NOT NULL AND j.customer_id IN (SELECT customer_id FROM builders))
      )
  ),
  months AS (
    SELECT cs.job_ledger_id AS job_id,
           MIN(to_char(cs.work_date::date, 'YYYY-MM')) AS first_work_month
    FROM public.clock_sessions cs
    JOIN jobs ON jobs.id = cs.job_ledger_id
    WHERE cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.clocked_out_at IS NOT NULL
      AND cs.clocked_out_at > cs.clocked_in_at
    GROUP BY 1
  )
  SELECT jobs.id AS job_id,
         COALESCE(jobs.hcp_number, '') AS hcp_number,
         COALESCE(jobs.click_number, '') AS click_number,
         COALESCE(jobs.job_address, '') AS job_address,
         jobs.status,
         jobs.customer_id,
         c.name AS customer_name,
         jobs.gc_customer_id,
         g.name AS gc_name,
         jobs.customer_address_id,
         jobs.has_owner,
         jobs.owner_confirmed,
         jobs.property_kind,
         m.first_work_month,
         public.lien_notice_deadline(m.first_work_month, jobs.property_kind) AS first_deadline
  FROM jobs
  JOIN months m ON m.job_id = jobs.id
  LEFT JOIN public.customers c ON c.id = jobs.customer_id
  LEFT JOIN public.customers g ON g.id = jobs.gc_customer_id
  WHERE NOT (jobs.has_owner AND jobs.owner_confirmed)
  ORDER BY public.lien_notice_deadline(m.first_work_month, jobs.property_kind) NULLS LAST, jobs.id;
$$;

COMMENT ON FUNCTION public.list_jobs_owner_to_confirm() IS
  'Owner of record (v2.3447; service role since v2.3450 for owner-confirm-nightly): every GC job (GC set, or a builder in the customer row with no GC) in waiting/working/ready_to_bill/billed with approved hours whose property record has no confirmed owner of record — has_owner is the Lien desk''s expression; first_deadline the § 53.056 date for the earliest approved work month. Office roles and the service role; empty otherwise.';

REVOKE EXECUTE ON FUNCTION public.list_jobs_owner_to_confirm() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_jobs_owner_to_confirm() TO authenticated, service_role;

-- ---------- 3 · the nightly call ----------

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'owner-confirm-nightly';

SELECT cron.schedule(
  'owner-confirm-nightly',
  '15 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/owner-confirm-nightly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
