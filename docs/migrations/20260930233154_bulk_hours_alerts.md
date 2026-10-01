# 20260930233154_bulk_hours_alerts.sql (2026-09-30, v2.4281)

One function, no table, no trigger: the bulk-*addition* sibling of `list_bulk_deletion_alerts()` (20260717120000), read over the typed-hours ledger `clock_typed_entries` (20260930160727) that the triggers already fill.

- **`list_bulk_hours_alerts()`** (STABLE, SECURITY DEFINER, granted to `authenticated`): one row per (typist, time bucket) whose `added` entries cover at least `bulk_hours_alert_days_v1` distinct **(person, work_date)** pairs — `actor_id`, `actor_name`, `days`, `people`, `seconds`, `waiting_days` (pairs with no `confirmed_at`), `first_typed_at` / `last_typed_at`, `window_start` / `window_end`, `people_names`, `first_work_date` / `last_work_date`. Newest bucket first, at most 50.
- **Settings** (all-read / dev-write `app_settings`, COALESCE defaults): `bulk_hours_alert_enabled_v1` (`value_text`, missing = on), `bulk_hours_alert_days_v1` (2), `bulk_hours_alert_window_minutes_v1` (60), `bulk_hours_alert_lookback_days_v1` (7). Key names are load-bearing in `src/lib/appSettingsKeys.ts`.
- **Who**: `is_dev() OR has_payroll_access() OR is_assistant()` — whoever the approvals queue opens for; anyone else gets zero rows. Never the caller's own typing (`typed_by IS DISTINCT FROM auth.uid()`), so no burst is invisible to everyone. Trims (`kind = 'trimmed'`) never count.
- Fixed time buckets, not a sliding window, exactly as the deletion alert; a spree that continues trips the next bucket.

Proof: `npm run test:pg:typed-hours` runs `supabase/tests/typed_hours/40_bulk_hours_scenarios.sql` — a four-day burst for two people (five entries and a trim) counted as four days, three waiting; seen by a controller and a dev, hidden from the typist, from a helper and from no-one signed in; a worker's own two late days as a burst; the days threshold, the switch, the look-back and a narrow window.

Apply order: any — the client that reads it (v2.4281) shows nothing until the function exists, and the function harms nothing without the client.
