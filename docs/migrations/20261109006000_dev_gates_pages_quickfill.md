# 20261109006000_dev_gates_pages_quickfill.sql (2026-11-08, v2.6763)

Punch list #188, PR 10 of the dev gates: the pages and the Quickfill edit modes, rows 61 and 67 to 71 of the audit table, taken as written by the owner on 2026-11-08. The database side of the doors that write rows only a dev could:

- **Hiring → Onboarding settings and the Team review weights (row 61)** — `team_onboarding_items` `INSERT`, `UPDATE` and `DELETE` for `is_master_or_dev()`; key-scoped `INSERT`/`UPDATE` on `team_review_composite_weights_v1` and `team_review_composite_include_crew_v1` for `is_master_or_dev()`.
- **Quickfill's edit modes (row 67)** — key-scoped `INSERT`/`UPDATE` on `quickfill_office_arriving_items`, `quickfill_office_leaving_items` and `quickfill_assistant_dailys_items` for `is_office_staff()`; `quickfill_difficult_people_items` `INSERT`, `UPDATE` and `DELETE` for `is_office_staff()`, beside the dev's three.
- **The Bridge (row 69)** — `bridge_calls_master_or_dev` (`FOR ALL`) beside the dev's, and `UPDATE` on `bridge_weekly_sheet_on_v1` for `is_master_or_dev()`.
- **Templates (row 70)** — `workflow_templates` `UPDATE` and `DELETE` for `is_master_or_dev()`; the insert admitted the office since the one-company sweep.

Rows 68 (Moneyfill) and 71 (a course that is off) read what their audiences read already: client lines alone. No table is created, so no fence call is owed. Every policy is `DROP POLICY IF EXISTS` then `CREATE`: idempotent, additive.

**Order**: push right after the merge. Until the push the owner's onboarding, weight, template and Bridge saves and the office's Quickfill template edits come back as refusals in words.

**Applied** to prod by 2026-11-09, read the same day through `npm run check:migration-drift` and the dev seat's `check_migration_ledger`: 1207 local files against 1207 remote versions, fully applied, this one among them.
