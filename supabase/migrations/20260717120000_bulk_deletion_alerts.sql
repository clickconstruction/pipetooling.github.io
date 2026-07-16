-- Bulk-deletion alerting: detect bursts of deletions and surface them on the dev dashboard.
--
-- WHY. Everything built in v2.695-v2.704 (no self-escalation, 83 tables archived, one-click restore,
-- airtight read-only) assumes SOMEBODY NOTICES. Nothing tells you today: a hostile or careless actor could
-- delete for hours and you would only find out by happening to open "Recently deleted". This closes that.
--
-- No new capture is needed — deleted_records_archive already records deleted_by / deleted_at / group_key /
-- table_name for every deletion. This is purely a read-side aggregate over data we already have.
--
-- THE UNIT IS BUNDLES, NOT ROWS. Deleting ONE job archives many rows: measured on a local stack a minimal
-- job is 5 rows / 1 bundle, and a real one (materials, payments, tally parts, inspections) is 15-20+. A
-- real prod bundle (a bid count-clear) was 19 rows / 1 bundle. So a row-count threshold would fire on a
-- single legitimate delete and get muted within a day. count(distinct group_key) = "how many THINGS did
-- they delete" is the meaningful signal. The row threshold is still a useful SECOND trigger, because one
-- enormous bundle (a customer cascading into 50 projects) is 1 bundle but hundreds of rows. Hence two
-- thresholds, OR'd.
--
-- SETTINGS are read server-side from app_settings (all-read / dev-write by the baseline RLS), which is why
-- this needs a migration at all rather than being client-only — same reason as
-- 20260618130000_hide_dev_tally_transactions.sql. COALESCE defaults mean it works before anything is
-- configured, and a NULL/garbage value falls back rather than disabling the alarm.
--
-- KNOWN LIMITATION (deliberate): fixed time buckets, not a sliding window. A burst straddling a bucket
-- boundary splits in two and each half may fall under the threshold. Accepted — a sliding window costs far
-- more for a heuristic alarm, and a spree that continues still trips the next bucket. Tighten window_minutes
-- if you want finer granularity.
--
-- Dev-only via the `WHERE public.is_dev()` idiom used by list_deleted_records / list_job_activity_events:
-- a non-dev simply gets zero rows. Excludes the caller's OWN deletions (product decision: you know what you
-- did; other devs still see your bursts, so a spree is never invisible to everyone).

CREATE OR REPLACE FUNCTION public.list_bulk_deletion_alerts()
RETURNS TABLE (
  actor_id     uuid,
  actor_name   text,
  bundles      bigint,
  row_count    bigint,
  window_start timestamptz,
  window_end   timestamptz,
  tables       text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cfg AS (
    SELECT
      COALESCE((SELECT NULLIF(trim(value_text), '') = 'true'
                FROM public.app_settings WHERE key = 'bulk_delete_alert_enabled_v1'), true)        AS enabled,
      GREATEST(COALESCE((SELECT value_num FROM public.app_settings
                         WHERE key = 'bulk_delete_alert_bundles_v1'), 5), 1)::int                  AS min_bundles,
      GREATEST(COALESCE((SELECT value_num FROM public.app_settings
                         WHERE key = 'bulk_delete_alert_rows_v1'), 200), 1)::int                   AS min_rows,
      GREATEST(COALESCE((SELECT value_num FROM public.app_settings
                         WHERE key = 'bulk_delete_alert_window_minutes_v1'), 60), 1)::int          AS window_minutes,
      GREATEST(COALESCE((SELECT value_num FROM public.app_settings
                         WHERE key = 'bulk_delete_alert_lookback_hours_v1'), 168), 1)::int         AS lookback_hours
  ),
  bursts AS (
    SELECT
      a.deleted_by AS actor_id,
      -- floor deleted_at onto a window_minutes-wide bucket
      to_timestamp(floor(extract(epoch FROM a.deleted_at) / (c.window_minutes * 60)) * (c.window_minutes * 60)) AS window_start,
      c.window_minutes,
      count(DISTINCT a.group_key)                              AS bundles,
      count(*)                                                 AS row_count,
      array_agg(DISTINCT a.table_name ORDER BY a.table_name)   AS tables
    FROM public.deleted_records_archive a
    CROSS JOIN cfg c
    WHERE c.enabled
      AND a.deleted_by IS NOT NULL
      AND a.deleted_by IS DISTINCT FROM (SELECT auth.uid())   -- never alert me about my own deletions
      AND a.deleted_at > now() - make_interval(hours => c.lookback_hours)
    GROUP BY 1, 2, 3
    HAVING count(DISTINCT a.group_key) >= (SELECT min_bundles FROM cfg)
        OR count(*)                    >= (SELECT min_rows FROM cfg)
  )
  SELECT b.actor_id,
         COALESCE(u.name, '(unknown)') AS actor_name,
         b.bundles,
         b.row_count,
         b.window_start,
         b.window_start + make_interval(mins => b.window_minutes) AS window_end,
         b.tables
  FROM bursts b
  LEFT JOIN public.users u ON u.id = b.actor_id
  WHERE public.is_dev()
  ORDER BY b.window_start DESC, b.bundles DESC
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.list_bulk_deletion_alerts() IS
  'Dev-only: bursts of deletions from deleted_records_archive, one row per (actor, time bucket) exceeding the app_settings thresholds (bundles OR rows). Excludes the caller''s own deletions. Non-devs get zero rows. Fixed buckets, not a sliding window.';

GRANT EXECUTE ON FUNCTION public.list_bulk_deletion_alerts() TO authenticated;
