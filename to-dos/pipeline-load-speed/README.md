---
name: Pipeline load speed
group: ready
status: >
  PR 1 shipped v2.3569 — 146 requests → 67, last response 4.8 s → 3.2 s (the card-charge loader
  stops on Pipeline; the list-driven effects wait for the list) · PR 2 shipped v2.3600 — the board
  paints from the primary rows, the four passes run together once across the open sections ·
  PR 3 shipped v2.3602 — the passes are one RPC (`get_stages_enrichment`) · the tab-switch TTL
  shipped v2.3603 · PR 4 remains, owner-gated
summary: >
  **Pipeline (Stages) loads 136 database requests per visit** and re-runs all of them on every tab
  switch. The first section shows at 0.6 s, the rest at 1.3–2.5 s, and the page keeps working until
  5.5 s. The server is not the problem (every query is milliseconds); the count is. PR 1 stops the
  Mercury card-charge loader on a tab that never renders it and keys the list-driven effects on a
  stable id string (≈ −90 requests). PR 2 paints rows from the primary query before the four
  enrichment passes land. PR 3 folds those passes into one RPC. PR 4 remembers the last board on the
  device so cold loads paint instantly while refreshing.
next: >
  PR 4 — remember the last board on the device (IndexedDB snapshot, painted at once with
  `jobsListRefreshing`), after the owner answers its two questions: how old a board may be shown
  (proposal 24 h) and whether money columns read muted while refreshing.
size: M (PRs 1–3 and the TTL done)
blocker: >
  None. Coordinate with the JobsStagesTab decomposition train (`engineering-hygiene.md`) — PR 1 and
  PR 2 touch `Jobs.tsx` and `JobsListCacheContext.tsx`, not the tab file, so they can run alongside.
ver: PR 1 v2.3569 · PR 2 v2.3600 · PR 3 v2.3602 · TTL v2.3603
opinion: your call — PR 4 needs the 24 h answer; everything else in the train shipped.
---

# Pipeline load speed

Status: **PR 1 shipped v2.3569** (146 → 67 requests, 4.8 → 3.2 s) · **PR 2 shipped v2.3600** (the board paints from the primary rows; the passes run together, once) · **PR 3 shipped v2.3602** (the passes are one RPC) · **the tab-switch TTL shipped v2.3603** (a switch back within 30 s is free — numbers in `docs/recent-features/v2.3603.md`) · measured 2026-09-16 and 2026-09-18 · the measurement script is `measure.js` beside this file

## The ask, in the owner's words

> "Can you please take a look at the jobs, stages tab, and look at load speed. I don't think the tab is being as efficient as it could be."

Grace, 2026-09-16. Then, after the first plan: *"is this the best we can do?"* — which is where PRs 2–4 come from.

## What was measured

Dev server on this machine, dev login as Robert, all six sections open on the device, cold in-memory cache, SPA click from another Jobs tab to **Pipeline** (`measure.js` reproduces it):

| | |
|---|---|
| Supabase requests per visit | **136** |
| Requests before the board is visible | 18 |
| First section on screen (Ready to Bill) | 0.6 s |
| All sections filled in | ~1.3–2.5 s |
| Last request finishes | 5.5 s |
| Switch to another Jobs tab and back | all 136 again — the cache is ignored |

**The server is fast.** Server-side timings as `postgres` through the pooler: the schedule-blocks lookup for 150 job ids 0.7 ms, a scope query 0.3 ms, the board's embed joins ~2 ms, `jobs_ledger_thread_note_stats` 8.5 ms, `get_billed_customer_pay_speeds` 10 ms. Every `job_id` / `mercury_transaction_id` column involved is indexed. Yet the browser waited up to 2 s for the thread-stats call — that is queueing, and the cure is fewer requests. (Where exactly it queues cannot be proven from the page: cross-origin timing phases are hidden without `Timing-Allow-Origin`. Do not claim a mechanism; claim the count.)

**Prod shape behind the numbers:** 111 non-paid jobs, 724 paid, 13,340 Mercury transactions, 1,854 schedule blocks, 872 fixture rows.

**Not measured:** the browser's own render cost. The hidden preview pane reported zero long tasks, which is not credible for a 3,600-line component re-rendering after each response; measure with the pane visible or React Profiler before attributing felt slowness to rendering.

## Where the 136 come from, ranked

