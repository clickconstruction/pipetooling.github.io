# Dispatch: the small reads the inbox and the sheet rows never make

Status: not started, low · sources: fragments v2.2880 "Not changed / follow-ups", v2.2883 "Deferred (small)"

## The items (validated 2026-09-06)

1. **Self-heal for `add_job_phone` requests** — `useDispatchInbox`'s sweep retires only orphaned `link_job_pictures` requests; the phone analogue (jobs whose `customer_phone` was set outside the Job form, or before the request) is the same kernel shape with `customer_phone` added to the sweep's `jobs_ledger` read.
2. **Dispatch blocks on the Work row and the nudge history on the Sent row** (the sheet-story mock-up's marks 3 and 5) — the two reads the Subs tabs never make; add when the feed or the email log grows a per-sheet key.
3. **Tag slices on the bulk cost map** (v2.2870 residual): `mercuryTagChargesByJobId` refreshes only on the full load; a server-side `sum by job_id` remains the durable form.

## Where it plugs in

- `src/hooks/useDispatchInbox.ts`, the Subs → Work / Sub Labor rows (`src/components/jobs/`), the paged Banking loaders (v2.2870).
