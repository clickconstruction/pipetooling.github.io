# Burn against the bid — a job budget with provenance

Status: **in progress** · PR 1 shipped as v2.3297 (`claude/burn-pr1-job-budgets`: `job_budgets`, the five RPCs, `jobBudget.ts`) · PR 2 shipped as v2.3299 (`claude/burn-pr2-budget-card`: the Costs-tab Budget card, link banner, typed form; Burn reads the footing) · designed 2026-09-11 (mock-up reviewed with the owner: "I think this is pretty good") · **held behind the Bids → Labor refresh** ([`to-dos/bids-labor-refresh/`](../bids-labor-refresh/README.md); its PR 1 shipped as v2.3276 — resume this after its PR 2 lands the estimate's `source` / completeness columns) — the owner wants the two built together, because a budget is only as honest as the estimate that feeds it, and today's Labor tab is where that estimate is (not) made.

Mock-ups, kept here: [`mockup.html`](./mockup.html) (the design study, v2 after the "is this the best we can do?" pass; published as the artifact *Burn Against the Bid*) and [`mockup-burn-budget-stages-2026-09-09.html`](./mockup-burn-budget-stages-2026-09-09.html) (the earlier *Burn, Budget and Stages* study that produced v2.3189 / v2.3191 / v2.3192 — its "budget = bid estimate else price × (1 − target)" rule is the one this to-do finishes).

## The ask, in the owner's words

> "Help me build the rest of Burn against the actual bid, come up with a plan and test along the way … Help me deeply think about the best way to do this and build a mock up before we build and then after you build that mock-up review it with the question 'is this the best we can do'."

Then, on the plan: "I think this is pretty good. How would this be accessed by a user?" and finally: "if we're going to build this we need to also build a new version of the bids labor section."

Earlier (2026-09-09, the Burn train): "I want to be able to see exactly how much per day we are spending on jobs and how that it's growing compared to the bid and the percent complete report."

## What the data said (read-only prod queries, 2026-09-11)

| Fact | Figure |
|---|---|
| Open jobs (waiting · working · ready to bill · billed) that carry `jobs_ledger.bid_id` | **0 of 106** (0 of 805 jobs created in 2026) |
| Open jobs whose `revenue` equals a bid's `bid_value` / `agreed_value` to the cent | **15** — J1007 ↔ B375 SPACEX BA-02N ($249,715.66), J523 ↔ B66 Mission Hill Park ($123,600), J804 ↔ B67 AutoZone 1604, J650 ↔ B34 ATI Schertz, J843 ↔ B75 Lagan Casita, J775 ↔ B211 Wadelyn, J879 ↔ B76 ADAMS, J363 ↔ B4 Dr. Martins (agreed $31,400), J251 ↔ B12 Baumgartner … |
| Bids with `outcome = 'won'` since 2025-09 | 33 · 27 with a bid value · 23 with a `cost_estimates` row |
| Won bids whose cost estimate has labor hours | ≈ 5 (Connell 47 h, ADAMS 36 h, Knight 20 h, Bear Spring 17 h, Wadelyn 13 h; Lagan's 603 h is a data-entry oddity) |
| Won bids with a `labor_rate`, or PO materials, or sub rows | 0 · 0 · 0 |
| `bid_pricing_history.est_cost` for B375 SPACEX ($249,716 bid) | $260 (26 count rows × the $10 estimator cost) |

**Reading:** ClickTooling prices from the price book; it does not cost most bids. The "actual bid" that exists for nearly every won job is its **price** and its **fixture counts**. A budget that only works when the Cost Estimate tab was filled would light up a handful of jobs and stay dark on J1007. Hence the Labor-tab refresh being a precondition, and hence the provenance design below.

## The decision

Build a **Budget** that is a first-class thing on the job with a **provenance** — where it came from, when, by whom, how complete — instead of a single snapshot number:

- Sources, ranked by truth: **bid estimate** (snapshot of the bid's direct cost when the estimator costed it) → **typed** (hours · materials $ · subs $, by the person who scoped the job) → **assumed** (the Job Summary Target chip, 35 % default — today's behavior).
- **Direct cost** = labor hours × rate + materials + subs + equipment + permits + waste + other + driving + travel. **Not** the estimator cost (bid time is already in the overhead pool — People → Overhead "Bid labor"), and Burn keeps overhead out of the direct signal as before (v2.3189).
- **Snapshot, with a refresh**: the budget is what the bid said when the job took it (or when Refresh was pressed), stamped with the bid version, the date and the person; repricing produces a visible delta, never a silent drift.
- **Hours before dollars for labor**: the bid priced a book rate, the job pays real wages; hours are what the crew controls. Per-component bars (labor h · materials · subs · other) each with the %-done marker and a per-component at-completion; a written "why" sentence.
- **Partial estimates stay partial**: hours-only estimate → labor burns against the bid, materials against the assumption, chip says so. Never blend into one unexplainable figure.
- **Linking is the feature**: ranked candidates on the Costs tab (exact price match → same GC and won → address prefix → name similarity; show ≤ 3; never auto-link), one tap links + snapshots; Bid Board won rows get two chips with verbs (job: linked / matches by value → Link / none; estimate: costed · N % / hours only / none → Cost it); New Job from a bid carries the estimate by default.
- **Every readout names its footing**: one glyph (◆ bid · ✎ typed · ≈ assumed) on the Costs tiles, the Job Summary Burn cell (+ a Budget column and filter), and the Pipeline burning-jobs card, whose "margin at risk" is measured against each job's own footing.

Rejected: the v1 plan (a `jobs_ledger.bid_estimated_cost` column filled at job creation, two `null` arguments replaced) — arithmetically right, blind to the data; it would have shipped and lit up zero jobs. Also rejected: auto-linking by value (15 matches include two-bid ambiguities — J363, J258, J864, J581).

Open questions for the owner (asked 2026-09-11, not yet answered): (1) should a won bid with no cost estimate *notify* the estimator, or only sit on the Board as a chip? (2) keep the typed budget, or strictly bid-sourced? (3) the Labor refresh itself — see `to-dos/bids-labor-refresh/` once it exists.

## How a user reaches it

Job window → **Costs** (from the Pipeline row's Edit, global search, a Job Summary Burn / Proj. margin cell, the Pipeline burn card's "Open the worst first"): the Budget card sits above the Burn tiles; with no bid, the amber banner with candidates and the typed fields. **Job Summary**: glyph on Burn, Budget column + filter (the "assumed" filter is the linking backlog). **Bid Board** won rows: the two chips. **New Job from a bid**: the carry checkbox, on by default. **Settings → Data** (dev only): the one-time list of the 15 exact matches, Link all / per row. Role gates as Costs / true profit today: dev · controller · master technician; assistants see none of it; linking uses the job-edit permission; "Cost it" the bid-edit permission.

## Where it plugs in

Exists:
- `src/lib/jobs/jobBurn.ts` — `resolveJobBurnBudget({ priceUsd, bidEstimateUsd, targetMarginPct })`, `JobBurnBudgetSource = 'bid_estimate' | 'target_margin'`, `buildJobBurn` (spent %, lead points, EAC, runway, earned-value series, status). `JobCostsBurnSection.tsx:102` and `jobSummaryBurn.ts:53` both pass `bidEstimateUsd: null`; the header already prints "bid estimate as budget" for the unreachable source.
- `src/lib/jobs/jobSummaryBurn.ts` — `projectJobSummaryBurn` (no bid argument yet), `buildPipelineBurnAlert` (at-risk vs `targetMarginUsd`).
- `src/hooks/useJobBurnOverhead.ts` reads the app-wide overhead allocation (v2.3260) — untouched by this work.
- Bid cost math: client `BidsPricingTab.tsx` → `derivePricingWorkbench()` (`totalCost` incl. team labor + five direct-cost families); server RPC `bid_pricing_history(p_service_type_id)` (`supabase/migrations/20260820230000_bid_pricing_history.sql`, `est_cost` excl. team labor). `lib/bidPricingRowCalculations.ts` (`computeBidPricingRows`), `lib/bids/bidCostCalc.ts` (travel / driving / estimator / `sumEquipmentRows`), `lib/bids/laborRowHours.ts`.
- Bid → job: `JobFormModal.tsx` `applyPrefillFromBid` (~1795–2020) and the insert (~3395, `bid_id: bidId || null`); `BidWonJobActions.tsx` → `openNewJob({ prefillBidId })`; trigger `estimates_link_job_stamps_bid`; reverse trigger `jobs_ledger_bid_outcome_from_job`. `JobWithDetails.linkedBid` carries id / project_name / bid_number / service_type_id only; `jobsLedgerEmbedSelects.ts` (guard test) is where a budget embed goes.
- Job Summary rows: `jobSummaryLedgerView.ts` `JobSummaryLedgerRowInput['job']` does not declare `bid_id` (runtime objects are `JobWithDetails`, so it is there); `Jobs.tsx:1533` builds the Pipeline alert.

New:
- Table `job_budgets` (job_id PK → jobs_ledger; kind `bid` | `typed`; bid_id, bid_version_id; labor_hours, labor_usd, labor_rate, materials_usd, subs_usd, other_usd, total_direct_usd; completeness jsonb — rows with hours / total rows, materials source, rate present; taken_at, taken_by, note). RLS mirrors jobs_ledger writes; both read-only blocks.
- RPCs: `bid_estimate_breakdown(p_bid_id)` (single-bid form of `bid_pricing_history`'s math + hours by stage + completeness); `snapshot_job_budget_from_bid(p_job_id, p_bid_id)` (link + snapshot in one transaction; refresh = same call); `suggest_bids_for_job(p_job_id)` (the ranking rule).
- Kernel `src/lib/jobs/jobBudget.ts`: resolve → `{ source, direct, components, completeness }`; per-component burn + the "why" words. `resolveJobBurnBudget` / `projectJobSummaryBurn` take the resolved budget.
- UI: Budget card + link banner + typed form on `JobCostsBurnSection`; glyph + Budget column/filter on `JobsJobSummaryTab`; footing on `PipelineMoneyOpportunities`; Bid Board chips; the New Job carry box; the dev backfill list.

## The plan (PR train, smallest shippable first)

1. **Data — SHIPPED v2.3297.** Migration `20260911175025_job_budgets.sql` (`job_budgets`, `bid_estimate_breakdown`, `snapshot_job_budget_from_bid`, `set_typed_job_budget`, `clear_job_budget`, `suggest_bids_for_job`) + `src/lib/jobs/jobBudget.ts` (resolve · completeness rule · component burn · the why sentence). Rank 4 (name similarity) was left out — no `pg_trgm` in the schema; ranks 1–3 cover the 15 known matches.
2. **Kernel + Costs tab — SHIPPED v2.3299.** `useJobBudget` + `JobBudgetCard` (Frame A / Frame B), `JobCostsBurnSection` reads `budgetForBurn(resolved)`, `teamHours` on the timeline inputs. Not yet: the "other" row's used figure; changing a linked bid (unlink is a job-edit action).
3. **Job Summary + Pipeline** — glyph, Budget column + filter, `projectJobSummaryBurn` on the resolved budget, the card's footing wording. Kernel tests; live screenshots.
4. **Bid side** — Bid Board chips; New Job carry checkbox → snapshot RPC after insert. Help guides: `job-charges-timeline.md`, `read-true-profit-on-job-summary.md`, the Bid Board guide.
5. **Backfill offer** — dev-only Settings → Data list of exact matches; then the deferred pair: persist the Pricing workbench margin on the bid when priced (so an uncosted bid can still hand the job price × (1 − priced margin)); earned value by stage (stage % × that stage's budget) once estimates carry stage hours.

Out of scope on purpose: changing how bids are costed — that is the Labor-tab refresh, its own to-do.

## How to verify

- Dev server on a per-worktree port (`preview_start` `pipetooling-dev-5179`); drive it headless with Playwright from `node_modules/.scratch/*.mjs`; dev-login `http://localhost:5179/dev-login?as=1&to=<encoded path>`; read-only prod queries via `page.evaluate(async () => { const { supabase } = await import('/src/lib/supabase.ts'); … })`.
- Real pairs to test on (unlinked today): J1007 ↔ B375 (no estimate → the typed path and the "Cost it" door), J523 ↔ B66 (hot on the Pipeline card: 100 % of the assumed budget at 77 % done), J879 ↔ B76 ADAMS (36 h of hours → the partial path).
- No prod writes by an agent: linking and typing are UI actions the owner performs; the backfill list never auto-links.
- Gotchas: `bids` has no `status` column — won/lost is `bids.outcome`; `jobs_ledger` address is `job_address`; `bid_pricing_history` needs a `service_type_id`; the pool chart footnote on People → Overhead still read "Approved…" on 2026-09-11 (HMR, not a bug).
