# Pipeline on a map — the Bid Board's map at the top of Jobs → Pipeline, with an As-of slider

Status: not started · planned 2026-09-12 · owner decisions below still open · mock-up: [`mockup.html`](./mockup.html) (the plan page with the drawn card, also published as a Claude artifact the same day)

## The ask, in the owner's words

> right now there is a map at the top of bids that works very productively, what would we need to add one of similar qualities to the top of the Jobs, Pipeline page with one addition, I would like to be able to scroll back in time

## The reading — why the Bids map works, and what carries over

The Bid Board card (`BidBoardMapCard`, v2.3162 → v2.3251) is productive for four reasons, all of which carry straight over:

1. **A second view of the list, never a filter on it.** Pins follow the search and the trade pill; chips toggle pins only. On the Pipeline the pins follow the search box, the GC / development / account-man filters and hidden groups.
2. **A pin lands you on the row.** Click a pin → the row lights below; the popup carries Open / Edit / Directions. The Pipeline already has a row-jump path (`StagesJobNumberJumpChip`) to reuse.
3. **The empty land became numbers.** The rail (v2.3206) turns distance into three buckets with counts and dollars and lists what is due, nearest first.
4. **Everything underneath is shared.** `PinsMapCanvas` / `PinsMapGoogleCanvas`, `useOfficeAnchor` (25 / 50 mi rings), `useAddressGeocodeCoords` (cache → `geocode-address-batch`), clustering, Fit all, Hide map, the phone bar. The new card is a kernel plus a component that composes them.

## The decision

