# 20261116234500_painted_map_photos_after_the_map.sql (2026-11-16, v2.7454)

A painted map's photos can be taken out of the bucket after the map is gone (punch list #345). Throwing a map away left its places' photo files in `painted-map-photos` with nothing pointing at them, and the app could not clean up after itself: both of the bucket's reading and removing policies asked for the map's row, so once the row was gone nobody signed in could list or remove a file under its id. The owner picked the migration over a client-only fix on 2026-11-16.

This migration is the rule alone. The app's own removal, after a map's delete, is the next PR and is cut only after this is pushed.

## What it does

1. **`painted_map_stands(text)`**: is there a painted map with this id? `SECURITY DEFINER` with `search_path` pinned to `public`, so it reads past the caller's own row security. It answers with a boolean and nothing else. It tells a caller only whether an id is a map, never anything about the map: not its name, its job, who painted it or who may read it. `EXECUTE` is revoked from `PUBLIC` and `anon` and granted to `authenticated`.
2. **`painted_map_photos_files_select`** and **`painted_map_photos_files_delete`** on `storage.objects`, each dropped and made again with one more branch, for a file whose first folder is no map.

The half of each policy that holds while the map stands is word for word what `20261113220000_painted_maps.sql` wrote. `painted_map_photos_files_insert` is not touched.

The helper is there because the policies' own `EXISTS` runs under the caller's row security, where a map the caller cannot read and a map that is gone look the same. The new branch must open for the second only.

Storage's `remove()` deletes with a `WHERE` on the object's columns, so a file must pass the select policy as well as the delete policy to go. That is why both policies carry the branch.

## Who may do what

In every row the caller is signed in. `owner` is the account that uploaded the file. The office is `is_office_staff()`: dev, master, assistant and controller.

| | While the map stands (unchanged) | Once the map is gone, before | Once the map is gone, after |
|---|---|---|---|
| **List or read a file** | Whoever reads the map | Nobody | Its uploader, and the office |
| **Remove a file** | Its uploader and the office, when they read the map | Nobody | Its uploader, and the office |
| **Add a file** | Whoever reads the map | Nobody | Nobody |

- **Nobody gains a file they could not touch before.** The uploader and the office are the two who could remove a file while its map stood, and they are the two who can after. A crew member who read the map's photos reads none of them once the map is gone.
- **A map the caller cannot read is not a map that is gone.** A file under a map that stands, hidden from the caller, opens for nobody new, whoever's name is on it.
- **Signed out**, nothing: the three policies are `TO authenticated`, and `anon` may not run the helper.
- **Someone archived** reads and removes nothing, as before: the `archived_fence` on `storage.objects` is restrictive and is not touched.

## What it leaves behind

When a maker who is not office throws a map away, a teammate's photo on it stays in the bucket until the office removes it. The maker could never remove that file while the map stood, so this rule does not let them after. The office can now list and remove such a file, which nobody signed in could before. Recording who threw a map away, so that person could take every file under it, would need a table and a trigger; that was put to the owner as a later option and is not here.

The bucket's policies carry no training-mode check, before or after, so an account in training that uploaded a file can remove it through Storage (read from the policies, not tried). This migration does not change that.

## Locks

No table is created, so the four fence calls are not needed. `DROP POLICY` and `CREATE POLICY` each take a brief exclusive lock on `storage.objects`, which every upload and download in the app reads. `SET lock_timeout = '3s'` makes a busy moment fail fast, and the file is then pushed again in a quieter one. The push runs the file in one transaction, so there is no moment with a policy dropped and not yet made again.

Idempotent: the function is `CREATE OR REPLACE`, and each policy is `DROP POLICY IF EXISTS` then `CREATE POLICY`. A second run changes nothing.

## Order of deploy

The migration first, then the client. The app as it is today keeps working under the new policies, since the half it uses is unchanged. The client that removes a map's files after its delete would be refused under the old policies, silently, so it is cut only after this push.

## Checked on a database

- **The bed** `supabase/tests/painted_maps/60_photos_after.sql` (run by `npm run test:pg:painted-maps` after the four scenarios before it) on the real schema in CI. A dev, a helper who painted the map, a helper who added photos and a helper who added none, all on the job's crew, and a second map on a job none of the helpers is on.
  - **The structure**: the helper is closed to `anon`, answers past row security with a pinned path and returns a boolean; the bucket's three policies are for signed-in callers only.
  - **While the map stands**: a crew member reads the three photos and removes none; a helper does not read a file under the map he cannot read, though his name is on it, and removes nothing under it, while the helper says that map stands; signed out, nothing is read or removed.
  - **Once the maker throws the map away**: another signed-in person who read the photos a moment before reads and removes none; the maker reads and removes her own upload and neither of her teammate's; nobody adds a file under the id; the uploader reads his two and removes one; the office reads and removes the one left behind, another person's upload; signed out, nothing. Only the photo of the map that stands is left.
- **The migration is applied a second time** by the bed's script, which must change nothing.
- **Not run on this Mac.** Docker refuses a session here, and the bed needs it. A stub run on the Mac's own Postgres 15 server was possible and was not done. The bed passed in CI's `sql-beds` check on #8352.

## Pushed

On prod by 2026-11-16 16:52 UTC. #8352 merged at 16:29 UTC, and when this session went to push at 16:52 the ledger already held `20261116234500 painted_map_photos_after_the_map`, with the two files either side of it: another session's `supabase db push` from `origin/main` had carried all three. The ledger's row has the repo's own version and name, so it was applied by `db push` and by nothing else.

Proved on prod, read only:

- **The ledger**: `supabase migration list` and the dev seat's `check_migration_ledger` both show the row.
- **The helper**: a signed-out call to `painted_map_stands` answers `42501 permission denied for function painted_map_stands`, so the function is there and closed to `anon`.
- **The two policies and the helper**, read from prod's catalog on 2026-11-17 with one `SELECT` on `pg_policies` and `pg_proc`: each policy's text is the migration's, the insert policy is untouched, and `painted_map_stands` is `SECURITY DEFINER` with `search_path` pinned to `public`, returns `boolean`, and may be run by `authenticated` and not by `anon`.
- **The walks** on the live app, in the v2.7473 fragment: as the office, and as a maker who is not office.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
