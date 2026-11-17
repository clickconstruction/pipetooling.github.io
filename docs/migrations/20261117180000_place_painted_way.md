# 20261117180000_place_painted_way.sql (2026-11-17, v2.7580)

A place on a site can carry the way to it. Punch list #372, step 4 ([`to-dos/find-a-lost-box/README.md`](../../to-dos/find-a-lost-box/README.md)), on the owner's word of 2026-11-17, *Build all the steps*. This is the database half. No screen reads or writes the column yet.

**Where is it?** on a box draws a straight line from the reader to the box's pin. A straight line knows no fence, wall or gate. A painted map (#345) does, because a person drew it. Boxes stand in places, and most of a site's boxes share a few, so one way painted once to a place serves every box in it.

## The column, on `job_places`

| Column | Type | What it holds |
|---|---|---|
| `painted_map_id` | `uuid`, nullable, references `painted_maps(id)`, `ON DELETE SET NULL` | The painted map that is the way to this place. Null until someone paints it. A map thrown away leaves the place standing with no way. |

`job_places_painted_map_idx` is a partial index on it, for the `SET NULL` of a map thrown away.

## The door: `job_places_update`

`job_places` had a select and an insert policy and no update. The new policy uses the gate every other on-site table asks, `on_site_can_touch_job(job_id)`, in both `USING` and `WITH CHECK`. The read-only block on `UPDATE`, the twin fence and the archived seal were made with the table and already stand.

## The guard: `job_places_guard_way`

`BEFORE INSERT OR UPDATE` on `job_places`, running `on_site_guard_place_way()` as the caller. It holds two things.

- **A direct caller changes the way and nothing else.** An update that changes any other column of a place is refused: *A place keeps its name and its job. Only the way to it can be set.* A direct caller is the `authenticated` or `anon` role. `on_site_carry_job`, inside the combine and the dev seat's move, still changes a place's job, since it runs inside a definer function.
- **The way is a map the writer can open, on the place's own job or its development.** The guard reads `painted_maps` under the writer's own RLS, so a map they cannot open is not found: *That map cannot be the way to a place. It is not a map you can open.* A map on another job, or on no job, is refused: *The way to a place is a map of its own job or of its development.* This holds for every caller and for a new place made with a way.

Each refusal carries the code `P0PWY`, so the app prints its words. It renders `42501`, the code of a row level security refusal, as one fixed sentence about access.

A map on no job is read by its maker and the office only. A place never points at one, because the crew could not open it.

## The helper: `on_site_job_in_development(job, development)`

`SECURITY DEFINER`, granted to `authenticated` and `service_role`. It answers whether the job is in the development, yes or no, and returns no row. The guard needs it because a helper on a job's crew cannot read `jobs_ledger`, and would otherwise be turned away from a map of the job's own development.

## Who reads the way

Nothing changes. A map on a job is already read by the job's crew and the office, through `painted_map_can_touch`, which asks `on_site_can_touch_job`. Those are the people who read the job's places. So whoever reads a place reads its way.

## The bed

`supabase/tests/on_site_guards/40_place_way.sql`, run by `scripts/pgtest-on-site-guards.sh` with this migration applied a second time first. It plays a helper on the crew, a helper on no crew and the office's own code through each rule above.

## Order

Additive and idempotent. No `CREATE TABLE`, so no fence calls. The push can come any time after the merge. **The client that follows must not merge before the push**: it names the column in the read of every place.
