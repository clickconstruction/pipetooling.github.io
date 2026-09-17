---
name: "Frozen bid prices: the last two calls"
group: gated
status: >
  PRs 1–2 shipped 2026-09-15 (v2.3481 the write-target guard, v2.3484 the sent-vs-today line) · PR
  3 (lock pricing after send) and the backfill re-run are owner calls
summary: >
  **Frozen bid prices**: a bid only freezes once it owns a copy of the price book, and nothing
  takes that copy before the first price is written — a new bid prices straight on the shared
  template and every assignment keys to it (BP483 today), so book edits re-price it after it is
  sent; the 2026-09-03 backfill froze 188 older bids at *that day's* book, not their send day
  (BP315: sent $379,895.70, reads $385,506.07; 105 of 165 priced sent bids differ). Clone before
  the first write + re-run the backfill; a *Sent … · today …* line on sent bids; lock-after-send
  is the owner's call.
next: >
  Two calls are yours. (1) Re-run scripts/backfill-legacy-template-pricing.sql for BP483 and the
  seven robot/twin bids? (2) PR 3, lock pricing after send?
size: XS once decided
blocker: Both remaining items are owner decisions.
ver: v2.3481 · 3484 shipped
opinion: build — a sent bid that re-prices when the book changes is a quote you cannot stand behind; re-run the backfill and lock after send.
---

# Frozen bid prices — a bid only freezes once it owns a copy of the book, and nothing guarantees it owns one before it is sent

## Where it stands

**PRs 1–2 shipped 2026-09-15** — v2.3481 (the write-target kernel + `freezeSharedPricingAfterWrite` at 11 write sites) and v2.3484 (the *Sent … · the book prices it at … today* line) are on main · **what is left is two owner calls: re-run the backfill for BP483 and the seven robot/twin bids, and PR 3 (lock pricing after send)** · found 2026-09-15 · proof gathered read-only against prod the same day (see [`drift-report-2026-09-15.md`](./drift-report-2026-09-15.md)) · one live bug (PR 1), one display fix (PR 2), one owner decision (PR 3) · handed off — another session builds it

## The ask, in the owner's words

> updating prices is affecting new bids, when you update a price in the "pricing" pricebook it is retroactively pricing bids that have already been submitted. This means what is in the system as the "price" is now higher than what has been submitted.
>
> the system is designed to freeze old bids in place, is this happening elsewhere in the app but not here or is it bugged in some other way?

Seen on **BP315 Prue Event Center** (Pricing tab, Sent): the grid reads **$385,506.07**; the bid went out 2026-07-01 at **$379,895.70**.

## The reading — how the freeze works, and where it is not applied

A bid never prices from a shared price book directly. `clone_price_book_version_to_bid` (migration `20260610120000`) gives the bid a **frozen copy** of a template — a `price_book_versions` row with `bid_id = <the bid>` and `source_version_id = <the template>` — and every priced row (`bid_pricing_assignments`, `bid_count_row_custom_prices`) is keyed to that copy by `price_book_version_id`. Templates are the rows with `bid_id IS NULL` (today: Default, WENDI, Bill, Bryan, Joseph, Trace, RSmeans, `default`, three `🤖 Robot Default`).

The drawer on the Pricing tab edits the **shared template only** — `templatesMode` is hard-wired `true` at [`BidsPricingTab.tsx`](../../src/components/bids/BidsPricingTab.tsx) (search `const templatesMode = true`), and `savePricingEntry` writes `panelVersionId = editingTemplateId`. A book edit reaches a bid's copy only through the v2.2444 door (**Use $X on this bid**, `applyPendingBookOffer`). So for a bid that *owns a copy*, the freeze holds: editing the book changes nothing on it. That part is right, and it is the same mechanism everywhere (Cover Letter, Workbench, the bundle all read the copy).

The freeze fails in two places:

### Gap 1 — the live bug: a new bid prices straight on the template until someone explicitly picks a book

