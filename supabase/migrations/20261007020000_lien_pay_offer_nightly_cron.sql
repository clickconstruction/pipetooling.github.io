SET lock_timeout = '3s';

-- The pay offer's nightly sweep (v2.4704). A live offer is a Stripe credit note on the bill
-- (`jobs_ledger_invoices.lien_offer_credit_note_id`); once its day has passed unpaid the
-- `lien-pay-offer` function voids it and marks the row ended, so the scanned code shows the
-- full amount again. Same shape as `stripe-invoice-links-nightly` (20260918172652): vault
-- PROJECT_URL + CRON_SECRET. 06:05 UTC is 01:05 Central in summer, 00:05 in winter — a few
-- minutes after the day turns, before anyone scans.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'lien-pay-offer-nightly';

SELECT cron.schedule(
  'lien-pay-offer-nightly',
  '5 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/lien-pay-offer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{"action":"expire"}'::jsonb
  ) AS request_id;
  $$
);
