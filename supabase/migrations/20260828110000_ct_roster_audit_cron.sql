SET lock_timeout = '3s';

-- CT↔PT weekly roster drift audit cron (v2.2438; CT bridge Phase 3). Invokes the
-- ct-roster-audit edge function Mondays at 13:00 UTC (7am CST / 8am CDT) — it pulls
-- both rosters, diffs them (only-in-CT, linked-but-gone, twin-flag/active mismatches,
-- email changed under a linked uuid, backfill candidates), and emails every dev. The
-- email always sends; an all-clear note is the heartbeat. Weekly cadence sits far off
-- the 5-minute email-dispatch lanes, so no lane coordination is needed (v2.1919 note).

SELECT cron.unschedule('ct-roster-audit') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'ct-roster-audit'
);

SELECT cron.schedule(
  'ct-roster-audit',
  '0 13 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/ct-roster-audit',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
