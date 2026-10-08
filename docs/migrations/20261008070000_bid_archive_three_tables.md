# 20261008070000_bid_archive_three_tables.sql (2026-10-07, v2.4861)

Bid history PR 0c (punch list #73, [`to-dos/bid-history`](../../to-dos/bid-history/README.md)): three bid tables join the deleted-records archive. Removing a count row or a whole bid took them with no snapshot, so *Recently deleted* put the bundle back without them.

| table | group key (TG_ARGV) | what it holds |
|---|---|---|
| `bid_count_row_custom_costs` | `bid_id` | a count row's quoted cost (its count-row FK shipped in v2.4413, so a removed count row takes it along) |
| `bid_takeoff_stage_splits` | `bid_id` | a takeoff line's rough-in / top-out / trim split |
| `bid_submittal_takeoff_choices` | `bid_id` | a submittal row's ticks; no `id` column, so its archive rows carry `record_id` null |

All three archive under their bid, like their siblings `bid_count_row_custom_prices` and `bids_takeoff_rough_part_lines`: a whole bid restores them in its bundle, and a count row removed on its own shows as the bid-keyed partial bundle it already makes. `restore_deleted_records` and `list_deleted_records` are unchanged: dependency-depth ordering re-inserts count rows and part lines before these children, and a row with no `id` goes through the same `jsonb_populate_record` insert.

Reuses `archive_deleted_record()` and the idempotent `DROP TRIGGER IF EXISTS` + `to_regclass` loop of `20260906000000`; `SET lock_timeout = '3s'` (each `CREATE TRIGGER` takes a brief lock on its table). No new table, so no `apply_read_only_*` or digital-twin footers. The client label map (`deletedRecordContents.ts`) learned the three names, and a removed quoted cost reads "quoted cost $3,700.00 · Ferguson".

Apply: `supabase db push` after the PR merges. Order relative to the client does not matter (the trigger only writes the archive).

Tested on a scratch Postgres 15 with stub tables (Docker was not reachable from the authoring session): the file applied twice; a count row removed on its own archived its three children under the bid; the bid removed archived the remaining tick; `restore_deleted_records` (the live `20260828031500` body) put back the bid, both count rows and all three tables, the no-id table included, with no warnings.
