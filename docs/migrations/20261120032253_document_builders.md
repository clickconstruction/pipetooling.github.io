# 20261120032253_document_builders.sql (2026-11-19, v2.7988)

The Document builder's builders, punch list #404 step 2. Database only: the tab reads it in the PR after the push.

- **`document_builders`**: one row a builder, keyed by its name in the client's registry (`key`, such as `sub-nda`). It holds the builder's `kind` (`walked` or `filled`), the `draft` being set up, the `published` copy everyone outside sees, that copy's `revision` with who published it and when, and the read mark: `read_revision`, `read_by_name`, `read_on`, and who marked it and when.
- **The rules of a revision**, kept by `document_builders_stamp` (BEFORE INSERT OR UPDATE). A builder starts as a draft on revision 0 whatever the client sent. A revision goes up one at a time and only with its published copy. A published copy changes only with its revision. So a revision number always names one set of words.
- **The read mark** is whole or absent: a revision, a typed name and a day. Only the published revision can be marked. A builder is read when `read_revision` equals `revision`, so a new revision is unread again with nothing to clear. A mark can be taken off.
- **Who did it is the caller.** The stamp sets who made the row, who published it, who marked it and who changed it last, and keeps the builder's name and kind from changing.
- **A publish from a stale page** is the client's to guard: it updates `WHERE revision = <the revision it read>` and reads back no row when someone published first. Since `20261120160000` a save and a publish also name the draft's number, `draft_no`, which that migration adds and this table's stamp keeps.
- **Who reads and writes.** A dev alone, by `is_dev()`, on all four of select, insert, update and delete. `anon` holds no grant. A public page that later shows a published copy reads it through an edge function with the service role, never through a policy.
- **No words.** The migration writes no row. The first draft is loaded by a press in the app.
- Additive and idempotent. It opens with the lock timeout and ends with the four fences.

Checked before the push: `supabase/tests/document_builders/20_scenario.sql`, the bed `document-builders` in `scripts/sql-beds.txt`.

Apply: `supabase db push` after the merge. No client calls any of it yet.

**Applied** to prod by 2026-11-20: the dev seat's `check_migration_ledger` read 1,410 versions applied against 1,410 local files, this version among them (read in the docs pass after #8832); types regenerated in #9012.
