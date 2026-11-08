# 20261108110000 — evidence superseded by a named document (v2.6704)

Punch list #277, open call 2 (`to-dos/hr-named-documents/`): a Drive-linked evidence record is marked as superseded once a named document carries what it pointed at — a note on the record, nothing deleted.

- `person_file_evidence` gains three nullable columns: `superseded_by_document_id uuid REFERENCES person_documents(id) ON DELETE SET NULL`, `superseded_at timestamptz`, `superseded_by uuid REFERENCES users(id) ON DELETE SET NULL`. Every other column stays append-only: no UPDATE policy is added.
- `person_evidence_supersede(p_evidence_id uuid, p_document_id uuid DEFAULT NULL)`, `SECURITY DEFINER`, devs only (`is_dev()`), closed to `anon`: with a document, the record must have at least one file and every file a Drive link (`storage_path` null, `drive_url` set), the document must exist, be on the same person and not be archived, and a record already marked by another document is refused until that mark is lifted; it stamps the three columns and answers `{ ok, evidence_id, superseded: true, document: { id, title }, superseded_at, by }`. With `p_document_id` null it lifts the mark and answers `superseded: false`.
- The app's Evidence view calls the function (*Now a named document…* → *Mark it*); the dev seat reads the columns on `get_person_file` in a quiet read of their own (`dev-mcp` 0.42.0 deploys in any order; the mark shows once the catalog knows the columns, the `chore(types)` PR after the push).
- No table is created, so no fence is owed. Additive and idempotent.

Deploy order: merge, push this migration right after (`check:calls-ahead` holds the Pages deploy until then, since the client calls the function), then `supabase functions deploy dev-mcp`. The coordinating session pushes; the **Applied** line is written then.
