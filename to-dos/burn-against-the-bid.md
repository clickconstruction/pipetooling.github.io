---
name: "Burn against the bid: the priced footing"
number: 102
group: waiting
status: pieces 1 and 2 shipped (v2.5043 the priced margin, v2.5046 the dollar burn and earned value by stage) · left — the fourth footing, once stamps exist
summary: >
  The two pieces the Burn train (v2.3297–v2.3306) deferred, approved by the owner on 2026-10-09.
  Piece 1 keeps the margin a bid was priced at on the bid and reads it beside the job's burn.
  Piece 2 is earned value by stage and per-component burn beyond hours on Bids → Bid Costs → Bid
  vs actual. Last, a fourth budget footing: a job whose bid has no usable estimate budgets at
  price × (1 − priced margin) instead of the 35 % assumption.
next: When real bids carry priced-margin stamps, the fourth budget footing — a job whose bid has no usable estimate budgets at price × (1 − priced margin).
size: S
blocker: Stamps on real bids (the first priced bid after the v2.5043 push); stage-mode field reports for earned value by stage to light up.
ver: v2.5043 · 5046
opinion: later — both pieces are built; the footing needs real stamps to test against, and earned value by stage needs crews reporting stage progress.
---

# Burn against the bid: what the train deferred

## The ask

The Burn-against-the-bid train shipped as v2.3297–v2.3306 and closed with two pieces deferred. They are in its plan, deleted with the folder at `d59f2e831` (`git show d59f2e831^:to-dos/burn-against-the-bid/README.md`): "persist the Pricing workbench margin on the bid when priced (so an uncosted bid can hand the job price × (1 − priced margin)); earned value by stage (stage % × that stage's budget) once estimates carry stage hours." The owner's sitting of 2026-10-09 put both on the build list (`owner-decisions-pending.md`), and Punchlist cut them into three PRs.

## Piece 1 — shipped v2.5043

The Pricing workbench keeps its strip's margin on the bid (`bids.priced_*`, `stamp_bid_priced_margin`, migration `20261010010000`). It writes after the tab's own price writes land, and only for the price the customer sees from the bid's own GC. It freezes at send, so it reads the margin the bid went out at. It is stored with its revenue, cost, the revenue on rows with no cost, and whether a labor rate was set, so a reader can see why a stamp reads high. The job's Costs verdict says *The bid was priced at N% direct · this job runs M pts under the price*. Bid vs actual has a **Priced** column. Fragment: `docs/recent-features/v2.5043.md`.

**Live check still owed:** no bid carries a stamp until the migration is on prod. Once it is pushed, price one row on a ZZ TEST bid through the dev server, then read the stamp back. Touch no real bid. The write goes through the app, so the user says yes in chat first.

## Piece 2 — shipped v2.5046

On the same lens, beyond the hours burn it read before:

- **Per-component burn.** The dollar roles read **Direct**: each linked job's direct margin at completion, with the points it runs under or over the priced margin. That is the mock-up's *margin 14% · bid expected 31%*. It is built with the job's own Costs tab calls, so the two cannot disagree. The Costs tab's loader (`loadJobChargesTimelineInputs`) and its verdict build (`lib/jobs/jobBurnForVerdict.ts`) are shared. A row opens into the Costs tab's by-section table. Overhead is left out, as on the Pipeline card.
- **Earned value by stage**, in hours, for every role. The bid's `labor_hours_by_stage` × each stage's progress from `list_job_stage_progress`, the job's billing lines mapped to rough / top / trim by name. When built, all 18 linked jobs had staged lines, but no job anywhere had a stage report, and 7 linked bids carried stage hours. So every row reads *no stage progress reported* until crews report by stage. No job cost carries a stage, so spend by stage stays out of reach.

Fragment: `docs/recent-features/v2.5046.md`.

## The fourth footing — its own PR, once stamps exist

`resolveJobBurnBudget` takes ◆ bid · ✎ typed · ≈ assumed. A job whose linked bid carries a stamp but no usable estimate could budget at price × (1 − priced margin), the margin the estimator actually priced at, instead of the company's 35 % target. It moves the Costs tab, Job Summary's Burn and the Pipeline card onto a fourth glyph. A stamp that reads high (no labor rate, uncosted rows) must not become a budget. Build it when real stamps exist to test against.

## Residuals

- **No price, no priced margin** (Punchlist's call, 2026-10-09). A price write that takes an unsent bid's revenue to $0 now stamps nothing (`stamp_bid_priced_margin` answers `no_revenue`), so the bid keeps its last stamp and the strip's line still shows it. The rule is that such a write clears the eight `priced_*` columns. Build it in the next migration that touches `bids`, or on its own once the lens shows a stale stamp on a real bid. The first stale example is the test bid B464 *ZZ Takeoffs Test*, left at −9,921% by the v2.5043 live check.

## Where it plugs in

- `src/lib/bids/pricedMargin.ts` and `pricedMarginIo.ts`, `src/hooks/usePricedMarginStamp.ts`, `src/components/bids/PricedMarginLine.tsx`. The arm points are in `BidsPricingTab.tsx`.
- `src/lib/bids/bidVsActual.ts` and `src/hooks/useBidVsActual.ts`, the lens in `src/components/bids/BidsBidCostsTab.tsx`.
- `src/lib/jobs/jobCostsVerdict.ts` and `JobCostsVerdict.tsx`, read through `src/hooks/useBidPricedMargin.ts`. The footing is in `src/lib/jobs/jobBurn.ts`, `jobBudget.ts` and `jobSummaryBurn.ts`.

## How to verify

- Piece 1, after the push: as above, the ZZ TEST bid's stamp read back. The verdict on a job linked to a stamped bid shows the priced line, and Bid vs actual's **Priced** column reads it.
- Piece 2: one linked job's **Direct** on the lens equals its Costs tab verdict's direct margin at completion on the same day (Punchlist's live check, read-only).
