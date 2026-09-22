---
name: "Stage Plan: items 3–4"
number: 13
group: gated
status: items 1–2 shipped v2.3431 / v2.3438 · item 5 shipped v2.3517 · items 3–4 owner calls · item 3 narrowed to discount rows by v2.3696 (the plain kind left the chooser)
summary: >
  What the Stage Plan train (v2.3083–v2.3134) left: capable-to-bill reading `billable()`, retiring
  `offered_to_gc` / bundles, plain rows on the final draw, the Any-done rule, the drawer's mint
  door.
next: Items 3–4 are yours — the final-draw sweep of the plain rows that remain (discounts only since v2.3696), and an office-marked done.
size: S each
blocker: Both remaining items are owner calls.
ver: 3 of 5 shipped · item 3 narrowed v2.3696
opinion: later — both are final-draw conveniences no one has asked for twice.
---

# Stage Plan residuals — what the six-PR train left for later

## Deferred, in order of value

1. ~~**The Stages board's *capable to bill* total reads `billable()`.** Today `capableToBillTotalFromWorking` (Jobs → Pipeline header, the Capable list) sums unbilled line items per working job. Reading the plan's `billable()` needs windows, orders and sheets for every working job in one fetch (`loadGcStageInputs` in `_shared/gcStages.ts` is the shape; it runs server-side today). One small PR: a hook that loads the three tables for the board's working jobs, builds each plan, and hands the header the sum of `billable()`.~~ **Shipped v2.3431** — `useWorkingStagePlanInputs` + `capableToBillPlan.ts`; a job with Order stages reads its plan, every other job keeps the formula.
2. ~~**Retire `job_stage_windows.offered_to_gc` / `offered_to_gc_at` / `bundle_id`.** Nothing reads them since v2.3132 (the portal reads the eye); `offerNextStage.ts` still mirrors `offered_to_gc` on the window when it flips an eye — drop the mirror, then a migration that drops the three columns and the `job_stage_windows_offered_idx` index. Also retire `StageCalendarModal`'s `onOffer` / `onWithdraw` props (no caller passes them).~~ **Shipped v2.3438** — migration `20260914250000_drop_stage_window_offered_columns.sql` (client + `submit-portal-request` redeploy first, then push; types regen chore after).
3. **Plain (—) rows on the final draw.** The plan reads a plain row as *later · with the final draw* but nothing auto-attaches it when the last Order draw breaks off; the office ticks it into that invoice by hand. Decide whether **Bill it** on the last Order stage should sweep the plain rows in. **Narrowed by v2.3696**: the Bill tab's chooser is two-way (In order / Any time) and the one hand-picked plain row was flipped to `any`, so the only plain rows left are the discounts `syncDiscountRows` forces null; `stagePlan.ts` still builds `plainRows` for them. The question is now whether the final draw should sweep the discounts in.
4. **Any-row "done" = the sheet's 100% or inspection called** (open question 2, built as proposed). If the owner wants an office-marked done instead, it is one column on `jobs_ledger_fixtures` and one line in `common()` in the kernel.
5. ~~**The drawer's real GC link** resolves through `useGcPortalLinks` (v2.3134); a GC with no minted link falls back to the sample page — a *Mint the link* door there would close the loop (the globe icon on the job header does it today).~~ **Shipped v2.3517** — the drawer's footer offers *Create their link* when the GC has none; one mint helper (`src/lib/portal/mintCustomerPortalLink.ts`) now serves the globe modal and the drawer.
