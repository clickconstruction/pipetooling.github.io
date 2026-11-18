# 20261117170000_box_pin_remembers.sql (2026-11-17, v2.7573)

A box's pin remembers who set it, when, and how sure the phone was. Punch list #372, step 1 (*Find a lost box*, closed 2026-11-17; its record is in [`to-dos/README.md`](../../to-dos/README.md)), on the owner's word of 2026-11-17, *Build all the steps*. This is the database half. No screen reads or writes the columns yet.

Until now a pin was two numbers on the box, `lat` and `lng`, and nothing else. A move between places is kept with who and when (`job_container_moves`). A pin was not, so the app could not say *pinned three weeks ago*, and for a box somebody is looking for that is the fact that matters.

## The columns, on `job_containers`

All four are NULL while the box has no pin.

| Column | Type | What it holds |
|---|---|---|
| `pinned_at` | `timestamptz`, nullable | When the pin was set. A press that waited on the phone for signal keeps its own, earlier time. A time ahead of the server's becomes the server's. |
| `pinned_by` | `uuid`, nullable, references `users(id)`, `ON DELETE SET NULL` | Who set it. Stamped by the database from the signed-in caller, never taken from the phone. |
| `pinned_by_name` | `text`, nullable, at most 120 characters | That person's name, kept on the row as a box move keeps `by_name`, because the crew's roles cannot read `users`. A dev's own words are kept, for the dev seat's agent label. |
| `pin_accuracy_m` | `double precision`, nullable, zero or more | The phone's own margin in metres, when the pin came from a reading. NULL when the map was dragged by hand and when the client did not say. |

## The trigger: `job_containers_stamp_pin`

`BEFORE INSERT OR UPDATE` on `job_containers`, running `on_site_stamp_box_pin()`. It has three cases.

- **The pin did not change** (`lat`, `lng` and `pinned_at` as they were). A direct caller's `pinned_by`, `pinned_by_name` and `pin_accuracy_m` are put back as they were. A pin's facts change only with the pin.
- **The pin was taken off** (`lat` or `lng` NULL). All four go to NULL. A new box with no pin lands here too.
- **The pin was set or moved.** `pinned_by` is the caller and `pinned_by_name` the caller's own name. When the same write carries a new `pinned_at`, the client knows these columns: its time and its margin are kept. When it carries none, the client is an older one: the time is now and the margin is NULL, so a margin left by an earlier pin never stands under a new point.

A direct caller is the `authenticated` or `anon` role, as in the guards of v2.7240. The service role and definer functions pass through the same rules, with the who taken from `auth.uid()` when there is one and kept as sent when there is none. `on_site_carry_job` changes a box's job and never its pin, so a combine and the dev seat's move keep every pin's facts.

## How it is written

By the screens, the way every other change to a box is written: an `UPDATE` of the row under the table's own policy, `job_containers_update`, which asks `on_site_can_touch_job(job_id)`. No new table, no new policy and no new grant. The read-only blocks, the twin fence and the archived seal already stand on `job_containers`.

## Pins made before the columns

No live box had a pin when this was written, so there is nothing to backfill. A pin made before the push would read as pinned with no day and no name.

## The bed

`supabase/tests/on_site_guards/30_pin_remembers.sql`, run by `scripts/pgtest-on-site-guards.sh` beside the guards' own scenario, with this migration applied a second time first. It plays a helper, a second helper, a dev and the service role through each case above.

## Order

Additive and idempotent: four nullable columns with no default are a catalog change alone, and no row is rewritten. No `CREATE TABLE`, so no fence calls. The push can come any time after the merge. **The client that follows must not merge before the push**: it names the columns in the read of every box, and PostgREST refuses a select that names a column it does not have.
