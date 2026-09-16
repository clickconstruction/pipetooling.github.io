# 20260916170000_journey_health_counts.sql (2026-09-16, v2.3513)

Settings → What customers see, the health row (`to-dos/what-customers-see-journeys/`, PR 9). One new function; **no table, column or constraint changes**.

- **`journey_health_counts() RETURNS jsonb`** (new, SECURITY DEFINER, `search_path = public`): read-only counts of where outside people are on their journeys and how many are stuck per step — `agreements` (signed · sent and unopened 3+ days · sent and waiting · live jobs with no agreement row), `bid_rooms` (open · sent and never opened · signed), `portals` and `sub_portals` (links · ever visited by an outside viewer), `statements` (builders with billed work · certified this month · sent this month). Reads `public_page_views`, which is dev-only under RLS, on the office's behalf.
- **Gate:** the caller's `users.role` must be `dev`, `master_technician`, `assistant` or `controller` — the same set that sees the tab (`canSeeWhatCustomersSee`); anyone else gets `42501`.
- **Grants.** `REVOKE ALL … FROM PUBLIC, anon`; `GRANT EXECUTE … TO authenticated, service_role`.
- Nothing is written. "Stuck" is the plainest reading of each stamp, stated in the function's header; the row's wording lives in `src/lib/journeys/journeyHealth.ts`.

`CREATE OR REPLACE`, so re-running is safe. Apply order: after the client merge — the row hides itself while the function is missing (`isMissingRpcError`), so the old client is not misled. No types regen needed: the client calls it with `rpc('journey_health_counts' as never)` and parses the jsonb defensively.
