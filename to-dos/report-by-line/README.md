---
name: "Report by line: how far along each line is, not the job"
number: 130
group: close
status: SHIPPED 2026-10-20 — the owner took the defaults and said build it all; the five PRs landed the same day (v2.5661, v2.5663, v2.5664, v2.5665 inside #5900's squash, v2.5666); what is left is the live walk and the count
summary: >
  A field report asks "How complete is the job?" and a tech who just finished the rough-in types
  50, meaning the piece they stood in, so the job reads 50% everywhere money is counted. The
  app already knows the job's lines, and a stage-weighted picker exists since v2.3192, but it
  opens only on a job with a declared Order stage, which almost no job has, and it asks about
  one stage per report. This to-do makes the per-line question the report's default on every
  multi-line job: the lines in plan order, each with its own percent, no amounts and no shares
  on the rows, the job's percent derived by the server the way it already is, and the same list
  behind the My Schedule stepper so the fast door stops minting whole-job fifties.
next: A live walk as a helper on a ZZ job with four priced lines and no Order row (the recipe under How to verify), then the count of reports whose job percent is exactly 50, before and after; then delete the folder.
size: XS
blocker: A live walk, and a read-only count on prod from the owner's seat (the session's classifier refused it).
opinion: your call — the code is done; the walk and the count are yours
mockup: to-dos/report-by-line/mockup.html
ver: v2.3192 · v2.5661 · v2.5663 · v2.5664 · v2.5665 · v2.5666
---

# Report by line (#130)

## The ask, in the owner's words

2026-10-20: "In the app we have tools for users to make reports on jobs. Right now those reports
include things like marking the % complete of the job as a whole. Right now in reports people are
marking jobs 50% complete while they mean of the stage. In reports, without showing money, I would
like to offer the users line items (which often includes stages) where they can individually
signal how complete each stage is."

## Three lenses

**The tech's seat.** Marco is halfway through the rough-in on a four-line job and files a Status Report from
Job Mode before he drives off. The form asks *How complete is the job?* with 0 · 25 · 50 · 75 · 100
under it. He has no number for the job; he has one for the rough-in. He taps 50. Fewest taps,
honest answer to the question he thinks he was asked. The same happens on the My Schedule card's
**Update % done** stepper, which is the faster door and files the same Status Report.

**The job behind the ask.** The question is wrong-sized. A tech works on a piece; the app asks
about the whole, and then treats the answer as the whole: `jobs_ledger.pct_complete` is what the
Pipeline's bar, the Dashboard's *Not Billed Out* and AR cards, Job Summary, Burn, the Bridge's
Build pace, earned revenue, the capable-to-bill plan and the Ready-to-bill prompt all read. A
fifty typed for the rough-in makes the job look half done and half unbilled.

**The whole office.** The office already splits jobs into lines on the Bill tab and reads the
stage line there (*Stage 2 · 60%*); the Pipeline's Progress & payment cell already draws one
segment per line and pours the job's percent down them; the GC portal shows the shared stages as
steps. Every one of those gets truer when the number per line is the tech's own. Nothing new has
to be invented for the office to read it; the gap is only at the point of entry.

## What exists today

- **Two doors file a percent.** [`NewReportModal`](../../src/components/NewReportModal.tsx)
  (Leave Report from Job Mode, the clock-out modal, the Dashboard's assigned-job rows and
  [`AdditionalReportModal`](../../src/components/AdditionalReportModal.tsx) from the job's
  reports list) and the My Schedule stepper
  [`FieldPctUpdateModal`](../../src/components/dashboard/FieldPctUpdateModal.tsx), which since
  v2.2078 files a Status Report through `submitStatusReportFromStepper` so both doors are one
  flow: report → `propagateReportPctToJob` → `set_job_pct_from_field` → the thread note *N%
  complete — from field report* → the Ready-to-bill prompt at 100% on a Working job.
- **The question is the template's `percent_0_100` field**, labelled *How complete is the job?*
  on the Status Report; the client (`reportCompletionPercent`) and the server
  (`list_latest_report_completion_pct`, `20260918195724`) both parse that label, so the label
  is an interface and stays.
