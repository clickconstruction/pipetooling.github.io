-- Fix: the sync-mercury-transactions pg_cron job (added in
-- 20270605150000_sync_mercury_transactions_pg_cron.sql) referenced the Vault
-- secrets as lowercase 'project_url' / 'cron_secret'. Vault actually stores
-- them UPPERCASE (PROJECT_URL / CRON_SECRET, the Dashboard default casing), so
-- those subqueries returned NULL -> net.http_post(url := NULL) failed on every
-- run with: null value in column "url" of relation "http_request_queue"
-- violates not-null constraint. Mercury auto-sync therefore never fired.
--
-- This regressed the convention established in
-- 20260402044932_pg_cron_use_uppercase_vault_secret_names.sql. Reschedule the
-- job with the correct UPPERCASE secret names. Idempotent (unschedule then
-- schedule), matching the other pg_cron migrations.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-mercury-transactions';

SELECT cron.schedule(
  'sync-mercury-transactions',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/sync-mercury-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{"lookback_days": 2}'::jsonb
  ) AS request_id;
  $$
);
