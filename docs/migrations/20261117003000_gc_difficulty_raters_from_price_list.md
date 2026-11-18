# 20261117003000_gc_difficulty_raters_from_price_list.sql (2026-11-16, v2.7468)

GC difficulty rating (punch list #357, [`to-dos/gc-difficulty-rating/README.md`](../../to-dos/gc-difficulty-rating/README.md)): the rating's insert rule asks the price list who may rate, and the price list names the estimators. The owner's word of 2026-11-16: an estimator should be able to rate. Fragment: [`v2.7468`](../recent-features/v2.7468.md).

**Who may insert into `gc_difficulty_ratings`**

| Role | Before (`is_office_staff()`) | After (`gc_difficulty_can_rate()`, under price list version 2) |
|---|---|---|
| dev | yes | yes, whatever the list names |
| master_technician (the owner) | yes, whatever the list named | yes while the list names `master` |
| assistant, controller | yes, whatever the list named | yes while the list names `office` |
| estimator | **no**, though the client offered the save once the list named the estimators | **yes** while the list names `estimator` |
| primary, superintendent, subcontractor, helpers, signed out | no | no |

- **`gc_difficulty_can_rate()`** — `STABLE`, `SECURITY DEFINER`, `search_path = ''`, executable by `authenticated` only. The caller's role against `body.raters` of the newest published row of `difficulty_price_versions`: a dev always; `estimator` → `estimator`, `master_technician` → `master`, `assistant` and `controller` → `office`; nobody else. With no published list, or `raters` not a list, all three groups may. It is the twin of `difficultyCanRate()` in `src/lib/bids/difficultyPrice.ts`, and `difficultyPrice.test.ts` reads this file to hold the default and the groups equal.
- **The insert rule**: `gc_difficulty_ratings_insert_raters` (`WITH CHECK (gc_difficulty_can_rate())`) is made first, then `gc_difficulty_ratings_insert_office` is dropped, so there is no moment with neither. Select (everyone signed in), delete (a dev), the guard trigger and the three restrictive fences (`read_only_users_cannot_insert` with the statement block, `digital_twin_write_fence_insert`, `archived_fence`) are untouched. A digital twin is an estimator by role and is still refused by its fence.
- The data step first takes the advisory lock the price list's guard takes when a person publishes (`pg_advisory_xact_lock(hashtext('difficulty_price_versions'))`), so a publish in the same moment waits and takes the number after this one.
- **A data change on prod, two statements, each runs once** (both skip when any published version already names the estimators, so a later version that takes them off again is the owner's and the controller's choice and a second run respects it):
  - `difficulty_price_versions` gains **one row**: `version` = the newest published version + 1 (**2** on prod, where version 1 is the only row), `status` `published`, `body` = that version's body with `raters` set to `["office", "estimator", "master"]` (prod's version 1 holds `["office", "master"]`; the nine numbers are copied unchanged: field 5%, office 12 hours at $80, site 4%, paying past 45 days at 1.5% a month, 3 bills, 2 late in a year, cap 10%), `note` *Version 1's numbers, with the estimators added to who may rate a GC: the owner's word of 2026-11-16.*, `published_by_name` *the app*, `published_at` now. Version 1 is not changed: a published row never is, and bids priced under it keep it.
  - A draft row with a `raters` list that lacks `estimator` gains the name, so publishing a half-typed draft does not take the estimators off again. Prod held **no draft** when this was written (read 2026-11-16), so this touches no row there.
- No table is created, so there are no fence calls. Numbered `20261117003000`, after main's newest file when the PR was cut (`20261117001500`); it was first written as `20261116233000` and renumbered before the push, since `db push` refuses a file older than the last one applied.

**Bed**: `npm run test:pg:gc-difficulty-raters` (`supabase/tests/gc_difficulty_raters/`, whole schema, in the SQL beds workflow): the migration twice, then every role's save under version 2 and under lists naming only the estimators, the office and the masters, nobody, and no list; a draft deciding nothing; an estimator in training, a twin and an archived estimator refused by their fences.

Read-only on prod before the PR (2026-11-16, the dev seat and its sample estimator): `difficulty_price_versions` holds version 1 alone, published by *the app*, `raters` `["office", "master"]`, no draft. The sample estimator reads the two published criteria versions, the price list and a `ZZ Test` customer; `get_billed_customer_pay_speeds()` answers it NULL (the pay-speed read is the money roles'), which is why the client now keeps the Paying point an estimator cannot read.

**Apply order**: the client first, then the push. The merge deploys the client; push once the Pages deploy has finished. Until the push nothing changes for anyone: the list still reads version 1 and the old rule still stands. Pushed before the new client, an estimator's save from the old client would have dropped the GC's Paying point. No types PR waits on it: no column or table changes and the client does not call the function. The generated types gain `gc_difficulty_can_rate` at the next regeneration, whoever runs it.

**Pushed**: 2026-11-16 at 12:51 CST (18:51 UTC), from a checkout equal to `origin/main`, after the merge (#8366, 18:30 UTC) and the client's deploy of that commit. It was the only file pending. Main's `20261117030000` was already applied, so the plain push named this one file and asked for `--include-all`, the out-of-order case, and the second run applied it alone. `check:migration-drift` then read 1,333 files, fully applied.

Read back on prod, read-only, the same hour:

- `difficulty_price_versions` holds two published rows and no draft. Version 2: `raters` `["office", "estimator", "master"]`, the nine numbers equal to version 1's, the note as written above, `published_by_name` *the app*, `published_by` NULL, `published_at` 18:51:01 UTC. Version 1 is as it was.
- `pg_policies` on `gc_difficulty_ratings`: one permissive insert rule, `gc_difficulty_ratings_insert_raters` with `WITH CHECK (gc_difficulty_can_rate())`; `gc_difficulty_ratings_insert_office` is gone; the select rule, the dev's delete rule and the restrictive fences (`read_only_users_cannot_insert`, `digital_twin_write_fence_insert`, `archived_fence`) are there.
- `gc_difficulty_can_rate()` on prod: its body equals this file's, `SECURITY DEFINER`, `search_path = ''`, executable by `authenticated` and not by `anon`.
- The function's rule read against each role's sample account: assistant, controller, estimator and master technician may rate; helpers, primary, subcontractor and superintendent may not. Under the old rule the estimator was the one refused.
- The sample estimator reads version 2 as the newest published list, which is what the client asks.
- `gc_difficulty_ratings` held no row before or after: no rating was saved to check this.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
