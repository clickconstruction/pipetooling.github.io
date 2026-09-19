---
name: What customers see — residuals
group: residual
status: >
  the nine-PR train shipped 2026-09-16 (v2.3505–v2.3513, all live, functions deployed, migration
  pushed) · item 3 shipped v2.3615 · two small leftovers (the confirm-page bug the tab exposed was fixed in v2.3521)
summary: >
  What the What-customers-see train left: a full sample matter on the law firm's portal (today the
  sample is the portal before its first matter), the signed-copy agreement email as its own step,
  and the Job window's *Their journey* door (the Customer page has it).
next: >
  Either of the two in a quiet hour; the firm's sample matter is the largest (a fixture that
  satisfies `parseLegalPortalPayload`).
size: S each
blocker: >
  None.
ver: shipped 09-16
opinion: later — the firm's sample matter is a fixture worth having before the next demo, not before.
---

# What customers see — residuals

The train in `what-customers-see-journeys/` (deleted at the shipping commit; the mock-up and the data map live in git history there, and the release notes v2.3505–v2.3513 carry the record) left three small things:

1. **A full sample matter on the firm's portal.** `sampleLegalPortalResponse` returns the firm, its recipients and no matters. A sample matter needs a fixture that satisfies `parseLegalPortalPayload` (a job with invoices and payments, a contact, an agreement, a demand letter) — half a day.
2. **The signed-copy agreement email as its own step.** `share-job-contract` emails the signed PDF; the builder `signedAgreementEmail.ts` is already client-side. Today it is folded into the *Signed* step's note.
3. ~~**The Job window's *Their journey* door.**~~ Shipped v2.3615 — `customerRowsForJob` narrows the customer's rows to the job; the door is collapsed under the schedule band.
