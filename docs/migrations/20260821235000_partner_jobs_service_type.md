# 20260821235000_partner_jobs_service_type.sql (2026-08-21, v2.2018)

`CREATE OR REPLACE` of **`partner_jobs_payload(uuid)`** only (the shared inner
body from `20260821150000_partner_view_as_rpcs.sql`) — adds one key per row,
`'service_type_name'` (`service_types.name` via LEFT JOIN on
`jobs_ledger.service_type_id`, null when the job has no type), so the partner
"Your jobs" card and the View-as lens can render the trade pill (PLUM 789).

- `get_my_partner_jobs()` and `get_partner_jobs_as()` are thin wrappers over
  this payload — untouched.
- Additive and order-independent: older clients ignore the new key; the newer
  client fail-softs to the `#789` form until this is pushed.
- No tables created — read-only-block sweeps not required. Owner, comment,
  and grants re-stated (service_role only; not client-callable).
