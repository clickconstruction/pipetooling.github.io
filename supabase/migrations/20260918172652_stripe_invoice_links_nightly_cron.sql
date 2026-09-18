SET lock_timeout = '3s';

-- Stripe invoice links, the nightly refresh (v2.3589).
-- Stripe expires a hosted-invoice link 30 days after the invoice's due date; the
-- app stores the link once and every reader hands the stored copy out. This
-- schedule calls `refresh-stripe-invoice-links` every night, which retrieves
-- every open Stripe bill and stores its current link. Same shape as
-- `owner-confirm-nightly` (20260914270000): vault PROJECT_URL + CRON_SECRET.
-- 08:45 UTC is 03:45 Central in summer, 02:45 in winter — after the other
-- nightly sweeps, before the office opens.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'stripe-invoice-links-nightly';

SELECT cron.schedule(
  'stripe-invoice-links-nightly',
  '45 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/refresh-stripe-invoice-links',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
