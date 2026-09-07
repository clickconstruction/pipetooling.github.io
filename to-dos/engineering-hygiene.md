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

- **Silent no-op `from('bids').update(...)` siblings** (v2.2461): 23 update sites outside tests share the shape the RLS-refused-update fix covered once; a sweep would give them the same loud message.
- **Same exposure on the takeoff tables** (v2.2466): `bids_takeoff_rough_part_lines` and siblings — UPDATEs do not error; wants a table-appropriate message.

- **`toLocaleDateString('en-CA')` as a YYYY-MM-DD source** (v2.2980): 119 call sites across components, pages and hooks assume `en-CA` renders `YYYY-MM-DD`; Node 20 / ICU 72 renders `MM/DD/YYYY`, and `dateUtils.ts`, `checklistDueDates.ts` and `payStubPayments.ts` already carry the warning. Browsers get it right, so prod has been fine — but any of those strings that reaches a date column or a string comparison is one ICU update away from breaking. Sweep: replace with `denverCalendarDayKey(ms)` (company calendar) or a parts-based local-day helper where the device's day is meant.

Mechanical sweeps merge alone (CLAUDE.md): cut from fresh main, merge before the next feature PR on those surfaces.

## The plan

1. ~~Refresh the inventory table and the AI_CONTEXT headline~~ (done: AI_CONTEXT v2.2956, playbook table v2.2961) — pick the next Stage-A target from it: `JobsStagesTab.tsx` (6,094) and `BidsPricingTab.tsx` (5,504) roughly doubled since the July sweep.
2. Run the three sweeps as one script-driven PR each.