- **Sections = Pipeline sections**: Waiting (amber) · Working (blue) · Ready to bill (purple) · Billed (orange) · Paid (green). A job in collections keeps Billed's color and wears a red ring (the bid map's overdue ring). **Paid starts off** (723 pins would bury the ~110 live ones), as Lost starts off on the bid map.
- **Popup**: number + name, the party the bills go to (`effectiveInvoiceParty`), status + stage + % done, address + miles from the office, what is owed on a Billed job; **Open job** (job window), **Edit** (its Edit tab), **Directions**.
- **Rail**: the same three distance buckets, second number = **dollars still to collect**, sub-line = **N to ask for** (Ready to bill + Billed). List under it: **Ask for money · nearest first** (Ready to bill + Billed, longest-waiting first, then nearest); tapping a row selects the pin and lights the Pipeline row.
- **The addition — As of**: the Job Summary → Timeline slider (v2.2807, `JobSummaryTimelineView`) reused as-is in words and controls: toggle, Play / Pause, date + days-ago, a range slider, jump chips (Today · 1 wk · 1 mo · 3 mo · 6 mo · Feb 22), and a "since then" strip. A pin wears the status the job had on that day (last recorded move at or before the day; before its first move, that move's `from_status`); a job created after the day is not drawn; chips count the day's world; the rail follows. **Play means time** — the bid map's section tour (v2.3208) is not ported.
- **The floor is 2026-02-22**, the first `job_status_events` row. The card says so at the floor: *History starts Feb 22, 2026, when the Pipeline began recording moves.* Older bills (back to 2020) cannot tell a job's status on a day, so nothing older is shown.
- **Rejected**: drawing the rewound day from the board's scoped rows (paid loads on demand, so the past would be missing jobs); ghosting vanished jobs (dropped instead — the strip counts them); pin size by revenue; area select.

## Data facts (prod, 2026-09-12, read through the pooler)

| Fact | Value |
|---|---|
| Jobs with an address | 829 of 829 |
| Already in `address_geocodes` | 542 (the other 287 place through `geocode-address-batch`, 20 per call, on first open) |
| `job_status_events` | 2,561 rows on 786 jobs, 2026-02-22 → today (`job_id, from_status, to_status, changed_at`) |
| `jobs_ledger` by status | paid 723 · billed 53 · working 30 · waiting 23 |
| `jobs_ledger_invoices.billed_at` | 490 rows; `sent_to_customer_at` also present |
| `jobs_ledger_payments` | 661 rows since 2026-02-27 (`created_at` only) |
| `clock_sessions` with a job | 2,033 on 186 jobs, work_date 2026-03-15 → today (optional crew layer) |

Every read pages past PostgREST's 1,000-row cap (the cap bit twice on the Costs tab work — use count queries for counts, `.range()` loops for lists).

## Where it plugs in

Exists (reuse, do not fork):
- `src/components/map/PinsMapCanvas.tsx`, `PinsMapGoogleCanvas.tsx`; `src/lib/map/mapCanvasTypes.ts` (`MapCanvasPin { id, lat, lng, color, ringColor?, title }`, `MapCanvasAnchor`), `mapPointsBounds.ts`.
- `src/hooks/useAddressGeocodeCoords.ts`, `useOfficeAnchor.ts`; `src/lib/dashboardJobsMap.ts` (`googleMapsBrowserKey`, `resolveDashboardMapProvider`, `googleColorSchemeForTheme`).
- `src/lib/bids/bidBoardMap.ts` + `bidBoardMapRail.ts` (the shapes to mirror: `milesBetween`, home fit, ring extents, hide / cluster prefs, `formatMoneyCompact`), `src/components/bids/BidBoardMapCard.tsx`, `BidBoardMapRail.tsx`, `src/lib/bids/bidBoardHoverStore.ts` (row hover → pin pulse, v2.3251).
- Pipeline: `src/components/jobs/JobsStagesTab.tsx` (toolbar row at ~line 2630: New Job · Follow-ups · Forecast · search; `useIsMobile()`; sections from `buildJobsStagesBoardLists` in `src/lib/jobsStagesBoard.ts`; `jobInCollections`); `StagesJobNumberJumpChip.tsx` (row jump); `JobDetailModalContext` (job window opener).
- Time precedent: `JobSummaryTimelineView.tsx` As-of row (`JOB_RUN_AS_OF_JUMPS`, `daysBackLabel`), `src/lib/jobs/jobRunningTimeline.ts` (status-on-day from moves), `loadJobDayLedger.ts` (paged `job_status_events` + `clock_sessions` selects), `jobDayLedgerSessionCache.ts` (session cache with TTL).
- Guides to mirror: `src/content/help/see-your-bids-on-a-map.md`, `see-your-jobs-on-a-map.md` (the Dashboard card).

New:
- `src/lib/jobs/jobsMap.ts` (+ test) · `src/components/jobs/JobsMapCard.tsx` (+ render test) · `src/lib/jobs/jobsMapRail.ts` · `JobsMapRail.tsx` · `src/lib/jobs/jobsMapAsOf.ts` (+ test) · `src/lib/jobs/loadJobsMapHistory.ts` · guide `see-the-pipeline-on-a-map.md`.
- No migration, no edge-function change, anywhere in the train.

## The plan — PR train

1. **PR 1 — Jobs on a map (today's view).** Kernel `jobsMap.ts`: board rows → map jobs (label `J1019 · Vasquez pretest`, section, collections ring, payer name, address key, miles), pin resolution, legend, visibility with Paid off, popup lines, unmapped line, hide / cluster prefs. `JobsMapCard.tsx` composed from the shared pieces; mounts in `JobsStagesTab` under the toolbar row and above the money strip; renders nothing with no pinnable job. Pin → row via the jump-chip path; popup buttons → job window / Directions. Guide. ~12 kernel tests, ~6 render smokes (mirror `BidBoardMapCard.render.test.tsx`).
2. **PR 2 — The rail.** `jobsMapRail.ts` / `JobsMapRail.tsx`: buckets with dollars to collect + "to ask for", the Ask-for-money list, the pinned total; Pipeline row hover pulses the pin (hover store reused).
3. **PR 3 — As of.** `jobsMapAsOf.ts`: status on a day, existed-on-day, day legend, since-then counts (started · billed · paid · collections), jumps, the floor. `loadJobsMapHistory.ts`: paged reads of jobs (id, numbers, name, address, status, created_at, gc, revenue), moves, bills, payments; session cache. The As-of row + strip; pins, chips and rail recolor to the day. Loads nothing until the toggle is on. Tests on day arithmetic and boundaries (a move at 23:59, a job created the same day, the floor). Guide section *rewind the map*.
4. **PR 4 — Crews on the day (optional).** `clock_sessions` by `work_date`, paged: a pulse on every pin with a session that day, rail line *5 crews out · 4 jobs*.

Each PR: `npm run claim`, release note `v2.NNNN.ts` + `docs/recent-features/v2.NNNN.md`, theme tokens only, guide with the feature, `gh pr merge --auto`.

## Owner decisions still open (recommendation first)

- **Shown or collapsed by default on the Pipeline?** Recommend shown, remembered per device (the bid map's rule).
- **Sections on by default?** Recommend Waiting, Working, Ready to bill, Billed on; Paid off.
- **Dollars on the rail** — "to collect" = billed − paid + ready-to-bill exposure, the Pipeline's own numbers; the Pipeline is office-only by RLS, so it stays inside the owner-only line (see the *Finances stay owner-only* decision, 2026-09-11).
- **Play speed** — recommend one day per 150 ms (six months in ~30 s).
- **Rail list** — recommend Ask for money; alternatives: Started this week, Working past billable progress.

## How to verify

- Dev: `dev-5237` launch config, `http://localhost:5237/dev-login?as=1&to=%2Fjobs%3Ftab%3Dstages`. Prod check after merge on clicktooling.com → Jobs → Pipeline.
- Recharts / Leaflet draw nothing while the Browser pane is hidden — take a screenshot first, then read the DOM.
- Geocode: on first open expect *Placing N more jobs…* while the 287 cold addresses resolve; a second open is instant (cache). A miss lists the job under the map with a link to its row — no "fix the address" sheet is needed because every job has an address.
- As-of spot checks against known moves: J1019 (created 2026-09-11, GC pays) must vanish before Sep 11; J1001 (billed Aug 31) must read Working before that day and Billed after; the floor label appears at Feb 22 and the slider stops there.
- Phone: 430 px width → chips scroll sideways, map 220 px, rail and As-of row stack, tapped pin becomes a bar.
- Row hover → pin pulse only on desktop.
