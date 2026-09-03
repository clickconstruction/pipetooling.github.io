# 20260903184432_gc_review_week_status_v2.sql (2026-09-03, v2.2705)

`CREATE OR REPLACE FUNCTION public.gc_review_week_status(p_week_start date)` — the Dashboard GC-review nudge's RPC, second version. Idempotent, no table changes, no new grants (re-issues the existing `authenticated` execute).

**Why.** The Needs-you card read "10 of 10 GCs certified · 0 statements sent" with a badge of **0** while the GC Review modal read "8 of 11 certified". Three counting differences between this RPC (v1) and the client's `gcReviewWeekProgress` kernel:

1. v1 counted a certification for the week even after the group changed (RMC +$2,200, Michael Palmer +$3,850, H & I +$350 since sign-off); the client demotes those to "certify to release". v2 counts a GC as certified only when its latest attestation `total` still equals the live outstanding total (cents).
2. v1's outstanding set used its own row math (billed job shells AND billed invoices, double-counting jobs that have both); v2 mirrors the board: a billed job with no billed invoice is one shell row (`revenue − payments_made`), otherwise its billed invoices carry the money (`amount − payments linked by invoice_id`), plus billed invoices on waiting/working/ready-to-bill jobs. A GC is outstanding only when that total is `> 0` (the client kernel gained the same `subtotal ≤ 0` skip in this release — Done Right Foundation, a fully paid job still marked billed, was the eleventh group).
3. New key `gcs_done` = GCs both certified and sent this week, so the badge shows what's left (`outstanding − done`) instead of `outstanding − certified`.

**Verified before push** by running the CTE body as a plain query on prod for week 2026-08-31: 10 outstanding, 7 certified, 0 sent, 0 done — matching the modal's groups once the $0 group is excluded.

**Deploy order.** Client first is safe (it falls back to `min(certified, sent)` when `gcs_done` is absent); the RPC is additive, so either order works.
