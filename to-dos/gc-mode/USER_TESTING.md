---
name: "GC mode: what the testers tell us"
parent: to-dos/gc-mode/PLAN_2026-10-07.md
status: started 2026-10-07 by Helper 7 at the lead's ask · empty until the first door opens (door 1, New project, day 1)
summary: >
  Every note a tester gives about GC mode on prod lands here, with the day it came, the lane it
  belongs to and where it stands. Each morning Helper 7 routes the night's new notes to a helper by
  name and sends the lead the list; the lead decides what jumps the queue.
---

# GC mode: what the testers tell us

**How a note gets here:** a tester tells Grace or the lead, and one of them relays it to Helper 7,
who adds the row. The tester never writes this file.

## How a row reads

- **Date**: the day the tester said it, as `2026-10-08`.
- **Tester**: who said it, by first name.
- **Lane**: Schedule, Board, Portal, Building, Owner Billing, New project, or Doors (who can open
  what). *Not sure* until the morning triage names one.
- **Note**: what the tester said, as close to their words as the relay allows, and the page it was on.
- **State**: one of the states below.
- **Helper**: who has it, by name (Helper 1 to Helper 7), from the morning triage on.

## The states

- **New**: in the file, not yet routed.
- **Routed**: the morning triage gave it to a helper and the lead has the list.
- **Building**: the helper has a PR open. Its number goes in the note.
- **Live**: the fix is on prod.
- **Checked**: the tester saw the fix and said it works.
- **Owner's call**: it changes what GC mode does, so it waits on the owner.
- **Not a change**: it works as meant. The note says why, in a sentence the tester could read.

## The notes

| Date | Tester | Lane | Note | State | Helper |
|---|---|---|---|---|---|

## The morning triage

Each morning Helper 7 reads every *New* row, names a lane and a helper for each, sets it *Routed*,
and sends the lead one list: the helper, the rows, and any that look like the owner's call. A note
that blocks a tester from going on is at the top of the list.

## Status

Started 2026-10-07. No notes yet.
