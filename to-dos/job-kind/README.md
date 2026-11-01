---
name: "A job's kind: service call or project, read from the job's own facts and settled by one press, so the baseline, the checklists, the line and the reports stop guessing from the customer"
number: 238
group: ready
status: thought through 2026-11-01 with the owner, read against jobs_ledger's columns, the Stage Plan, the customer's Res/Comm and the service types; one mock-up; nothing built
summary: >
  The app has no job kind. It has four signals that each say part of it: an HCP number against a
  Click number, a bid or a GC project behind the job, Stage Plan rows, and the customer's
  Res/Comm. Punch list #234 planned to gate the hours baseline on the customer's kind, which
  misfires both ways: a restaurant's clogged drain is a service call for a commercial customer, a
  custom home's rough-in is a bid project for a residential one. This card gives a job one kind,
  service call or project, read from the job's own facts by one kernel, settled by one press on
  the New Job form, backfilled by a Quickfill deck line, and shown as a chip; and points #234's
  gate and #237's "projects only" at it.
next: PR 1, the kernel and the column with the form's press and the chip. Useful on its own; nothing waits on a call.
size: S as a train of two (S · S); one migration; no edge function
blocker: none
ver: v2.3297 · 3417 · 2927 · 4958 · 6072 · 6077 · 2145 · 5837 · 3055
opinion: now, before #234's PR 1 and #237's PR 1 build their gates on the customer's kind
mockup: to-dos/job-kind/mockup.html
---

# A job's kind (#238)

## The ask

The owner, 2026-11-01, after the stage-checklist walk:

> How can I better differentiate when a job is a service call versus a job being a commercial
> construction project that we bid?

Later the same day he named the cut himself:

> Service calls, we don't know how much to bill until the very end. While projects coming from
> bids or estimates or even oral conversations, we know how much they are gonna cost before we
> start, but we can sometimes add change orders along the way, based on things we find.

So the kind is **when the price is known**. A project is priced before the first hour is worked,
from a bid, an estimate or a handshake the office typed in, and its price moves only by change
orders. A service call is priced by the work: the tech finds what is wrong, does it, and the bill
is the sum at the end, or a price-book line he picks on site, which from the office's chair is
still known at the end of the visit. Because a project's price is known before, its hours and its
labor budget can be known before too, which is why #234's baseline at award and #237's checklists
and records mean something on a project and nothing on a service call.

## The mock-up

`mockup.html` beside this card, made-up names and figures: the New Job form's two-press control
with its default and the reason under it; the chip on the job window's header and on the board's
rows; the Quickfill deck line *jobs working with no kind* with its presses; and the Settings
card's one line that says what the kind feeds.

## The thinking

**What the app records today, and where each signal lies.**

- `jobs_ledger.hcp_number` against `click_number`: an HCP number means the job came through
  Housecall Pro, the service side; a Click-only number means it was made in the app. Older
  construction jobs were imported from HCP too, and a service call made in the app has no HCP
  number.
- `jobs_ledger.bid_id` and `project_id`: set, the job is construction we bid or a GC project we
  build (the billing-only job, v2.4958). A T&M commercial job without a bid has neither.
- Stage Plan rows, `jobs_ledger_fixtures`, the stages the Pipeline reads as Rough In · Top Out ·
  Trim Set (v2.3417, windows v2.2927) and the stage checklists hang off (v2.6072, v2.6077):
  stages mean construction; a service call never has them; a construction job may not have had
  its stages typed yet.
- `customers.customer_type`, Res/Comm: the customer's business, not the job's.
- `service_type_id` is the trade, Plumbing, HVAC, General contracting. It is not the kind.

