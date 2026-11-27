# 20261127023116_test_painted_map_keeps_a_copy.sql (2026-11-26, v2.8678)

A test map thrown away keeps a copy, and Recently deleted puts it back. Punch list #443, row 15, one of the take-backs that need a migration, on the owner's answer of 2026-11-25 (*All eight*), each push on its own yes.

## Why

**Throw this map away** in a painted map's window deletes the `painted_maps` row from the client, under the table's own delete policy: its maker and the office. Its lines, places, links and the opens of its links go with it by their keys, `ON DELETE CASCADE` ([`20261113220000_painted_maps`](./20261113220000_painted_maps.md), [`20261114010000_painted_map_links`](./20261114010000_painted_map_links.md), [`20261116173000_painted_map_link_visits`](./20261116173000_painted_map_link_visits.md)), and the client then takes the map's photos out of the bucket. No painted map table carries the archive trigger `zzz_archive_on_delete`, so nothing was kept and Settings → Data & recovery → Recently deleted had nothing to put back. A map a walk threw away was gone for good.

## What it makes

One function, `CREATE OR REPLACE`, `plpgsql`, `SECURITY DEFINER`, `search_path = public`, `row_security = off`, revoked from `PUBLIC` and `anon`, granted to `authenticated`, with a comment. No table is created, so the four closing calls do not apply.

### `throw_away_test_painted_map(p_map_id uuid) → jsonb`

It refuses in this order, each with `ERRCODE = 'P0001'`:

| The case | The words |
|---|---|
| Nobody is signed in | *Sign in first.* |
| The caller is not a developer (`is_dev()`) | *Only a developer can throw a map away and keep a copy.* |
| The map is not there | *The map is not there any more. Read the list again.* |
| The map's name does not start with ZZ, in any case, after trimming | *Only a test map keeps a copy. This map’s name does not start with ZZ.* |

The name rule is the one `painted-map-link`'s `desk.reopen` holds (`isZzTestName`, row 14, v2.8627). The map's row is read `FOR UPDATE` and held until the transaction ends. A stroke, a place or a link added at the same moment waits on its own key to the map, then finds the map gone and is refused, where it would otherwise go with the map uncopied.

Then, in the one transaction:

1. It counts what carries the map: `checklist_items.painted_map_id`, `checklist_tech_tree_group_tasks.painted_map_id` and `job_places.painted_map_id`.
2. It inserts into `deleted_records_archive` the map's row under its own id, and each row of `painted_map_lines`, `painted_map_places`, `painted_map_links` and `painted_map_link_visits` whose `map_id` is the map, each as `to_jsonb` of the row, with `group_key` the map's id, `record_id` the row's own id and `deleted_by` the caller.
3. It deletes the `painted_maps` row. The children go by their keys. A delete that reaches no row raises *The map is not there any more. Read the list again.*

It answers `{ ok, map_id, name, copied, total, carriers }`. `copied` holds one count a table, `total` their sum, and `carriers` the three counts of step 1.

## What it leaves on prod

One `pg_proc` row with its grant and its comment. No table, column, policy, table grant, trigger or row. No table is locked: `CREATE OR REPLACE FUNCTION`, `REVOKE`, `GRANT` and `COMMENT` on one function. `SET lock_timeout = '3s'` opens the file. It is safe to run twice.

`row_security = off` changes nothing today: the function is owned by the owner of every table it touches, which row security does not bind. It is set so that a function that ever ran as a role row security does bind would raise, where it would otherwise copy and delete only the rows that role could see.

## Why a function and not the archive trigger

The trigger on the five tables would copy every row any path deletes, on real maps too. A painter erases a stroke as part of painting. Each erased stroke would be kept under its map's id, and a later restore of the map would bring back strokes its painter had erased. The trigger on a child also cannot tell a test map from a real one. The function copies the map as it stands at the moment it is thrown away, for a test map alone.

## The put-back

