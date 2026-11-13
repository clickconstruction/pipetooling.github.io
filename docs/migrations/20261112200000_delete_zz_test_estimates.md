# 20261112200000_delete_zz_test_estimates.sql (2026-11-12, v2.7051)

Deletes eight ZZ test estimates. They were made on walks of the app and showed in the Estimates lists and in every count read from them. A data step only: no table, no column, no function, so no fence call.

## Why a migration

`estimates_delete_draft` and `estimates_update_draft` let no signed-in account, a dev included, delete or change an estimate that is not a draft. These eight are sent, declined or accepted, so the app cannot take them out. The repo's one sanctioned way to change production data outside the app is a migration applied by `supabase db push`.

## The rows

Read on prod on 2026-11-12, read-only, before this file was written:

| Estimate | Status | Customer |
| --- | --- | --- |
| 167, 168, 169 | sent | ZZ Walk Press Answers |
| 175, 176, 177 | declined | ZZ Walk Press Answers |
| 189 | customer_accepted | ZZ Test Walk 2026-11-08 |
| 190 | sent | ZZ Test Walk 2026-11-08 |

None has a job (`job_ledger_id`), a bid (`bid_id`), a project or a first look. Exactly eight rows in `estimates` carry those numbers, and the migration's own predicate matched those eight and no other.

## What keeps it off a real estimate

A row is deleted only when all three hold:

1. `estimate_number` is one of the eight.
2. Its customer's name starts with `ZZ` (joined through `public.customers`). An estimate with no customer never matches.
3. `job_ledger_id IS NULL AND bid_id IS NULL`.

If one of the eight is tied to a job or a bid, or moved to a customer with a real name, between the read and the push, it stays and the rest go. The migration says how many it deleted in a `NOTICE`. A second run matches nothing.

## What goes with each estimate

Six foreign keys point at `estimates(id)`, read from the live catalog (`pg_constraint`) and matched against the files here:

| Table | On delete | Rows under the eight on 2026-11-12 |
| --- | --- | --- |
| `estimate_customer_events` | CASCADE | 9 |
| `estimates_thread_notes` | CASCADE | 0 |
| `estimate_share_links` | CASCADE | 2 |
| `estimate_field_photos` | CASCADE | 0 |
| `estimate_photo_handover` | CASCADE | 0 |
| `messages.estimate_id` | SET NULL | 3 |

So nine event lines and two share links go with the estimates. Three lines in Messages stay where they are and lose only their pointer to the estimate. The two share links stop opening, which is right for a test estimate.

The two ZZ customers are not touched. Nothing else is deleted.

## Getting one back

`estimates` is on the 90-day `deleted_records_archive` (`docs/ACCESS_CONTROL.md`, *Deleted-records archive is DB-captured, dev-only*). The `zzz_archive_on_delete` trigger copies each deleted row there before it goes, grouped by the estimate's own id. A dev can list the bundles with `list_deleted_records` and bring one back with `restore_deleted_records(p_group_key, p_dry_run)` until about 2027-02-10.

What a restore brings back is the estimate, its `estimate_customer_events` and its `estimates_thread_notes`: those three tables carry the archive trigger. `estimate_share_links`, `estimate_field_photos` and `estimate_photo_handover` do not, so the two share links would not come back, and a line in Messages would not get its pointer back. No restore was tested on prod.

## Release order

Merge, then `npx supabase db push --dry-run`, read what it lists, then `bash scripts/db-push.sh`. Nothing in the client depends on it. The delete takes row locks on eight estimates and their children for a moment and no table lock.

## Verify

Read-only on prod after the push:

- `select count(*) from estimates where estimate_number in (167,168,169,175,176,177,189,190)` reads 0.
- `select count(*) from deleted_records_archive where table_name = 'estimates' and row_data ->> 'estimate_number' in ('167','168','169','175','176','177','189','190')` reads 8.
- `select count(*) from customers where name like 'ZZ Walk Press Answers' or name like 'ZZ Test Walk 2026-11-08'` reads the same as before.

## Undo

`restore_deleted_records` for each estimate's id, as above, inside the 90 days.
