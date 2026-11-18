# 20261117070000_bid_schedule_and_set_sheets.sql (2026-11-16, v2.7496)

Punch list #367, PR 3: the columns behind the Development page's By date view, ahead of the screens that read them.

- **`bids.schedule_start`, `bids.schedule_end`** (dates) and **`bids.schedule_open_ended`** (boolean, default false): a bid's promised schedule, typed by a person. An empty start means the bid has no schedule. Three checks keep the three states honest: an end needs a start (`bids_schedule_end_needs_start`), the end is not before the start (`bids_schedule_end_after_start`), and a schedule with no end date has a start and no end (`bids_schedule_open_ended_has_no_end`).
- **`plan_sets.sheet_count`** (integer, 0 to 100,000 or NULL): how many sheets a set has. `file_count` is a different fact, the files in the set's Drive folder.
- **`list_development_overview(uuid)`** replaced with the same body plus four keys: the three schedule columns on each bid and `first_work_date` on each job. The function names its columns one by one, so without this an estimator's page would never see them. Neither is money.

No new table, no policy change: the columns ride the tables' existing policies, so whoever can edit a bid or a set can set them.

**Apply order**: additive, and nothing reads the columns until the PRs after this one, so push it at any quiet moment after the merge. Those PRs (the schedule on screen, sheets in hand) read columns only this file creates, so they wait for the push.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