When a bid owns no copy, [`deriveActivePricingId`](../../src/lib/bids/pickActiveVersion.ts) falls through to a **template** id: `savedUnsplit ?? unsplitPricings[0] ?? legacyFallbackPricingId ?? legacyDataPricingId ?? defaultTemplatePricingId`. The last three are shared books. That resolved id is `selectedPricingVersionId`, and **every pricing write keys to it with no ownership check**:

| Write | Where | Keys to |
|---|---|---|
| assign a book entry to a count row | `savePricingAssignment` in `BidsPricingTab.tsx` | `selectedPricingVersionId` |
| type a custom price / clear one, or a unit-price override on an assignment | `writeUnitPriceOverrideRow` (writes `bid_count_row_custom_prices` and `unit_price_override`) | same |
| Workbench "fill every exact match" | `fillMatchingBookEntries` | same |
| copy prices from another scenario | `copyBasePriceFromVersion` / `copyPricesIntoViewedScenario` | same |

A copy is created only when the user picks a book from the toolbar dropdown (`onSelectPriceBookTemplate` → `cloneTemplateIntoBidAndActivate`), presses "Set up pricing" in `BidVersionPicker`, or takes the v2.2444 "Use $X on this bid" door. None of those is on the path from *New Bid → Counts → Pricing → assign*. The drawer's permanent caption ("This bid prices from **Default**, its own copy taken when the bid started") is therefore untrue for these bids — no copy was ever taken.

**Specimen, live today:** **BP483 Laynes Chicken Fingers 24th Street** — created 2026-09-09 (six days *after* the v2.2720 backfill), 42 pricing rows, **all 42 keyed to the shared Default template** (`92b0c353-662b-42b4-8d0e-e9352e84ad1d`), zero copies, `selected_price_book_version_id` null. If it is sent in that state, every future book edit re-prices it, and the v2.2720 backfill script would have to be run again to freeze it. Eight bids are in this state on 2026-09-15: BP483 plus seven robot/twin bids (BP481, BP477 and five with no rows yet — the robot ones are expected; the robot write fence keys on the robot-flagged parent version).

### Gap 2 — the historical damage: the 2026-09-03 backfill froze old bids at *that day's* book, not at send

Before v2.2720 (2026-09-03) **every** bid that had not explicitly picked a book priced live on a template — that was the pre-copy model, and template edits floated their revenue (v2.2720 named BP190: sent $40,560.05, priced $37,780.59). The backfill (`scripts/backfill-legacy-template-pricing.sql`, 188 bids · 202 copies · 20,802 entries) cloned each bid's template **as it stood on 2026-09-03**, so every template edit between a bid's send date and Sept 3 is baked into its "frozen" copy.

BP315 is exactly this: sent Jul 1 at $379,895.70 (`bids.bid_value`, stamped from the cover-letter amount at send — `BidsCoverLetterTab.tsx`, the `patch.bid_value = amount` line), copy taken Sep 3 (`price_book_versions.created_at 2026-09-03T20:03:27Z`), priced today $385,506.07. Reconstructing the grid from its copy (24 assignments + 32 custom prices × the count rows) gives **$385,506.07 to the cent**, so this is the mechanism, not a rendering fault. Its copy differs from today's Default template in exactly one entry (A/C drip line, copy $1,500 vs template $500) — i.e. *since* Sept 3 the freeze has held; the $5,610 drift is all pre-backfill.

**Not recoverable:** `price_book_entries` has no history (no `updated_at`, no audit table; `deleted_records` only archives deletes). The sent-time *per-line* prices cannot be rebuilt. The sent **total** is safe in `bids.bid_value` and the filed cover-letter PDF.

## The proof (prod, read-only, 2026-09-15)

