# 20260826141136 — ui_nav_clicks (nav-click telemetry) (v2.2334, 2026-08-26)

Append-only measurement ledger for the CX audit: one row per click on
instrumented navigation chrome (top nav, gear menu, mobile menu, icon cluster,
bottom tabs, dashboard dock/banners/pins/quick buttons).

- **Table** `public.ui_nav_clicks`: `id uuid PK`, `user_id uuid → auth.users
  ON DELETE CASCADE`, `role text`, `control text`, `target text` (app path or
  `#dock-section`), `from_path text`, `occurred_at timestamptz default now()`.
- **Indexes**: `(occurred_at)` and `(control, target)`.
- **RLS**: INSERT for authenticated with `user_id = auth.uid()`; SELECT
  `public.is_dev()` only (widen deliberately when a readout needs it); no
  UPDATE/DELETE policies — append-only.
- Ends with both `apply_read_only_write_blocks()` and
  `apply_read_only_stmt_blocks()` (CREATE TABLE rule). Read-only training
  users therefore record no clicks — acceptable for measurement.
- **Privacy posture**: control + target path only; no content, query data
  beyond the target's own search string (tab names), or free text.
- Client writes are fire-and-forget with zero retries
  (`src/lib/navClickTelemetry.ts`) — a missing table (client deployed before
  `db push`) degrades to silent no-ops.
