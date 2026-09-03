# 20260903191916_person_desk_gate_widenings.sql (2026-09-03, v2.2713)

Person Desk PR 5 — the owner's two gate widenings (proposal decision 2) and the HR-file existence line (decision 4).

- `users_guard_privileged_columns()` rewritten: `read_only` (training mode) may now be changed by a **dev, a controller, or a pay-approved master** (checked against `pay_approved_masters`); a non-dev may never change it on their own row. `role` stays dev-only; `archived_at` stays edge-flow only. Trigger binding unchanged.
- The users UPDATE policy "Masters assistants devs can update user notes" is re-created with `controller` in its role list (it predated the role, so a controller's update filtered to zero rows). Column-level control stays with the trigger.
- New `person_file_summary_counts(p_person_id)` (SECURITY DEFINER, STABLE): `(entries, has_summary, updated_at)` for dev / assistant-like / master callers, the zero row for everyone else. Never returns content; RLS on the HR tables stays `is_dev()`.

Apply order: any time — the client falls back to the locked row until the RPC exists, and the trigger change is a no-op for devs. Pair with redeploying `archive-user` and `restore-user` (same PR: they admit `controller` and `master_technician` in code).
