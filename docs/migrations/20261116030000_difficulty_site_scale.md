# 20261116030000_difficulty_site_scale.sql (2026-11-15, v2.7360)

GC difficulty rating, PR 6 of six (punch list #357, [`to-dos/gc-difficulty-rating/README.md`](../../to-dos/gc-difficulty-rating/README.md)): the site scale, picked on the bid.

- **Criteria version 2** — one row of `difficulty_criteria_versions`, published by the migration (*the app*), not from the dev's card, so the live walk is a read: version 1's three scales unchanged and **The site** (`key: site`, `scope: bid`, `source: picked`, 0 to 2: *Open ground with room to stage.* / *An occupied building, or no room to stage.* / *Work in phases, or every trip is a lift.*). `ON CONFLICT … DO NOTHING` on the published version number, so a second run adds nothing. The same JSON is `DIFFICULTY_CRITERIA_V2` in `src/lib/bids/difficultyCriteria.ts`; `difficultyCriteria.test.ts` reads this file and holds the two equal. A rating made under version 1 keeps its version and its points; the client carries a GC's picks to the GC's scales only, so the site never reads as unrated on a GC.
- **`bid_difficulty_picks`** — one row per bid (`bid_id` the key): the picks made on the bid itself (`{site: 1}`) under one published version, who picked and when. Kept apart from the pin (`bid_difficulty`), which is what the bid was priced with: a bid to an unrated GC can carry a site pick, and a master can pick the site before the bid is costed.
- **The guard** stamps `picked_by`/`picked_by_name`/`picked_at`, holds the version to a published one, and holds every pick to a scale of scope `bid` that a person picks and to a rung that scale has.
- **The gates**: everyone signed in reads; `is_bid_pricing_user()` (dev, owner, assistant, controller, estimator) inserts and updates; `is_dev()` deletes.
- The four fence calls.

Nothing prices the site until a person picks it: `difficultyLines` has read `sitePctPerPoint` since PR 4, and no scale carried the key before this version.

**Apply order**: push right after the merge. The client reads `bid_difficulty_picks` by name and fails soft (no site line until the push), and the site line draws only once version 2 is published. Regenerate types after the push as a `chore(types)` PR.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111); `database.ts` on `main` carries `bid_difficulty_picks`.
