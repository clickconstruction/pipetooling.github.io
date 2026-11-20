# 20261120031349_builder_call_answers.sql (2026-11-19, v2.7982)

Permits, Market: the answer on a name the call list offers (punch list #405, step two; `to-dos/permits-market-page/`). One table, append-only. It ships alone, ahead of every line of client code that names it, so the merge holds no deploy.

## What it does

- **`builder_call_answers`** (id, builder_key, answer, reason, look_again_on, city, prospect_id, permit_id, answered_by, answered_at): what a person said of a builder the call list offered.
  - `answer`: `pursue` (we are going after them), `not_for_us` (not a company to call) or `back` (an earlier answer undone, so the name may be offered again).
  - `builder_key` is the name's key, as `permits.builder_key` and `builders.key` hold it. No foreign key to `builders`: most names on permits have no row there. The answer stands in every city the name pulls permits in, and `city` only records whose list it was given on.
  - `look_again_on` is the day a pursued or passed name may be offered again. Null is not again.
  - `prospect_id` is the lead a pursue made and `permit_id` the permit it was made from. Each is set null when its row is deleted, so the answer stands.
  - `reason` is the person's line of why, empty when none was given.
  - `answered_by` cascades with the user.
  - One index, on `(builder_key, answered_at)`.
- **Row security**: read and insert for `user_can_research_permits()` (the office and every estimator), an insert only as oneself, the rule inside a scalar subquery as `20261111013000` set the other permit tables. No update and no delete: the newest row per name is the state, folded by `src/lib/research/permitCallList.ts` in the client that follows.
- Closed to `anon`; `SELECT` and `INSERT` to `authenticated`. The four fences close the file.

A builder's mark (Good, Avoid) stays in `builder_marks`. A name marked Avoid never reaches the call list, and this table says nothing of it.

## How it was checked

Applied twice on a throwaway local Postgres 15 with stub tables and the row rule's real shape, then a scenario of ten checks: an estimator inserts as themself, nobody inserts as another person, a field tech neither reads nor writes, the office reads another person's answer, no update, no delete, the two checks refuse, the defaults hold, `anon` holds nothing, and a deleted lead leaves its answer standing. The stub is not the app's schema and Postgres 15 is not the app's 17, so this proves the SQL's syntax and logic. The dry run at the push proves the fit.

## Release order

Merge, then push. Nothing in the client names the table yet, so the deploy does not wait on the push. The call list that reads and writes it ships after the push, and reads a missing table as no answers all the same.

## Applied

Pushed to prod on 2026-11-20 within minutes of #8978's merge at 04:46 UTC, with `supabase db push --linked` from a detached checkout of `origin/main`. The dry run named this one file. `npm run check:migration-drift` then read 1,404 local files against 1,404 remote versions, fully applied.

## Verified on prod

Through the app's own session as the dev on clicktooling.com, on the ZZ Test key `zztestbuilders`, which no builder has:

- **An answer given as oneself** lands, with its reason, its day to look again and its city.
- **An answer naming another person** is refused by the row rule.
- **An answer outside the three** is refused by its check.
- **An update and a delete** are refused: the table only grows.
- **A read as `anon`** is refused.
- **A put-back** lands after the pass, so the name would be offered again.

Two ZZ rows are left on that key, the pass and its put-back. A field tech's refusal was held on the throwaway Postgres before the push, not on prod.
