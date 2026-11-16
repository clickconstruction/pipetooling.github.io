# 20261115020000_difficulty_price_versions.sql (2026-11-15, v2.7301)

GC difficulty rating, PR 4 of six (punch list #357, [`to-dos/gc-difficulty-rating/README.md`](../../to-dos/gc-difficulty-rating/README.md)): the price list, versioned.

- **`difficulty_price_versions`** — one row per version, the criteria table's twin (`version`, `status` draft or published, `body` jsonb, `note`, who published and when). `body` is the price list: `fieldPctPerPoint`, `officeHoursPerPoint`, `officeRate`, `sitePctPerPoint`, `payingDaysPast`, `payingMonthlyRate`, `payingMinBills`, `payingLateBillsInYear`, `capPct`, `raters` (`office`, `estimator`, `master`); `src/lib/bids/difficultyPrice.ts` validates it, the database holds the floor (an object). One draft at a time; one row per published number.
- **The guard** (`difficulty_price_versions_guard`): a publish stamps who and when and takes the next number under an advisory lock; a published row is never changed or deleted (priced bids pin to it).
- **The gates**: everyone signed in reads; `is_master_or_dev() OR is_controller()` writes — the owner, the controller and a dev.
- **Version 1** seeded with the canvas's numbers (5% · 12 h at $80 · 4% · 45 days at 1.5% a month · 3 bills · 2 late in a year · 10% cap · the office and the masters rate). `difficultyPrice.test.ts` reads this file to hold the kernel's `DIFFICULTY_PRICE_V1` equal to it.
- The four fence calls, as every CREATE TABLE.

**Apply order**: push right after the merge. The Bid Board's *Pricing rules* door, the GC card's rater gate and the Workbench's lines read the table by name; before the push the reads fail soft (version 1's numbers for the gate and the rule, no lines written). Regenerate types after the push as a `chore(types)` PR.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111); `database.ts` on `main` carries `difficulty_price_versions`.
