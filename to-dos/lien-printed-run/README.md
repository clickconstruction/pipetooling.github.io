---
name: "Lien desk: take back a printed run, and a Do now that reads as one job"
number: 101
group: ready
status: the owner approved the mock-up 2026-10-08 (no leader needed to take back) · PR 1 built v2.4983 (#5044) · PR 2 built v2.4982 on claude/lien-run-row · PR 3 next
summary: >
  The office printed a run of 19 notices, then changed the packet's layout before mailing.
  Printing stamps every notice as in the mail, and nothing takes a whole run back. PR 1 puts
  Take back… on the run window's printed step. PR 2 draws every printed notice as one run row
  on Do now, with the rail counting them. PR 3 puts the leader's approvals first, and the
  office sees them last under the leader's name.
next: Merge PR 1, then build PR 2 (the run row) and PR 3 (only you can approve).
size: S, M, S
blocker: none
opinion: build — PR 1 is a batch of the Back to ready the desk already has; PR 2 reuses the GC row's shape
mockup: to-dos/lien-printed-run/mockup.html
---

# Lien desk: take back a printed run

## The ask

The owner, 2026-10-08: the office did a run, then we changed how the PDF looks, and now she
cannot restart the run. Add a way to take back a run where nobody has entered a tracking
number yet. Then look at the page as a whole and give the user more autonomy.

## What is wrong today

- **Printing is a one-way door.** `markLienDeskItemsPrinted` stamps `printed_at`, the notice
  moves to the printed pile, and the run window opens on step 3 (`runOpening`). The ways back
  are *Print it again* (its hint says lost copy only) or *Back to ready* on each notice
  (`clearLienDeskItemPrinted`, v2.4568).
- **Nineteen rows for one task.** `buildLienNextUp` pushes one `add_tracking` row per printed
  notice, and every one opens the same run.
- **The rail drops them.** `countLienSteps` sets rung 4 from `counts.ready`, so 19 printed
  notices read as *Send the run 0*.
- **The leader's approvals are buried** among the printed rows, sorted by day alone.

## The plan

1. **PR 1, Take back the run.** `LienDeskRunModal`: *Take back…* on the printed step, an inline
   confirm (the count, approvals stand, filed copies stay, typed numbers are dropped), then
   step 1. A batch IO beside `clearLienDeskItemPrinted` that clears only items still printed and
   not sent, and writes `fields.runTakenBack` (`at`, `by`, `printedAt`). The step card reads the
   line. The GC-on-notice window shares the modal and gets it too. Client only.
2. **PR 2, the run row.** `buildLienNextUp`: printed notices fold into one `run` row (the GC
   row's shape), in the group of the earliest day, with *Record the mailing* and *Take back…*
   both opening the run window. `countLienSteps` counts printed on rung 4. The find box still
   finds a job inside the row.
3. **PR 3, only you first.** `groupLienNextUp` takes the viewer: a leader's approvals lead as
   *Only you can approve*; for the office they go last as *Waiting on <leader>*, with no
   button, and leave Do now's count.

## Decided in the mock-up

- Take back lives in the run window. Do now only opens it there.
- Whole run only. One envelope can hold several notices, and a notice has two envelopes.
- Filed copies stay. `sent_documents` is append-only, and they did print.
- The office takes back without the leader (the owner, 2026-10-08), since approvals stand.

## How to verify

Live on the ZZ TEST bid's job is not possible (no printed notices there). Use the desk smoke
(`LienDeskModal.render.test.tsx`) and the run modal smoke, then a look at the live desk without
pressing anything: the printed run of 2026-10-07 is the case.
