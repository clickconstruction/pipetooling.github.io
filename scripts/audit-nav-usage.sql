-- Read-only. Run against the linked DB (CLI/psql — not the Dashboard SQL editor).
-- CX-audit measurement plan, step 1 (v2.2334): mine the page-time data the app
-- has recorded since 2026-07-03 (user_app_activity_page_daily), and — once the
-- nav-click telemetry has data — the click side (ui_nav_clicks).
--
-- One-liner (from the repo root; SUPABASE_DB_PASSWORD lives in .env.local):
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
--     "host=aws-1-us-east-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.yewfzhbofbbyvkvtaatw sslmode=require" \
--     -f scripts/audit-nav-usage.sql

-- 1. Where does each role actually live? Minutes by page over the last 60 days.
SELECT u.role,
       a.page,
       round(sum(a.active_seconds) / 60.0) AS minutes,
       count(DISTINCT a.user_id)           AS people,
       count(DISTINCT a.activity_date)               AS active_days
FROM public.user_app_activity_page_daily a
JOIN public.users u ON u.id = a.user_id
WHERE a.activity_date >= current_date - 60
GROUP BY u.role, a.page
ORDER BY u.role, minutes DESC;

-- 2. The whole-app top 25 pages by time, all roles together.
SELECT a.page,
       round(sum(a.active_seconds) / 60.0) AS minutes,
       count(DISTINCT a.user_id)           AS people
FROM public.user_app_activity_page_daily a
WHERE a.activity_date >= current_date - 60
GROUP BY a.page
ORDER BY minutes DESC
LIMIT 25;

-- 3. Pages that get almost no time (candidates to question) — under 30 total
--    minutes across everyone in 60 days.
SELECT a.page,
       round(sum(a.active_seconds) / 60.0) AS minutes,
       count(DISTINCT a.user_id)           AS people
FROM public.user_app_activity_page_daily a
WHERE a.activity_date >= current_date - 60
GROUP BY a.page
HAVING sum(a.active_seconds) < 1800
ORDER BY minutes ASC;

-- 4. Click telemetry (fills once v2.2334's ui_nav_clicks ships): which controls
--    people actually navigate with, by role.
SELECT role, control, target, count(*) AS clicks, count(DISTINCT user_id) AS people
FROM public.ui_nav_clicks
WHERE occurred_at >= now() - interval '30 days'
GROUP BY role, control, target
ORDER BY clicks DESC
LIMIT 50;

-- 5. Dock-tab ranking — answers directly which of the dashboard's 12 sections
--    earn their place (control = 'dock').
SELECT target AS dock_section, count(*) AS clicks, count(DISTINCT user_id) AS people
FROM public.ui_nav_clicks
WHERE control = 'dock' AND occurred_at >= now() - interval '30 days'
GROUP BY target
ORDER BY clicks DESC;
