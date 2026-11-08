# 20261106010000 — dev_theme_marks_write (v2.6552)

The dev MCP's dry-run wrapper for themes marked on the record: `plan_theme_marks` → `apply_theme_marks` in `dev-mcp`. One `SECURITY DEFINER` function, `dev_theme_marks_write(p jsonb, p_dry_run boolean DEFAULT true)`, gated `auth.uid()` + `is_dev()`, `EXECUTE` revoked from `PUBLIC` and `anon`.

- `p` is `{ stand?, marks }`: `stand` is `kept` (the default: the owner said Apply it, so `kept_at` / `kept_by` are stamped) or `proposed` (dashed in the app until a dev keeps it); `marks` is 1 to 100 of `{ theme_id, target_kind, target_id, why?, proves_by? }` — a `legal_themes` row on an `hr_entry` (`person_file_entries`), an `hr_evidence` (`person_file_evidence`), a `matter_document` (`legal_matter_documents`, live) or a `matter_entry` (`legal_matter_entries`, live), `why` up to 200 characters, `proves_by` one of `document`, `own_words`, `firsthand`, `relayed`.
- The dry run resolves every mark and replies with each as `ready`, `already` (a live mark of that theme on that thing) or `held` with its reason (no such theme, a retired theme, no live thing with that id), the person or the matter it lands on, the thing's first words, and the counts. A bad shape raises instead.
- Apply inserts the ready rows as the caller (`marked_by`, `author_label` *dev seat*), skips the already and the held ones, and replies with the counts and the new ids. The marks table's trigger holds each row to what it was when made.
- No table is created, so no read-only fence is owed; training mode is blocked by the table's statement trigger.

Deploy order: push this migration, then deploy `dev-mcp` (server 0.26.0).

**Applied** to prod by 2026-11-06, read on 2026-11-07: types regenerated from prod through #7112 (`chore(types)` after `20261106040000`, 2026-11-06) with this file already on `main` — the repo's evidence that it was pushed; the dev seat's `check_migration_ledger` was not read in this pass (the connector was not available in the docs worktree), and `check:edge-drift` on 2026-11-07 found every function deployed, 15 of them on `_shared` code older than `main` after #7159 / #7166 (a redeploy owed, not a migration matter).
