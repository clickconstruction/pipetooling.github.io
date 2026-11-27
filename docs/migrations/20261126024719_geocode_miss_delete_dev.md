# 20261126024719_geocode_miss_delete_dev.sql (2026-11-26, v2.8623)

A developer deletes a kept miss of the map by hand. Punch list #443, row 16, the ninth of the take-backs that need a migration, on the owner's answers of 2026-11-25 (*All eight*, then *Yes, all picks* to the row that made it a ninth), its push on its own yes.

## Why

An address no map service can place is kept in `address_geocode_misses` under the address as typed ([`20261124091500_address_geocode_misses`](./20261124091500_address_geocode_misses.md), punch list #408), so the screens stop asking the services for it. It goes by itself when a point is saved for the address (`address_geocodes_clears_miss`), and it stops counting after 30 days, but nobody could delete one by hand: the table grants `SELECT, INSERT, UPDATE` and had no delete policy. A walk's made-up address stood in the misses for a month.

## What changes

- **`address_geocode_misses_delete_dev`**, a `DELETE` policy for `authenticated` with `USING (public.is_dev())`, as `bill_hand_ways_delete_dev` and `sent_documents_delete_dev` open theirs.
- **`GRANT DELETE ON TABLE public.address_geocode_misses TO authenticated`**. The policy is what holds the grant to a developer.
- The four fences laid when the table was made are restrictive `FOR ALL` policies, so a read-only account, a digital twin and an archived caller are held back from this delete too, dev or not.

## What stays

Who reads, inserts and updates a miss. The trigger that clears a miss when a point is saved. How long a miss stands, which is the functions' rule. The press that calls the delete, a dev's **Clear…** in Settings → Data & recovery → **Kept map addresses**, clears a miss only when no record anywhere holds its street line, the rule the kept addresses follow (`keptAddressClearProblem`, v2.8568).

## What it does not do

It makes and changes no table, so the four closing calls of a `CREATE TABLE` migration do not apply. It corrects no row.

## Locks

`DROP POLICY IF EXISTS`, `CREATE POLICY`, `GRANT` and `COMMENT` on one table: each takes a short `ACCESS EXCLUSIVE` lock on `address_geocode_misses`, a small table the screens read in batches. `SET lock_timeout = '3s'` opens the file, so a busy moment fails the push fast and it is retried.

## Order

The client calls no new name: it deletes from the table through the untyped client, as it deletes a kept address. Until the push a dev's **Clear…** on a miss reaches no row and the block says the miss was not cleared, in words. So the push and the client deploy may land in either order, and `npm run check:calls-ahead` names no call.

## Test

`npm run test:pg:address-geocode-misses` applies this migration a second time after the table's, which must change nothing, and plays `supabase/tests/address_geocode_misses/20_dev_delete.sql`: an assistant's delete reaches no row; a dev in training mode is held; the dev deletes one miss by its key and the other two stand; a second delete reaches no row; anon is refused. No Postgres runs on the Mac that built this, so the SQL beds job on the PR is the proof of the SQL.

**Applied** to prod by 2026-11-26: the dev seat's `check_migration_ledger` read 1,504 versions applied against 1,504 files on `origin/main`, this version among them (read in the docs pass after #9830); no new name in `database.ts`, since the file makes only one delete policy on `address_geocode_misses`.
