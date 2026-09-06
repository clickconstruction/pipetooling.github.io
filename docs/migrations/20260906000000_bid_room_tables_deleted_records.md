# 20260906000000_bid_room_tables_deleted_records.sql (2026-09-05, v2.2908)

Journey map B16 / J35-N1 (C73): the three bid-room tables from `20260828215717_bid_proposal_rooms.sql` had no `zzz_archive_on_delete` trigger, so deleting a bid (or a room) dropped a signed room's revision and open/sign/decline history with no way back. This migration installs the standard `archive_deleted_record()` BEFORE DELETE trigger on:

| table | group key (TG_ARGV) | why |
|---|---|---|
| `bid_proposal_rooms` | `bid_id` | lands in the bid's bundle; a room deleted on its own shows as a bid-keyed "partial" bundle (the price-option precedent) |
| `bid_proposal_room_revisions` | `room_id` | chained from the room via the restore's `a2.group_key = b.record_id` recursion |
| `bid_proposal_room_events` | `room_id` | same |

Idempotent (`DROP TRIGGER IF EXISTS` + `to_regclass` skip-with-warning), `SET lock_timeout = '3s'`, no new table (so no `apply_read_only_*` footers). `restore_deleted_records` and `list_deleted_records` are untouched — dependency-depth ordering already re-inserts rooms before their children, and the client label map (`deletedRecordContents.ts`) learned the three table names so "Recently deleted" reads "Bid rooms", not `bid_proposal_rooms`.

Apply: `supabase db push` after the PR merges. Order relative to the client does not matter (the trigger only writes the archive).
