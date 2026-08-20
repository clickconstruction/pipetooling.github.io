SET lock_timeout = '3s';

-- Stagger the email dispatchers off the shared :00/:05 tick (v2.1919).
--
-- All four */5 email dispatchers plus sync-salary-sessions fired in the same
-- second, and paid-job-email joined them every 15 minutes — a synchronized
-- net.http_post volley whose edge functions all queried back at once. During
-- the Aug 19-20 OOM incident several crashes landed seconds after this volley.
-- Each dispatcher moves to its own minute lane; sync-salary-sessions stays at
-- :00 (payroll anchor, mirrored in supabase/seed.sql). Worst-case email
-- lateness grows by ≤4 minutes; there is no delivery SLA tighter than the
-- cron tick (docs/REPORT_SUBSCRIPTIONS.md).
--
-- Re-schedule convention: unschedule by jobname, then cron.schedule — jobids
-- change (nothing keys off them; runbooks and monitoring use jobnames).
-- Command bodies are copied VERBATIM from each job's source migration
-- (uppercase Vault names PROJECT_URL / CRON_SECRET — lowercase fails silently,
-- see archive/20270607010000_fix_mercury_cron_uppercase_vault_secret_names.sql).

-- billed-report-email: */5 → :01/:06/… (source: 20260803100000_billed_report_email.sql)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'billed-report-email';

SELECT cron.schedule(
  'billed-report-email',
  '1-56/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/billed-report-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- gc-statement-email-dispatch: */5 → :02/:07/… (source: 20260806233713_gc_statement_email_requests.sql)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gc-statement-email-dispatch';

SELECT cron.schedule(
  'gc-statement-email-dispatch',
  '2-57/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/gc-statement-email-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- weekly-movement-email-dispatch: */5 → :03/:08/… (source: 20260807024222_weekly_movement_email_stream.sql)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'weekly-movement-email-dispatch';

SELECT cron.schedule(
  'weekly-movement-email-dispatch',
  '3-58/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/weekly-movement-email-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- weekly-money-email-dispatch: */5 → :04/:09/… (source: 20260807070000_weekly_money_email_stream.sql)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'weekly-money-email-dispatch';

SELECT cron.schedule(
  'weekly-money-email-dispatch',
  '4-59/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/weekly-money-email-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- paid-job-email: */15 → :07/:22/:37/:52 (source: 20260722260000_paid_job_email.sql)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'paid-job-email';

SELECT cron.schedule(
  'paid-job-email',
  '7-52/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/paid-job-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
