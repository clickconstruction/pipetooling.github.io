# 20261108190000_person_document_source.sql (2026-11-08, v2.6712)

A named document from a Drive file, punch list #286 ([v2.6712](../recent-features/v2.6712.md)). The dev seat's `plan_person_doc` / `apply_person_doc` now take a Drive file in place of the text; the row remembers where it came from.

- **`person_documents.source_drive_file_id`** (text, nullable): the Drive file the document was copied from through the seat; null for one written or pasted.
- **`person_documents.source_sha256`** (text, nullable): sha256 of the bytes it was read from, so a reader knows which version of the file the document is.
- **`person_document_index`** recreated with the two columns at the end (`CREATE OR REPLACE VIEW`, which can drop no column, so `headings` from `20261107060000` stays in its place), so the HR tab's list and `get_person_file` can show a document as a copy of a file.
- **`dev_person_doc_write(p, p_dry_run)`** replaced (the body from `20261107040000`, extended): `p.source_drive_file_id` + `p.source_sha256` come together, on a named document (`doc_id` or `title`, never `kind`), with `markdown` (the whole text), the sha 64 hex characters. The row keeps them through a flag-only change (`counsel_only`, `archive`) and clears them on a text change that names no file, since the document is then no longer a copy of one. The dry run's `document` gains `source` (as the row will carry it) and `source_before`; the write's reply names `document.source`. Everything else — the three ops, the `updated_at` guard, the no-change refusal, the 1,000,000-character limit, the archive trigger — as before.

Idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`). No `CREATE TABLE`, so the four fence appliers are not run; the table's policies and fences from `20261107040000` cover the new columns.

## Order

After `20261107040000` (the function it replaces). Push right after the merge, then `supabase functions deploy dev-mcp` (0.41.0 sends the two fields; the old function refuses nothing, it ignores them, so the order matters only for the row remembering its source). Then `npm run gen-types:linked` → `node scripts/build-dev-mcp-catalog.mjs` in the next `chore(types)` PR, so `read_rows` on `person_document_index` can select the two names.

**A sibling's note**: punch list #287 (a document tied to its evidence record) also adds to `person_documents` and may extend `dev_person_doc_write`; its migration is numbered after this one and starts from this body, so the later `CREATE OR REPLACE` keeps both.

**Applied** to prod 2026-11-08 by `scripts/db-push.sh` from the deploy checkout right after #7337 merged (`check:migration-drift`: 1169 local, 1169 remote, fully applied); `dev-mcp` 0.41.0 deployed the same minute; types and the catalog regenerated in the `chore(types)` PR #7350. The live check on ZZ Test Hand is on the card.