**One kind, read from the job's own facts.** A pure kernel, `jobKind(job)`, with precedence: the
office's explicit kind when set; else a contract amount on the job before its first clock
session → *project* (the owner's own test: the price was known before the work); else `bid_id`
or `project_id` set → *project*; else Stage Plan rows exist → *project*; else an HCP number with
none of those, or an amount that first appears at billing → *service call*; else *not set*. The
bid, the GC project and the stages corroborate the one fact rather than stand as rules of their
own, and the oral agreement stops being an edge: the office typing the price is what makes it a
project. One source every reader uses, so a reader never re-derives it from a column of its own.
The Glossary gives the two kinds their honest names: a project is a **priced job**, a service call
is **time and materials**; the chips keep the words the crew uses.

**One press to settle it.** A nullable column, `jobs_ledger.kind` (`service` · `project`). The
New Job form asks it as a two-press control defaulted from the signals with the reason under it
(*Project · priced $112,000 from bid B917*; *Service call · priced when done*), so a T&M commercial job gets its kind
by one press at creation and nothing else changes for a job the signals already settle. Edit Job
carries the same control. A Quickfill deck line, *jobs working with no kind*, lists the jobs the
kernel reads *not set*, newest first, with the two presses and *Skip*, the way the baseline deck
line of #234 and the cleanup deck of v2.2145 work; Needs you review (v2.5837) can stamp the ones
whose signals are plain.

**A chip, not a column.** The kind reads as a chip on the job window's header, *Service call* or
*Project*, and on the Jobs board's rows, with a filter on the board. The Pipeline's Stages board
shows projects only, which is roughly what it does today by accident of the stage rows.

**What then stops guessing.** #234's hours baseline at award and the superintendent's line and
score: projects only, by the kernel, instead of the customer's kind. #237's stage checklists and
their records: projects only, since a service call has no Rough In. Pay applications and draws.
The labor book's calibration (`job_budgets` kind `bid`, v2.3297). Reports that split service
revenue from construction revenue, which today lean on the HCP-number heuristic. Each reader
changes one predicate; none of those changes is this card's.

**Guard rails.** The explicit kind wins over the signals, so the office's press is never undone
by an import. A job with no kind is not hidden from anything that shows jobs today; only the
readers that gate on *project* leave it out, and the deck line names it. A sub labor sheet's job
(v2.3055) and a billing-only job (v2.4958) take the kind of the job they point at.

## Open questions

Two the build will meet, neither the owner's:

1. **A warranty call on a finished project** is a service call that should link back to its
   project. That is a parent link, not a kind; later, if the reports want it.
2. **A "small commercial" T&M job with no bid** is whichever the office presses. The deck line
   shows the signals it has; the press is the answer.

## Where it plugs in

What exists:

- `jobs_ledger` with `hcp_number`, `click_number`, `bid_id`, `project_id`, `service_type_id`;
  `jobs_ledger_fixtures` (the Stage Plan); `customers.customer_type`; `service_types`.
- The New Job form and Edit Job (`src/components/jobs/JobFormModal.tsx`), the job window's header
  (`JobWindowModal.tsx`), the Jobs board and its filters.
- Quickfill's deck lines and Needs you review (`src/lib/quickfill/`, v2.2145, v2.5837).
- The readers that will gate on the kind: #234's baseline and line (`src/lib/jobs/jobBudget.ts`,
  `jobCostsVerdict.ts`), #237's checklists (`src/lib/jobs/stageChecklist.ts`), the Pipeline's
  Stages board.

What is new: `jobs_ledger.kind`; the kernel `src/lib/jobs/jobKind.ts` and its tests; the form's
control; the chip and the board filter; the deck line; the guide; the Glossary's *Job kind*.

## The plan

1. **PR 1 · the kind** (S). The migration (`SET lock_timeout = '3s';`, additive, no table), the
   kernel with tests over every precedence case, the New Job and Edit Job control with its
   default and reason, the chip on the job window and the board rows, the board filter, the
   Glossary entry, `PROJECT_DOCUMENTATION.md`, the guide *say whether a job is a service call or a
   project*.
2. **PR 2 · the deck line** (S). *Jobs working with no kind* on Quickfill with its presses and
   Needs you review's stamp for the plain ones; a read on the dev server of how many jobs it
   lists.

Then one-line PRs where the readers gate: #234's PR 1 and #237's PR 1 read `jobKind` instead of
the customer's kind, each in its own train.

## How to verify

On the dev server as the dev, prod data, nothing written outside ZZ Test rows: make a ZZ Test
job with a bid behind it and read *Project* on the form and the chip; make one with an HCP
number and nothing else and read *Service call*; make one with neither, read *not set*, press
*Project*, read the chip and the board filter; open Quickfill's deck line and read the count.
Delete every ZZ Test row after.

## Where it stands

2026-11-01: thought through with the owner and mocked up; nothing built. PR 1 waits on nothing.
