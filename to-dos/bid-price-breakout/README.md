---
name: "What the price is made of: material, markup, tax, equipment, labor"
number: 128
group: gated
status: proposed 2026-10-19 — the owner picked D1 (one markup number, the SOV factor set to 1.4) and D2 (hours × rate with margin left over; the residual only with no hours) the same day; D3 and D4 open; PR 1 can start
summary: >
  A bid's price is the price book's all-in number per fixture, so some estimators skip the Labor
  tab and let the fixture's price carry its material. Then the Workbench's margin lies, tax is a
  box that forgets itself on reload, and equipment is a guess from a row's name. The takeoff
  already knows the material. This to-do draws one card on the Pricing Workbench that takes the
  ★ price apart into material, the company markup on it, sales tax on it, the equipment rows and
  labor, and says plainly when labor is only what is left; a kind on each count row so equipment
  stops being a guess; and tags of the estimator's own that add up to the price.
next: PR 1, the tax rate on the bid; the owner still picks D3 (whether the lines reach the cover letter) and D4 (free tags, or kinds only) before PR 4 and 5.
size: S (PR 1 and 2) · M (PR 3) · S (PR 4) · S (PR 5, if picked)
blocker: None for PR 1–3; D3 gates PR 5 and D4 gates PR 4.
opinion: build — PR 1 to 3 in one week; the card answers the owner's ask and Wendi's in one place, and the labor book fills the hours it needs
mockup: to-dos/bid-price-breakout/mockup.html
---

# What the price is made of (#128)

## Where it stands

Proposed 2026-10-19 after a read of the Pricing, Labor and Takeoffs code and the cover letter's
schedule of values. The owner picked **D1** and **D2** the same day, as recommended: one material
markup number (the schedule-of-values factor, set to 1.4), and when hours exist Labor is hours ×
rate with Margin what is left, Wendi's residual rule only on a bid with no hours. D3 and D4 are
open. Nothing is built. The mock-up draws the recommended card in both of its
states, the two ways not taken, the kind chip, the tag card and the paper question.

## The ask, in the owner's words

> On pricing we would like to be able to better break out taxes, labor, and materials as right
> now sometimes users are skipping the labor section and building in the material cost to the
> fixture. Thankfully we have the takeoff cost so we can estimate labor, and then margin. I see
> many ways to do this, can you take a holistic look at the bids sections and help me come up
> with some tasteful proposals. Separately I think it would be nice to be able to internally tag
> line items and see how they add up to the total on pricing.

And Wendi's, the estimator's request the owner forwarded:

> I would like a tax breakout for every bid generated from takeoffs. I would also like a labor
> breakout by subtracting the takeoff price (plus 40% mark up) and tax — we will call this
> number labor. I would like to be able to flag equipment as a separate category so that it has
> a separate line item. Ideally this will result in a breakout for material, tax, equipment, and
> labor.

## What exists today

**A row's price is one number.** Revenue on the Workbench is the assigned price book entry's
`total_price` × count (or a typed override, or a fixed price) —
`src/lib/bidPricingRowCalculations.ts`. A price book entry splits by stage (rough, top, trim),
never by material and labor. So an estimator who prices from a book that already carries the
fixture's material has no reason to open Labor, and nothing on Pricing shows what part of the
$1,150 water closet is pipe and what part is hands.

**A row's cost is material plus labor.** `lineCostForRow` adds the row's takeoff material
(the part lines under the fixture at the catalog's lowest price, copied when the part was
picked, `bidMaterials.ts`'s `combinedMaterials`) and its labor (the row's hours on the Labor tab
× `cost_estimates.labor_rate`). With no hours the labor is $0; with no rate it is $0 too. The
Labor tab's hours seed themselves from the labor book the first time Labor or Takeoffs opens
(`useBidPricingEngine.ts`, `syncCostEstimateLaborRows`), but the rate does not, and the crew
rate card's number (`crewRate.ts`: the 90-day field wage × the burden factor) is shown, not
used, until someone types it.