- **Stage mode exists (v2.3192, the owner's idea of 2026-09-09).** On a job with at least one
  **Order** row, or whose line names read as a plumbing plan in order (v2.3417: Underground →
  Rough → Top Out → Trim → Final), the percent field becomes
  [`ReportStageProgressField`](../../src/components/ReportStageProgressField.tsx): *Which stage
  did you work on today?*, the stage list with *35% of the job* on each row, one stage's slider,
  and the green derived box. The job's percent is Σ weight × stage percent, the weight a line's
  share of the priced stage lines' value, computed by `list_job_stage_progress` so no price
  reaches the field. The report also carries a *Stage progress* text field for the office. The
  move lands on `jobs_ledger_fixtures.progress_pct / progress_at / progress_by /
  progress_report_id` through `record_stage_progress` — one row per report.
- **The gate keeps it shut.** `stageModeAvailable` needs an Order row. The v2.3083 backfill made
  every line item kind `any`, and the two-way chooser (v2.3696) keeps it that way unless the
  office picks *In order*. The 2026-09-21 census found 16 Order rows across about seven jobs and
  200-plus Any rows; the recognition rule opens a few more by name. Everywhere else the tech
  sees the whole-job slider, seeded with the current percent, quick picks 0 to 100.
- **Even open, stage mode asks one stage per report**, and the stepper door never shows stages
  at all. The Additional report and the Edit report windows use the plain slider only.
- **Readers of the job's percent** (a sample of the sixty-odd files): `progressPaymentCell.ts`
  (the Pipeline cell: `stages` mode draws per-stage fill from `progress_pct`, `lines` mode pours
  the job percent down the priced lines), `stagesMoneyBar.ts` (done, not billed = amount ×
  percent), `dashboardFinancials.ts`, `jobSummaryPercentComplete.ts`, `jobBurn.ts`,
  `bridge/buildPace.ts` (a job with no percent reads as half done), `capableToBillPlan.ts`,
  `reportReadyToBillPrompt.ts`, `aiaG702G703Template.ts`. All of them want one job number; none
  of them should change.
- **Who may say a stage's number**: `can_report_stage_progress(job)` — office roles, a team
  member, anyone with a clock session on the job, or a sub who can read the row.

## The root gap

The right question is already built, but it is behind a gate that almost no job passes, it asks
for one piece at a time, and it is absent from the fast door. So the tech is asked the whole-job
question on nearly every job and answers it with the number they have.

## The proposal — Mark each line

**One rule.** On a ledger job with two or more priced lines, every door that asks for a percent
asks per line. The lines are listed in plan order with their own percent; the tech moves the ones
they worked on; the job's percent is derived the way v2.3192 already derives it and still lands in
*How complete is the job?*, so every reader downstream reads the same field it reads today. A
one-line job keeps the slider it has.

**The screen** (mock-up states 2 to 4):

- *How far along is each line?* over the list. One line under it: *Move the ones you worked on.
  The rest stay as they are.*
- **The rows**: a number for an In-order stage (declared or recognized), ◆ for an Any-time line,
  the name, and the line's current percent on the right (*—* when nobody has said one; **✓ Done**
  at 100; **✓ Paid** when its draw is paid, which locks the row, the Stage Plan's rule since
  v2.3192). No amount. No share. The first line not yet done opens by itself; tapping a row opens
  it; only the open row shows its controls, so a six-line job is six short rows, not six sliders.
- **The controls** on the open row are the ones techs already know from the percent field:
  **25 · 50 · 75 · Done ✓** chips and the slider under them. A moved row's right side turns green
  and reads *35% → 50%*; a row moved back reads amber.
- **The job line** at the bottom, once and bold: **Job 32% → 43%**, with *was 32%* beside it and
  a small **how?** that unfolds the arithmetic (the shares as percentages, as v2.3192 prints them,
  never dollars) for the tech who wants it. Collapsed by default: a share of the job is not money,
  but it is money-shaped, and the owner's ask says without showing money (D1).
- **Set the whole-job % instead** stays under the job line for the job a tech honestly judges as
  a whole; it brings back today's slider, and the report says so in its text.
- **The report's text field** (*Stage progress*, kept under that label so nothing that reads it
  changes) lists every moved line: *Rough In 35% → 50% · Water heater — → 100% · job 32% → 43%*. The
  office reads that sentence on the report card, in the job's activity, and in the notification
  email, and the line's own number on the Bill tab.
- **The stepper door** (mock-up state 4): on a multi-line job, **Update % done** opens the same
  list in a sheet with the same chips, and *Save* files the same Status Report. The ± chips stay
  for a one-line job. One component, two doors, the way v2.2078 made the two doors one flow.
- **The Pipeline cell** (mock-up state 5): `lines` mode reads each line's own percent for its
  fill instead of pouring the job's percent down the lines, which `stages` mode already does. The
  words line and the money channel are unchanged. The GC portal is unchanged: it shows shared
  Order stages only, and their state already comes from `progress_pct`.
