---
name: "Pricing strip: the Revenue number carries its cents"
number: 133
group: close
status: BUILT 2026-10-20 — the go came the same day, defaults taken; v2.5678 swaps the strip, the alternates line and the tooltips as drawn
summary: >
  On the Pricing tab the scoreboard strip rounds Revenue and Profit to whole dollars while
  every other money on the page — the price cards, the per-row table, the "Sent at … today"
  line, even the strip's own tooltips — carries cents. Wendi, revising sent bids, reads the
  strip's big number against the card and the GC's letter and they disagree; when the book
  total ends in .50 or more the strip rounds UP to a dollar that exists nowhere. The fix is
  the house pattern the cards already use: AmountSmallCents (v2.2246) — full-size dollars,
  cents at 70% — on Revenue, Profit and the alternates line, keeping the glance the owner's
  whole-dollars rule was protecting while making the number exact.
next: Wendi opens a priced bid and reads the strip against the card and the letter; then delete the folder.
size: XS
blocker: none
opinion: done as drawn — her word closes it
mockup: to-dos/pricing-strip-cents/mockup.html
ver: v2.2208 · v2.2246 · v2.4194 · v2.5678
---

# Pricing strip: the Revenue number carries its cents (#133)

## The ask, in Wendi's words

2026-10-20: "i want the revenue number to include cents as well on the pricing page in click
tooling."

## Three lenses

**Wendi's seat.** She is revising a sent bid. The price card reads **$49,420.35**, the audit
line reads *Sent Jun 17 at $110,746.77 · the book prices it at $49,420.35 today*, and the
strip — the biggest, boldest revenue on the page, the one that moves as she solves and
brushes — reads **$49,420**. When she reads the number off for a GC's portal, a phone call or
a check against the letter, the headline number is the one her eye lands on, and it is the
one number on the page that is wrong by design. She hovers for a tooltip or looks up at the
card's smaller type to get the real figure.

**The job behind the ask.** A revising estimator is doing an exactness job: does today's book
still land exactly where the letter says? The letter prices to the cent; the sent-vs-today
line diffs to the cent (−$61,326.42). Rounding the headline makes "do these match?" a
mental-math question — and `Math.round` rounds half up, so a book total of **$83,117.65**
shows **$83,118** on the strip: the strip and the card disagree in the *dollars* column, and
the strip names a figure no letter, row or card anywhere carries. The cents are not
decoration on this page; they are the checksum.

**The whole office.** The office already settled this exact tension. `AmountSmallCents`
(v2.2246, Sub Labor tab) exists because magnitude-at-a-glance and exactness are both wanted:
full-size dollars, cents at 70%, and selecting still copies the full figure. The pricing
tab's own cards use it, as do payroll, pay stubs and Job Summary. The strip and its
alternates line are the last money on this page outside the pattern.

## What exists today

- **The strip** ([BidsPricingTab.tsx:3070](../../src/components/bids/BidsPricingTab.tsx)):
  `stat('Revenue', `$${Math.round(effRevenue).toLocaleString('en-US')}`, …)` and the same for
  Profit, under the comment *"Whole dollars only — the strip is a scoreboard, cents live in
  the rows (owner, v2.2205)."* The rule landed in v2.2208 ("Workbench batch 2", a
  live-iteration batch with the owner); the exact figure was moved into the tooltip in the
  same diff — the tooltip's leading `$49,420.35 · ` exists only because the strip dropped it.
- **The alternates second line** (v2.4194): `whole()` rounds Base, each *+ alternate* and
  *With every alternate* the same way, with the exact figure in each tooltip.
- **Everything else on the page carries cents**: the price cards (`AmountSmallCents`), the
  per-row SALE/REVENUE/PROFIT columns (`formatCurrency`), the sent-vs-today line, the
  Traditional-breakdown card, the strip's own tooltips.
- **Margin solves round row *prices* to whole dollars** (the brush and solver, stated in two
  help guides). That rule is about writing prices and stands untouched; revenue still gains
  cents from book-assigned entries and markup-derived unit prices, which is why the card in
  Wendi's screenshot ends in .35.
- **No render test covers the strip** (the tab has none; `AmountSmallCents` has its own).
- **The help guides do not state the strip's rounding** — checked `price-a-bid-with-the-
  workbench.md` and `price-a-bid-by-margin.md`; their "whole dollars" sentences are about
  solved row prices. No guide edit is needed.

## The proposal

One rule: **every money figure on the scoreboard strip shows exactly what the cards and rows
show, cents small.** Swap the strings for the existing components:

- **Revenue** → `<AmountSmallCents value={effRevenue} />`.
- **Profit** → `<SignedAmountSmallCents value={effProfit} />` (true minus for a loss, as Job
  Summary does; today's hand-rolled `-$…` becomes the house glyph).
- **The alternates line** — Base, each *+ alternate*, *With every alternate* — the same, so
  the second line never disagrees with the first.
- **Margin and Multiple untouched** (percent and ratio; no cents to carry).
- **Tooltips trimmed back** to what they said before v2.2208: `our cost $X …` — the leading
  duplicate of the now-exact headline goes. The our-cost figure, the crew-rate note and the
  alternates' margins stay.
- `stat`'s value parameter widens from `string` to `React.ReactNode`. No kernel, no
  migration, no guide edit; `AmountSmallCents` is already tested.

What this is **not**: no change to row prices, the solver's whole-dollar solves, the brush,
the cards, or any other scoreboard in the app (Jobs, AR and the weekly totals have their own
conventions and their own owners' reasons).

## Decisions that are yours

1. **The owner's rule.** This amends his v2.2208 whole-dollars call. *Recommended default:
   ship the small-cents middle path — it keeps the glanceable scoreboard that rule was
   protecting (the cents render at 70%, the dollars don't move) and it is the pattern his own
   price cards already use. If you'd rather, show him the mock-up's state 2 first.*
2. **Scope.** Revenue alone (her literal ask) or Revenue + Profit + the alternates line?
   *Recommended default: all three. A strip where Revenue carries cents and Profit doesn't
   fails the Revenue − Profit = our-cost eyeball check, which is the very job the cents do.*
3. **Tooltips.** Keep the duplicate exact figure or trim to `our cost $X`? *Recommended
   default: trim — it was only ever the cents' hiding place.*

## How to verify

Open any priced bid's Pricing tab: the strip's Revenue equals the viewed card's number to the
cent, Profit + our cost equals Revenue to the cent, and on a bid whose book total ends ≥ .50
the strip no longer reads a dollar above the card. On a bid with an alternate, the second
line's three figures sum: Base + each alternate = With every alternate, to the cent. Hover
Revenue: the tooltip opens with "our cost $…". `npm test` (AmountSmallCents render test) and
the usual typecheck.