**Tax is a box that forgets.** The tax rate is React state, `useState('8.25')` in `Bids.tsx`,
edited on the Takeoffs materials summary, never saved. It multiplies a row's takeoff material
(`materialsWithTax`), shows as *Tax (8.25%)* in the row's breakdown window
(`PricingMarginBreakdownModal.tsx`), and is left out of the bid's cost total
(`computeBidCostBreakdown`), so the Workbench's overhead line quietly absorbs it (the map's
"tax fallback duality"). No document prints a tax line; *Sales tax* is a tick in the GC
exclusions list.

**Equipment is a cost, never a line.** The Labor tab's direct costs have five kinds
(`costEstimateDirectCosts.ts`: Equipment & Tool Rental, Permits, Subcontractor, Waste, Other),
each a table of stage amounts. They sit in the cost total and on the internal Labor print as one
*Other direct* line; the GC never sees them. A count row that *is* equipment (a rental, a lift)
prices like a fixture, and the composition bar (`pricingComposition.ts`) guesses it into *other*
from its words.

**The paper already splits labor and material.** The cover letter's schedule of values
(v2.4075, `sovLaborMaterial.ts`) divides each stage's value between labor (the Labor tab's hours
× the rate + subcontractors) and material (the takeoff × the factor), and a stage with no cost
takes the company labor share (45). The factor is `app_settings`
`bid_sov_material_factor_v1`, 1.5, with a per-bid override `bids.sov_material_factor`
(v2.3671, *Materials by stage*). That factor is Wendi's old ×1.5; her note now says 40%.

**Tags.** `bids_count_rows` has `group_tag`, which the Counts sheet groups by and the alternate
toggle reads (`bids.alternate_group_tags`). `fixture_types.category` is free text nothing
reads. There is no free tag on a row.

## Two readings of "estimate labor"

The owner's sentence and Wendi's rule read two ways, and the card has to hold both:

- **Price-down (Wendi).** The price is known. Material is the takeoff; the markup is 40% of it;
  tax is the rate on it; equipment is its own rows; *labor is what is left*. Needs no hours.
  Always adds to the price. Margin is inside labor.
- **Cost-up (the Workbench's claim).** Material, tax and equipment as above; labor is hours × the
  rate; *margin is what is left*. Needs hours, which the labor book has for most fixtures. Shows
  the margin the strip promises.

They are the same five lines; the hours decide what the last line is called. That is the
recommendation's spine.

## The proposals

Each is drawn in the mock-up.

### 1 · One card on the Workbench: *What the price is made of* — recommended

Under the sticky Revenue · Cost · Profit · Margin strip, for the ★ price (every price option has
its own). Six lines, each with its rule and the screen that sets it:

| Line | Rule | Set on |
|---|---|---|
| Material | the takeoff's part lines at the catalog's price (what the cost rail calls *What Pricing sees*) | Takeoffs |
| Material markup | the company number on material (D1: the schedule-of-values factor becomes *the* material markup, 1.4 for 40%) with a per-bid override under the line | Settings, the bid |
| Sales tax on material | the rate saved on the bid, the company default 8.25 | Takeoffs' Tax box, now saved |
| Equipment | the rows tagged Equipment, at their price (proposal 3) | Counts |
| Labor | with hours: the Labor tab's hours × the rate, the crew rate standing in when none is typed and the line saying so · without hours: **Labor and margin**, what is left, on an amber line | Labor |
| Margin | what is left of the price, only when labor has hours | — |

A stacked bar over the table; a hover on a line lists the rows behind it; the Labor line with no
hours carries *The labor book knows 41 of these 46 fixtures* and an **Open Labor** door, since
one visit fills the hours from the book. The lines always add to the price. Driving, travel,
permits and subs stay in the strip's cost: the card is about the price, not every cost, and says
so under the table.

The strip's profit and the card's margin differ on purpose: the strip's profit is price − every
cost; the card's margin is what is left after the markup line is counted as the material's own
earning. The card's note says *Markup and margin together are the strip's profit, less driving,
travel, permits and subs.*

### 2 · Not taken

- **Split the price book into material and labor prices** per stage: six boxes per fixture on
  every template and every frozen copy, typed by hand with no truth behind them. The takeoff
  already holds the material; typing it twice is the thing to stop.
- **A gate: Labor before Pricing.** A wall where a nudge does. Pricing from a per-fixture book is
  a real way to price, and the card shows what it hides without stopping anyone.
- **A per-bid "labor %" setting** that splits the price by a fixed share. The schedule of values
  already falls back to one (45) for a stage with no cost; a guessed split is what the owner is
  trying to get away from.

### 3 · A kind on the row, not a guess from its name

`bids_count_rows.kind`: **fixture · pipe · fitting · equipment · allowance**, null = the app's
guess (`compositionKind`, as today). One chip on the Counts sheet row and in the Workbench row,
dashed while it is the guess; a press opens the five. The composition bar, the card's Equipment
line and the schedule of values read the saved kind first. Most rows keep the guess, so nobody
tags 46 rows. Equipment rows leave Material alone (their part lines, if any, are not material).

### 4 · Tags of the estimator's own, and a card that adds them up

`bids_count_rows.tags text[]`: lowercase words, 40 letters at most, typed on a row in the
Workbench or on Counts, the bid's own tags offered first and the office's recent ones after.
Never on paper. A **By tag** card under the composition bar lists each tag with its price, cost,
margin, row count and share, then *No tag*, then the price. A row with two tags counts in both
and the card says so under the total rather than pretending the lines add. A press on a tag
lights its rows in the table. Copying a bid version copies the rows' tags and kinds.

Kinds and tags are two things on purpose: the kind is the app's (the card needs Equipment to be
a fact), the tags are the estimator's (the app never reads their words).

