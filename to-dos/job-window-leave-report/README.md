---
name: "Leave Report from the job window"
number: 135
group: close
status: SHIPPED 2026-10-20 — v2.5688 (#5929) on main: the ＋ Report chip in the pills' own family right after Reports, the owner's pick after one redraw ("it should blend in better"); delete the folder once it is seen live
summary: >
  The job window's Job tab shows the activity feed with a Reports pill and the job's percent,
  but leaving a report from here takes two hops: the Reports box lower in the pane opens the
  job's reports list, whose Add additional report button opens the form. This to-do puts one
  ＋ Report chip in the activity header's filter row, in the pills' own family right after the
  Reports pill, opening the same per-job form (with the lines list on a multi-line job since
  v2.5663), and refreshes the feed, the pill's count and the percent readout when the report
  saves.
next: See it live on any job's window (Jobs → Pipeline → a job → the activity list's ＋ Report), then delete the folder.
size: XS
blocker: None.
opinion: your call — the code is done; a look at it live is all that is left
mockup: to-dos/job-window-leave-report/mockup.html
ver: v2.5663 · v2.5688
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

## The proposal — a chip in the pill family, right after Reports (recommended)

- **Where**: in the filter row itself, right after the *Reports* pill: **＋ Report**, a chip of the
  pills' own height, radius and weight, blue words with a plus so it reads as an act, its hairline a
  shade bluer (the mock-up's state 2). The row reads *Reports · ＋ Report* — the filter, then the
  door — and *Reports 3 · ＋ Report* on a job with reports. On a phone the row wraps as it does
  today. The house already pairs an action chip with filter pills this way: *+ bid note* beside
  *All | Bid | Customer* on a bid's notes strip. The chip's hover word and accessible name are
  *Leave Report*, the Dashboard's label. The *Reports* box in the date band stays as the door to
  the list.
- **What it opens**: `AdditionalReportModal` for this job, over the window (`overlayZIndex` above
  the pane's 1100), the same form the reports list opens — so a multi-line job shows *How far
  along is each line?* and a one-line job the slider.
- **After a save**: the feed reloads and the new report sits at the top as a *REPORT* line (the
  author, the type, the *Stage progress* sentence when there is one); the *Reports* pill's count
  moves up and the pill wakes from quiet text if it was empty; the percent readout follows the
  report (*43% complete · crew report Oct 20*); the date band's box reads *N reports*. The Dashboard
  and the Pipeline follow the way they do for any report (`propagateReportPctToJob`).
- **Who sees it**: whoever can see the window and may leave a job report (`canLeaveJobFieldReport`,
  everyone with a role), the gate the Dashboard's buttons use.

## Two other ways to blend it in (drawn, not recommended)

- **B — a link in the percent readout**: *100% complete · set by office · ＋ Leave report*, the idiom
  of *Set % complete*, a text press. It blends completely and is easy to miss: the readout is a fact
  line, and a door in it reads as part of the fact.
- **C — an icon in the window's top row**: a clipboard beside the paper and the share arrow, in the
  same stroke. It blends with the other doors, and needs its hover word to say *report*; the icons in
  that row open places, and a report is an act.
- A second line inside the date band's *Reports* box was also considered: the box is a scroll away on
  every job and its first line is already the list's door.

## Is this the best we can do?

- The first draft drew an outlined blue button at the row's end. It fought the pills it sat beside —
  a different shape, a heavier line, a label that did not say which pill it belonged to (the owner:
  "it should blend in better"). The chip is the row's own shape and sits by the word it belongs to.
- The label shortened from *Leave Report* to *＋ Report* because the pill before it already says
  *Reports*; the chip's hover word and its accessible name stay *Leave Report*.
- A button inside the note composer (beside *Arrived*, *Leaving*, *Set % complete*) was considered:
  that row is the field's stamps and the office's note; a report has its own form and would make the
  row a third thing wide.
- The empty *Reports* pill today reads as quiet text (*No reports yet* on hover). With the chip
  beside it the quiet pill reads as "none yet, and here is how", which is what it should have read
  all along.

## Decisions for the owner

- **D1 — the door.** Default: the chip after *Reports*. Alternatives: B, the link in the readout;
  C, the icon in the top row.
- **D2 — who sees it.** Default: everyone who may leave a job report, the Dashboard's gate.
  Alternative: the office team only.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The chip | the filter row in `JobThreadNotesPanel` (`filters.map`, the empty-bucket quiet style, the percent readout pushed right) | an `onLeaveReport?: () => void` prop; when given, the **＋ Report** chip right after the *Reports* pill, in the pills' style with blue words and `aria-label="Leave Report"` |
| The form | `AdditionalReportModal`, mounted by `JobReportsModal` | `DetailJobModal` mounts it beside `JobReportsModal` with the same props and `overlayZIndex` over the pane, opened by the button |
| The refresh | `JobReportsModal.handleReportAdded`; the panel's own reload after a note; `fullJob.report_count` | `onSaved` reloads the panel's entries and the job (count, newest report, percent) |
| Tests | `JobThreadNotesPanel` and `DetailJobModal` render smokes | the button renders when the prop is given and calls it; the window opens the form and refreshes on save |

## The plan

One PR: the prop and the button, the mount and the refresh, the two smokes, the release note and
fragment, and a line in the guide *file and review field reports* (the window's door). Docs:
`JOBS_MODALS_ARCHITECTURE.md`'s Job Detail row.

## Where it stands

Built 2026-10-20 as v2.5688 (#5929) the same afternoon it was asked for: the chip as drawn in
state 2, `JobThreadNotesPanel`'s `onLeaveReport`, `DetailJobModal` mounting the form over the pane
with the feed and the job reloading on save, two smokes, the guide's *From a job's window*. D1 the
chip, D2 the Dashboard's gate, as the defaults. This file's first draft landed in #5924 while its
redraw waited on a queued head; this is the redraw.

## How to verify

Open any job's window on the Pipeline (Kane 1043 has two priced lines): the header shows
**＋ Leave Report**; press it, the form opens over the window with the lines list; save; the feed's
top line is the report, the *Reports* pill reads 1, the readout reads the new percent with *crew
report* and today's date; Escape closes one layer at a time (the form, then the window).
