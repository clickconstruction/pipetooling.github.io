# 20261124091500_address_geocode_misses.sql (2026-11-24, v2.8473)

Remember an address the map cannot place, step 1 of 3 (punch list #408; [`to-dos/remember-unplaced-addresses.md`](../../to-dos/remember-unplaced-addresses.md)). A place to keep a miss. It ships alone, ahead of the functions and the readers that use it.

## What it does

- **`address_geocode_misses`**: one row for an address no map service could place.
  - `address_normalized` is the key, the same one `address_geocodes` uses: trimmed, single-spaced, lower case. At least three characters.
  - `error_code` is why it could not be placed, in the functions' own codes. Never blank. `detail` is what each service said, at most 2,000 characters.
  - `checked_at` is the day it was checked. The trigger `address_geocode_misses_stamp` sets it from the server's clock on every insert and update, whatever the caller sent.
  - Any signed-in user reads, inserts and updates a row, as `address_geocodes` has allowed since v2.3131. The functions write through the caller's own JWT.
  - Nobody deletes a row by hand. The role holds no DELETE and there is no delete policy.
- **`address_geocodes_clears_miss`**: a trigger on `address_geocodes`, after every insert and update. It deletes the miss kept for the same key.
  - So a hit removes the miss whoever saved the point: the two geocode functions, the parcel lookup, the nightly placing, the dev seat's task place.
  - The function is a definer, because no caller holds a delete on the misses. It fires only after the caller's own write to `address_geocodes` has passed that table's policies and fences.
- The four fences close the file, and they cover the new table. A training account, a digital twin and an archived account write no miss.

## What the table does not hold

How long a miss stands before it is asked again. That is the functions' rule, kept in one named constant in step 2, so the owner's call on the number of days needs no migration.

## Why a trigger takes the miss away

Six writers save a point to `address_geocodes` today. A delete written into each would miss the next writer. The trigger covers them all, and no user needs a delete of their own.

## Why the day is the server's

The table is open to every signed-in user. A day the caller could send would let one write keep an address off every map for years.

## Applying it

`supabase db push`, once the file is on `main`, then regenerate `src/types/database.ts`. Nothing reads or writes the table until step 2 ships. The trigger on `address_geocodes` takes a short lock on that table, under the three-second lock timeout.

**Applied** to prod by 2026-11-24: the dev seat's `check_migration_ledger` read 1,485 versions applied against 1,485 local files, this version among the newest it listed (read in the docs pass after #9574).
