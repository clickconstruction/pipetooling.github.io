# 20260901004102 — attendance_annotations (v2.2556)

New append-only table: excuse/context notes beside derived late days.

- Columns: `subject_user_id` (FK users, cascade), `work_date`, `note`,
  `author_id`, `created_at`. Latest note per subject/work_date renders and
  excuses that day from the ledger's pattern counts.
- RLS: SELECT + INSERT for dev/master_technician/assistant/controller (the
  People → Writeups office set); INSERT requires `author_id = auth.uid()`.
  Deliberately NO UPDATE/DELETE policies — corrections are newer rows
  (`person_file_entries` precedent).
- Ends with both `apply_read_only_write_blocks()` and
  `apply_read_only_stmt_blocks()` (CREATE TABLE rule).
- The lateness facts stay derived from clock records; this table stores only
  human interpretation. Orphan notes (day later corrected to not-late) are
  harmless and never rendered.
