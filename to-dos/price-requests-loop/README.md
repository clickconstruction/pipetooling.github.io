---
name: Price requests, asked to priced
group: ready
status: >
  not started · proposed 2026-09-15 · owner: "save it so someone else can do the work" · four
  client-only PRs, no migration
summary: >
  **Price requests, asked to priced**: the Edit Bid table is already the robot's intake tray
  (`buildPriceMatrixSources` reads its links) — so **+ Ask houses** pre-picks the estimator's
  usual houses, each chip *app emails* or *I'll send it*; a Status column (waiting / late / quote
  in) with Nudge or Call; drop the quote PDF on the row; **Price with robot · N quotes in** on the
  header. Two mock-ups (the loop; the rejected plus-only options). Three owner questions open.
next: >
  PR 1 the pre-picked + Ask houses (hand-sent rows only); PR 2 app-sends per chip; PR 3 status +
  drop-zone + Call; PR 4 the header button + Needs You card. Three wording/rule questions are the
  owner's.
size: L (4 PRs, each alone)
blocker: None for PR 2; the owner said save it, so ask before starting the next one.
ver: proposed 09-15 · PR 1 v2.3495
---

# Price requests, asked to priced — the plus that asks the houses, and the row that carries each one to the robot

## The ask, in the owner's words

From the Edit Bid window, 2026-09-15: "We want to add a plus button to 'Price requests' that allow us to add price requests from multiple supply houses, if that makes sense, help me come up with a plan to add it and show me mockups." Then, on the first mock-up (a plus that opens a house checklist): "is this the best we can do?" — the answer below is the second mock-up. Nothing is approved yet beyond saving it.

