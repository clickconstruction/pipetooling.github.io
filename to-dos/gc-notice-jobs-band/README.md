---
name: "Put a GC on notice: the GC's jobs by stage, and the door to mark each one right"
number: 43
group: ready
status: mock-up drawn 2026-09-25 from the live run on RMC- Dudley Mason (22 jobs) · waiting on the owner's yes
summary: >
  Before 22 notices go out, the office wants to see the GC's jobs by stage and catch the ones
  whose record is wrong — a Waiting job with a draw billed, a billed job with no percent. Add one
  band above the steps: the jobs grouped by the stage on record, each with its line items, the
  Pipeline's progress-and-payment bar and one chip saying what looks wrong; the chip opens the Job
  window on the field that fixes it, over this window, and ✕ hands back with the row re-read.
next: The owner reads the mock-up and picks A (the band) or B (the chevron per row); then one PR.
size: S
blocker: The owner's yes on the placement.
ver: —
opinion: build A — the stage audit needs the jobs side by side under their stage, and every piece exists (the Pipeline cell and its readings, the tiles, the job-window door); B hides the same facts behind 22 clicks and cannot group by stage.
mockup: has
---

# Put a GC on notice: the GC's jobs by stage, and the door to mark each one right

## The ask

The owner, 2026-09-25, on the run window for RMC- Dudley Mason: *"In this view I would like to see
all of a GC's jobs and their line items and progress added to this current view. Clicking on any of
those items should open the job modal above what we are currently looking at, and closing the job
modal should bring us back to this screen."* And the reason, the same day: *"so we know what jobs of
theirs are at what stage and we can dig in to mark some of them more correctly."*

## What is missing today

The window (v2.3470 … v2.3767) is built around the paper: Step 1 asks who owns each property, Step 2
what each notice claims, Steps 3–5 the letter, the decision and counsel's grid. Every job appears in
Step 1 and again in Step 2 with one line under its number — *Billed · 1 mo · $26,400 open* — and
nothing else. To know what the $26,400 is for (one draw of two on "Plumbing Per Plans", 80 % done),
or that J651's Top Out draw went out Sep 21 while its Trim Set is not started, someone closes the
window, finds the job on the Pipeline, opens it, and comes back — and the run window reopens at the
top with the owner lookups re-run.

On the live run of 2026-09-25 that is 22 jobs at seven properties, and seven of them read wrong on
the record: J372 sits in *Waiting* with 80 % done, a draw paid in February and a draw billed Sep 14;
J305 and J436 are 70–90 % done in *Waiting* with nothing billed; J706 is *Waiting* with a paid draw
and no percent; J651 has its Top Out draw out and no percent; J800 and J868 are billed with no
percent. A notice claims what the record says, so the record is the thing to fix first — and today
the run window gives no way to see that, let alone reach the field.

## The mock-up

[`mockup.html`](mockup.html) — drawn from the live run (the 22 jobs as the database holds them today,
customer names left off): today's window, the band (option A, every row), the stack when a row is
clicked, the chevron alternative (option B), the phone row, and the sizes.

## The two options

**A — the band, "The jobs, by stage" (recommended).** One section between the brief and Step 1, not
a step (no number, no status pill). A head line — *Waiting 4 · Working 1 · Billed 17 · 7 look wrong ·
22 jobs · $231,034 job total · $175,694 billed ($86,314 unpaid) · $89,380 paid · $55,340 done, not
billed* — then the jobs **grouped by the stage on record** (Waiting → Working → Billed, biggest open
first inside each; *biggest open first* and *by property* are the other two orders), each group head
counting its jobs, its open money and how many look wrong. One row per job:

- **Job** — number · name, the address, last on site.
- **Stage on record · what looks wrong** — the status chip, then one or two chips in the Pipeline's
  own words, each naming its door: the band's own reading first, **the stage the evidence says**
  (*Waiting, but 80% done and a bill out → Status ▾*; *Waiting, but draw 1 paid → Status ▾*), then
  `jobNextLine`'s (*set % done → % done*, red when a bill is out with no percent — v2.3411; *$13,860
  done, not billed → Bill it*; *quiet N d*; *no bid value*). A job with nothing wrong shows a quiet ✓.
- **The work** — the line items in order, each with its price and the money on it (paid · billed ·
  done, not billed · not done), poured the way the Pipeline pours it: a line an invoice names takes
  that invoice's money first, the rest in order.
- **Progress & payment** — the Pipeline's own cell (`buildProgressPaymentView` +
  `StagesProgressPaymentCell` in view mode): stage chips when the job has stages (J651, J706 read as
  ① Rough In · ② Top Out · ③ Trim Set from their line names, v2.3417), one bar whose top channel is
  the work and whose bottom edge is the money, and the one line of words under it.
