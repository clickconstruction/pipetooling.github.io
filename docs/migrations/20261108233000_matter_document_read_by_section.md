# 20261108233000_matter_document_read_by_section.sql (2026-11-08, v2.6722)

A matter's text document read a section at a time, punch list #288 PR 3 ([v2.6722](../recent-features/v2.6722.md)).

- **`hr_doc_slice(p_text, p_section default null, p_who default 'the document')`** (`STABLE`): the slice lifted whole from `dev_doc_read` (`20261107080000`) — the section index (the preamble when words come before the first heading, then one a heading with its number as `hr_doc_headings` reads it) and, by number or heading (exact, then by its start), one section's text with its neighbours named, capped at 200,000 characters; `p_who` prefixes a refusal. `{ lines, sections, section }`.
- **`dev_doc_read`** replaced: the same head (the named document from **`documents`** by id and person, or the summary or narrative from `person_files`), the slice through `hr_doc_slice`.
- **`dev_matter_doc_read(p_matter_id, p_doc_id, p_section default null)`**: `SECURITY DEFINER`, devs only; the Evidence row by id on the matter (a removed one refused); a counsel-only row refused to the seat (`request_is_dev_seat()`, `42501`, the count named) and read by a dev signed in; a row with no `text_document_id` refused with its mime and name; the target (`document_id`, `text_document_id`, title, shows, state, dated_on, counsel_only, mime, original_name, updated_at, kept_by, chars, archived_at) plus the slice.
- **`dev_doc_history`** replaced: `document_revisions` and `documents` in place of the view names; nothing else moves.
- `dev_person_doc_write` is not touched: #286 (`20261108190000`) and #287 (`20261108193000`) replace it, the later stamp carrying both; it stays on the `person_documents` view until the next PR that owns it.

No table, no column: no fence is owed. Idempotent (`CREATE OR REPLACE`).

## Order

After `20261108230000` (v2.6720, `counsel_only`, which `dev_matter_doc_read` reads). Push, then `supabase functions deploy dev-mcp`; regenerate the catalog so `find_rpc` lists the two functions (`get_matter_document` names the RPC itself).

**Applied** to prod by 2026-11-09, read the same day through `npm run check:migration-drift` and the dev seat's `check_migration_ledger`: 1207 local files against 1207 remote versions, fully applied, this one among them.