1. **The Mercury card-charge loader, on a tab that never shows it — ~85 requests, the whole 4 s tail.** `useJobsMercuryAllocations` (`src/hooks/useJobsMercuryAllocations.ts`, the effect near line 99) sums card charges over `jobListForCardCharges`, which `src/pages/Jobs.tsx` (~line 361) sets to the whole `jobs` list on every tab except Job Summary. Only `JobsPartsTab` and Job Summary render `mercuryCardChargesByJobId`; nothing in `JobsStagesTab`, its tables, `jobsStagesRowShared` or `PipelineOverview` reads it. It pulls `mercury_transaction_job_allocations` (2 pages), then the transaction ids in `.in()` chunks of 150 (`SUPABASE_IN_CHUNK_SIZE`, `src/lib/supabasePaging.ts`) across `mercury_transactions`, `mercury_transaction_supply_house_invoice_links` and `mercury_transaction_drag_sort_assignments` (16 chunks each), plus labels — and it runs **twice** per visit because it is keyed on the `jobs` array identity, which changes as scopes merge.
2. **One full board fetch per open section — ~25 requests for 111 jobs.** `loadJobsScopedForStages` (`Jobs.tsx`) → `runFetchScopes(scopesForOpenStagesSections(...))` (`src/contexts/JobsListCacheContext.tsx`) runs `fetchJobsLedgerWithDetailsForStages` once per open scope (waiting, working, ready_to_bill + its companion, billed_all) in parallel, and **each** runs its own serial four-pass enrichment in `src/lib/fetchJobsLedgerWithDetailsForStages.ts`: materials + fixtures → schedule blocks → estimates. `fetchStagesHeaderStats` adds four more. The scoped design (v2.1823 / v2.1827) exists for the owner's default of only Ready to Bill open, where it is cheap; a device with every section open pays it several times over.
3. **Effects keyed on the `jobs` identity re-fire on every merge.** Geocoding ×4 (`JobsMapCard` → `useAddressGeocodeCoords`), `job_budgets` ×3 (`useJobBudgetFootings`), `list_job_crew_position` ×3, `jobs_ledger_thread_note_stats` ×2 (`useJobThreadNotes`), `list_latest_report_completion_pct` ×2, `customers` ×5, `users` ×4.
4. **A tab switch is a full reload.** The `activeTab` effect in `Jobs.tsx` (~line 684) calls the loader unconditionally; the 60 s guard (`VISIBILITY_REFETCH_MIN_MS`) covers only `visibilitychange`.
5. The labor loaders (`people_hours_recorded` 3 pages, `people_labor_*`, `people_crew_jobs`, pay config) fire on Pipeline when the Burn feature is armed on the device (`pipelineBurnArmed`). Smaller, and arguably intended.

## Decision

Trim the count first, then change the shape. The first plan (stop the unused loader, dedupe the effects, a tab-switch TTL) was judged "not the best we can do" because it keeps the four serial passes in front of every row and starts every page load from nothing. The shape changes are PRs 2–4 below.

Rejected: a single RPC returning the whole board shape. It would collapse everything to one round trip, but `JobWithDetails` is consumed through 55 props and many kernels; re-shaping it is a much larger, riskier change than folding only the enrichment passes (PR 3).

## Where it plugs in

| Piece | Home |
|---|---|
| The cache + scope fetches + header stats | `src/contexts/JobsListCacheContext.tsx` (`runFetchJobs`, `runFetchScopes`, `fetchScopeIfNeeded`, `refreshHeaderStats`) |
| The loader + the four enrichment passes | `src/lib/fetchJobsLedgerWithDetailsForStages.ts` (`enrichJobsLedgerPrimaryRows`), select in `src/lib/jobsLedgerEmbedSelects.ts` |
| Which scopes load | `src/lib/jobs/stagesSectionPrefs.ts` (`scopesForOpenStagesSections`, `STAGES_SECTION_DEFAULT_OPEN`) |
| The card-charge loader and its gate | `src/hooks/useJobsMercuryAllocations.ts`, `jobListForCardCharges` + `canAccessBankingForParts` in `src/pages/Jobs.tsx` |
| Tab-keyed loaders | `src/pages/Jobs.tsx` (`shouldLoadJobsListForTab`, the `activeTab` effect, `needCustomers`, `loadLaborJobs` / `loadTeamLaborData`, `loadRoster`) |
| Paging helpers | `src/lib/supabasePaging.ts` (`fetchAllRowsChunkedIn`, `SUPABASE_IN_CHUNK_SIZE = 150`, page 1000) |
| The maps | `docs/JOBS_TABS_ARCHITECTURE.md` (§ stages, the cache quirks), `docs/JOBS_STAGES_TAB_ARCHITECTURE.md` (the shared substrate) |