- **What stays the office's.** The office still types a whole-job percent on the Pipeline and in
  Edit Job when it wants to; the typed number wins until the next line report, which re-derives,
  the same precedence as today (the report is the field's newest statement). The chooser on the
  Bill tab still decides draws and numbering, not whether the question is asked.

## The second pass: is this the best we can do?

What the first draft had, and what the critique changed:

1. **Four chips on every row.** The first draft drew controls on all rows. On a 375px phone a
   six-line job was a wall of chips and the tech's eye had nowhere to land. Now one row is open at
   a time and the rest are one line each. Done rows stay as one-liners with a check.
2. **"35% of the job" on each row.** v2.3192 prints the share on the row and the arithmetic in the
   green box. It is not money, but a tech can read value from it, and it invites doing the math
   instead of answering the question. The share moved behind **how?** on the job line. The number
   the tech must see is the job's, once (D1 keeps the owner's say).
3. **A separate "stepper" design.** The first draft gave the My Schedule door its own per-line ±
   stepper. Two idioms for one answer is two things to learn; the stepper now opens the same list,
   and keeps its ± chips only where it has nothing to list.
4. **Asking "which line did you work on?" first.** The v2.3192 shape picks a line, then asks its
   percent. A tech who did two things reports one. The list form lets them move two rows in three
   taps and is also faster for one row, since the likely row is already open.
5. **Gating on the Order flag.** The flag exists to make draws wait on the stage above. Using it
   to decide whether the report asks per line was the whole gap. The new rule keys on two or more
   priced lines, which is what the Pipeline bar already keys on, so the report and the bar agree
   on what a job's pieces are. A service job with *Diagnostic · Parts · Labor* does list three
   rows; that is honest, and the office named them (D2).
6. **What the office reads.** The first draft wrote one *Stage progress* line per row into
   separate fields. One field, one sentence per moved line, keeps the report card and the email
   readable and keeps the existing readers of that label working.

What it does not do, on purpose: it does not auto-move the job to Ready to bill when every line
reads Done — the derived job percent reaches 100 then, and the existing prompt asks, as it does
today. It does not let a tech add or rename lines. It does not touch the GC portal or the Bill
tab's draw rules.

## Not taken