### 5 · On paper — the owner's call (D3)

The cover letter's schedule of values could take the card's lines as *Material, with markup ·
Sales tax on material · Equipment · Labor* beside or instead of the per-stage labor/material
split. Margin never prints; on paper it sits inside labor, as Wendi's rule has it. Nothing in
PR 1–4 reaches the GC.

## Decisions for the owner

- **D1 · One material markup number or two? — picked: one** (2026-10-19). Today's schedule-of-values factor (1.5, per-bid
  override) is already "what we charge for material over cost". The proposal makes it the one
  material markup, shown as 40% / 50%, and sets it to 1.4. The other way is a second setting for
  the card alone, which would let the paper and the screen disagree.
- **D2 · When hours exist, is the Labor line hours × rate, or still what is left? — picked: hours × rate** (2026-10-19). The
  recommendation is hours × rate with a Margin line below; Wendi's rule then shows only on a bid
  with no hours. The other way is Wendi's rule always, with the book's labor as a note under it.
- **D3 · Do the lines reach the cover letter?** Proposal 5, or stay internal.
- **D4 · Free tags, or kinds only?** Proposal 4 is the owner's "internally tag line items";
  proposal 3 alone covers Wendi's equipment ask.

## Where it plugs in

- **Revenue and cost per row**: `src/lib/bidPricingRowCalculations.ts` (`lineCostForRow`,
  `computeBidPricingRows`); the Workbench's one derive `derivePricingWorkbench` and
  `scenarioPricingRows.ts` (one price option's overrides onto the rows); the engine's
  `pricingMaterialTotalRoughIn` / `pricingFixtureMaterialsFromTakeoff`
  (`useBidPricingEngine.ts`).
- **The bid's cost total**: `src/lib/bids/bidTotalCostBreakdown.ts` (`computeBidCostBreakdown`,
  pre-tax today).
- **Tax**: `Bids.tsx`'s `costEstimatePOModalTaxPercent` and
  `BidsTakeoffMaterialsSummarySection.tsx`'s box; `decoratePricingRows.ts`'s `taxAmount`;
  `PricingMarginBreakdownModal.tsx`.
- **Direct costs**: `src/lib/bids/costEstimateDirectCosts.ts`, the five `cost_estimate_*_rows`
  tables and the `cost_estimate_direct_costs` view.
