# 20261119130000_bid_permit_answers.sql (2026-11-19, v2.7940)

Permit news on Followup: the answer on a line (punch list #401, PR 2; `to-dos/permit-news-on-the-bids/`). One table, append-only. It ships alone, ahead of every line of client code that names it, so the merge holds no deploy.

## What it does

- **`bid_permit_answers`** (id, bid_id, city, permit_number, permit_type, answer, answered_by, answered_at): what a person said of a permit on a bid's address.
  - `answer`: `this_job` (the permit is on the job we bid; the line is answered and stays on the bid), `not_this_job` (another job on the same address; off this bid for everyone) or `taken_back` (an earlier answer undone).
  - A permit is named by `city`, `permit_number` and `permit_type`, the way `permitsOnSite` counts one: the application and the issued permit share a number and a type and are one permit. No foreign key to `permits`, so a re-pull that replaces a row leaves the answer standing.
  - `bid_id` cascades with the bid. `answered_by` cascades with the user.
  - One index, on `(bid_id, answered_at)`.
- **Row security**: read and insert for `user_can_research_permits()` (the office and every estimator), an insert only as oneself, the rule inside a scalar subquery as `20261111013000` set the other permit tables. No update and no delete: the newest row per bid and permit is the state, folded by `src/lib/research/bidPermitAnswers.ts` (v2.7941).
- Closed to `anon`; `SELECT` and `INSERT` to `authenticated`. The four fences close the file.

A lost bid is not written here. It is the bid's own outcome, saved by the windows that save it today.

## Release order

Merge, then push. Nothing in the client names the table yet, so the deploy does not wait on the push. The read, the write and the Followup lens that call it ship in v2.7941, after the push: `loadPermitAnswers` reads a missing table as no answers all the same.

**Applied** to prod by 2026-11-20: the dev seat's `check_migration_ledger` read 1,410 versions applied against 1,410 local files, this version among them (read in the docs pass after #8832); types regenerated in #8921.
