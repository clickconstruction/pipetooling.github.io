# 20260911161857_labor_rows_kind_unit_source.sql (2026-09-11, v2.3291)

The Labor refresh's data rung (PR 2 of `to-dos/bids-labor-refresh/`). Additive, idempotent, no data loss:

- `labor_book_entries.unit` (`each` | `per_100ft`, default `each`) and `.kind` (`fixture` | `task`, default `fixture`) with CHECK constraints — footage entries carry hours per 100 ft; a task entry is fixed hours.
- `cost_estimate_labor_rows.kind` (`fixture` | `task` | `sub`), `.unit` (`each` | `per_100ft`), `.source` (`book` | `alias` | `typed` | `robot`, NULL = written before this migration) and `.source_note` (free text). Rows with `is_fixed` are backfilled to `kind = 'task'`; `is_fixed` stays because the Old view and the sub-sheet prints read it.
- `app_settings` row `labor_burden_factor_v1` = 1.20 (`ON CONFLICT DO NOTHING`) — the multiplier on the recorded field wage the crew-rate card will read in PR 4.
- `VIEW cost_estimate_direct_costs` (`security_invoker`) — the five direct-cost tables (`cost_estimate_equipment_rows`, `_permit_rows`, `_subcontractor_rows` → kind `sub`, `_waste_rows`, `_other_rows`) as one shape with a `kind` column; `GRANT SELECT TO authenticated`. Read-only; writes go to the underlying table.

Order: push this migration the moment the PR merges, before the Pages deploy lands — the old client ignores the new columns (all defaulted), but the new client writes them, so a new client on an unmigrated database fails every labor-row write. No table is created, so the read-only training-mode blocks are not re-applied.
