# 20261107040000_person_documents.sql (2026-11-07, v2.6613)

Named documents on a person's HR file, punch list #277 PR 1 ([v2.6613](../recent-features/v2.6613.md)). The file kept two documents in `person_files`; everything else written about a person had no home.

- **`person_documents`**: `id`, `person_id` (→ `people`, cascade), `title` (1–160), `content` (markdown or plain text, `''` default), `counsel_only`, `author_label`, `created_by` / `updated_by` (→ `users`, set null), `created_at` / `updated_at`, `archived_at`. Index on `(person_id, updated_at DESC)`.
- **`person_document_revisions`**: the prior version of every rewrite — `document_id` (cascade), `person_id`, `title`, `content`, `counsel_only`, `author_label`, `replaced_at`, `replaced_by`, `replaced_by_label`; written only by the trigger **`person_documents_archive_revision`** (`BEFORE UPDATE`, when `content` or `title` moved), the pattern of `person_files_archive_revision` (`20260824141540`).
- **Policies**: devs read, add and change `person_documents`; devs read the revisions; no DELETE policy on either — `archived_at` retires a document. RLS on both.
- **`person_document_index`** (view, `security_invoker`): a person's documents without the text — the columns above plus `chars` (`length(content)`) and `sections` (`hr_doc_headings`, `20261107013000`). `SELECT` to `authenticated`; the table's own policies and fences decide what a reader sees.
- **`dev_person_doc_write(p, p_dry_run)`** replaced: the target is exactly one of `kind` (`summary` | `narrative`), `doc_id` (a `person_documents.id` on that person) or `title` (a new named document; refused when an unarchived document of that title exists, case-folded). A named document also takes `counsel_only` (set or clear the mark) and `archive` (true retires, false restores), either alone with no text; a new title needs `markdown`; the fixed two take neither. The same `markdown` | `ops` (at most 20), the same `expect_updated_at` guard against the row's `updated_at`, the same no-change refusal (a flag change counts as a change), 1,000,000 characters at most. The dry run adds `document { id, title, counsel_only, archived_at }` and `kind: 'document'`; the apply upserts `person_files` as before or inserts / updates `person_documents` (`author_label` the dev's name, `created_by` / `updated_by`), returning `document { id, title }` and `revision_archived` when the text moved.
- The four fence appliers close the two new tables to read-only users, twins and an archived caller.

Idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS` before each policy and trigger). `CREATE TABLE`, so the appliers run.

## Order

After `20261107013000` (`hr_doc_headings`, the function it replaces). Push, then `supabase functions deploy dev-mcp`; then `npm run gen-types:linked` → `node scripts/build-dev-mcp-catalog.mjs`, since `get_person_file`'s documents list and `read_rows` on the new names are refused by the catalog until it knows them.

**Applied** to prod by 2026-11-07, read the same day: types regenerated from prod through #7183 (`chore(types)` after `20261107040000`, 2026-11-07) with this file already on `main` — the repo's evidence that it was pushed; the dev seat's `check_migration_ledger` was not read in this pass (the connector was not available in the docs worktree), and `check:edge-drift` on 2026-11-07 found every function deployed, 15 of them on `_shared` code older than `main` after #7159 / #7166 (a redeploy owed, not a migration matter).
