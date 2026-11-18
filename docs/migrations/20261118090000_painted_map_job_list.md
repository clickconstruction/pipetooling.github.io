# 20261118090000_painted_map_job_list.sql (2026-11-18, v2.7792)

A painted map can be marked as its job's own list of places. Punch list #393, reading C ([`to-dos/painted-map-pins.md`](../../to-dos/painted-map-pins.md)), on the owner's choice of 2026-11-18, *A separate list of pins*, and his word on the mock-up the same day, *I like what you've mocked up*. This is the database half. No screen reads or writes the column yet.

A place lives on one painted map (#345). A point that every map of a job should show had to be set again on each, and a job with no painted map had nowhere to keep one. The list is that somewhere: it sits under the job's address, and every painted map of the job draws its places.

## The column, on `painted_maps`

| Column | Type | What it holds |
|---|---|---|
| `job_list` | `boolean`, not null, default `false` | True for a job's own list of places. False for a map somebody painted. |

## Why a map and not a table

The list is kept as a painted map that holds places only. Everything a place already has comes with it and nothing is built twice:

- its kind and its mark (`painted_map_places.kind`);
- its photo, in the private `painted-map-photos` bucket under the map's id;
- who reads it, who adds to it and who changes it, by the four policies on each of the two tables;
- the read-only block, the twin fence and the archived seal, made with those tables;
- the map's own link, picture and printed page.

A table of its own would have needed each of those again.

## What the table does not hold

**A job is held to no count of lists.** Two rules would have been natural, and each would refuse something the app already does.

- *A list has a job.* `painted_maps.job_id` is set null when its job goes, so the map is kept for its maker and the office. A check that a list has a job would refuse that update, and the job could not be removed.
- *One list a job.* Two jobs can be combined, and both may have a list. A unique index would refuse the combine. Two phones that start a job's list at the same moment would also have one of them refused.

So the app makes one list a job and reads every one a job has as one list. A second list costs nothing and loses nothing.

## Who reads and writes it

Nothing changes. The policies on `painted_maps` are by row and do not read the column. Whoever may paint a map for a job may start its list. Anyone who reads the map adds a place to it. It is renamed, unmarked and thrown away by its maker and the office alone, as any map is.

## The bed

`supabase/tests/painted_maps/80_job_list.sql`, run by `scripts/pgtest-painted-maps.sh` with this migration applied a second time first. It plays two helpers on a job's crew, a helper on no crew and the office through the column, a second list on one job, and a job that goes.

## Order

Additive and idempotent. No `CREATE TABLE`, so no fence calls. The lock is an `ALTER TABLE` that adds a column with a constant default, which rewrites no row, under the 3 second timeout. The push can come any time after the merge. **The client that follows must not merge before the push**: it names the column in the read of every map.
