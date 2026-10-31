# 20261031000000_bid_copies_carry_plan_tag.sql (2026-10-30, v2.6194)

A copied bid keeps each row's plan tag. `20261030230000_robot_fixtures.sql` (v2.6180, punch list #221) added `bids_count_rows.plan_tag` — the robot's tag (*WC-1*) on a row its fixtures landed, drawn as the chip beside the name — and the tables `bid_fixture_pulls` / `bid_fixture_pull_rows`, without touching the four functions that copy or move a bid's takeoff, which name their columns one by one. So from that push until this one a new version and a duplicate dropped every row's plan tag. The copy guard, `src/lib/bids/bidCopySql.test.ts` (v2.4388), reads the generated types, so it went red only with the types chore that followed the push (#6593).

## What it does

1. **`clone_count_rows_to_bid_version`** (a new version, called by `create_bid_version`) and **`duplicate_bid_to_service_type`** (a copy into another trade, or a duplicate) are redefined with `plan_tag` added to the copy's SELECT and INSERT and nothing else changed — both bodies as `20261020020000_bid_count_row_marks.sql` left them. `CREATE OR REPLACE` keeps ownership and grants. `adopt_bid_as_version` moves rows whole with `UPDATE … SET bid_id`, so it carried the column from the start and is not touched.
2. **The robot's pull rows are not copied, re-keyed or moved by any copy**, and the guard lists `bid_fixture_pull_rows` beside `bid_changes` as the robot's record, not a row on a count row. A pull is the robot's record of one read of one bid's plans on one run (the bid, the shell, the run, the set it read), and a pull row's `count_row_id` only remembers which row of hers the take landed as.
   - **A new version** clones her rows with their `plan_tag` and the robot's share (`source_shares`, v2.5517), so the shade and the chip survive on the new version; the take stays recorded once, on the version she took it on (`taken_version_id`), which is how `score_locked_shadows` reads the fixtures score. Two pull rows for one fixture found once would count it twice and show it twice in the window.
   - **A duplicate** is a new bid with no shadow run, and v2.5517 already leaves the count sources behind (its rows start with no project): a pull on the copy would describe another bid's read, and `robot_progress()` reads pulls by the run's reference bid, so the copy would never light *Fixtures ready* from it anyway.
   - **An adopt** leaves the pull on the adopted bid with its run, where `robot_progress()` reads it; the pull row keeps pointing at the moved count row (the row keeps its id).

No table is created, so the three `apply_*` fences are not called. Idempotent: two `CREATE OR REPLACE`.

## Release order

Any order. The old client reads and writes `plan_tag` through the RPCs only, and this migration changes no signature. Push with `supabase db push` once the file is on `main`; until the push a new version or a duplicate keeps dropping the tag. `#6593` (the types chore) goes green once this file is on `main`.

## Verify

Read-only on prod after the push: make a bid version from a bid with a `plan_tag` row (`take_robot_fixtures` is the only writer) and read the copy's row. `npm run test:pg:bid-copies` (docker) seeds a robot read on two of the bed's bids and holds: the new version's tags, one pull row still on the first version's row, the duplicate's tags with no pull of its own, and the adopt's pull staying on the adopted bid pointing at the moved row.