## The plan

**PR 1 — stop the unused loader; dedupe the list-driven effects (S).** In `Jobs.tsx`, make `jobListForCardCharges` empty unless the active tab is `parts` or `job-summary` (the two consumers), so the effect short-circuits on Pipeline. Then key `useJobThreadNotes`' stats fetch, `useJobBudgetFootings`, `useJobCrewPositions` and the map's geocode request on a sorted id string (the pattern the card-charge hook already uses at its top) instead of the array identity, and hold them until `jobsListLoading` is false. Expected: ≈ −90 requests, last response ~2.5 s. Watch: the Parts tab still shows card charges; Job Summary's cost drilldown still opens.

**PR 2 — paint rows first, enrich after (S) — SHIPPED v2.3600.** In `fetchJobsLedgerWithDetailsForStages` / the cache, `setJobs` with the primary rows (payments, invoices, team members and the to-one embeds are already on them) as soon as the scope query returns, then patch `materials`, `fixtures`, `last_schedule_work_date` and `linkedEstimateForStages` in place when the passes land. Run the four passes with `Promise.all`, not in sequence. Anything that reads those four fields must tolerate "not yet": the row's estimate banner, the schedule "last worked" date, the fixtures-driven chips. Expected: every section on screen at ~0.6 s.

**PR 3 — one RPC for the enrichment (M) — SHIPPED v2.3602.** `get_stages_enrichment(p_job_ids uuid[])` returning four jsonb maps keyed by job id (materials rows, fixtures rows, max schedule `work_date`, the estimate candidates the banner picks from), SECURITY INVOKER so RLS still applies, replacing the ~20 chunked requests with one. Keep `pickLinkedEstimateForStagesBanner` and `mergeMaxScheduleWorkDateByJobId` as the client-side kernels over the RPC's rows so the tests stay. Migration: `SET lock_timeout = '3s';`, `CREATE OR REPLACE`, no table changes, `docs/migrations/` fragment.

**PR 4 — remember the last board on the device (M).** Persist the last successful `jobs` snapshot (+ key + timestamp) in IndexedDB via a small kernel; on a cold load with a matching key, `setJobs` from it immediately with `jobsListRefreshing = true`, then let the normal fetch replace it. **Decision for the owner first:** how old a board may be shown before it is hidden instead (proposal: 24 h), and whether money columns should read muted while refreshing. This is the only PR with a design question — both are drawn in `before-after-pr4.html` beside this file (the cold load today, three snapshot ages under the 24 h line, and the muted / plain treatments side by side, with a recommendation on each).

Also, small and independent — **SHIPPED v2.3603**: a same-key TTL on tab-switch refetches (`boardIsFreshForTab`, 30 s, every wanted scope merged), so coming back to Pipeline within the window is instant.

Each PR: fragment + release note, re-run `measure.js`, put the before/after table in the fragment.

## How to verify

1. Start the dev server, sign in with dev login, open any Jobs tab other than Pipeline.
2. Paste `measure.js` into the browser console. It installs a `PerformanceObserver` on `supabase.co` requests, clicks the **Pipeline** tab, polls for the *Loading jobs…* text to disappear, and after 15 s prints: total requests, requests before the board, time the board appeared, time the last response ended, and a per-endpoint tally.
3. Do it once cold (fresh page load, then step 2) and once warm (switch away and back). Compare with the table above.
4. Do NOT measure with a full navigation to `/jobs?tab=stages`: under Vite the module requests overflow the resource-timing buffer and the Supabase entries are lost. SPA clicks only.
5. The hidden preview pane cannot report long tasks; render cost needs a visible window.

## State

Not started. The measurement, the attribution of every request family and the plan are above. Nothing has been changed in code. Parallel work to know about: the JobsStagesTab decomposition train (`engineering-hygiene.md`) is moving regions out of the tab file — PRs 1–2 here touch the page and the cache context, not the tab, so they can run alongside; PR 2's "tolerate not yet" edits in the row renderers should wait for a quiet moment in that train.
