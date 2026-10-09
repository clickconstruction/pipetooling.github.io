---
name: "Burn against the bid: earned value by stage, then the priced footing"
number: 102
group: ready
status: piece 1 shipped v2.5043 (the priced margin kept on the bid, read beside the job's burn) · left — piece 2, then the fourth footing
summary: >
  The two pieces the Burn train (v2.3297–v2.3306) deferred, approved by the owner on 2026-10-09.
  Piece 1 keeps the margin a bid was priced at on the bid and reads it beside the job's burn.
  Piece 2 is earned value by stage and per-component burn beyond hours on Bids → Bid Costs → Bid
  vs actual. Last, a fourth budget footing: a job whose bid has no usable estimate budgets at
  price × (1 − priced margin) instead of the 35 % assumption.
next: Piece 2 on the Bid vs actual lens — each linked job's dollar burn by component (labor $, materials, subs) with its at-completion margin against the priced one, and earned value by stage (stage % × that stage's budget).
size: M + S
blocker: None for piece 2; the footing waits until stamps exist on real bids.
ver: v2.5043
opinion: build — the owner said yes on 2026-10-09; piece 2 is next, and the footing is its own PR once stamps exist.
---

# Burn against the bid: what the train deferred

## The ask

The Burn-against-the-bid train shipped as v2.3297–v2.3306 and closed with two pieces deferred. They are in its plan, deleted with the folder at `d59f2e831` (`git show d59f2e831^:to-dos/burn-against-the-bid/README.md`): "persist the Pricing workbench margin on the bid when priced (so an uncosted bid can hand the job price × (1 − priced margin)); earned value by stage (stage % × that stage's budget) once estimates carry stage hours." The owner's sitting of 2026-10-09 put both on the build list (`owner-decisions-pending.md`), and Punchlist cut them into three PRs.

## Piece 1 — shipped v2.5043

The Pricing workbench keeps its strip's margin on the bid (`bids.priced_*`, `stamp_bid_priced_margin`, migration `20261010010000`). It writes after the tab's own price writes land, and only for the price the customer sees from the bid's own GC. It freezes at send, so it reads the margin the bid went out at. It is stored with its revenue, cost, the revenue on rows with no cost, and whether a labor rate was set, so a reader can see why a stamp reads high. The job's Costs verdict says *The bid was priced at N% direct · this job runs M pts under the price*. Bid vs actual has a **Priced** column. Fragment: `docs/recent-features/v2.5043.md`.

**Live check still owed:** no bid carries a stamp until the migration is on prod. Once it is pushed, price one row on a ZZ TEST bid through the dev server, then read the stamp back. Touch no real bid. The write goes through the app, so the user says yes in chat first.

## Piece 2 — next

On the same lens, beyond the hours burn it reads today:

- **Per-component burn.** Each linked job's labor $, materials and subs against the bid's figures, with its direct margin at completion (spent ÷ % done) beside the priced margin. That is the mock-up's *margin 14% · bid expected 31%*. It needs a per-job spend loader on the Bids page with Job Summary's composition: team labor, sub sheets, and parts from tally, supply-house invoices, billed materials and card charges. Keep one kernel so Job Summary and the lens cannot disagree.
- **Earned value by stage.** Stage % × that stage's budget. `bid_estimate_breakdown` already returns `labor_hours_by_stage`, which `job_budgets` does not store. Stage progress comes from `jobs_ledger_fixtures.progress_pct` through `list_job_stage_progress`. No job cost carries a stage today, so spend by stage is out of reach. Earned value by stage is not.

## The fourth footing — its own PR, once stamps exist

`resolveJobBurnBudget` takes ◆ bid · ✎ typed · ≈ assumed. A job whose linked bid carries a stamp but no usable estimate could budget at price × (1 − priced margin), the margin the estimator actually priced at, instead of the company's 35 % target. It moves the Costs tab, Job Summary's Burn and the Pipeline card onto a fourth glyph. A stamp that reads high (no labor rate, uncosted rows) must not become a budget. Build it when real stamps exist to test against.

## Where it plugs in

- `src/lib/bids/pricedMargin.ts` and `pricedMarginIo.ts`, `src/hooks/usePricedMarginStamp.ts`, `src/components/bids/PricedMarginLine.tsx`. The arm points are in `BidsPricingTab.tsx`.
- `src/lib/bids/bidVsActual.ts` and `src/hooks/useBidVsActual.ts`, the lens in `src/components/bids/BidsBidCostsTab.tsx`.
- `src/lib/jobs/jobCostsVerdict.ts` and `JobCostsVerdict.tsx`, read through `src/hooks/useBidPricedMargin.ts`. The footing is in `src/lib/jobs/jobBurn.ts`, `jobBudget.ts` and `jobSummaryBurn.ts`.

## How to verify

- Piece 1, after the push: as above, the ZZ TEST bid's stamp read back. The verdict on a job linked to a stamped bid shows the priced line, and Bid vs actual's **Priced** column reads it.
- Piece 2: one linked job's lens row against its own Costs tab on the same day, with the same spent, the same % done and the same margin at completion.