Nothing new. `restore_deleted_records(group_key, dry_run)` ([`20260828031500_deleted_records_price_option_bundles`](./20260828031500_deleted_records_price_option_bundles.md)) reads the bundle by the map's id, sorts the tables by their foreign keys from the catalog, and inserts the map first, then its lines and links, then its places and the opens of its links. A place that runs along one of the map's own lines (`painted_map_places.line_id`) follows its line. `list_deleted_records` has no word for a painted map, so the bundle's kind is the head row's table name, `painted_maps`, and its label is the map's name. The client reads that kind as *Painted map* (`describeDeletedBundleKind`), and names the five tables in `ARCHIVE_TABLE_LABELS`. The function is not changed.

The copies are purged with every other archive row, 90 days after the delete, by the cron job `purge-deleted-records-archive` of `20260716120000_deleted_records_archive.sql`.

## Triggers that fire

Read in the migrations, not on a database:

- The five painted map tables each carry the statement trigger `read_only_block_stmt` and no other. It raises for a caller flagged `users.read_only`, also inside a `SECURITY DEFINER` function, so a developer in training mode is refused at the delete with *Read-only (training) mode: changes are blocked.* and nothing is copied.
- `deleted_records_archive` is left out of that trigger by name (`apply_read_only_stmt_blocks`), and has no trigger of its own.
- The three carriers' keys are `ON DELETE SET NULL`. Their guards (`checklist_items_painted_map_guard`, `checklist_tech_tree_group_tasks_painted_map_guard`, `job_places_guard_way`) pass a pointer set to null. This is what today's delete does too.

## Order

The client calls `throw_away_test_painted_map` by name, and only this migration creates it. So `npm run check:calls-ahead` labels the PR *push right after the merge*, and `deploy.yml` holds the client until the push. Push with `bash scripts/db-push.sh` from a checkout of main right after the merge. The push is asked for by name and waits on its own yes.

Until the push, a developer's **Throw this map away** on a ZZ-named map is answered with a missing name, shown as PostgREST's own sentence, and the map stays. The client does not fall back to the old delete: that would sweep the photos the confirm said stay. That is a step back for as long as the gap lasts, on a press only a developer on a test map takes. Everyone else's press is unchanged.

No types PR is owed for the client: it calls the function as an untyped RPC, as the other take-backs call theirs. The generated types gain it on the next `chore(types)` PR.

## Verify after the push

1. `npm run check:migration-drift` reads the ledger and the repo as one.
2. Through the dev seat, `find_rpc` names `throw_away_test_painted_map`, and `check_migration_ledger` lists `20261127023116`.
3. `npm run check:calls-ahead -- --prod` names no call ahead for this function.
4. The walk below, each write on its own yes.

## Roll back

A new migration that runs `DROP FUNCTION IF EXISTS public.throw_away_test_painted_map(uuid);`, pushed the same way. Nothing else was made, so nothing else is undone. Copies already in `deleted_records_archive` stay and can still be restored. The client's developer path then shows PostgREST's refusal on a ZZ-named map until the client is reverted too, and every other press is as it was.

## Known, and not covered

- **A real map keeps no copy.** A map whose name does not start with ZZ is thrown away as before, by anyone who may, and its photos go with it.
- **A map thrown away by anyone but a developer keeps none**, a test map among them. Its maker and the office take the table's own delete, which this migration does not touch.
- **A job's own list of places keeps none from the app.** The app gives a list a fixed name, so it is never a test map by its name, and the client leaves a list on the old delete. The function itself reads the name alone.
- **What carried the map does not get it back.** A task, a roadmap task or a Materials place that pointed at the map lost its pointer when the map went, and a restore leaves it null. The answer counts them, and the screen says the count after the map is gone.
- **A place on another map that ran along one of this map's lines loses its line** (`painted_map_places.line_id`, `ON DELETE SET NULL`), and the restore does not give it back. Such a place is not counted in `carriers`.
- **The photos stay in the bucket.** The client does not sweep them on this path. While the map is gone, the bucket's policies of [`20261116234500_painted_map_photos_after_the_map`](./20261116234500_painted_map_photos_after_the_map.md) apply: a file under the map's id is listed and removed by its uploader and the office, and read by nobody else. Once the map is back, whoever reads the map reads them again. When the 90-day purge takes the copy, nothing sweeps the photos. They stay until their uploader or the office removes them, and no screen lists them.
- **A restored link opens at its old address again.** The copy of a link holds its `code_hash`, so the link sent before the throw-away works once the map is back, until its own day or until it is ended.
- **The copy holds what the rows held.** The copy of a link holds its `code_hash`, and the copy of a link open holds the reader's name, device, internet address and the place they chose to show. `deleted_records_archive` is read by a developer alone, and the copy goes with the 90-day purge.
- **A second copy is a second bundle of the same id.** A map put back and thrown away again is copied again under the same id. The restore takes only the copies not yet restored, so each round puts back what that round took.

