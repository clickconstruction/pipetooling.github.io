---
name: "Put a GC on notice: the jobs, their work and where each stands"
number: 43
group: ready
status: mock-up drawn 2026-09-25 from the live run on RMC- Dudley Mason (22 jobs) · waiting on the owner's yes
summary: >
  The run window lists the GC's jobs twice (the owners, the claims) and neither row says what
  the work was, how far it got or what was billed of it. Add one band above the steps — every
  job with its line items, the Pipeline's own progress-and-payment bar and Job total · Billed ·
  Paid — and make every row, line and bar a door into the Job window, which opens over this
  window and hands back to it, where you left it, on ✕.
next: The owner reads the mock-up and picks A (the band) or B (the chevron per row); then one PR.
size: S
blocker: The owner's yes on the placement.
ver: —
opinion: build A — the band is the ledger the four steps act on, and every piece of it already exists (the Pipeline cell, the tiles, the job-window door); B hides the same facts behind 22 clicks.
mockup: has
---

# Put a GC on notice: the jobs, their work and where each stands

## The ask

The owner, 2026-09-25, on the run window for RMC- Dudley Mason: *"In this view I would like to see
all of a GC's jobs and their line items and progress added to this current view. Clicking on any of
those items should open the job modal above what we are currently looking at, and closing the job
modal should bring us back to this screen."*

## What is missing today

The window (v2.3470 … v2.3767) is built around the paper: Step 1 asks who owns each property, Step 2
what each notice claims, Steps 3–5 the letter, the decision and counsel's grid. Every job appears in
Step 1 and again in Step 2 with one line under its number — *Billed · 1 mo · $26,400 open* — and
nothing else. To know what the $26,400 is for (one draw of two on "Plumbing Per Plans", 80 % done),
or that J651's Top Out draw went out Sep 21 while its Trim Set is not started, someone closes the
window, finds the job on the Pipeline, opens it, and comes back — and the run window reopens at the
top with the owner lookups re-run.

On the live run of 2026-09-25 that is 22 jobs at seven properties: two split into stages (Rough In ·
Top Out · Trim Set), four still carrying a migrated "Job total", thirteen service visits and trip
charges, and $55,340 that is finished work on no bill yet.

## The mock-up

[`mockup.html`](mockup.html) — drawn from the live run (the 22 jobs as the database holds them today,
customer names left off): today's window, the band (option A, every row), the stack when a row is
clicked, the chevron alternative (option B), the phone row, and the sizes.

## The two options

**A — the band, "The jobs" (recommended).** One section between the brief and Step 1, not a step
(no number, no status pill): the ledger the steps act on. A totals line — *22 jobs · $231,034 job
total · $175,694 billed ($86,314 unpaid) · $89,380 paid · $55,340 not yet billed* — then one row per
job, biggest open balance first:

- **Job** — number · name, the address, the status chip (Working / Waiting / Billed) and last on site.
- **The work** — the line items in order, each with its price and the money on it (paid · billed ·
  done, not billed · not done), poured the way the Pipeline pours it: a line an invoice names takes
  that invoice's money first, the rest in order.
- **Progress & payment** — the Pipeline's own cell (`buildProgressPaymentView` +
  `StagesProgressPaymentCell` in view mode): stage chips when the job has stages (J651, J706 read as
  ① Rough In · ② Top Out · ③ Trim Set from their line names, v2.3417), one bar whose top channel is
  the work and whose bottom edge is the money, and the one line of words under it.
- **Job total · Billed · Paid** — the Job window's own tiles (`jobWindowTiles`), and **Open** in bold.

Every row is a door. The row opens the **Job window on its Job tab** (`openJobDetail`); a line item
or the bar opens it on **Bill → ① Line Items** (`openEditJob` with `initialTab: 'bill'` +
`fixturesSectionHighlight`), the same door the Pipeline's stage chips use (v2.3461). The Job window
(z 1010, owned by `JobDetailModalContext`) opens **over** the run window (z 90), which stays mounted
with its scroll, its lookups and its typed answers; **✕ on the Job window hands back** to the run
window exactly where it was, and the band re-reads its rows (`onSaved` / close → `refetch`) so a
percent or a bill set inside the window shows at once. This is the stacking "Find the owner ›" and
"link a property ›" already do (v2.3667); nothing new is needed for it.

Folded like Step 1: *Hide the jobs ▴* remembers per browser. On a phone each row is two lines — the
number · name and open figure, then the bar — and a tap opens the window as on the phone board.

**B — the chevron.** No new section; each Step 1 row gains a chevron that opens the same three
columns under it (as the Forecast's work-months chevron, v2.3400), and the Step 1 band gains *Show
the work on every job*. Less to read at rest, but the facts are 22 clicks away, Step 1 is folded on
a settled run, and Step 2's rows would want the same chevron.

## Where it plugs in

| Piece | Today | Change |
|---|---|---|
| `useGcOnNoticeData` | jobs from `jobs_ledger` (`LIEN_DESK_JOB_COLUMNS`), desk items, owners | + one chunked read per table: `jobs_ledger_fixtures`, `jobs_ledger_invoices`, the payments — the three the Pipeline row already carries — as `workByJob` |
| `gcOnNotice.ts` | `GcNoticeJob`, `GcNoticeSummary` | + `gcNoticeJobsBand(jobs, workByJob)` (pure, tested): the rows in open-first order, each line's poured money, the totals line |
| `GcOnNoticeModal.tsx` | brief → Step 1 … Step 5 | + the band between the brief and Step 1, reusing `StagesProgressPaymentCell view=…`, `jobWindowTiles`, the step shell's card styles |
| `GcOnNoticeModalProps` | `onOpenEditJob(jobId, focus?)` | + `onOpenJob(jobId)` (the Job tab) and `focus: 'line-items'` on the existing door; `JobsStagesTab` wires both to `jobDetailModal.openJobDetail` / `tryOpenEditJob({ initialTab: 'bill', fixturesSectionHighlight: true })` |
| Tests | `GcOnNoticeModal.render.test.tsx` | + the band's totals and a row's lines; a row click calls `onOpenJob`; a line click calls `onOpenEditJob` with `'line-items'` |
| Docs | guide *send lien notices from the Lien desk*, `GLOSSARY.md` → Put a GC on notice | the band and its doors |

One PR, size S. No migration — every read is a table the Pipeline already reads under the same RLS.

## Verify

Open the run on ZZ TEST GC (BP398's GC; or RMC- Dudley Mason read-only): the band lists every job
Step 1 lists, the totals line equals the brief's open figure plus the paid figure, J651 shows three
stage chips with ② Top Out live and a blue edge, J372 shows one line half green half blue with 80 %
fill; click J372's row → the Job window opens on Job over the run window; ✕ → the run window is where
it was, scroll and all; click "Plumbing Per Plans" → the window opens on Bill at ① Line Items.
