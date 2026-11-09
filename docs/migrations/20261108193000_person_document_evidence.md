# 20261108193000_person_document_evidence.sql (2026-11-08, v2.6713)

A named document on a person's HR file names the evidence record it transcribes, punch list #287 ([v2.6713](../recent-features/v2.6713.md)).

- **`person_documents.evidence_id`** (`uuid`, nullable, `REFERENCES person_file_evidence(id) ON DELETE SET NULL`), with a partial index on the rows that carry one. Null for a document that transcribes nothing.
- **`person_document_index`** replaced with the same columns plus **`evidence_id`** at the end (`CREATE OR REPLACE VIEW` adds a trailing column and may drop none, so `headings` from `20261107060000` and #286's `source_drive_file_id` / `source_sha256` stay in place).
- **`dev_person_doc_write`** restated whole from `20261108190000` (#286) with `evidence_id` in `p`: a `person_file_evidence.id` on the same person, or `null` to untie; a named document only (`doc_id` alone, with no text, or beside `title` + `markdown`); the dry run and the write name the record as `document.evidence` (`id`, `dated_on`, `title` — null on a counsel-only record — `counsel_only`); `changes` carries an `evidence` op with `before` and `after`. **The counsel rule**: a document tied to a counsel-only record must be counsel-only — the pair is refused, and so is clearing the mark on a document still tied to one.
- #286's two columns are added here too with `IF NOT EXISTS`, so the file stands whichever of the two lands first.

No table, so no fence appliers. Idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`); the `ALTER TABLE … ADD COLUMN` on `person_documents` takes a brief exclusive lock on a small table, under the 3 s timeout.

## Order

After `20261108190000` (#286), whose function body this one carries. **When this file is pushed before `20261108190000`, that file must fold `evidence_id` in before its own push**, since the later `CREATE OR REPLACE` carries one body. Push, then `supabase functions deploy dev-mcp`; the client's reads fall back to the old column lists until the push (42703), so either order of the client deploy and the push holds. Then regenerate the types (the column was hand-added to `database.ts` and the catalog for this PR; the regen writes the same).

**Applied** to prod by 2026-11-09, read the same day through `npm run check:migration-drift` and the dev seat's `check_migration_ledger`: 1207 local files against 1207 remote versions, fully applied, this one among them.
