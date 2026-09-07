# Engineering hygiene: the decomposition inventory has regrown, plus three mechanical sweeps

Status: not started, low priority · sources: [`docs/PAGE_DECOMPOSITION_PLAYBOOK.md`](../docs/PAGE_DECOMPOSITION_PLAYBOOK.md) inventory (last_updated 2026-08-02), fragments v2.2461 / v2.2466

## The inventory is stale (measured 2026-09-06, non-test files)

| File | Playbook says | Now |
|---|---|---|
| `src/pages/Estimates.tsx` | 5,365 | 6,906 |
| `src/components/jobs/JobsStagesTab.tsx` | 3,664 | 6,083 |
| `src/components/bids/BidsPricingTab.tsx` | 2,610 | 5,504 |
| `src/components/jobs/JobFormModal.tsx` | 4,096 | 4,824 |
| `src/pages/People.tsx` | 4,313 | 4,703 |
| `src/pages/Bids.tsx` | 3,791 | 4,613 |
| `src/pages/Workflow.tsx` | ~4,800 | 4,346 |
| `src/components/people/PeopleReviewTab.tsx` | 5,009 | 4,184 |
| `src/pages/Checklist.tsx` | ~3,500 | 3,809 (Roadmap became its own page, v2.2916) |
| `src/components/jobs/SendRecordInvoiceModal.tsx` | (not listed) | 3,513 |
| `src/components/bids/BidsTakeoffTab.tsx` | ~5,800 | 2,866 (came off the list) |
| `src/pages/Materials.tsx` | ~6,900 | 2,187 (came off the list) |

The playbook's method still applies; the numbers, the "largest files" headline in `docs/AI_CONTEXT.md`, and the "next tab" pointers do not. `Estimates.tsx` and `JobsStagesTab.tsx` are the two first candidates; `BidsPricingTab` doubled during the RFQ / Workbench trains.

## Two mechanical sweeps noted and never run

- ~~**Silent no-op `from('bids').update(...)` siblings**~~ — done v2.3058: measured 38 sites, 32 already guarded; the six that were not now are, and every guard reports through `src/lib/refusedWrite.ts` (`rls_refused` beacon).
- ~~**Same exposure on the takeoff tables**~~ — done v2.3058: both `bids_takeoff_rough_part_lines` updates guarded with a "takeoff line" message; `bids_takeoff_template_mappings` has no UPDATE site.

- ~~**`toLocaleDateString('en-CA')` as a YYYY-MM-DD source**~~ — done v2.3061: 119 sites in 41 files swept (`todayYmdInAppTz()` for today, `localCalendarDayKey(d)` for a device-local Date), guard rule 5 in `check-app-calendar-tz.mjs` keeps it out.

- **Edge `_shared/ipGeoValidation.ts` is not strict-clean** (v2.3026): it fails the app's tsconfig (`noUncheckedIndexedAccess`: a possibly-undefined octet at lines 8 and 30–35), so the client test for `ipGeolocationMaps.ts` cannot import it for a client↔edge parity guard the way the accounting-label parity tests do. Fix is type-narrowing only (no behaviour change), but it lives under `_shared`, so redeploy `resolve-ip-geolocation` afterwards (edge drift misses `_shared` importers).

Mechanical sweeps merge alone (CLAUDE.md): cut from fresh main, merge before the next feature PR on those surfaces.

## The plan

1. ~~Refresh the inventory table and the AI_CONTEXT headline~~ (done: AI_CONTEXT v2.2956, playbook table v2.2961) — pick the next Stage-A target from it: `JobsStagesTab.tsx` (6,094) and `BidsPricingTab.tsx` (5,504) roughly doubled since the July sweep.
2. Run the three sweeps as one script-driven PR each.
