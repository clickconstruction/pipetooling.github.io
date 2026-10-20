---
name: "Leave Report from the job window"
number: 135
group: ready
status: PROPOSED 2026-10-20 — the mock-up is here; the owner picks the placement (A, the activity header, recommended) and says go
summary: >
  The job window's Job tab shows the activity feed with a Reports pill and the job's percent,
  but leaving a report from here takes two hops: the Reports box lower in the pane opens the
  job's reports list, whose Add additional report button opens the form. This to-do puts one
  Leave Report button in the activity header beside the Reports pill, opening the same per-job
  form (with the lines list on a multi-line job since v2.5663), and refreshes the feed, the
  pill's count and the percent readout when the report saves.
next: The owner's pick between A and B, then one PR.
size: XS
blocker: None.
opinion: build — one button, one existing form, one PR
mockup: to-dos/job-window-leave-report/mockup.html
ver: v2.5663
---

# Leave Report from the job window (#135)

## The ask, in the owner's words

2026-10-20, with a screenshot of the job window on *Kane (1043)*: "Can you help me add to this view a
button to leave a report? Let me know what it could look like?"

## Three lenses

**The person's seat.** The office has the job open — the customer, the accounts, the feed — and wants
to write down what happened on site. Today the door is the *Reports* box in the date band lower in
the pane, which opens the reports list, which has **Add additional report**. Two hops and a scroll
for a thing the feed is about.

**The job behind the ask.** The feed already reads reports (the *Reports* pill filters to them) and
the percent readout already says *crew report Oct 20* when a report set it. The window reads
reports well and writes them badly.

**The whole office.** The per-job form exists ([`AdditionalReportModal`](../../src/components/AdditionalReportModal.tsx)):
the Dashboard's job rows, Job Mode, Dispatch Mode and the reports list all open it, and since
v2.5663 it asks how far along each line is on a multi-line job. Nothing new to build behind the
button; the window just needs its own door.

## What exists

- The Job tab is [`DetailJobModal`](../../src/components/jobs/DetailJobModal.tsx) in pane mode;
  its activity panel is [`JobThreadNotesPanel`](../../src/components/JobThreadNotesPanel.tsx),
  whose filter row (`role="tablist"`, *All · Notes · Reports · Status · Billing · Crew*, an empty
  bucket demoted to quiet text) ends with the percent readout (`pctComplete`,
  `PercentProvenanceChip`) pushed right with `marginLeft: auto`.
- The *Reports* box in the date band (`setReportsModalOpen(true)`, *N reports* / *No reports yet*,
  the newest report's who and when) opens [`JobReportsModal`](../../src/components/JobReportsModal.tsx),
  which mounts `AdditionalReportModal` behind **Add additional report** with `jobId`, `hcpNumber`,
  `jobName`, `jobAddress`, `authUserId`, `userRole` and `overlayZIndex`, and reloads its list on
  save.

## The proposal — one button in the activity header (A, recommended)

- **Where**: the right end of the filter row, before the percent readout: **＋ Leave Report**, a
  small outline button in the row's own height (the mock-up's state 2). On a phone the pills wrap
  and the button takes the row's right end under them. The *Reports* box in the date band stays as
  the door to the list.
- **What it opens**: `AdditionalReportModal` for this job, over the window (`overlayZIndex` above
  the pane's 1100), the same form the reports list opens — so a multi-line job shows *How far
  along is each line?* and a one-line job the slider.
- **After a save**: the feed reloads and the new report sits at the top as a *REPORT* line (the
  author, the type, the *Stage progress* sentence when there is one); the *Reports* pill's count
  moves up and the pill wakes from quiet text if it was empty; the percent readout follows the
  report (*43% complete · crew report Oct 20*); the date band's box reads *N reports*. The Dashboard
  and the Pipeline follow the way they do for any report (`propagateReportPctToJob`).
- **Words**: *Leave Report*, the Dashboard's label, so the field and the office press the same
  thing.
- **Who sees it**: whoever can see the window and may leave a job report (`canLeaveJobFieldReport`,
  everyone with a role), the gate the Dashboard's buttons use.

## The other placement (B, not recommended)

A second line inside the *Reports* box in the date band — *2 reports · ＋ Leave Report*. It keeps the
reports' doors together, but the box is below the feed and the customer block, a scroll away on
every job, and its first line is the list's door: two actions in one small box.

## Is this the best we can do?

- An icon in the window's top row (beside the storefront, the envelope, the calendar, the send
  arrow, the paper and the share) was considered: those are destinations, a report is an act, and an
  icon needs a tooltip to say *report*. The words win.
- A button inside the note composer (beside *Arrived*, *Leaving*, *Set % complete*) was considered:
  that row is the field's stamps and the office's note; a report has its own form and would make the
  row a third thing wide. The header, where the *Reports* pill already is, is the one place the word
  *Reports* is already on the screen.
- The empty *Reports* pill today reads as quiet text (*No reports yet* on hover). With the button
  beside it the quiet pill reads as "none yet, and here is how", which is what it should have read
  all along.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The button | the filter row in `JobThreadNotesPanel` (the percent readout pushed right) | an `onLeaveReport?: () => void` prop; when given, **＋ Leave Report** before the readout |
| The form | `AdditionalReportModal`, mounted by `JobReportsModal` | `DetailJobModal` mounts it beside `JobReportsModal` with the same props and `overlayZIndex` over the pane, opened by the button |
| The refresh | `JobReportsModal.handleReportAdded`; the panel's own reload after a note; `fullJob.report_count` | `onSaved` reloads the panel's entries and the job (count, newest report, percent) |
| Tests | `JobThreadNotesPanel` and `DetailJobModal` render smokes | the button renders when the prop is given and calls it; the window opens the form and refreshes on save |

## The plan

One PR: the prop and the button, the mount and the refresh, the two smokes, the release note and
fragment, and a line in the guide *file and review field reports* (the window's door). Docs:
`JOBS_MODALS_ARCHITECTURE.md`'s Job Detail row.

## How to verify

Open any job's window on the Pipeline (Kane 1043 has two priced lines): the header shows
**＋ Leave Report**; press it, the form opens over the window with the lines list; save; the feed's
top line is the report, the *Reports* pill reads 1, the readout reads the new percent with *crew
report* and today's date; Escape closes one layer at a time (the form, then the window).
