# 20261121203000_photo_spot_ground.sql (2026-11-21, v2.8195)

The ground for the later steps of punch list #413 (closed 2026-11-23; what is left is [`to-dos/photo-of-a-spot-whats-left.md`](../../to-dos/photo-of-a-spot-whats-left.md)), on Taunya's word of 2026-11-21 to build it all. One migration, so the screens that follow each need none of their own. No screen reads or writes any of it yet.

## Step 3: a photo keeps the phone's reading

On `job_photo_notes` and on `report_photos`:

| Column | Type | What it holds |
|---|---|---|
| `taken_lat`, `taken_lng` | `double precision`, nullable | Where the phone was when the photo was taken, read once on that press. Both or neither. |
| `taken_accuracy_m` | `integer`, nullable | The phone's own margin for that reading, in metres. Only with a point. |

`job_photo_notes_taken_point_check` and `report_photos_taken_point_check` hold a point whole, on the globe, and a margin to zero or more and to a row that has a point.

Whoever reads a photo's row reads where it was taken. That is the crew of the job and the office, as for the photo. The reading is where a worker stood, so the guide says so when the screens ship.

## Step 3: a place counts its opens

On `painted_map_places`: `opened_count integer NOT NULL DEFAULT 0` and `last_opened_at timestamptz`.

`note_painted_place_opened(p_place_id)` is what a screen calls when a person opens a place. It runs as the caller, so it finds the place only when the caller can read it, and it skips the place's own setter: the count answers whether anyone else came looking. It hands the row to `painted_place_opened_bump`, which runs as its owner, since a reader is not let to change a place they did not set. The bump swallows its own failure, so a training account, a digital twin or a lock never stops anyone from reading a place.

The count names nobody.

## Step 4: places follow the address

A job's own list of places is read from every job at the same customer address.

- `painted_list_address_jobs(p_map_id)` and `painted_address_jobs_of(p_job_id)` run as their owner, since a helper cannot read the ledger. They answer with job ids only: which jobs share a `customer_address_id`. A job with no customer address shares nothing.
- `painted_map_at_my_address(p_map_id)` runs as the caller: true when one of those jobs passes `on_site_can_touch_job`, the gate a painted map on a job already uses.
- The policy `painted_maps_select_at_my_address` on `painted_maps`, for reading alone, lets that caller read a map that is a job's list. A painted map that is not a list stays its own job's.
- `job_address_place_lists(p_job_id)` is what a job's window asks: the lists kept by other jobs at this job's address, oldest first, each with its job and its day. It answers only for a job the caller may touch.

The lines, the places and the photo files of a map all ask *can the caller read the map*, so they follow with no policy of their own. That includes adding a place, as for every reader of a painted map. Changing or removing another person's place, and renaming or throwing away the list, stay with the setter, the maker and the office.

The two owner-run functions can be called by any signed-in account, and tell it which job ids share an address with a job or a list it names. They tell it nothing else: no name, no address, no row.

## Step 6: a place and its line

`painted_map_places.line_id`, a nullable `uuid` to `painted_map_lines(id)`, `ON DELETE SET NULL`, with a partial index. A buried line walked before backfill gives its place a length. The line may be on another painted map of the job. A place is left standing when its line is removed.

## Step 7: more photos on a place

`painted_map_places.more_photos jsonb NOT NULL DEFAULT '[]'`: the place's photos after its first, as a list of `{path, words, at, by}`. `painted_map_places_more_photos_check` holds it to a list of twelve at most. Each path is an object in the `painted-map-photos` bucket under the place's map, so the bucket's own policies cover it.

## The bed

`supabase/tests/painted_maps/95_spot_ground.sql`, a ninth scenario in the painted maps bed. Four helpers, each on one job: two jobs at one customer address, one at another, one with none.

- A photo's point: whole, on the globe, a margin only with a point.
- The address: the helper on the later job reads the earlier job's list and its places, and not that job's painted map of the way in or its line. The helper at another address and the one with no address read nothing of it. `job_address_place_lists` answers for the caller's own job and for no other.
- The count: raised by a reader, not by the setter, not by someone who cannot read the place, and not writable by hand.
- A place tied to a line, a line that does not exist refused, and the place left standing when the line goes.
- More photos: a list kept, something that is not a list refused, twelve kept and thirteen refused.

The migration was also run twice on a local Postgres 15 over a stub of its tables before the PR, with the same four answers on the address and the count.

## Order

Additive and idempotent. No `CREATE TABLE`, so no fence calls. Every `ALTER TABLE` adds a nullable column or one with a constant default, which rewrites no row, under the 3 second timeout. The foreign key takes a brief lock on `painted_map_lines` as well as `painted_map_places`. The push can come any time after the merge. **The screens that follow must not merge before the push**: they name the new columns in their reads and call the new functions.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274); types regenerated in #9290.
