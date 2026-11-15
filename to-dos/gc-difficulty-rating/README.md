---
name: "GC difficulty rating: the GC is rated once, and the points become cost lines on every new bid to them"
number: 357
group: ready
status: designed 2026-11-14 with the owner on a canvas, the calls settled the same day · building as a train of six, one PR merged, pushed and walked live before the next is cut · PR 1 (the criteria, versioned, and the dev's editor) merged as v2.7275 (#8129), pushed and walked live the same day · PR 2 (the rating on the GC's record, the chips) merged as v2.7279 (#8134), pushed and walked live the same day · PR 3 (Paying read from the bills) on claude/357-pr3-paying
mockup: the canvas, five screens — https://claude.ai/artifact/JRUZqLEPwTHHdJNCWFEgVd
summary: >
  The company loses bids because a master in the field asks the estimator to add twenty or fifty
  thousand dollars to a price with no reason attached, and an estimator will not question a master.
  The fix is to rate the GC, not the bid: one rating on the GC's record, in sentences a master picks
  from, read by every new bid to that GC and turned into cost lines on the estimate by a price list
  the office owns. Paying is read from the GC's bills, never picked. The criteria are the dev's and
  versioned; the price list is the owner's and the controller's and versioned; a rating and a priced
  bid pin to the versions they were made under, so a new version never moves old points or old lines.
next: PR 3 merged, pushed and walked live, then PR 4, the price list and the lines.
size: L as a train of six (M · M · S · L · M · M)
blocker: none; the owner settled the calls on 2026-11-14 and said build it.
ver: v2.7275 (PR 1) · v2.7279 (PR 2)
opinion: build — the owner's calls are settled and every PR stands on its own
---

# GC difficulty rating (#357)

Canvas: [GC difficulty rating](https://claude.ai/artifact/JRUZqLEPwTHHdJNCWFEgVd), five screens drawn 2026-11-14 with made-up names. 1 the GC's record card *How they are to work with*; 2 the master's phone sheet from a bid; 3 the Workbench strip with the three cost lines; 4 the Bid Board with the GC chip and the *Pricing rules* sheet; 5 the dev's criteria editor with versions.

## The ask

The owner, 2026-11-14: masters in the field ask estimators to add twenty or fifty thousand dollars to a price because the GC is hard to work with, with no reason attached. The estimator adds it, the bid loses, and nobody can say afterwards what the money was for. He wants the difficulty named in sentences, priced by a rule the office owns, and shown on the bid as cost with its reasons.

## Settled 2026-11-14 (the owner's calls)

1. **Rate the GC, not the bid.** One rating per GC on its record. One scale, the site, lives on the bid instead, since the site is the job's and not the GC's (PR 6).
2. **Cost lines, never a multiple and never margin points.** Difficulty costs field hours, office hours and money waiting on a slow payer. Materials and tax are untouched. The lines are direct-cost rows on the Labor tab, so the solver, the margin and *Bids like this* need no change.
3. **The criteria are the dev's, versioned.** The scales, their rungs and their sentences are edited from the dev's own Settings tab. A published version is immutable; the dev edits a draft and publishes the next version. A rating and a priced bid pin to the version they were made under.
4. **The price list is the owner's and the controller's, on the Bid Board** behind a *Pricing rules* door, not in Settings. Versioned the same way. Estimators read it.
5. **A rating change reaches only bids priced after it.** A priced bid keeps its lines. The Workbench shows a quiet *rated higher since this was priced* line with a press to read the new rating in.
6. **Paying is read from the bills**, from the pay-speed data the app already keeps (`billedExpectedPay.ts`, `payPace.ts`: the median days to pay, lateness against a pay calendar), never picked. Fewer bills than the price list's minimum means no point, and the card says so. A by-hand override takes a reason.
7. **The master is asked at the end of a job** with that GC, once, on the same phone sheet. The bid reads the rating at pricing.

## The data model (three tables versioned and pinned, one that pins)

- **`difficulty_criteria_versions`** — `version`, `status` (draft or published), `published_by`, `published_at`, `note`, and `body` jsonb validated by the kernel: a list of scales, each with a stable `key`, a `name`, `scope` (`gc` or `bid`), `source` (`picked` or `bills`), `max`, and `rungs` of `{points, sentence}` in order. A published row is immutable (a trigger refuses the update). Version 1 is seeded by the migration with today's three scales: **paying** (bills, gc, 0 to 1), **field** (picked, gc, 0 to 3) and **office** (picked, gc, 0 to 2). The **site** scale (picked, bid, 0 to 2) comes as version 2 in PR 6.
- **`gc_difficulty_ratings`** — `customer_id`, `criteria_version_id`, `picks` jsonb `{key: points}`, `note` (required), `rated_by`, `rated_at`. The newest stands and every one is kept. A rating given under version N stays a version N rating.
- **`difficulty_price_versions`** — the Bid Board's price list: the field percent of field hours, office hours per point and the office rate, the site percent, the paying rule (the days threshold, the monthly rate, the minimum bills), the cap as a percent of the bid's own cost, who may rate, `published_by`, `published_at`.
- **`bid_difficulty`** — `bid_id`, `rating_id`, `criteria_version_id`, `price_version_id`, the picks and sentences snapshotted, the lines as written (each with the scale key, hours, rate, amount and the event words), lines taken off with who and why, `priced_at`. The direct-cost rows on the estimate reference it.

**The carry-over rule**, pure and tested (`difficultyCriteria.ts`): a pick carries to a newer criteria version only when its scale key and its points value still exist there. A removed scale or rung leaves that scale unrated and the card says so. A new scale starts unrated. Nothing is recomputed from old words onto new words. A bid already priced keeps its version, words and lines.

## The plan: six PRs, one at a time

Each PR is merged before the next is cut. After each merge: `supabase db push`, deploy, then the feature is walked on clicktooling.com as the dev against ZZ Test customers and bids, and what was seen goes in the fragment under *Checked live*. Each fragment ends with *Is this the best we can do?*: what was doubted, what changed because of it, and what is left for the owner with a pick.

| PR | What | Touches | State |
|---|---|---|---|
| 1 | **Criteria infrastructure.** The criteria table with its seed; the kernels `src/lib/bids/difficultyCriteria.ts` (the shape, validation, carry-over, total points) and `difficultyEditor.ts` (draft edits as pure operations); the dev's Settings card to edit the draft and publish, with a preview of the GC card. No price effect. | migration `20261114090000_difficulty_criteria_versions.sql`, `src/lib/bids/difficultyCriteria*.ts`, `difficultyEditor*.ts`, `difficultyCriteriaIo.ts`, `difficultyCriteriaWords.ts`, `src/components/settings/DifficultyCriteriaCard.tsx`, `src/components/bids/DifficultyScalesPicker.tsx`, `settingsGroups.ts`, `Settings.tsx`, guide `change-the-difficulty-criteria` | merged as v2.7275 (#8129), pushed and walked live 2026-11-14 |
| 2 | **The rating.** The ratings table; the card *How they are to work with* on the customer's page beside *Pays in kind*, drawn from the published version; a read-only *Rated N points* chip on the Workbench strip and in the Bid Board's GC column, *Rate them* where none. | migration, `gcDifficultyRating*.ts`, `CustomerDetail.tsx`, `BidsBidBoardTab.tsx`, `BidsPricingTab.tsx`, guide `rate-how-a-gc-is-to-work-with` | merged as v2.7279 (#8134), pushed and walked live 2026-11-14 |
| 3 | **The paying scale from bills.** A reader over the pay-speed data and the price list's thresholds, shown on the card with the numbers behind it; fewer bills than the minimum means no point and says so; a by-hand override with a reason. | migration `20261115010000_gc_difficulty_pick_reasons.sql`, `difficultyPaying*.ts`, `difficultyPayingIo.ts` over `billedExpectedPay.ts`, `payPace.ts` and `payCalendar.ts`, the card | building on claude/357-pr3-paying (v2.7296) |
| 4 | **The price list and the lines.** The *Pricing rules* door on the Bid Board with its versioned sheet (the owner and the controller edit, estimators read); `difficultyLines.ts` turning a rating, a price version and the bid's field hours, labor rate and price into the lines; when a bid to a rated GC is first priced the engine writes them as direct-cost rows of a new kind on the Labor tab, and the Workbench strip reads *Difficulty · N points · +$X in cost* with the fold of sentences; take a line off this bid with a reason; the stamp at send keeps the difficulty cost apart (`bids.priced_difficulty_usd`); the *rated higher since this was priced* line with its press; *Bids like this* unchanged. | two migrations, `difficultyPrice*.ts`, `difficultyLines*.ts`, `useBidPricingEngine.ts`, `BidsLaborTab.tsx`, `BidsPricingTab.tsx`, `BidsBidBoardTab.tsx`, `pricedMargin.ts`, guide `set-what-difficulty-costs` | after 3 |
| 5 | **The master's door.** The phone sheet from a bid row (390 px, 44 px rungs, the paying scale locked, the consequence in dollars before Save, with *Bids like this* for this GC); the end-of-job ask: when a job with a rated or unrated GC closes, the master on it is asked the same sheet once. | `DifficultyRateSheet.tsx`, the bid row's door, the job close hook, the masters' part of the rating guide | after 4 |
| 6 | **The site scale and the feedback.** Criteria version 2 adds the site scale on the bid, priced from the Bid Board's site percent; the card *What the rating did* on the GC's record (bids since rated, won, difficulty priced in, hours past the estimate) with the nudge when hours burn past the lines. | migration (version 2 published by the dev), `difficultyFeedback.ts`, the GC card | after 5 |

## How to verify

Signed in as the dev on clicktooling.com. Make a `ZZ Test` GC customer and a `ZZ Test` bid to it when none fits, and delete both before the session ends. PR 1: Settings → Difficulty criteria shows version 1 with the three scales, a draft can be edited and published as version 2, the preview draws the GC card from the draft, and version 1 reads unchanged afterwards. The later rows add their own recipe as they land.

## Where it stands

PR 1 (v2.7275) and PR 2 (v2.7279) are live. PR 3 is being built. The ZZ Test GC *ZZ Test Walk 2026-11-08* carries a 3-point rating as the fixture for the later walks; it is deleted at the end of the train.