Same session, shipped first: v2.3477 (PR #3223) relabeled the table's link column **Quote link** with the hint "the link to the quote received from the supply house" — the owner had asked "is this where a quote goes?". The findings below are why that relabel was right in spirit.

## Findings (what the code already does)

- **The table is the robot's intake tray.** `buildPriceMatrixSources` in [`src/lib/rfq/priceMatrixRequest.ts`](../../src/lib/rfq/priceMatrixRequest.ts) reads *this table's* rows for **Price with robot**: a row's `quote_url` wins, else its `request_url`; closed / draft rows drop out. So a link on the row is what gets priced — the table is not just a log of who was asked.
- **Multi-house sending already exists, on the desk.** `RfqComposeModal` (Pricing → Supply house list → "Send by email…") picks several houses with checkboxes, prefills the rep from the newest request ever sent to that house, remembers a typed address, warns on a house that already has an open request on this bid, and sends one email + link + `bid_rfqs` row per house through `send-rfq-email`. It needs `scope` (`{lines, text}`) handed in from the Supply house list — "one scoping surface".
- **Hand-sent requests are one house per pass.** `BidPriceRequestsTable` → **+ Add a request** opens one editor row (house · date · link) and inserts one `bid_rfqs` row (`sent_via = 'outside'`, `status = 'sent'` or `'quoted'` if a link is pasted). Three houses = three passes.
- **Chasing is uneven.** `RfqNudge` (shared with the desk via `useRfqNudge`) shows **Nudge** on app-sent rows only; hand-sent rows have no action while waiting.
- **The quote's landing is a separate chore.** Edit the row, paste the link. Submittals (v2.3466) already stores a dropped vendor PDF on a revision — the same storage pattern fits a row here.
- **Price with robot lives on Pricing** (`PriceWithRobotModal`), away from the table whose links it reads. `v2.3195` had trimmed this table to house · date · link after a price was typed into the old quote box; the relabel (v2.3477) kept the single link box.

## The decision (proposed, not yet approved)

Treat the table as one strip that carries each house through the loop. The plus **asks** the houses; it does not merely record them.

1. **Ask** — **+ Ask houses** in the table: the estimator's usual houses for this trade pre-picked (a kernel over their last 10 bids in the bid's trade, ranked by how often each house was asked); each chip carries a *how*: **app emails Dan** (send through `send-rfq-email`, scope = the bid's count rows — the same snapshot the price matrix takes) or **I'll send it** (an `outside` row, no email). Tap the *how* to flip. A house with no rep on file defaults to *I'll send it* (or type an address; remembered, as the compose modal does). One needed-by for the set. **Ask 3 houses** sends what needs sending and inserts every row in one call. "+ another house" is the existing picker with "+ Add … as a new supply house".
2. **Wait** — a Status column: *waiting* / *late 1d* / *quote in*. **Nudge** stays on app-sent rows; hand-sent rows get **Call** (`tel:` the default rep, via `CallPhoneButton`). A Needs You card for "needed-by passed, nothing in" on live bids.
3. **Quote lands** — a drop-zone on every waiting row: drop the vendor's PDF (upload to the bid's price-requests storage path, set `quote_url`, status `quoted`) or paste a link (today's box). The summary line counts it ("4 houses · 2 quotes in · 1 late").
4. **Price** — **Price with robot · N quotes in** on the table header once ≥1 quote is in; opens the existing modal.

Rejected on the way:
- **A plus that opens a house checklist and inserts N `outside` rows** ([`mockup-plus-only.html`](./mockup-plus-only.html), option 1) — gets the rows in faster, then leaves the estimator doing four things in four places. It survives as PR 1's skeleton (the pre-picked set is the improvement).
- **A plus that stacks editor rows** (same file, option 2) — a house picker, date and link per row; quote links are almost never in hand when requests go out.

Open questions for the owner:
- A house that already has an open request on this bid — unchecked with *already asked Sep 2* (as drawn), or hidden?
- Should the desk's compose (scoped from the Supply house list) stay as a second door, or should Pricing's "Send by email…" route here once PR 2 lands?
- The "usual houses" rule: last 10 bids in the trade, or the estimator's own remembered set (a per-user list they edit)?

## The mock-up

[`mockup.html`](./mockup.html) — the loop (today vs proposed per step), the strip with all four states on real-looking rows, the **+ Ask houses** chip row, and the plan. Also published as the artifact *Price Requests Loop*. [`mockup-plus-only.html`](./mockup-plus-only.html) — the first, narrower proposal (artifact *Price Requests Plus Button*), kept for the rejected options.

## Where it plugs in

| Exists | New |
|---|---|
| [`BidPriceRequestsTable.tsx`](../../src/components/bids/BidPriceRequestsTable.tsx) — the table, `startAdd` / `save` (single `outside` insert), house picker with "+ Add … as a new supply house", `pricingHref` | the **+ Ask houses** panel (`BidPriceRequestsAskPanel`), the Status column, the row drop-zone, the header **Price with robot** button |
| [`bidPriceRequests.ts`](../../src/lib/bids/bidPriceRequests.ts) — `shapePriceRequests`, `neededByState` (already knows late vs ✓ per row), `validateOutsideRequest`, `priceRequestSummaryLine`, `linkDisplayText` | `usualHousesForBid` (ranking kernel), `planAskHouses` (chips → emails to send + rows to insert + already-asked list), a `late` state in the summary line |
| [`RfqComposeModal.tsx`](../../src/components/bids/RfqComposeModal.tsx) — house list (`fetchSupplyHousePickerRows` + `housesForBidTrade`, quote-able only, "show all trades"), rep prefill, remember-a-typed-address, the `send-rfq-email` call | reuse the send path per chip; do not re-scope here — scope from the bid's count rows (`PriceMatrixScopeLine` shape) |
| [`priceMatrixRequest.ts`](../../src/lib/rfq/priceMatrixRequest.ts) — `buildPriceMatrixSources` reads `quote_url` else `request_url` | nothing — the drop-zone writes `quote_url`, which it already prefers |
| [`RfqNudge.tsx`](../../src/components/bids/RfqNudge.tsx) + `useRfqNudge` — Nudge on app-sent rows | **Call** on hand-sent rows (`CallPhoneButton`, the rep's phone from the Directory) |
| [`PriceWithRobotModal.tsx`](../../src/components/bids/PriceWithRobotModal.tsx) — the robot door on Pricing | a second opener from the table header (same modal, same props) |
| Submittals' dropped-PDF storage (v2.3466) — bucket path + signed-link open | the same pattern under a `bids/<id>/price-requests/` path; `bid_rfqs.quote_url` holds the signed or storage link |
| `bid_rfqs` (`sent_via`, `status`, `requested_on`, `request_url`, `quote_url`, `needed_by`) | **no migration** |
| Needs You cards (`src/lib/dashboardNeedsYou.ts`) | one card: live bids with a needed-by passed and no quote |

## The plan

1. **PR 1 · several houses in one pass — BUILT as v2.3495** (`to-dos/price-requests-loop/pr1-build-plan.md`). The owner's two calls on 2026-09-16: **one date per supply house** and **a quote link for every house**, so each picked house became a card of its own rather than a chip on a shared date. The pre-picked "usual houses" set moved to PR 2. Originally written as: **+ Ask houses, hand-sent only.** `usualHousesForBid` + `planAskHouses` kernels with tests; the chip row in the table (pre-picked set, remove / add, one needed-by); one insert of N `outside` rows; toast "Asked 3 houses". Help guide *get supply house prices on a bid* → "Requests you sent yourself" gets the plus. This alone is the plus the owner asked for, with the pick made for you.
2. **PR 2 · the chip's how — app emails it.** Scope built from the bid's count rows; per-house `send-rfq-email` exactly as the compose modal calls it; remembered addresses; already-asked warning. The desk's compose stays.
3. **PR 3 · the row carries the quote.** Status column (waiting / late / quote in) from `needed_by` + `status`; drop-zone on waiting rows (upload → `quote_url`, status `quoted`); paste still works; **Call** on hand-sent rows.
4. **PR 4 · Price with robot on the strip + the Needs You card.** Header button at ≥1 quote in; the card for needed-by passed with nothing in.

Each PR: release note + `docs/recent-features/` fragment; the guide paragraph; a live pass on BP398.

## How to verify

- Dev login (Robert) → Bids → Bid Board → search `ZZ Test` (BP398, the safe prod test bid) → gear on the won row → Edit Bid → scroll to **Price requests** (under the plans links). Today it shows Click Plumbing Supply (sent by app, Sep 2) and National Wholesale (sent outside, Sep 10).
- PR 1: **+ Ask houses** pre-picks the Plumbing houses Robert asked most on his last 10 plumbing bids; remove one, add Apple Lumber, Ask → N new rows read *sent outside · today · no link yet*; the summary line counts them; **Cancel** leaves nothing behind. Do not press Ask on any bid but BP398 — it is prod.
- PR 2: flip Ferguson's chip to *app emails Dan*; the preview names Dan's address; do **not** send from a real bid — BP398's houses have test reps, check the Directory first.
- PR 3: drop a PDF on the National Wholesale row → the link opens by signed URL; the status reads *quote in*; **Price with robot** (Pricing) lists it as a source.
- PR 4: with two quotes in, the header button appears and opens the same modal Pricing does.
- Gotchas hit already: the Bid Board's `ZZ Test` row is below the map — **Hide map** first, then the gear at the row's left; the editor row's Cancel is the safe exit (nothing writes until Save).
