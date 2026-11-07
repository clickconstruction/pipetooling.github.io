# 20261107100000_matter_narrative_ops.sql (2026-11-07, v2.6623)

Section ops on the matter's narrative for dev-mcp's `plan_matter_narrative`, punch list #278 PR 5 ([v2.6623](../recent-features/v2.6623.md)).

- **`hr_doc_apply_ops(p_text, p_ops, p_what default 'document')`** (`IMMUTABLE`): the section ops `dev_person_doc_write` (`20261107013000`) carries, as one function over any text — `replace_section` (the lines under a heading up to the next heading of the same or a higher level, the heading kept, `''` empties it), `insert_after`, `append`; at most 20; a heading matched by its text, case-folded; missing or repeated headings raise with the text's headings, so a caller's dry run says so. Returns `{ after, changes }`.
- **`dev_legal_narrative_write(p, p_dry_run)`** replaced: `p` carries `markdown` (the whole text, `''` clears it) or `ops`, one of the two, and `expect_updated_at` (refused unless `legal_matters.narrative_updated_at` is that instant). The dry run adds `changes` (each op with the words removed and added, capped at 6,000 characters each) and `sections` (the headings after) to the matter, the sizes and `firm_reads_it` it named before; a text that would not change is refused; 40,000 characters at most, as `legal_set_narrative` holds. The apply still calls the live `legal_set_narrative` unchanged.
- EXECUTE on both revoked from `PUBLIC` and `anon`, granted to `authenticated` (the gates are inside).

No table, so no fence appliers. Idempotent. `dev_person_doc_write` keeps its own copy of the ops for now; folding it onto `hr_doc_apply_ops` is a later tidy.

## Order

After `20261007235000` (the function it replaces) and `20261107013000` (`hr_doc_headings`). Push, then `supabase functions deploy dev-mcp`.
