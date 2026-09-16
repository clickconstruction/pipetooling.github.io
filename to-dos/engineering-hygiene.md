---
name: Decompose JobsStagesTab / BidsPricingTab
group: ready
status: "the ipGeo item shipped v2.3427 · JobsStagesTab region 5 (the three inline modals) shipped v2.3530, 6,598 → 6,328 lines · left: the rest of the JobsStagesTab map, then BidsPricingTab"
summary: Decomposition inventory regrown again; two silent-no-op update sweeps.
next: >
  JobsStagesTab, next region by the map: the toolbar (~215 lines) or the modal-tail confirms;
  then BidsPricingTab from its map. One region per PR, between feature trains on those surfaces.
size: L
blocker: Collides with every feature PR on those files.
ver: inventory 09-06 · region 5 v2.3530
---

# Engineering hygiene: the decomposition inventory has regrown, plus three mechanical sweeps

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

Mechanical sweeps merge alone (CLAUDE.md): cut from fresh main, merge before the next feature PR on those surfaces.

## The plan

1. ~~Refresh the inventory table and the AI_CONTEXT headline~~ (done: AI_CONTEXT v2.2956, playbook table v2.2961) — pick the next Stage-A target from it: `JobsStagesTab.tsx` (6,094) and `BidsPricingTab.tsx` (5,504) roughly doubled since the July sweep. **First cut landed v2.3530**: region 5 of `docs/JOBS_STAGES_TAB_ARCHITECTURE.md` — the Total by Name, Capable of Being Billed and Est. bill date dialogs are their own components and the grouping is a tested kernel; the map records what stayed and why. Next by the map: the toolbar, then the modal-tail confirms.
2. Run the three sweeps as one script-driven PR each.
