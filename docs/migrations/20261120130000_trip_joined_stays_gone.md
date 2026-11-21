# 20261120130000_trip_joined_stays_gone.sql (2026-11-20, v2.8127)

A joined trip stays joined.

[`trip_join`](20261119180000_trip_join.md) deletes the next trip and keeps it in the archive marked `joined_into`. The Deleted trips fold reads the mark and draws no **Put back**. The save itself refused nothing, since `trip_save` makes any id that is not there.

## The gap it closes

Three presses send a trip's own save under its own id:

- **Put back** on a Deleted trips fold read before the join;
- **Change**, then **Save**, on a Development page left open from before the join;
- the **Undo** of a delete made on such a page.

On a screen older than a join, each made the trip that went again. The Development page reads a site's trips when it opens and after its own writes, never by itself, so such a screen can be hours old.

Worked on the local bed with made-up rows: Trip 2 (two days, Extra, on a bill as an $1,800 line) was joined into Trip 1. A stale screen then saved Trip 2, and the save answered *added as Trip 2*.

- Its two days stood on Trip 1 and on Trip 2.
- Trip 2 read Extra and on no bill, while Trip 1 held the line.
- The save settled the archive row, so Deleted trips listed nothing and no screen said Trip 2 had been joined.
- **Put on a bill** then took Trip 2, and the job's total read $3,600 for one trip's days.

No number was handed out twice, the line stayed with Trip 1, and hours and cost went to the trip that went out first, so they were not doubled.

Prod held no trip when this shipped, so nothing had come back.

## What it adds

One trigger function and its trigger. No table, column or index.

### `trips_refuse_joined_back()`, `BEFORE INSERT ON public.trips FOR EACH ROW`, `SECURITY DEFINER`

- It reads the newest delete of the trip's id that nothing has put back (`deleted_records_archive`, `table_name = 'trips'`, `restored_at IS NULL`), over `idx_deleted_records_archive_table_record`.
- When that delete carries `joined_into`, the insert is refused in words. Otherwise the trip is made as before.
- A read that fails, or a mark it cannot read, lets the insert through with a warning, as every save went before.
- It is a definer because the archive is the dev's alone to read.
- Its name sorts before `trips_take_number`, so a refused insert never reaches the site's counter.

It covers every door at once: `trip_save` and its three presses, the dev seat's `apply_trip`, and the dev's `restore_deleted_records`, which answers `{ ok: false, code: '22023', error }` with the same words, in a dry run too.

`trip_save`'s dry run writes nothing, so it does not hear the refusal and says *add*. The app sends no dry run: the dev seat's `plan_trip` is its one caller. Since v2.8165 (server 0.123.0) `plan_trip` reads the same archive row after a dry run that says *add*, as the dev, and refuses the plan in these words, so a plan and its `apply_trip` agree (`tripPlanJoinedBack` in `_shared/devMcpTrips.ts`). Before that it could say *add* for such a trip, and `apply_trip` was then refused.

What it leaves alone:

- A trip somebody deleted carries no mark. **Put back**, the **Undo** of a delete and the dev's restore of one work as before, with the trip's number.
- **Split in two** makes its new trip under a new id, so a split is never refused. The halves join again, and the half that went is refused in its turn.
- The phone's `trip_phone` already refused a trip that is gone.

## What it refuses, in words

| Case | Words | Code |
|---|---|---|
| The joined trip is there | *Trip 2 was joined into Trip 1, which holds its days. To take the join back, press Split in two on Trip 1.* | 22023 |
| The joined trip is deleted too | *Trip 2 was joined into Trip 1, which holds its days. Put Trip 1 back, then press Split in two on it.* | 22023 |
| Trips made before numbers | *That trip was joined into another trip, which holds its days. To take the join back, press Split in two on that trip.* | 22023 |

The words name the trips as the Deleted trips fold does (`deletedTripLine`).

## The screen

`useSiteTrips`' save reads the site's trips and its deleted trips again when the database refuses a save, so a trip joined away redraws under Deleted trips as *Joined into Trip 1*, with no **Put back**. A save lost to the signal reads nothing again. The toast carries the database's words after the press's own sentence: *The trip could not be put back: Trip 2 was joined into Trip 1, …*

## Who

Nothing changes in who may save, put back or restore a trip. The trigger refuses one kind of insert for everyone, the dev included. `EXECUTE` on the function is revoked from `PUBLIC`, `anon` and `authenticated`: it is a trigger function nobody calls.

## Locks

`CREATE OR REPLACE FUNCTION` and `CREATE OR REPLACE TRIGGER`, which holds a SHARE ROW EXCLUSIVE lock on `trips` for a moment. The file starts with `SET lock_timeout = '3s'`. Each insert of a trip does one indexed read of the archive.

## Tests

`supabase/tests/trips/95_joined_back.sql` (`npm run test:pg:trips`), with days counted from the bed's own today:

- nobody calls the guard, and it runs before each trip is made and before the trip takes its number;
- the save of a trip that was joined away, sent from a screen read before the join, refused in words with code 22023, and the same trip changed on an old sheet;
- `trip_save`'s own dry run says *add* and writes nothing (the dev seat's `plan_trip` reads past it since v2.8165, held to this function's text by `src/lib/devMcp/devMcpTrips.test.ts`);
- the site, the line and the counter as the join left them, Deleted trips still saying joined, and the mark not settled away;
- the dev's restore of its bundle refused in the same words, and its dry run;
- a trip somebody deleted put back with its number;
- Split in two on the joined trip, the halves joined again, and the half that went refused in turn;
- the joined trip deleted, then put back, with the words for each;
- a trip made before numbers named as the fold names it;
- a mark the guard cannot read letting the save through.

The whole trips bed ran green on the build Mac's local Postgres 15, with the trips migrations applied a second time: 392 checks, the 363 from before and 29 new. With the guard made a no-op, the new file failed at the first stale save.

## Push

`supabase db push` once this file is on main. The screen's half works before and after the push: until the push a stale save is not refused, as before.
