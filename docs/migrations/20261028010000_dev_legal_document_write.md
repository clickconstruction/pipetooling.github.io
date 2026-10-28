# 20261028010000 — dev_legal_document_write (v2.6004)

The dev MCP's dry-run wrapper for a document on a legal matter's Evidence tab: `plan_matter_document` → `apply_matter_document` in `dev-mcp`. One `SECURITY DEFINER` function, `dev_legal_document_write(p jsonb, p_dry_run boolean DEFAULT true, p_file jsonb DEFAULT NULL)`, gated `auth.uid()` + `is_dev()`, closed to `anon`, modeled on `dev_legal_plan_write` (`20261023195135`).

- `p` carries the row's words and the file's facts: `matter_id`, `title`, `shows`, `original_name`, `mime` (the Evidence tab's kinds: PDF, an image, an email as .eml, plain text), `size_bytes` (1 byte to 10 MB), `sha256` (the file's digest, which the plan hash commits to), and optionally `dated_on`, `state` (draft · final · sent · received; final by default), `received_on`, and for a sent paper `sent_on` (today when left out), `sent_how` (email · certified_mail · mail · hand · other) and `sent_to`.
- The dry run returns the matter, the row as it would be written (`after`), how many live documents the matter holds and whether the firm reads it now.
- The write needs `p_file = { id, storage_path }`: the edge function stores the file in the `legal-matter-documents` bucket under `<matter_id>/<id>-<name>` first, and the function refuses the row unless that object exists. The row is inserted as the caller; `legal_matter_documents_stamp` fills `added_by`.
- No table is created, so no read-only fence is owed; training mode is blocked by the table's statement trigger.

Deploy order: push this migration, then deploy `dev-mcp` (server 0.7.0).
