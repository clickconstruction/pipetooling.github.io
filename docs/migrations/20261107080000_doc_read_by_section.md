# 20261107080000_doc_read_by_section.sql (2026-11-07, v2.6621)

A document on a person's HR file read a piece at a time, for dev-mcp's `get_person_document`, punch list #278 PR 3 ([v2.6621](../recent-features/v2.6621.md)).

- **`dev_doc_read(p_person_id, p_doc_id default null, p_kind default null, p_section default null)`**: `SECURITY DEFINER`, `search_path = public`, raises `42501` unless `auth.uid()` is set **and** `public.is_dev()`. Exactly one of `p_doc_id` (a `person_documents` row on that person, archived or not) or `p_kind` (`summary` | `narrative` in `person_files`). The sections are cut at the headings `hr_doc_headings` (`20261107013000`) reads, the text before the first heading as its own piece (heading null), each with its number as `hr_doc_heading_index` reads it, its level, its first and last line and its size.
- Without `p_section`: `{ target, lines, sections, section: null }` — `target` is `{ doc_id | kind, title, counsel_only, archived_at, updated_at, kept_by, chars }` (`covered_through` on the fixed two).
- With `p_section`: a number (matched on the headings' numbers) or a heading's text (exact, case-folded, then by its start); none is refused with the sections listed, more than one with the count. The reply adds `section: { i, n, heading, level, from_line, to_line, chars, body, cut, before, after }` — `body` capped at 200,000 characters (`cut` true when it was), `before` / `after` the neighbouring headings or null.
- EXECUTE revoked from `PUBLIC` and `anon`, granted to `authenticated` (the gate is inside).

No table, so no fence appliers; stands on `hr_doc_headings` alone, so it lands in any order with this week's other functions. Idempotent.

## Order

After `20261107040000` (`person_documents`). Push, then `supabase functions deploy dev-mcp`; regenerate the catalog after the push so `find_rpc` lists it (`get_person_document` names the RPC itself).

**Applied** to prod on 2026-11-07, read the same day: `npm run check:migration-drift` from the docs worktree read 1153 local files and 1153 remote versions, fully applied, this file among them; the #278 card's close (#7238) records the five PRs' migrations pushed and the seat deployed at 0.38.0.