Method: from the authenticated dev server (`/dev-login`), `import('/src/lib/supabase.ts')` and rebuild each sent bid's grid total the way the app does — for the bid's active pricing (the version's ★ / saved / first copy, else `selected_price_book_version_id`), Σ `count × (unit_price_override ?? entry.total_price)` over its assignments plus Σ `count × unit_price` over its custom prices — and compare with `bid_value`. Twin/shadow bids excluded. Full table in [`drift-report-2026-09-15.md`](./drift-report-2026-09-15.md).

| | Count |
|---|---|
| Sent bids (non-twin) | 280 |
| …priced in the app (≥1 priced row and a `bid_value`) | 165 |
| **Match** the sent value to the cent | **60** |
| **Differ** | **105** — 74 read *higher* than sent (+$437,951 in all), 31 *lower* |
| Of the 105, copy taken on **2026-09-03** (the backfill) | **90** |
| Of the 105, sent *after* the copy was taken (post-send edits, or a hand-typed `bid_value`) | 10 |

Reading the table: the up-drifts on well-priced bids are the book-edit float (BP242 Emergency Animal Hospital $251k → $356k; BP107 TownePlace Suites $4.080M → $4.156M; BP216 San Marcos Fire Station $603k → $662k; BP264 Cackler $37.6k → $79.3k; BP315 $379.9k → $385.5k). The large *down*-drifts on bids with only 1–13 priced rows (BP139, BP1, BP44, BP73, BP18) are bids whose `bid_value` was typed by hand or priced outside the grid — not the same defect. Treat the 105 as an upper bound; `bid_value` is the honest record either way.

Other checks that came back clean: no sent bid points `selected_price_book_version_id` at a template except BP82 / BP83 (Feb 2026, no priced rows); `bid_pricing_assignments` / `bid_count_row_custom_prices` on templates exist only for the eight no-copy bids above (the backfill left the original template-keyed rows in place — additive — so a bid that owns a copy also still carries its old template-keyed rows; the grid reads only the copy's, so those are inert).

## The decision

Owner (2026-09-15): *"we are going to let someone else make the fix, please save all of your research and proof and proposal into to-do."* The proposal below stands as drafted; PR 3 is the owner's call.

## Where it plugs in

| Exists | New |
|---|---|
| `clone_price_book_version_to_bid(p_source_version_id, p_bid_id, p_name)` — copies entries, remaps assignments on the source to the copy, carries `(bid, source)` overlays; SECURITY INVOKER; cross-bid guard (`20260610190000`) | nothing on the server for PR 1 |
| `cloneTemplateIntoBidAndActivate(sourceVersionId, name)` / `attachAndActivateNewBidPricing` in `BidsPricingTab.tsx` — clone + point `selected_price_book_version_id` at the copy + reload | a guard, **`ensureBidOwnsPricing()`**, called first by every write in the table above: if `selectedPricingVersionId` is not bid-owned (`priceBookVersions.some(v => v.id === id)` is false), clone it into the bid via the existing helper, then write against the returned copy id |
| `deriveActivePricingId` + `pickLegacyDataTemplateId` + `pickDefaultTemplatePricingId` (the template fallbacks) | keep them — they are what *shows* a template's prices before the first write; the guard is what stops a write landing on one. A pure kernel `src/lib/bids/pricingWriteTarget.ts` (`resolvePricingWriteTarget({ selectedPricingVersionId, bidPricingIds })` → `{ kind: 'own', versionId } \| { kind: 'clone-first', sourceVersionId }`) keeps the decision testable |
| `scripts/backfill-legacy-template-pricing.sql` (v2.2720) | re-run once for the eight no-copy bids (it is idempotent — skips bids that already own copies; keep the robot skip) |
| `bids.bid_value` + `bids.bid_date_sent` (stamped at send from the cover letter) | PR 2 reads them; nothing new stored |
| Pricing header — the REVENUE · PROFIT · MARGIN · MULTIPLE strip and the "One GC · one price ★ base" line in `BidsPricingTab.tsx` | PR 2's sent-vs-today line |
| `src/content/help/price-a-bid-with-the-workbench.md` → "Price from the book" | one paragraph on when the copy is taken |

## The plan

1. **Clone before the first write** (client only, the bug fix). The `resolvePricingWriteTarget` kernel + tests; `ensureBidOwnsPricing()` in `BidsPricingTab.tsx` awaited at the top of `savePricingAssignment`, `removePricingAssignment` (no-op if not owned), `writeUnitPriceOverrideRow`, `fillMatchingBookEntries`, and the two scenario copies (`bid_count_row_submission_hides` has no client write today — nothing to guard); the clone names the copy after the template (matches every existing copy) and stamps `bid_version_id = selectedBidVersionId` (null for an unsplit bid — the same stamp the toolbar clone uses). Toast once on the clone: *"Took this bid's own copy of Default — book edits won't reach it."* Then run the backfill script for BP483 (and any other non-robot bid that has grown template-keyed rows by then). Fix the drawer caption so it only claims a copy when one exists (`priceBookVersions.length > 0`); otherwise: *"This bid has no copy yet — the first price you assign takes one."* Help guide paragraph + release note + `docs/recent-features/` fragment.
2. **Tell the truth on sent bids** (client only). On a bid with `bid_date_sent`, a line under the revenue strip: *"Sent Jul 1 at $379,895.70 · the book prices it at $385,506.07 today (+$5,610.37)"* — `formatCurrency`, signed delta, muted when the two agree to the cent. Kernel `src/lib/bids/sentVsToday.ts` (+ tests) for the wording and the 1¢ tolerance. Same line on the Cover Letter tab's total, since that is where the number is read aloud. No data written.
3. **Owner decision — lock pricing after send?** Once `bid_date_sent` is set, make every write in the table above require a deliberate **Revise** (a per-bid flag or a session-scoped unlock), so post-send changes are on purpose and the sent-vs-today line explains itself. Not built until the owner says yes; the 10 "sent after the copy was taken" drifts in the report are the cases it would have caught (or would have made deliberate).

Not proposed: repairing the 90 backfilled copies to their sent-day prices — there is no history to rebuild them from. PR 2 is the honest substitute.

## How to verify

- **PR 1, the live path:** dev login (Robert) → Bids → New Bid (Plumbing) → Counts: paste two rows (`WC` 2, `LAV` 1) → Pricing. Before any assignment, `price_book_versions where bid_id = <new bid>` is empty and the grid shows Default's prices. Assign `WC` from the dropdown → expect one copy row (`name = 'Default'`, `source_version_id` = Default's id, `bid_version_id` null), `bids.selected_price_book_version_id` = the copy, and the assignment's `price_book_version_id` = the copy — **not** `92b0c353-…`. Open the drawer, change `WC` on the shared Default book, close: the grid does not move; the v2.2444 banner offers *Use $X on this bid*. Delete the test bid afterwards (it is prod).
- **PR 1, BP483:** before the backfill re-run, its 42 rows are on the template; after, `price_book_versions where bid_id = BP483.id` has one row and all 42 assignments/custom prices point at it (the script prints the coverage assertions).
- **PR 2:** BP315 reads *Sent Jul 1 at $379,895.70 · the book prices it at $385,506.07 today (+$5,610.37)*; BP397 TAKE 5 BROWNSVILLE (sent 2026-09-08, matches to the cent) reads the muted "agrees" form; an unsent bid shows nothing.
- **Read-only proof, repeatable:** the reconstruction in the drift report's header (the JS runs in the page console of the authenticated dev server; `bids_count_rows` is the count table, PostgREST pages at 1,000 rows — use `.range()`).
- Gotchas hit: `bids` has no `name` column (`project_name`); `price_book_entries` has no `updated_at`; the browser pane's dev-login did complete on 2026-09-15 (contrary to the 2026-09-08 note in memory — try it before falling back to Playwright).
