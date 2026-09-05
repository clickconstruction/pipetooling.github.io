# Engineering hygiene: the decomposition inventory has regrown, plus two mechanical sweeps

Status: not started, low priority · sources: [`docs/PAGE_DECOMPOSITION_PLAYBOOK.md`](../docs/PAGE_DECOMPOSITION_PLAYBOOK.md) inventory (last_updated 2026-08-02), fragments v2.2461 / v2.2466

## The inventory is stale (measured 2026-09-05, non-test files)

| File | Playbook says | Now |
|---|---|---|
| `src/pages/Estimates.tsx` | 5,365 | 6,525 |
| `src/components/jobs/JobsStagesTab.tsx` | 3,664 | 5,992 |
| `src/components/bids/BidsPricingTab.tsx` | 2,610 | 5,504 |
| `src/pages/People.tsx` | 4,313 | 4,668 |
| `src/components/jobs/JobFormModal.tsx` | 4,096 | 4,610 |
| `src/pages/Bids.tsx` | 3,791 | 4,534 |
| `src/pages/Checklist.tsx` | ~3,500 | 4,470 |
| `src/components/people/PeopleReviewTab.tsx` | 5,009 | 4,184 |
| `src/components/jobs/SendRecordInvoiceModal.tsx` | (not listed) | 3,533 |

The playbook's method still applies; the numbers and the "next tab" pointers do not. `BidsPricingTab` doubled during the RFQ / Workbench trains and is the new first candidate.

## Two mechanical sweeps noted and never run

- **Silent no-op `from('bids').update(...)` siblings** (v2.2461): the cover letter, counts, sent panel and review modals share the shape the RLS-refused-update fix covered once; a sweep would give them the same loud message.
- **Same exposure on the takeoff tables** (v2.2466): `bids_takeoff_rough_part_lines` and siblings — UPDATEs do not error; wants a table-appropriate message.

Mechanical sweeps merge alone (CLAUDE.md): cut from fresh main, merge before the next feature PR on those surfaces.

## The plan

1. Refresh the inventory table (one docs PR) and pick the next Stage-A target from it.
2. Run the two sweeps as one script-driven PR each.
