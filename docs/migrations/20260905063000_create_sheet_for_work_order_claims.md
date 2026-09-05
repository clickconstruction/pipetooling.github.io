# 20260905063000 — create_sheet_for_work_order reads `request.jwt.claims` (v2.2819)

Follow-up to [20260905050035_work_orders_on_jobs](./20260905050035_work_orders_on_jobs.md). The RPC's service-role gate compared the legacy `request.jwt.claim.role` GUC, which Supabase's PostgREST no longer sets (claims arrive as the JSON `request.jwt.claims`). `submit-sub-portal` (service key) was refused *Not authorized* after a sub signed a job-anchored work order, so the Sub Labor sheet was never created — caught on the first live signature (WO-892-01, 2026-09-05).

- `CREATE OR REPLACE FUNCTION public.create_sheet_for_work_order(uuid)` — same body; `v_is_service` is true when either `request.jwt.claim.role` or `request.jwt.claims ->> 'role'` is `service_role`. Office callers (`users.role` in the office set) unchanged.
- Idempotent; re-runs the three write-block appliers.
