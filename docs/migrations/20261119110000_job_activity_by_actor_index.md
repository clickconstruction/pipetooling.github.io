# 20261119110000_job_activity_by_actor_index.sql (2026-11-19, v2.7920)

One index on `job_activity_events`: `job_activity_events_actor_occurred_idx` on
`(actor_user_id, occurred_at DESC)`, partial on rows that have an actor.

It ships with **Your last jobs** reading the jobs a person changed in the app (punch list #392,
call 14). The painted map's job picker reads the record by who made the change, newest first,
200 rows. The record had an index by job and one by source, and none by person, and its read rule
(`can_read_job_activity`) runs once a row. Without the index that read walks the table and checks
every row the person ever made before it can sort them.

No function, table, column or policy changes. Additive and idempotent.

**Apply order:** the client's read works without the index, only slower, and it fails soft: a
read that errors leaves the changed jobs out and the list is still drawn. So the client may
deploy first. Push right after the merge all the same, since the slow read runs on every open of
the picker until the index is there.

**Applied** to prod by 2026-11-20: the dev seat's `check_migration_ledger` read 1,410 versions applied against 1,410 local files, this version among them (read in the docs pass after #8832); no change to `database.ts`, since an index is not in the types.
