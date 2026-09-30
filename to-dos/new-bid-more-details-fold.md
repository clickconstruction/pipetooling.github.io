---
name: "New Bid: fold the other eighteen fields under More details"
number: 64
group: ready
status: the Plans section moved up under the project name (v2.4162); the rest of the form is still every section open, ~26 fields
summary: >
  The robot-intake mock-up's After · New Bid form shows the name, Plans, and the four fields
  the robot uses (service type, due date, address, the distance that fills itself), with
  everything else — bid #, estimator, account man, GC, contacts, ITB links, dates, values,
  notes — folded under one More details ▾. v2.4162 shipped only the Plans move, so the form
  still opens long and the estimator scrolls past sections they rarely fill on day one.
next: >
  One PR in BidFormModal.tsx: keep Project Name, Plans, Service Type, Bid Due Date and the
  Location section open; wrap the other sections in a More details disclosure, open by
  default when editing a bid that already has any of those fields filled, remembered per
  device; a render test that a new bid shows the four fields and the fold, and that Edit on a
  filled bid opens the fold. Check every deep link that focuses a field (focusForRobotGap, the
  Robot Board doors) still lands, opening the fold first.
size: S (one client PR)
blocker: None.
ver: v2.4162
flagged: true
---

# New Bid: fold the other eighteen fields under More details

Left on purpose by the robot-intake train (v2.4162 the Plans section, v2.4165 the needs sheet and the Bid Board line), 2026-09-29. The owner flagged it to the top of the punch list the same evening.

*Robot intake before and after* — https://claude.ai/artifact/FR171snJmaS53BgYRGrH8a (the After · New Bid form board shows the fold).

## Why it waited

The Plans move changed which field the robots read and how it gets filled; folding the rest changes where every other field lives. Two changes to the same form in one PR would have made either one hard to review, and the fold needs the deep-link doors checked (Edit bid from the needs sheet and the Robot Board lands on a named field — a folded field must open its fold first).
