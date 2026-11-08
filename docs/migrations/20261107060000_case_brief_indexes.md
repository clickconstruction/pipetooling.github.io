# 20261107060000_case_brief_indexes.sql (2026-11-07, v2.6619)

The section indexes `get_case_brief` reads without carrying a document's text through the door, punch list #278 PR 1 ([v2.6619](../recent-features/v2.6619.md)).

- **`hr_doc_heading_index(md text)`** (`IMMUTABLE`, SQL): the headings of one document as jsonb, `[{ n, level, heading, line }]` in order, over `hr_doc_headings` (`20261107013000`); `n` is the number a heading carries (`16. …`, `§3 …`, `2 — …`), null when none, read as the app's `hrDocCitations.headingNumber` reads it.
- **`person_document_index`** replaced with the same columns plus **`headings`** at the end (`CREATE OR REPLACE VIEW` adds a trailing column).
- **`person_file_index`** (new view, `security_invoker`): the summary and the narrative in `person_files` without their text — `id`, `person_id`, `kind`, `author_label`, `updated_by`, `updated_at`, `covered_through`, `chars`, `sections`, `headings`.
- `SELECT` on both views to `authenticated`; the function's EXECUTE revoked from `PUBLIC` and `anon`, granted to `authenticated`. The tables' own dev-only policies decide what a reader sees.

No table, so no fence appliers. Idempotent (`CREATE OR REPLACE`), no locks beyond the catalog.

## Order

After `20261107040000` (the view it replaces). Push, then `supabase functions deploy dev-mcp`; then regenerate the types and the catalog, since `get_case_brief`'s reads of `person_file_index` and the new column are refused by the catalog until it knows them (the brief holds them in `held` and the rest draws).

**Applied** to prod on 2026-11-07, read the same day: `npm run check:migration-drift` from the docs worktree read 1153 local files and 1153 remote versions, fully applied, this file among them; the #278 card's close (#7238) records the five PRs' migrations pushed and the seat deployed at 0.38.0.
