---
name: Dispatch residuals
group: residual
status: item 1 shipped v2.3567 (the phone self-heal) · items 2–3 low
summary: >
  Dispatch blocks / nudge history on the sheet rows, the tag-slice refresh. The phone-request
  self-heal shipped v2.3567 (the inbox sweep covers add_job_phone as it covers link_job_pictures).
next: The sheet-row history when the feed or the email log grows a per-sheet key; the tag-slice sum server-side.
size: S
blocker: None.
ver: from v2.2880 / 83 · item 1 v2.3567
opinion: later — the self-heal shipped; the two left wait on data the sheet rows do not carry yet.
mockup: not required — draw the sheet-row history when it is picked up
---

# Dispatch: the small reads the inbox and the sheet rows never make

## The items (validated 2026-09-06)

1. ~~**Self-heal for `add_job_phone` requests**~~ — shipped v2.3567: — `useDispatchInbox`'s sweep retires only orphaned `link_job_pictures` requests; the phone analogue (jobs whose `customer_phone` was set outside the Job form, or before the request) is the same kernel shape with `customer_phone` added to the sweep's `jobs_ledger` read.
2. **Dispatch blocks on the Work row and the nudge history on the Sent row** (the sheet-story mock-up's marks 3 and 5) — the two reads the Subs tabs never make; add when the feed or the email log grows a per-sheet key.
3. **Tag slices on the bulk cost map** (v2.2870 residual): `mercuryTagChargesByJobId` refreshes only on the full load; a server-side `sum by job_id` remains the durable form.

## Where it plugs in

- `src/hooks/useDispatchInbox.ts`, the Subs → Work / Sub Labor rows (`src/components/jobs/`), the paged Banking loaders (v2.2870).