- **Composition**: `src/lib/bids/pricingComposition.ts` (`compositionKind` over
  `parseRowSignature`), `PricingCompositionBar.tsx`.
- **The factor and the paper**: `src/lib/bids/materialsByStage.ts` (`parseSovMaterialFactor`,
  `DEFAULT_SOV_MATERIAL_FACTOR`), `src/lib/appSettingsKeys.ts`
  (`bid_sov_material_factor_v1`, `bid_sov_labor_share_pct_v1`), `src/lib/bidDocuments/
  sovLaborMaterial.ts` and `scheduleOfValues.ts`, `bids.sov_material_factor`.
- **Rows**: `bids_count_rows` (`group_tag`, per bid version), the Counts sheet
  (`BidsCountsTab.tsx`, the group cell and alternate toggle), `alternateScope.ts`.
- **The crew rate**: `src/lib/bids/crewRate.ts`, `labor_burden_factor_v1`.
- **New**: a pure kernel `src/lib/bids/priceBreakdown.ts` (the six lines from the rows, the
  takeoff, the rate, the markup and the kinds; the two states), `byTag.ts`, a
  `PriceBreakdownCard.tsx`, a `ByTagCard.tsx`, a kind chip and a tag editor; two migrations.

## The plan

1. **PR 1 — the tax rate lives on the bid.** Migration: `bids.tax_rate_pct numeric` (null = the
   company default) and `app_settings` `bid_tax_rate_pct_v1` seeded 8.25, dev writes. The
   Takeoffs box reads and writes the bid's; `computeBidCostBreakdown` takes the rate and the
   bid's cost total includes tax, so overhead stops absorbing it; the breakdown window reads the
   saved rate. Kernel test for the total; a render test for the box. Migration doc. **XS–S.**
2. **PR 2 — the kind on a count row.** Migration: `bids_count_rows.kind text` with a check on
   the five words; `clone_count_rows_to_bid_version` carries it when a version is copied. `compositionKind`
   reads it first; the chip on Counts and in the Workbench row; `pricingComposition` gains an
   equipment bucket. **S.**
3. **PR 3 — the card.** `priceBreakdown.ts` and `PriceBreakdownCard.tsx` under the strip, for
   the ★ price option; D1's one markup (the setting's words change from *schedule of values
   factor* to *material markup*; the per-bid override moves under the card's line); the crew
   rate standing in for an untyped rate, said on the line; the no-hours state with the book's
   count and the Open Labor door; the row's breakdown window takes the same lines. Kernel tests
   for both states and the add-up; a render test per state. Glossary and `BIDS_SYSTEM.md`'s
   Pricing section. **M.**
4. **PR 4 — tags and the By tag card.** Migration: `bids_count_rows.tags text[]`; the editor on
   a row; `byTag.ts`; the card; copying a version copies them. **S.**
5. **PR 5 — the lines on paper**, only on D3: the schedule of values' split takes the four lines
   as a shape beside the per-stage one. **S.**

Help guide: *see what a bid's price is made of* ships with PR 3 (plain words; the Bids &
Estimating category), and *edit the quick replies* is not touched.

## How to verify

- A bid with a takeoff, a ★ price and no Labor visit: the card's last line is amber *Labor and
  margin*, the lines add to the strip's revenue to the cent, the note names the book's coverage.
  Open Labor once; back on Pricing the line splits into Labor and Margin and the sum still holds.
- Set the tax box to 0 and to 10: the tax line and the strip's cost follow; reload; the rate is
  still there (today it is not).
- Tag a rental row Equipment: the Material line drops by its part lines, the Equipment line takes
  its price, the composition bar's *other* shrinks.
- Two tags on one row: the By tag card's note says the lines add to more than the price.
- A sent bid: every write (the kind, a tag, the rate) refuses behind the pricing lock until
  Revise, like the other pricing writes.
- Dummy accounts and a test bid: the ZZ TEST GC's bids; never a live GC's bid for the screenshots.
