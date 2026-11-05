# 20261105200000_evidence_linked_file.sql (2026-11-05, v2.6541)

PR 1a of punch list #269. A file that already lives in Drive — a call recording over the 10 MB cap, a file the office filed by hand — becomes a linked file on an evidence record: a `person_file_attachments` row with `drive_url` and no `storage_path`. The filer (`hr-evidence-drive`) leaves it alone, the panel opens the link, and the record counts it as in Drive.

- `person_file_attachments.storage_path` goes nullable (the `UNIQUE` on it admits many NULLs), with `person_file_attachments_copy_or_link CHECK (storage_path IS NOT NULL OR drive_url IS NOT NULL)`, added `NOT VALID` and validated so the lock is short.
- `dev_person_evidence_write` (re-made) takes a file as `{ name, drive_url }` beside `{ name, mime, size_bytes, sha256 }`: the dry run lists it under `after.files` with `linked: true` and counts `linked`; the write takes it in `p_files.files` as `{ id, drive_url }` in the plan's order, checks nothing in the bucket for it, and inserts it with `drive_url`, `drive_file_id` read from the link (`/file/d/<id>`, `/document/d/<id>`, `/folders/<id>`, `?id=<id>`) and `filed_at = now()`. The reply carries `linked` and `staged` counts. A record of links alone tells the seat not to ask Drive.

No table is created, so no fence calls. Apply order: **push right after the merge** — the panel's save inserts a row with `storage_path` NULL, which the old column refuses; then redeploy `hr-evidence-drive` and `dev-mcp` (server 0.25.0).
