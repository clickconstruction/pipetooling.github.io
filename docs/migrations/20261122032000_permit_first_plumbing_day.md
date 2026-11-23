# 20261122032000_permit_first_plumbing_day.sql (2026-11-21, v2.8252)

Permits, Market: a job's first plumbing permit day, beside its newest ([v2.8252](../recent-features/v2.8252.md), punch list #405). One function added. Nothing replaced, no table, column, index, policy or grant changes.

## Why

`research_permits` keeps one plumbing day per building permit, the newest (`plumber_permit_on`). Market's clock measures from the building permit to the plumber's permit. A job with two plumbing permits was measured to its later one, so the clock read long. The clock says how soon a job is taken, and a job is taken the day its first plumbing permit lands.

## What it adds

| Object | What it does |
|---|---|
| `research_permits_v4(p_city, p_since, p_residential)` | `research_permits_v3`'s rows with one column more. `plumber_first_permit_on` is the day of the earliest plumbing permit that counts for the row's job. `SECURITY INVOKER`, `STABLE`, closed to anon. |

- It **reads v3 and joins the day on**. No body is copied, and v3 keeps its shape for a client that has not updated.
- The plumbing permits it reads are the job's own, by the pairing [`20261119063000`](./20261119063000_permit_plumbing_ties.md) gave `research_permits`: on the building permit's number, or at its address when `permit_address_plumbing_counts` says the two are one job, and no older than 30 days before it.
- So the column is set on exactly the rows that carry `plumber_permit_on`, and is never later than it. A job with one plumbing permit reads the same day in both.
- `plumber_permit_on` is not changed. The skim and the ledger say the newest permit's day, as before.

## Read on prod before writing

Read-only, 2026-11-21, a year of commercial permits, counts only.

| City | Jobs with a plumbing permit | With more than one | First day earlier than newest | Clock's quarter marks, days |
|---|---|---|---|---|
| Austin | 300 | 54 | 26 | 1, 7, 16 become 1, 6, 15 |
| San Antonio | 277 | 219 | 18 | 0, 0, 0 stay |
| New Braunfels, San Marcos, Seguin | 9 together | 0 | 0 | no change |

The function's body, run as a plain query over Austin's 936 rows, set the day on all 300 taken rows and no other, and never later than the newest. The join added 4 ms to a 144 ms read of San Antonio.

## The client

Nothing reads v4 yet. The clock's change is its own PR, armed after this file is pushed.

## Tested

`npm run test:pg:permit-skim`: the whole schema with this file applied, then applied again. New in the probe: a job with plumbing permits nine and three days ago reads 3 as its newest and 9 as its first, and a permit from two hundred days ago is never read; an open job carries neither day; a job with one plumbing permit reads the same day twice, on its number or at its address; v4 less its one column equals v3 row for row; across every city of the bed the first day is set with the newest and never later; anon cannot run v4.

## Release order

`supabase db push` from a main checkout after the merge. Order against the client deploy does not matter: no client calls v4 until the next PR.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274).
