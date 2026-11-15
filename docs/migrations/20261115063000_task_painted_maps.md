# 20261115063000_task_painted_maps.sql (2026-11-15, v2.7340)

A task carries a painted map (punch list #345, step 5). A task's place is a dot (#328). A dot says where the work is and not how to reach it. A painted map says that: which gate, which side of the building, the drive that is on no map. This migration lets a task point at one. No screen reads or writes the column yet.

## What it does

- **`painted_map_id`** on `checklist_items` and on `checklist_tech_tree_group_tasks`, a nullable pointer at `painted_maps`. The task as written carries it, so a repeating task keeps its map every day. A roadmap task carries its own, since its made row comes and goes as stages unlock, the same reason its place lives there (`20261112230000`). A map thrown away leaves its tasks standing with no map (`ON DELETE SET NULL`).
- **Two partial indexes**, one a table, on the pointer where it is set. The gate below looks a task up by its map, and so does the `SET NULL` of a map thrown away.
- **`painted_map_on_a_task_i_read(map_id)`**: true when a task or a roadmap task the caller can read carries the map. SECURITY INVOKER on purpose, so the task tables' own policies decide who reads a task and nothing here restates them. Closed to `anon`.
- **`painted_maps_select_on_a_task`**: one more permissive SELECT policy on `painted_maps`, beside `painted_maps_select`. Either opens the map.
- **`task_painted_map_guard()`** and a `BEFORE INSERT OR UPDATE OF painted_map_id` trigger on each task table. A task may point only at a map its writer can already read.

The pointer is not tied to the task's place in the database. The first screen sets it with a place. A task with a map and no place is punch list #345's next question, and it needs no second migration.

## Who may do what

- **Read a task's map**: whoever can read the task. For `checklist_items` that is the office, the task's maker and the people it is given to. For a roadmap task it is whoever may read the roadmap, the task's assignees among them. A task has no job, and the person it is given to may be on no job's crew, so the map's own gate would turn them away.
- **What comes with the read**: the map's lines, places, photos and its links' rows, since each follows its map through an `EXISTS` on `painted_maps`. So do the map's standing rules. Whoever reads a map may add a stroke or a place to it. Renaming it, moving it and throwing it away stay its maker's and the office's, and making a link stays theirs too (`painted-map-link`).
- **Put a map on a task**: whoever may write the task, and only a map they can open. Without the guard, anyone who may write a task could point one at any map and so open it. The guard reads `painted_maps` under the writer's own RLS before the row is written, so the task being written cannot vouch for itself.
- **A map read through a task can be put on another task** by its reader. That hands the map on to the people of the second task. It is the same reach as showing them the screen, and less than a link, which the reader may not make.
- **Take a map off a task**: whoever may write the task. The read goes with it.
- An archived account reads nothing: the seal on `painted_maps` is restrictive and holds over both SELECT policies. An account in training and a twin write no task, as before.

## Locks

Two `ADD COLUMN`s with a foreign key take a brief exclusive lock on each task table and a share lock on `painted_maps`. The column is nullable with no default, so no row is rewritten. Two small index builds and two `CREATE TRIGGER`s follow. `SET lock_timeout = '3s'` makes a busy moment fail fast.

## Order of deploy

Additive. No client reads the column yet, so this may be pushed any time after the merge. The client PR that reads and writes it comes after the push.

## Checked on a database

- **Not run locally**: Docker is not available on this Mac.
- **The bed** `supabase/tests/painted_maps/40_tasks.sql` (run by `npm run test:pg:painted-maps` after the map's two scenarios) on the real schema in CI: the pointer on both tables with `SET NULL`, the second SELECT policy, the guard on both tables, the question closed to `anon` and both functions reading as the caller; a helper on no crew gains a loose map when a task given to him carries it, reads its line, adds a place, and can neither rename it nor throw it away; a helper on the job's crew who is not on the task gains nothing; someone who left and is on the task reads nothing; a helper cannot point his own task, new or old, at a map he cannot open or one that does not exist, and can point it at his own; taking the map off the task takes the read; a roadmap task opens its map to its assignee, who cannot move it onto a map he cannot open; a map thrown away leaves the roadmap task standing.

**Applied** to prod on 2026-11-15 with `scripts/db-push.sh`, after #8204 merged: the dry-run listed this file alone, the drift check read 1306 local files against 1306 applied, and a read of the catalog found the column on both tables, `painted_maps_select_on_a_task` (SELECT, permissive), the guard on both tables, and both functions reading as the caller with `anon` shut out. Types and the dev seat's catalog regenerated with v2.7342.
