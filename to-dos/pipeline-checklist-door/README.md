---
name: "A checklist door on the Pipeline row: the office sees each stage's progress on the board and manages the list from there"
number: 246
group: ready
status: asked 2026-11-02 on the Pipeline's screenshot; thought through and mocked up the same day; nothing built
summary: >
  The Pipeline row's only sign of a stage checklist is an amber ☐ before the stage's name under
  the bar, with the count hidden in a hover. The owner wants an entry point on the row, in the
  icon strip under Edit, where the office sees progress and manages the lists without opening the
  job window. One icon with the count, toned by standing, opening a sheet beside the row: each
  stage with its bar and count, the open rows, answer in place, add a check, skip, and the door to
  the Documents read-out.
next: PR 1, the door and the sheet. Useful on its own.
size: S as a train of two (S · S); no migration; no edge function
blocker: none
ver: v2.6328 · 6347 · 6087 · 6084
opinion: now — the owner's own words on the board were "we don't currently have the tools … to look at checklist"; the board is where the office looks
mockup: to-dos/pipeline-checklist-door/mockup.html
---

# A checklist door on the Pipeline row (#246)

## The ask

The owner, 2026-11-02, on the Pipeline's screenshot with the row's icon strip under **Edit**
outlined (the strip of v2.4324's row actions: the test report, the liens, the release, the job
folder, the AIA workbook, the hazmat fee, the plans):

> I would like an entry point to the checklist on jobs here where the office can see progress and
> manage, what could this look like?

## The thinking

**What the board shows today.** v2.6087's mark: a stage with a question left reads *☐ 3 Trim* in
amber in the names row under the bar, the count only in the title on hover, nothing at all once
filled, nothing on the phone card. The count behind it is already read once per board load
(`useStageChecklistStates`, the company's questions, the board's job items and skips, the answers).
What the office does about it is three presses away, in the job window's Documents tab.

**The door.** One icon in the row's action strip, after the plans: a checklist mark with the
count beside it, toned by the job's standing across its stages:

- amber *☐ 3/6* while any stage has a question left, the title reading *Checklists · Trim Set 3 of
  6 · Rough In filled · Top Out filled*;
- green *✓* once every stage with a list is filled;
- grey *☐* on a job whose stages have no questions yet, so the office can add the first;
- not drawn on a job with no stage that takes a checklist (a service call).

The phone card gets the same icon in its shortcut row. The name mark under the bar stays, and
becomes a press to the same sheet, so a glance and a press meet in one place.

**The sheet.** Pressing the door opens *Checklists on JP1088* beside the row (a
`ResponsiveModalShell`, the phone's bottom sheet), the read-out the Documents tab draws
(`JobDocumentsChecklists`, v2.6328, v2.6347) with one difference: each row of a stage carries the
three presses, so the office answers in place under their own name, as they may on the strip's
sheet. Each stage: the name, the chip *Not ready · 3 of 6*, a thin bar, the open rows first with
Yes · No · Not here, then the answered rows as statements with their stamps; *+ Add a check for
Trim Set*, *Skip on this job* and *Take off* as Documents has them; **Open on the job** at the foot
to the Documents tab for the rest. One read, the strip's own, so a press here moves the board's
icon at once through the change bus. The board's count re-reads on the sheet's close.

**A column, not a filter.** The board's sections keep their order; a chip in the board's search
bar, *Checklist left · 4*, narrows the board to the jobs with a question left, the way the hidden
groups chip reads. The office asks "what is holding Trim Set on these jobs" more often than it
asks for one job.

**Is that the best we can do?** Weighed and left out:

- A column of its own with a bar per stage: the row is already full, and the bar under the stage
  names is the stage's money. The icon with a count says enough until the sheet opens.
- Answering from the row itself, inline: the row would grow by a question per stage; the sheet is
  one press away and keeps the row readable.
- A push to the office when a stage flips to not ready: #245's *Send to Dispatch* is the crew's
  way to raise a hand; a mark that flips on its own is noise on a board with thirty working jobs.

## Where it plugs in

What exists: the row's action strip `StagesRowActionButtons.tsx` and the phone card's shortcut
row; the mark `stageChecklistMarks.ts` and `StagesStageBar.tsx` (v2.6087); the board's read
`useStageChecklistStates` and the shared context's `checklistMarksFor(job)`; the read-out
`JobDocumentsChecklists.tsx` and the sheet `StageChecklistSheet.tsx` over `useJobStageChecklists`
with its change bus (v2.6328, v2.6347); the hidden-groups chip in the board's search bar.

What is new: the kernel `pipelineChecklistDoor.ts` (the job's standing across its stages from the
marks, the icon's tone and count, the title's words, the chip's count); the icon in the strip and
on the card; the sheet, lifted from the read-out with the presses on; the mark as a press; the
*Checklist left* chip; the guide.

## The plan

1. **PR 1 · the door and the sheet** (S). The kernel with its tests, the icon in the strip and on
   the phone card, the sheet with answer in place, add, skip and take off, **Open on the job**,
   the name mark as a press, the guide *see every checklist on the Pipeline* (Office).
2. **PR 2 · the board's chip** (S). *Checklist left · N* in the board's search bar, narrowing the
   sections to the jobs with a question left; the count in the row's title.

## How to verify

On the dev server as the dev, prod data, nothing written outside ZZ Test rows: on the Pipeline
read the ZZ Test job's row with its stages: the icon reads grey *☐* with no question; add a check
on the Documents tab and read amber *☐ 0/1* on the row; press it, read the sheet with the row's
three presses, press Yes and read the icon turn green without a reload; press **Open on the job**
and land on Documents with the stamped row. Delete every ZZ Test row after.

## Where it stands

2026-11-02: asked on the Pipeline's screenshot, thought through and mocked up (`mockup.html`: the
row with the door, the sheet beside it, the phone card). Nothing built.
