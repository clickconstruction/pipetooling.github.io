---
name: Dispatch residuals
group: residual
status: item 1 shipped v2.3567 (the phone self-heal) · items 2–3 low
summary: >
  Dispatch blocks / nudge history on the sheet rows, the tag-slice refresh. The phone-request
  self-heal shipped v2.3567 (the inbox sweep covers add_job_phone as it covers link_job_pictures).
next: The sheet-row history when the feed or the email log grows a per-sheet key. The tag-slice refresh shipped v2.3637.
size: S
blocker: None.
ver: from v2.2880 / 83 · item 1 v2.3567 · item 3 v2.3637
opinion: later — two of three shipped; the one left waits on a per-sheet key the feed and the email log do not carry yet.
mockup: not required — draw the sheet-row history when it is picked up
---

# Dispatch: the small reads the inbox and the sheet rows never make

## The items (validated 2026-09-06)

1. ~~**Self-heal for `add_job_phone` requests**~~ — shipped v2.3567: — `useDispatchInbox`'s sweep retires only orphaned `link_job_pictures` requests; the phone analogue (jobs whose `customer_phone` was set outside the Job form, or before the request) is the same kernel shape with `customer_phone` added to the sweep's `jobs_ledger` read.
2. **Dispatch blocks on the Work row and the nudge history on the Sent row** (the sheet-story mock-up's marks 3 and 5) — the two reads the Subs tabs never make; add when the feed or the email log grows a per-sheet key.
3. ~~**Tag slices on the bulk cost map**~~ — the staleness shipped v2.3637 (`tagSliceForOneJob`: the post-save refresh recomputes the job's slices with its total). A server-side `sum by job_id` remains the durable form for the bulk map's cost as the allocations table grows — not needed at 2,060 rows.

## Where it plugs in

- `src/hooks/useDispatchInbox.ts`, the Subs → Work / Sub Labor rows (`src/components/jobs/`), the paged Banking loaders (v2.2870).
