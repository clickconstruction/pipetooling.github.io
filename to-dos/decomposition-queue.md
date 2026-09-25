---
name: "Decomposition queue: the ten biggest files, in the order to break them up"
number: 46
group: ready
status: queued 2026-09-25 — every file below has a fresh map (sweep v2.3820 · v2.3824, maps #3705–#3708); nothing started
summary: >
  The ten largest hand-written source files (3,981–6,981 lines each), ranked by what to
  decompose first — value over risk, not size alone: how often the file is edited (a hot file
  pays back soonest), untested money math inside it, and how cheap the map's first step is.
  Each row names its map and the first PR that map recommends. The full inventory of all 60
  files over 1,500 lines stays in the playbook.
next: >
  PR 1 — the `scenarioPricingRows` kernel out of BidsPricingTab (untested money math copied four
  times, one copy already shipped a $0.00 bug; ~60 lines, zero state). Then down the table, one
  first-PR per file.
size: S per first PR · XL for the whole queue
blocker: None. On the two hottest files (JobsStagesTab, Bids) check `npm run sessions` first — a feature train there means waiting for a quiet day.
ver: v2.3820 · 3824
opinion: build — start with the Pricing money kernel; each first PR is small, tested and independent of the others.
mockup: not required — refactors, no screen changes
---

# Decomposition queue

The owner asked (2026-09-25) for the size of the ten biggest files, saved here **so we know what to decompose first**.

## The ten, in the order to take them

Measured 2026-09-25 at `6dcb6e0f8` (raw `wc -l`, blank lines and comments included; generated files — `src/types/database.ts`, the release-notes archive — left out). *Edits* = commits touching the file in the last 30 days.

| Order | File | Lines | Edits (30 d) | Map | First PR (from the map) |
|---|---|---|---|---|---|
| 1 | `src/components/bids/BidsPricingTab.tsx` | 5,122 | 63 | [BIDS_PRICING_LABOR_TABS](../docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md) | Stage A: the `scenarioPricingRows` kernel — the scenario money adapter is hand-written four times and one copy shipped a $0.00 bug. ~60 lines, zero state. |
| 2 | `src/components/jobs/JobsStagesTab.tsx` | 5,108 | 83 | [JOBS_STAGES_TAB](../docs/JOBS_STAGES_TAB_ARCHITECTURE.md) | Stage-A sweep II (returned-check gate, signer fallbacks, lien focus mapping… one kernel per PR), then the `useStagesBilledMoneyData` seam. The most-edited file in the app (198 edits in 90 days, 120 `useState`). |
| 3 | `src/pages/Estimates.tsx` | 6,981 | 25 | [ESTIMATES_TABS](../docs/ESTIMATES_TABS_ARCHITECTURE.md) | Stage A: `estimateDraftLines` (untested money) and `buildEstimateDraftPersistPayload` (writes `total_cents`); then the free move of `EstimateListTable` + `EstimateListCards` (props-only, ~880 lines). |
| 4 | `src/components/jobs/JobFormModal.tsx` | 5,457 | 53 | [JOB_FORM_MODAL](../docs/JOB_FORM_MODAL_ARCHITECTURE.md) | The labor loader onto the existing tested sub-labor hook; then three inline overlays to components (~320 lines, low risk). |
| 5 | `src/pages/Bids.tsx` | 5,293 | 75 | [BIDS_TABS](../docs/BIDS_TABS_ARCHITECTURE.md) | Dead-code + blank-run sweep (≈ −150 lines, zero risk — a mechanical PR that merges alone); then the route/role kernels and `BidsLensBar` (≈ −300). |
| 6 | `src/pages/People.tsx` | 4,700 | 27 | [PEOPLE_TABS](../docs/PEOPLE_TABS_ARCHITECTURE.md) | Stage A: the pay-report assembly (three copies of the pay-stub input fetch — payroll money). |
| 7 | `src/components/schedule/ScheduleDispatchHub.tsx` | 4,126 | 11 | [SCHEDULE_DISPATCH](../docs/SCHEDULE_DISPATCH_ARCHITECTURE.md) | Stage A: the shared chrome module (unblocks every Hub split), then tests for the untested dispatch kernels. Nothing extracted since the first map. |
| 8 | `src/components/people/PeopleReviewTab.tsx` | 4,167 | 17 | [PEOPLE_REVIEW_TAB](../docs/PEOPLE_REVIEW_TAB_ARCHITECTURE.md) | Delete the dead `forTeamSummary` path; then `splitPartsRate` (six copies) and friends to a kernel. |
| 9 | `src/pages/Workflow.tsx` | 4,354 | 6 | [WORKFLOW_PAGE](../docs/WORKFLOW_PAGE_ARCHITECTURE.md) | Stage A: the unified money rows and money totals (shared with the Forecast tab) with tests. |
| 10 | `src/components/DashboardMyTimeDayEditorModal.tsx` | 3,981 | 1 | [MY_TIME_DAY_EDITOR_MODAL](../docs/MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md) | Stage A: the payload and dirty-gate kernels with tests; then the Not-coming-in confirm as a component. |

## Why this order

- **Money first.** Rows 1, 3, 4 and 6 open with untested money math — a kernel with tests is worth doing even if nothing else moves, and the playbook says pure logic leaves before any component does.
- **Hot files next.** A file edited 60–80 times a month costs every one of those edits; JobsStagesTab and Bids are the two most-edited files in the app. They are also where a feature train is most likely to be open — cut those PRs on a quiet day.
- **Size alone is last.** Estimates is the biggest file but edited a third as often as JobsStagesTab; Workflow and the My Time editor are big but cold (6 and 1 edits in 30 days), so they wait.

## How to take one

1. `npm run map -- --triage` — confirm the file's map is still fresh (re-measure the lines while you are there).
2. Read the map's *Recommended extraction order*; `npm run map -- <file>` for the exact line ranges and who reads and writes each piece of state.
3. Follow `docs/PAGE_DECOMPOSITION_PLAYBOOK.md`: Stage A (pure logic → `src/lib` + tests) before any component move, one PR per step, behavior-preserving, the map updated in the same PR.
4. When a file's first PR ships, strike its row here; delete this to-do when the queue is empty or the owner re-ranks it.

Related: [#21 Decomposition residuals](./decomposition-residuals.md) — what the last two trains left on purpose (the Pricing Workbench block waits for a Workbench feature train). The playbook's *Cross-surface seams* section lists the shared kernels several of these files would adopt (the money formatter, date keys, the job-search hook).