## Test

`npm run test:pg:painted-maps` applies this migration a second time after every migration, which must change nothing, and plays `supabase/tests/painted_maps/97_thrown_away_copy.sql` in one transaction that rolls back, with fixtures made as postgres, the link and its open written as the service role, and every call made through RLS:

- The function runs as its owner and is closed to `anon`. No painted map table carries `zzz_archive_on_delete`.
- Nobody signed in, an assistant, a helper on his own ZZ map, a developer in training, a map that is not there and a map with ZZ later in its name are each refused with their sentence. Every map stands, nothing is archived and the three carriers keep the map.
- A dev throws away a ZZ map with two lines, two places (one with a photo path and more photos, one that runs along a line), a link and a link open. The answer holds the five counts, a total of 7, and one of each carrier. The five tables hold nothing of the map. The archive holds 1 + 2 + 2 + 1 + 1 rows under the map's id, each equal to the row as it stood. The task, the roadmap task and the Materials place stand with no map. Recently deleted lists the bundle as `painted_maps` with the map's name and 7 rows, to the dev and not to the assistant.
- `restore_deleted_records(id, true)` answers ok with the counts, no warning and no blocker, and leaves nothing. An assistant's restore is refused. `restore_deleted_records(id, false)` puts every row back equal to its archived copy and to the row as it stood, and the copies carry `restored_at`. The place runs along its line again, the link keeps its hash, and the carriers stay without the map.
- The same map is thrown away and put back a second time.
- A map named with leading spaces and a lower-case `zz` is a test map.
- A helper's plain delete of his own ZZ map still works and archives nothing. The map not named ZZ stands to the end.

**The whole-schema bed is unrun.** Docker does not answer on the Mac that built this, so the SQL beds job on the PR is the first run of the scenario against the real schema. What did run there: this migration, twice, and the scenario file as written, on a local Postgres 15 over stand-in tables. The stand-ins hold the five painted map tables with the columns, keys and checks the migrations give them, the three carriers with their keys, the archive, a training statement trigger, and the real `restore_deleted_records` and `list_deleted_records` applied from their own migration file. All 49 assertions passed. That shows the SQL parses, the rules hold, and the restore's ordering by keys puts a map of this shape back whole. It does not show that the real schema's other triggers, policies and columns agree, which is the bed's job.

## The walk, for the walker

Each write below is a write on prod and waits on its own yes. Use a made-up map named `ZZ Test …` on a ZZ Test job.

1. As the dev, paint a map named *ZZ Test way in* with a line and a place with a photo. Make a link on its Share sheet and note the address.
2. As the sample assistant through View as: open the map and press **Throw this map away**. The confirm is today's, *This cannot be undone.* Press **Cancel**.
3. As the dev, on a map not named ZZ: the confirm is today's. Press **Cancel**.
4. As the dev, on the ZZ map: the confirm reads *Throw this test map away?* and says a developer can put it back from Recently deleted for 90 days and that its photos stay. **On its own yes**, press **Throw the test map away**. The toast says the map was thrown away and where its copy is.
5. Settings → Data & recovery → Recently deleted lists a *Painted map* bundle under the map's name, with its lines, places and links counted.
6. **On its own yes**, restore it. The map opens again with its line, its place and the place's photo. The link's old address opens the map.
7. Throw the ZZ map away for good at the end of the walk, by the same press, and say in the report that its copy stays in Recently deleted for 90 days and that its photos are in the bucket. Tell `fixing` both.

**Applied** to prod by 2026-11-27: the dev seat's `check_migration_ledger` read 1,514 versions applied against 1,514 files on `origin/main`, this version among them (read in the docs pass after #9995); types regenerated in #10009.
