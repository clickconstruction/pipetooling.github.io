# Crew P&L — data flow map

---
file: docs/CREW_PNL_DATA_FLOW.md
type: Engineering / Data-flow reference
purpose: Every input, transform, and output behind Jobs → Crew P&L (dev-only), with the known weaknesses — written after the v2.976/v2.978 partial-data incidents so the next debugging session starts from a map instead of archaeology.
audience: Developers, AI Agents
last_updated: 2026-07-23
---

Surface: [`src/components/jobs/JobsCrewPnlTab.tsx`](../src/components/jobs/JobsCrewPnlTab.tsx) (dev-only tab on `/jobs?tab=teams-summary`). Math kernel: [`src/lib/crewPnlSummary.ts`](../src/lib/crewPnlSummary.ts) (`buildCrewPnlSummary`, fully unit-tested). Per person: **hours, labor cost, billing (revenue credit), profit, billing/hr** + per-job drilldown.

## 1. Inputs (six sources)

| # | Source | Loaded by | Scope / gotchas |
|---|---|---|---|
| 1 | **Complete jobs list** (`jobs_ledger` + `team_members` embed) | The tab itself, on mount, **paginated in 1000-row pages** (v2.978 — a single fetch silently truncated at config `max_rows = 1000` and made every profit negative, v2.977 incident) | All statuses. This exists because input #2 lazily omits Paid in Full — fatal for a P&L (v2.976 incident: paid jobs showed as raw UUIDs with zero billing). Any page error discards the whole fetch (partial data is worse than the fallback). |
| 2 | `jobs` prop (shared `JobsListCacheContext`) | Jobs page | **Fallback only** while #1 loads. Omits Paid in Full until Stages' "Expand to load". |
| 3 | `teamLaborData` prop (`TeamLaborRow[]`, [`utils/teamLabor.ts`](../src/utils/teamLabor.ts)) | Jobs page | Per job: per-person clock-session hours+cost by work date. Approved sessions; **wages join `people_pay_config` by trimmed name** (the app-wide name-join fragility — renames silently zero wages). |
| 4 | `laborJobs` prop (`people_labor_jobs` + items) | Jobs page (Sub Labor data) | Sub sheets. Cost = [`laborJobSubCost`](../src/lib/jobs/subLaborCost.ts) (line items + drive cost from app_settings `drive_mileage_cost` / `drive_time_per_mile`). Assigned names split on the sheet's delimiter. Sheet date = `job_date ?? created_at`. |
| 5 | `people` roster | The tab (in-tab fetch) | Feeds `buildCrewPnlPersonResolver`: unifies account users, roster names, and free-text spellings; unresolvable names flagged `unmatched`. |
| 6 | app_settings `crew_pnl_sub_equivalent_rate_v1` | The tab | `value_num`, default `DEFAULT_SUB_LABOR_EQUIVALENT_RATE = 30`. Editable inline ("Sub $/hr eq."). |

## 2. Transforms (component, before the kernel)

- `jobInputs`: id, label (`effectiveJobLedgerNumber(hcp, click)` → job_name → id), `revenue`, team members, `last_work_date` (equal-split fallback date).
- `jobIdByNumber`: sheet linking map — `lower(trim(hcp_number))` and `lower(trim(click_number))` → job id, first-wins. **Exact match only** — formatting variants ("HCP 769") don't link; the audit (below) surfaces them.
- `subInputs`: per sheet — `jobId` (via the map, else null), raw `jobNumberText` (audit), date, names, `cost`, sheet unit-`hours` (display-only since v2.977).

## 3. Kernel math (`buildCrewPnlSummary`)

1. **Sub effective hours** (v2.977): **always `cost ÷ equivalentRate`** — sheet unit-hours are piece-rate accounting, not effort (the v2.974 real-hours preference underweighted mixed sheets). All sub shares are flagged `estimated` (≈).
2. **Per-job denominator** = all-time clocked crew hours + all linked sub effective hours.
3. **Crew billing** = `revenue × inRangeHours ÷ denominator` (numerator range-filtered, denominator all-time — a person's share follows when they worked, the pool reflects everyone ever on the job).
4. **Sub billing** = `revenue × effHoursShare ÷ denominator`, names split equally; only for linked sheets whose date is in range. Sub-only jobs: denominator = their own eff hours → sub gets 100%.
5. **Equal-split fallback**: revenue jobs with *no* hours of any kind split equally across `team_members` (flagged `estimated`).
6. **Unlinked sheets**: cost (and eff hours) counted, **zero billing** — tracked per person (`unlinkedSubCost`) and in `summary.subLabor { total, linkedTotal, unlinkedSheets }`.
7. **Row** = Σ per person: profit = billing − laborCost; `billingPerHour` = billing ÷ hours. Sorted by profit desc (volume-biased by design — use the billing/hr sort for productivity).

## 4. Outputs / UI affordances

Rows table (sortable), totals row, per-job drilldown (`crew` / `sub` / `billing-fallback` lines; missing jobs label "Unknown job", never a raw UUID — v2.976), **≈** on estimated billing, **"$N unlinked"** red badge per affected row, and the audit footer: "Sub labor: $X in range · $Y linked (Z%)" + collapsible unlinked-sheet list (raw job # text, names, $, sorted by cost).

## 5. Known weaknesses / improvement backlog

1. **Wage name-join** (input #3): a `users.name` ↔ `people_pay_config.person_name` mismatch silently zeroes a person's labor cost (inflating their profit). App-wide issue (`docs/SALARY_CLOCK_SESSIONS.md`).
2. **`revenue` semantics**: the split uses `jobs_ledger.revenue` (job total), not payments collected — this is a *bid-value* P&L, not cash. Jobs with revenue unset contribute cost-only rows.
3. **Exact-match sheet linking**: normalization beyond trim/lower (e.g. stripping an "HCP " prefix) is deliberate future work — decide after reading the audit's raw job # texts.
4. **Employee cost is bare wage** (no burden/overhead) while sub cost is a market price — subs structurally look costlier per revenue dollar. A crew burden multiplier is a philosophical change, deliberately not done.
5. **Rate calibration**: the $30 default should track the field crew's real loaded average; currently manual.
6. **laborJobs load dependency**: sub data arrives via the Jobs page's Sub Labor loaders — if that load path ever becomes lazier, this tab starves silently (the audit total dropping to $0 is the tell).

## Incident log (why this doc exists)

- **v2.976**: tab read the lazily-loaded shared cache → paid jobs (most of a P&L!) missing → UUID labels, zero billing. Fix: self-loaded complete list.
- **v2.978**: that self-load hit PostgREST's 1000-row cap unpaginated → arbitrary subset → *all* profits negative. Fix: paginate; discard on partial error.
- **v2.979**: two v2.976 edits had silently no-opped — the linking map read the empty cache prop (0% linked) and `allJobs` was missing from the memo deps (billing $0 until remount). Caught by live-reading the audit footer; fixed with asserted edits.
- Lesson both times: **this tab must see the complete jobs universe, and silent truncation anywhere upstream shows up as "billing is missing", not as an error.** When Crew P&L looks wrong, check the audit footer and the jobs-universe size first.