- **Job total · Billed · Paid** — the Job window's own tiles (`jobWindowTiles`), and **Open** in bold.

Every row is a door, and **the chip is the door to the fix**: *Status ▾* opens the Job window on
**Edit → the status stepper**, ringed (`focusRow: 'status'`); *% done* opens **Edit → the percent
field**, ringed (`focusRow: 'pct'`) — two new focus rows in the shape of the lien rows of v2.3697;
*Bill it* opens **Bill → ② Invoices**. The row opens the **Job tab** (`openJobDetail`); a line item or
the bar opens **Bill → ① Line Items** (`openEditJob` with `initialTab: 'bill'` +
`fixturesSectionHighlight`), the same door the Pipeline's stage chips use (v2.3461). The Job window
(z 1010, owned by `JobDetailModalContext`) opens **over** the run window (z 90), which stays mounted
with its scroll, its lookups and its typed answers; **✕ on the Job window hands back** to the run
window exactly where it was, and the band **and the steps** re-read (`onSaved` / close → `refetch`):
a job moved to Billed regroups, its chip goes quiet, and Step 2's claim follows the corrected record.
This is the stacking "Find the owner ›" and "link a property ›" already do (v2.3667); nothing new is
needed for it.

Folded like Step 1: *Hide the jobs ▴* remembers per browser. On a phone each row is two lines — the
number · name and open figure, then the bar and the one chip — and a tap opens the window as on the
phone board.

**B — the chevron.** No new section; each Step 1 row gains a chevron that opens the same three
columns under it (as the Forecast's work-months chevron, v2.3400), and the Step 1 band gains *Show
the work on every job*. Less to read at rest, but the facts are 22 clicks away, the jobs cannot be
seen by stage, Step 1 is folded on a settled run, and Step 2's rows would want the same chevron.

## Where it plugs in

| Piece | Today | Change |
|---|---|---|
| `useGcOnNoticeData` | jobs from `jobs_ledger` (`LIEN_DESK_JOB_COLUMNS`), desk items, owners | + one chunked read per table: `jobs_ledger_fixtures`, `jobs_ledger_invoices`, the payments — the three the Pipeline row already carries — as `workByJob` |
| `gcOnNotice.ts` | `GcNoticeJob`, `GcNoticeSummary` | + `gcNoticeJobsBand(jobs, workByJob)` (pure, tested): the groups by stage (and the two other orders), each line's poured money, the group heads and the head line, and **the stage the evidence says** — one reading beside `jobNextLine`'s chip, each with the door it names |
| `GcOnNoticeModal.tsx` | brief → Step 1 … Step 5 | + the band between the brief and Step 1, reusing `StagesProgressPaymentCell view=…`, `jobWindowTiles`, the step shell's card styles |
| `GcOnNoticeModalProps` | `onOpenEditJob(jobId, focus?)` | + `onOpenJob(jobId)` (the Job tab) and `focus: 'status' \| 'pct' \| 'line-items' \| 'invoices'` on the existing door; `JobsStagesTab` wires them to `jobDetailModal.openJobDetail` / `tryOpenEditJob({ focusRow, initialTab, fixturesSectionHighlight })` |
| `JobFormModal` / `JobFormFocusRow` | focus rows for the lien facts (v2.3697) | + `'status'` (the stepper) and `'pct'` (the percent field), expanded and ringed the same way |
| Tests | `GcOnNoticeModal.render.test.tsx` | + the groups and the head line; J372's chip reads *Waiting, but 80% done and a bill out*; the chip calls `onOpenEditJob` with `'status'`; a row click calls `onOpenJob`; a line click passes `'line-items'`; the kernel test pins the seven readings on these 22 jobs |
| Docs | guide *send lien notices from the Lien desk*, `GLOSSARY.md` → Put a GC on notice | the band and its doors |

One PR, size S. No migration — every read is a table the Pipeline already reads under the same RLS.

## Verify

Open the run on ZZ TEST GC (BP398's GC; or RMC- Dudley Mason read-only): the band groups every job
Step 1 lists under Waiting / Working / Billed with the counts in the head line; J372 wears *Waiting,
but 80% done and a bill out → Status ▾*, J651 *set % done* in red, J305 *$13,860 done, not billed*;
click J372's chip → the Job window opens on Edit with the status stepper ringed, over the run window;
✕ → the run window is where it was, scroll and all; on the test GC move a job to Billed and ✕ → it
regroups under Billed with a quiet ✓ and its Step 2 claim reads the new balance; click "Plumbing Per
Plans" → the window opens on Bill at ① Line Items.
