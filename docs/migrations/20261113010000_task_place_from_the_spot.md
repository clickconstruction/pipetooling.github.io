# 20261113010000_task_place_from_the_spot.sql (2026-11-12, v2.7067)

The person doing a task adds its missing place from where they stand (punch list #328, PR 8 of 8). The people standing on a task's spot are the people doing it, and they may not edit the task: only the office or its maker writes `checklist_items`. So a task given with no place stayed with none.

## What it does

One function, **`add_task_place_from_the_spot(p_instance_id uuid, p_lat double precision, p_lng double precision, p_accuracy_m integer, p_name text DEFAULT NULL)`**, `SECURITY DEFINER`, returning `{ ok, on }` where `on` is `item` or `roadmap`. It raises in words on every refusal:

1. **Who.** Signed in, and the office or a person the task is given to (`can_work_checklist_instance`). Never a training account (`is_read_only`), a digital twin or an archived account. The task's maker who is not doing it uses the Edit window, which is theirs already.
2. **What.** A point on the globe, not `0,0`, with a margin between 0 and 46 m, about 150 ft. A reading with no margin, or a wider one, is refused: nobody looks at this place on a map before it is saved, so the phone must have been sure.
3. **Only a missing place.** A task that has a place keeps it, and so does a roadmap task. The update itself carries `WHERE place_lat IS NULL`, so two presses at once cannot both land. This function cannot move or clear a place.
4. **Where it lands.** On `checklist_items`, or on the roadmap task behind the row when there is one, since that is where a roadmap task's place lives (`20261112230000`).

The name is trimmed, its spaces collapsed, cut at 40 characters, and an empty one saves as null. `place_set_by` is the caller and `place_set_at` is now.

`EXECUTE` is revoked from `PUBLIC` and `anon` and granted to `authenticated`.

## Release order

**Push right after the merge.** The client calls a function only this migration creates. Before the push the press answers with a refusal in words and saves nothing, and every other screen is unaffected.

## Checked

Applied twice to a throwaway local Postgres 15 with stub tables, then called as eight made-up people, 27 checks: each of the six kinds of person refused in its own words, the five bad readings refused, a task with a place kept, nothing refused writing anything, the doer's add with its cleaned name and margin, a second press unable to move it, a roadmap task's place landing on the roadmap task with the list row left bare, the office at the widest margin allowed, and `anon` unable to call it. The stub is not the app's schema and the app runs Postgres 17, so the dry run at the push still matters.

## Verify

Read-only on prod after the push:

- `select has_function_privilege('authenticated', 'public.add_task_place_from_the_spot(uuid, double precision, double precision, integer, text)', 'EXECUTE')` reads `true`, and the same for `anon` reads `false`.
- `select prosecdef from pg_proc where proname = 'add_task_place_from_the_spot'` reads `true`.

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659); types regenerated in #7925.
