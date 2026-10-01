SET lock_timeout = '3s';

-- v2.4281 — Bulk hours alert: a burst of typed days shows on the Needs You card.
--
-- WHY. The typed-hours ledger (20260930160727) records every stretch of time someone typed onto
-- a day the clock had not recorded — who typed it, for whom, which day, how much, when — and the
-- hold keeps the typist from approving it. Both assume somebody opens the queue. Nothing said
-- "one person just typed a week of hours for two people": the second person would find out only
-- by opening the approvals queue that day. This closes that, the way list_bulk_deletion_alerts()
-- (20260717120000) closes the same gap for deletions: a read-side aggregate over data already
-- captured. No new table, no trigger.
--
-- THE UNIT IS DAYS, NOT SESSIONS. Fixing one person's missed Friday is one day whatever it took
-- (an add, a split, a second add). Typing a week for two people is ten days. So the signal is
-- count(distinct (person, work_date)) per typist per time bucket, over `added` entries only —
-- a trim (a forgotten clock-out cut back) removes time and is not the case here.
--
-- SETTINGS live in app_settings (all-read / dev-write) so the notice and its numbers can never
-- disagree; COALESCE defaults mean it works before anything is configured. Fixed time buckets,
-- not a sliding window, as the deletion alert — a burst straddling a bucket edge splits in two,
-- and a spree that continues trips the next bucket.
--
-- WHO. Whoever approves hours: dev, pay access (pay-approved masters, controllers) and
-- assistants — the same set the approvals queue opens for. Never the caller's OWN bursts: you
-- know what you typed; everyone else sees it, so no burst is invisible to everyone. A person's
-- own late entries (the worker's "It did not clock me in" door) count like anyone else's typing.
CREATE OR REPLACE FUNCTION public.list_bulk_hours_alerts()
RETURNS TABLE (
  actor_id        uuid,
  actor_name      text,
  days            bigint,
  people          bigint,
  seconds         bigint,
  waiting_days    bigint,
  first_typed_at  timestamptz,
  last_typed_at   timestamptz,
  window_start    timestamptz,
  window_end      timestamptz,
  people_names    text[],
  first_work_date date,
  last_work_date  date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cfg AS (
    SELECT
      COALESCE((SELECT NULLIF(trim(value_text), '') = 'true'
                FROM public.app_settings WHERE key = 'bulk_hours_alert_enabled_v1'), true)          AS enabled,
      GREATEST(COALESCE((SELECT value_num FROM public.app_settings
                         WHERE key = 'bulk_hours_alert_days_v1'), 2), 1)::int                       AS min_days,
      GREATEST(COALESCE((SELECT value_num FROM public.app_settings
                         WHERE key = 'bulk_hours_alert_window_minutes_v1'), 60), 1)::int            AS window_minutes,
      GREATEST(COALESCE((SELECT value_num FROM public.app_settings
                         WHERE key = 'bulk_hours_alert_lookback_days_v1'), 7), 1)::int              AS lookback_days
  ),
  bursts AS (
    SELECT
      e.typed_by AS actor_id,
      -- floor typed_at onto a window_minutes-wide bucket
      to_timestamp(floor(extract(epoch FROM e.typed_at) / (c.window_minutes * 60)) * (c.window_minutes * 60)) AS window_start,
      c.window_minutes,
      count(DISTINCT (e.user_id, e.work_date))                                        AS days,
      count(DISTINCT e.user_id)                                                       AS people,
      COALESCE(sum(e.typed_seconds), 0)::bigint                                       AS seconds,
      count(DISTINCT (e.user_id, e.work_date)) FILTER (WHERE e.confirmed_at IS NULL)  AS waiting_days,
      min(e.typed_at)                                                                 AS first_typed_at,
      max(e.typed_at)                                                                 AS last_typed_at,
      array_agg(DISTINCT e.user_id)                                                   AS people_ids,
      min(e.work_date)                                                                AS first_work_date,
      max(e.work_date)                                                                AS last_work_date
    FROM public.clock_typed_entries e
    CROSS JOIN cfg c
    WHERE c.enabled
      AND e.kind = 'added'
      AND e.typed_by IS NOT NULL
      AND e.typed_by IS DISTINCT FROM (SELECT auth.uid())   -- never alert me about my own typing
      AND e.typed_at > now() - make_interval(days => c.lookback_days)
    GROUP BY 1, 2, 3
    HAVING count(DISTINCT (e.user_id, e.work_date)) >= (SELECT min_days FROM cfg)
  )
  SELECT b.actor_id,
         COALESCE(u.name, 'Someone') AS actor_name,
         b.days,
         b.people,
         b.seconds,
         b.waiting_days,
         b.first_typed_at,
         b.last_typed_at,
         b.window_start,
         b.window_start + make_interval(mins => b.window_minutes) AS window_end,
         (SELECT array_agg(COALESCE(p.name, 'Someone') ORDER BY p.name) FROM public.users p WHERE p.id = ANY (b.people_ids)) AS people_names,
         b.first_work_date,
         b.last_work_date
  FROM bursts b
  LEFT JOIN public.users u ON u.id = b.actor_id
  WHERE public.is_dev() OR public.has_payroll_access() OR public.is_assistant()
  ORDER BY b.window_start DESC, b.days DESC
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.list_bulk_hours_alerts() IS
  'Whoever approves hours: bursts of typed hours from clock_typed_entries (kind = added), one row per (typist, time bucket) with at least app_settings.bulk_hours_alert_days_v1 distinct (person, day)s. Excludes the caller''s own typing. Others get zero rows. Fixed buckets, not a sliding window (v2.4281).';

REVOKE ALL ON FUNCTION public.list_bulk_hours_alerts() FROM public;
GRANT EXECUTE ON FUNCTION public.list_bulk_hours_alerts() TO authenticated, service_role;