- **A "stage" selector on the Job Mode card** (*I'm on the rough-in*) that defaults the report.
  Nice later; it does not remove the whole-job question, which is the gap.
- **Keying the lines on a new "work line" mark** instead of price. It needs a new chooser on the
  Bill tab before anything improves; D2 keeps it as an option if the plain list proves noisy.
- **Per-line notes.** The note field stays one per report; the text field already names the lines.
- **Hiding the whole-job escape.** Some jobs are one piece of work split for billing; the tech
  should be able to say *the job is about 70%* and move on.

## Decisions for the owner

- **D1 — the share.** Default: hidden behind **how?** on the job line, shares as percentages,
  never dollars. Alternative: print *35% of the job* on each row as v2.3192 does today.
- **D2 — which rows list.** Default: every priced line that is not a discount, in plan order (what
  the Pipeline bar draws). Alternative: only lines the office marks as work, which needs a third
  choice on the Bill tab's chooser.
- **D3 — the escape hatch.** Default: *Set the whole-job % instead* stays, no note required.
  Alternative: require a note when a tech sets the whole job on a multi-line job.
- **D4 — the stepper door.** Default: PR 3 in the same train. Alternative: leave the stepper
  whole-job and watch whether the fifties stop with PR 2 alone.
- **D5 — the Additional and Edit report windows.** Default: the Additional report gets the list
  (it is the office filing for the field); Edit report keeps editing the stored text only.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The lines and their weights | `list_job_stage_progress(job)` returns priced rows with `weight_pct`, `progress_pct`, `draw_paid` behind `can_report_stage_progress` | drop the Order gate on the client side (`linesModeAvailable`: two or more rows); the RPC already returns Any rows |
| Writing a line's percent | `record_stage_progress(job, fixture, pct, report)` — one row | no new RPC: the one that exists already gates, validates and filters by kind, so `stampMovedLines` (in `hooks/useJobLineProgress.ts`) calls it once per moved line, best-effort, after the report saves (v2.5663) |
| The kernel | `lib/reports/stageProgressReport.ts`: the row shape, the parse with the v2.3417 recognition, `stageEffectivePct`, `jobPercentFromStages`, `stagePickerNumber` (pruned to these in v2.5666) | `lib/reports/lineProgressReport.ts` beside it (v2.5661): `linesModeAvailable`, `linePct`, `jobPercentFromLines`, `defaultOpenLine`, `movedLines`, `jobLine`, `lineProgressFieldValue`, `lineWords`, `howRows` |
| The field | `ReportStageProgressField.tsx` (one stage, the green box) — deleted in v2.5666 | `ReportLinesProgressField.tsx` (v2.5663): the accordion list, the job line with **how?**, the escape |
| The doors | `NewReportModal` (stage mode when available), `AdditionalReportModal` (plain), `FieldPctUpdateModal` (± stepper) | one hook, `useJobLineProgress`, behind all three: the two report windows mount the list on two or more lines (v2.5663); the stepper mounts it in its sheet and keeps ± for one line (v2.5664) |
| The job's percent | `propagateReportPctToJob` → `set_job_pct_from_field`; `job_pct_events` | unchanged |
| The report's text | field *Stage progress* (`REPORT_FIELD_LABEL_STAGE_PROGRESS`) | same label, many lines in one value |
| The Pipeline cell | `progressPaymentCell.ts` `lines` mode pours the job percent | `lines` mode takes each row's `progress_pct` for its fill when present; `list_job_crew_position` already carries the newest report percent and date |
| Guides | `reports.md` (*On a job split into stages*), `update-percent-done-from-my-dashboard.md`, `set-job-progress-on-stages.md` | the three rewritten in plain words; the Glossary's Stage Plan line |

## The plan — as built, 2026-10-20

1. **PR 1 — the rule** (v2.5661, #5895). The plan called for a batch RPC `record_line_progress`
   with a migration and a SQL bed; it was not needed — `record_stage_progress` already gates on
   `can_report_stage_progress`, validates 0..100 and filters to Order / Any rows, and
   `list_job_stage_progress` already returns every priced Order and Any row with its share — so
   PR 1 is the kernel `lineProgressReport.ts` and its nine tests, nothing on prod.
2. **PR 2 — the field on the report** (v2.5663, #5897). `useJobLineProgress` + `stampMovedLines`,
   `ReportLinesProgressField` and its smoke; `NewReportModal` and `AdditionalReportModal` mount
   it when `linesModeAvailable`; the whole-job escape; the *Stage progress* text; the plain
   slider on any RPC error, as before. A report that moves nothing files the job's own number.
   The `reports.md` guide.
3. **PR 3 — the stepper door** (v2.5664, #5898). `FieldPctUpdateModal` mounts the same field;
   `submitStatusReportFromStepper` takes `extraFields` and returns the report id; ± chips stay for
   one line; the guide `update-percent-done-from-my-dashboard.md`.
4. **PR 4 — the Pipeline cell reads the lines** (v2.5665; its PR #5899 was stacked under PR 5 and
   the queue took #5900 first, so the change landed inside that squash and #5899 closed empty).
   `progressPaymentCell.ts` `lines` mode fills from `progress_pct` once any line has one; the
   guide `set-job-progress-on-stages.md`.
5. **PR 5 — retire the one-stage field** (v2.5666, #5900). `ReportStageProgressField` and its
   test deleted; `stageProgressReport.ts` pruned; the Glossary's *Report by line* entry.

## How to verify

- **Unit**: `jobPercentFromLines` equals `jobPercentFromStages` with one override; many
  overrides sum; a paid row stays 100 whatever is passed; `lineProgressFieldValue` lists only
  moved rows and the job's before → after; `linesModeAvailable` is false on one row and true on
  two Any rows (the old gate's counter-case).
- **Render**: the first not-done row opens by itself; tapping a chip updates that row's readout
  and the job line; the escape swaps the list for the slider and back; a paid row has no controls.
- **Live, as a helper on the sample account** (the recipe in memory *live test recipe on prod*):
  a ZZ-test job with four priced lines, no Order row. Leave Report shows the list; move two rows;
  the report card reads the sentence; the Pipeline cell's two segments fill; `job_pct_events` has
  one `service` row with the derived number; `jobs_ledger_fixtures.progress_*` has two stamped
  rows with the report's id. Then the stepper door on the same job. Then a one-line job still
  shows the slider.
- **Gotchas**: the field roles cannot read `jobs_ledger_fixtures` under RLS, which is why the
  RPCs are SECURITY DEFINER; keep the new writer the same. A client deployed before the push
  must fall back to the plain slider (PostgREST *could not find the function*), as v2.3192 does.

## Where it stands

Proposed and built 2026-10-20 (the owner: "take the defaults, build it all"); the five PRs are on
main, D1 to D5 as the defaults. Two things are left, both the owner's:

- **The live walk** (How to verify above). The session could not seed a ZZ job on prod (a write)
  and the deploy landed after the build; any real job with two or more priced lines shows the
  list on Leave Report and on Update % done now.
- **The count.** A live count was drafted (how many reports in the last 120 days carried 25/50/75
  as the job's number, how many Working jobs have two or more priced lines and no stage plan, how
  many line rows ever got a `progress_pct`) but the session's classifier refused the production
  read. Run it from the owner's seat, then again a month on: the share of reports whose job
  percent is exactly 50, before and after, is the number that says whether this worked.

Delete the folder when both are done; the release notes and the fragments carry the record.
