# 20261010015000_d22_ledger_archive_on_delete.sql (2026-10-09, v2.5056)

PR 2 of the Division 22 rules manager train (`to-dos/division-22-rules-manager.md`). Before any screen can delete a ledger row, both ledger tables join the deleted-records archive. A rule or a section deleted in the manager is then restorable for 90 days from **Settings → Data & recovery → Recently deleted**. Until now neither table had the trigger, so a deleted rule was gone for good.

## What it does

It adds the `zzz_archive_on_delete` trigger (`BEFORE DELETE … FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_record(<group key>)`) to the two tables. It uses the same idempotent DO-block as `20261008070000`. A table that does not exist is skipped with a warning, and each trigger is dropped and re-created, so a second run changes nothing.

| Table | Group key | What a bundle holds |
|---|---|---|
| `spec_section_match_rules` | `section_code` | A rule bundles under its section. A no-code rule (`section_code` NULL) falls back to its own id. |
| `spec_sections` | `code` | The table's key. It has no `id` column, so `record_id` stays null, as for `bid_submittal_takeoff_choices`. |

There is no new table, so there are no `apply_read_only_*` or digital-twin footers. `SET lock_timeout = '3s'` comes first. The trigger takes a brief lock on each table while it is created.

## A section and its rules come back separately

`spec_section_match_rules.section_code` is `ON DELETE CASCADE`, so a section deleted with rules still in it would take them along in one bundle. `restore_deleted_records` finds a parent in the same bundle by `record_id`, which a section does not have. Restoring that bundle would clear each rule's `section_code` with a warning, and the rules would come back as no-code.

- **The manager refuses to delete a section that still has rules** (PR 4), so the manager never makes such a bundle.
- **Restore a section before its rules.** If the rules went first and the empty section after, restoring the rules alone clears their section, with the same warning.

## Client

`src/lib/deletedRecordContents.ts`: Recently deleted names the tables *Division 22 rules* and *Division 22 sections*, and summarizes the rows.
- A rule reads in the audit window's own words, such as *contains FD- → 22 13 19*, or *→ no code*.
- A section reads as its code and title, such as *22 45 00 Emergency Plumbing Fixtures*.

## Checked before the PR

- **Read-only on prod:** both tables exist and have no archive trigger yet. `archive_deleted_record()` is the trigger function the other archived tables use.
- **The local Postgres bed could not start,** because the Mac's shared memory is used up by other servers. The DO-block is the `20261008070000` block with two table names changed. The SQL beds workflow was dispatched on the branch to apply it in the full migration chain.
- **The label tests pass,** and each of two mutants fails one.

## Push

Punchlist pushes it after merge.

## Verify after the push

```sql
SELECT c.relname, pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE t.tgname = 'zzz_archive_on_delete' AND c.relname IN ('spec_section_match_rules', 'spec_sections');
```

That returns two rows, keyed `('section_code')` and `('code')`.
