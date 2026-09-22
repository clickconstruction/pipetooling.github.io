---
name: Weekly Money phase 6
number: 11
group: gated
status: optional
summary: "Phase 6: drilldowns, GC lens, month roll-up, timeline feed, wider access."
next: Any of these wanted?
size: M
blocker: Optional, your call.
ver: plan phase 6
opinion: drop — drilldowns on a report read once a week; build the piece when someone names the question it answers.
---

# Weekly Money report: Phase 6 (later)

## What was left for later (validated 2026-09-05: none of it is in `JobsWeeklyMoneyModal.tsx`)

- Per-row drilldowns beyond the Job Detail links.
- A GC / development grouping lens.
- A month roll-up.
- Feeding the Charges & Value timeline from the same payload.
- Widening access to pay-approved masters (today dev/controller).

## Note

Job Summary's Months view (v2.2821) now does a month roll-up from the day ledger; check whether that makes the Weekly Money month roll-up redundant before building it.
