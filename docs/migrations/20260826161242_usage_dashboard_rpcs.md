# 20260826161242 — usage_* reader RPCs (Settings → Usage) (v2.2342, 2026-08-26)

Four SECURITY DEFINER aggregate readers for the dev-only usage dashboard, so
the client never needs broad SELECT on the measurement ledgers.

- `usage_page_minutes(p_days)` → (role, page, minutes, people)
- `usage_user_minutes(p_days)` → (user_name, role, page, minutes, active_days)
- `usage_nav_clicks(p_days)` → (role, control, target, clicks, people)
- `usage_customer_views(p_days)` → (surface, bucket, views, entities) —
  portal weeks from `public_page_views` UNION estimate-open weeks from
  `estimate_customer_events` (`public_link_view`).

Common posture: `IF NOT public.is_dev() THEN RAISE`; `SET search_path =
public`; `p_days` clamped to 1..365; EXECUTE revoked from public/anon,
granted to authenticated (the gate is in-function). All CREATE OR REPLACE —
idempotent. No tables created (no read-only sweep calls needed).

Depends on `20260826160132` (`public_page_views`) existing — same push,
earlier timestamp.
