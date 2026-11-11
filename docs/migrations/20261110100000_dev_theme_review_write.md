# 20261110100000 — dev_theme_review_write (v2.6844)

The dev MCP's dry-run wrapper for the review of theme marks already on the record: `plan_theme_review` → `apply_theme_review` in `dev-mcp`, beside `dev_theme_marks_write` (`20261106010000`), which makes them. One `SECURITY DEFINER` function, `dev_theme_review_write(p jsonb, p_dry_run boolean DEFAULT true)`, gated `auth.uid()` + `is_dev()`, `EXECUTE` revoked from `PUBLIC` and `anon`.

- `p` is `{ keep?, take_off? }`: `keep` is a list of `legal_theme_marks` ids to keep, `take_off` a list of `{ id, why }` with the reason each comes off (1 to 200 characters). 1 to 200 marks across the two lists, and no mark named twice. A bad shape raises.
- The dry run resolves every mark and replies with each as `ready`, `already` (kept already or made kept, for a keep; off already, for a take off) or `held` with its reason (no mark with that id; a mark that came off cannot be kept), with its theme, the first words of the thing it hangs on, the mark's own why and grade, and the counts of each list.
- Apply stamps the ready rows as the caller and skips the rest: `kept_at` / `kept_by` for a keep, `removed_at` / `removed_by` / `removed_why` for a take off — the two changes the marks table's own trigger (`legal_theme_marks_guard`) lets through. No row is inserted, reworded or deleted; a mark that does not fit comes off and is made again with `plan_theme_marks`.
- No table is created, so no read-only fence is owed; training mode is blocked by the table's statement trigger.

Held by `npm run test:pg:theme-review` (`supabase/tests/theme_review/`, in `scripts/sql-beds.txt`).

Deploy order: push this migration, then deploy `dev-mcp` (server 0.59.0).

**Applied** to prod by 2026-11-11: `npm run check:migration-drift` read 1239 local files and 1239 remote versions, fully applied (read in the docs pass after #7525); types regenerated in #7572.
