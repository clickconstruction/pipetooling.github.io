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

## What was left for later (validated 2026-09-05: none of it is in `JobsWeeklyMoneyModal.tsx`; the v2.3848 plan refresh of 2026-09-26 audited the report and the Moneyfill close, retired the concept mockups and left `docs/WEEKLY_MONEY_PLAN.md` §Phase 6 as this same list)

- Per-row drilldowns beyond the Job Detail links.
- A GC / development grouping lens.
- A month roll-up.
- Feeding the Charges & Value timeline from the same payload.
- Widening access to pay-approved masters (today dev/controller).

## Note

Job Summary's Months view (v2.2821) now does a month roll-up from the day ledger; check whether that makes the Weekly Money month roll-up redundant before building it. The v2.3848 audit's one finding is not a phase-6 item: the Monday close is not worked to zero (the Sep 14 week had $116k across 27 unapplied deposits), so the report's Cash lens cannot say which jobs got paid — a routine gap left with the owner.
