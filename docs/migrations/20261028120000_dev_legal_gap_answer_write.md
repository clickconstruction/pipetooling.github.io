# 20261028120000 — dev_legal_gap_answer_write (v2.6005)

The dev MCP's dry-run wrapper for an answer on a packet gap of the Legal desk's *Before this goes to an attorney* list: `plan_gap_answer` → `apply_gap_answer` in `dev-mcp`. One `SECURITY DEFINER` function, `dev_legal_gap_answer_write(p jsonb, p_dry_run boolean DEFAULT true)`, gated `auth.uid()` + `is_dev()`, closed to `anon`, modeled on `dev_legal_plan_write` (`20261023195135`), over the desk's own `legal_answer_gap` / `legal_clear_gap_answer` (`20261026210000`, v2.5920).

- `p` is `{ matter_id, gap_key, action?, answer?, label?, document_id? }`. The gaps are computed on every open and never stored, so `gap_key` is the gap's own key as the desk computes it (`never_asked`, `demand`, `contract:<jobId>`, `subjob:<jobId>`, `lienfile:<jobId>`, …), 1 to 120 characters. `action` is `answer` (the default) or `clear`.
- `answer` writes or replaces the one line the attorney reads instead of the gap (1 to 500 characters), with `label` (the gap's words as shown, up to 300) and `document_id`, an Evidence document that must be live and on the same matter. `clear` deletes the row and is refused when none is on record.
- The dry run returns the matter, the gap key, the answer on record (`before`, with who answered and when) and the row as it would be written (`after`), how many answers the matter holds and whether the firm reads it now. The plan hash commits to `before`, so an answer or a clear since the plan makes apply refuse.
- The write goes through `legal_answer_gap` as the caller with `p_job_ids` NULL, so the matter's jobs stay as they are, or through `legal_clear_gap_answer`. The matter must exist already; a closed matter is refused. The seat never makes a matter.
- No table is created, so no read-only fence is owed; training mode is blocked by the table's statement trigger.

Deploy order: push this migration, then deploy `dev-mcp` (server 0.8.0).
