# 20260901010000_shadow_runs_staff_rpc

Seals the shadow envelope at the API layer for the Shadows lens (v2.2544):
drops the v2.2539 blanket staff SELECT policy on `twin_shadow_runs` and replaces
the staff read door with `list_shadow_runs()` (security definer) — a joined,
sanitized listing (shadow/reference bid numbers, project, axis, requester name,
sent date) whose `locked_total` / `reference_value` / `delta_pct` are NULL until
`status='scored'`. Rationale: staff seeing the robot's sealed number before the
human bid sends could anchor the estimate — the blindness has to hold in both
directions. Twin-mcp is service-role and unaffected. Idempotent; no new table,
appliers not required (the table's own appliers ran in 20260831210000).
