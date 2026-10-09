# 20261009234500_submittal_design_change_call.sql (2026-10-09, v2.5023)

Submittals decision 11, the owner's call of 2026-10-09: a design-change row says whose call it is and records the sign-off. Four nullable columns on `bid_submittal_items`:

- **`call_by`** `text`, one of `architect · engineer · gc · owner`: whose call the changed performance value is;
- **`signoff_name`** `text`, 1 to 120 characters once trimmed: who signed off, as the office recorded it;
- **`signoff_on`** `date`: the day the sign-off came;
- **`signoff_via`** `text`, one of `email · letter · stamped_drawing · meeting · phone`: how it came.

Each column is optional on its own, and each CHECK lets NULL through. The office enters them in the row's **Edit** window, which shows them only while the status is a design change. A save on any other status clears them (`designCallPatch`). A split row and the next revision's row keep them when the product is unchanged (`designCallCarry`). `get-submittal-room` selects them, and the room prints one line under the row's why: *The engineer's call · signed off by Pat Lee on Oct 9, 2026, by email.* (`designCallLine` in `_shared/submittalRoomPayload.ts`).

Additive and idempotent: `ADD COLUMN IF NOT EXISTS`, and each constraint is added only when `pg_constraint` lacks its name. No new table, so no read-only or digital-twin fences to re-apply.

## Order

1. **The push first.** A save that leaves the fields empty names none of the columns, so ordinary saves work before the push. A save that fills them waits for it. Nothing on prod was a design change on 2026-10-09.
2. **Then `get-submittal-room`**, whose select names the four columns and fails until they exist.
3. **Then the types PR**, which drops the `DesignCallFields` casts.

## Checked on a local Postgres 15

The stand-in was `bid_submittal_items (id, status)` with 27 rows, and the migration was applied twice. The second run skipped the four columns and the three checks.
- The columns read `text`, `text`, `date`, `text`, and the three checks were there.
- A design change with every field set went in, with a name of 120 characters.
- These were refused by their checks: `call_by = 'boss'`, a blank name, a name of 121 characters, and `signoff_via = 'fax'`.

## The lock note

`SET lock_timeout = '3s';` is first. Nullable columns with no default are catalog changes. Each CHECK takes an ACCESS EXCLUSIVE lock on `bid_submittal_items` and scans it; the table held 27 rows on 2026-10-09, and no crew screen writes it.

## Verify after the push

1. **The columns.** `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bid_submittal_items' AND column_name IN ('call_by', 'signoff_name', 'signoff_on', 'signoff_via') ORDER BY 1;` gives four rows: `text`, `text`, `date`, `text`.
2. **The checks.** `SELECT count(*) FROM pg_constraint WHERE conname IN ('bid_submittal_items_call_by_check', 'bid_submittal_items_signoff_name_check', 'bid_submittal_items_signoff_via_check');` gives `3`.
3. **Nothing written.** `SELECT count(*) FROM public.bid_submittal_items WHERE call_by IS NOT NULL OR signoff_name IS NOT NULL OR signoff_on IS NOT NULL OR signoff_via IS NOT NULL;` gives `0`.

Then `npm run check:migration-drift`, the `get-submittal-room` deploy and the types PR.

## Status

Merged as v2.5023 (#5093) and pushed to prod in GC MODE's 09:12 UTC batch on 2026-10-09 (drift 813 of 813 at 09:13). `get-submittal-room` and the ten bundles that import `_shared/submittalRoomPayload.ts` deployed from the main checkout at 09:14 UTC (edge drift all 144 current). The verify steps ran read-only over the session pooler at 09:16 UTC:

1. **Passed.** Four columns: `call_by` text, `signoff_name` text, `signoff_on` date, `signoff_via` text.
2. **Passed.** The three CHECK constraints are present.
3. **Passed.** No row carries any of the four — nothing written.

The types PR rides with the batch's five migrations (Helper 17, the GC crew).

## Rollback

A one-off migration drops the three constraints and the four columns, after `get-submittal-room` is redeployed without them in its select.
