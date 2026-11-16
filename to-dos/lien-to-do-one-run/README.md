---
name: "Lien desk To do: one run — get every paper right, then print, mail and file them together"
number: 362
group: gated
status: written 2026-11-14 from a Lien desk session · mock-up redrawn 2026-11-15 with the Board in place (Today, B, A, D) at Taunya's ask · Taunya picked B's direction, B was refined the same day and she gave the go to build it · B is built and live (v2.7367, v2.7371, v2.7372), checked on the live desk 2026-11-15 · the owner leaned to D, not yet picked
summary: >
  The To do tab's Needs you now groups and orders rows by their day alone. Twenty-two rows sharing
  one day fall in no order that means anything, a held paper reads "the property record is not
  complete" without naming the one question, no affidavit row says where its notice stands, no
  desktop row carries dollars, and twelve rows carry the same File button. The owner works liens as
  one run: get every paper accurate and current, then print them all, mail them together and file
  them together. Since v2.7332 the Board is the top of To do and the list is pinned in what is left
  under it, about three rows. The mock-up draws today's desk and three answers with the Board in
  place: B (one page, clearer rows), A (the list follows the Board's bins) and D (one run in three
  steps, opened from the Board's first tile). Each is the start of the next.
next: The pick between stopping at B, going on to A (the list by bin), or on to D (the run). B needs nothing more.
size: M for A alone (step 4); L for D as the five steps left (M · M · M · S · M); B, the first three, is built
blocker: The pick. For D's single print, whether notices and affidavits can come out of one print run.
ver: v2.4583 · v2.6515 · v2.7247 · v2.7367 · v2.7371 · v2.7372
---

# Lien desk To do: one run (#362)

Mock-up: [`mockup.html`](./mockup.html), served at `/to-dos/lien-to-do-one-run/mockup.html` on the dev
server. Tabs switch between **Today**, **B**, **A** and **D**, each drawn with the Board on top; D has
three states of its own (*Before*, *Ready to print*, *After the print*) and the Board's chips move with
them. A link can open on a drawing: `#today`, `#a`, `#d-ready`, `#d-after`, with `-dark` for the dark
theme. Sample jobs (ZZ names) and made-up figures only.

## The ask

The owner, 2026-11-14, looking at the Lien desk's To do with 22 rows under Needs you now, all due the
same Monday: one affidavit row said *the property record is not complete* and *ready to lien* on a job
that had never had a notice. "Take a look holistically at how the needs you now is generated and help
me come up with a better way to present it." Then, on the mock-up: "the way I want to do liens is I
want to get all the information accurate and current and then I want to print them all in a batch and
mail them all together and file them all together."

That job needed no notice (contracted with the owner, so no § 53.056 notice applies), and its one hold
was an unanswered homestead question. The row said neither.

Taunya, 2026-11-15, with the Board landed (v2.7332) and a screenshot of the list as a strip under it:
the Board "takes up most of the screen but is the most important pane", so redo the mock-ups with it
in place. The first mock-up drew the list alone, under the step strip the Board replaced.

Taunya, later the same day, on the redrawn mock-up: "I like the idea of B but waiting on the leader
should be below needs you above coming up to make it more actionable", and she asked that B be refined
by asking whether it is the best we can do. What that changed is under B below. On the refined B:
"Waiting on the leader should be above on track", and then the go to build all of B.

## What exists today

- `buildLienNextUp` (`src/lib/jobs/lienNextUp.ts`) folds the desk's queues (notices, affidavits,
  retainage, letter two, liens filed and not served) into one row per paper, each with one action.
- `groupOf` puts a row in Needs you now when its day is within `LIEN_NEXT_UP_NOW_DAYS` (7) or past;
  `compareRows` orders by the day, then by the row's key. Rows sharing a day fall in key order.
- `groupLienNextUp` draws the groups: the leader's sign and approve groups first, Needs you now,
  Reminders, Coming up, then Waiting on the leader.
- Approved notices already fold: one run row per GC (`send_run`) and one row for every printed notice
  (`record_mailing`). Affidavits do not fold.
- The affidavit row's hold is `fix_property` with *Affidavit · the property record is not complete*,
  whatever the gate. `gateAct` in `src/lib/jobs/lienActWords.ts` already words each gate on its own
  (*Answer the homestead question*, *Add the GC's address*…), and the To do row does not use it.
- The step popover (`src/lib/jobs/lienNextUpSteps.ts`) says *The office drafts it from the notice
  already sent* on every affidavit, true or not.
- `src/components/jobs/LienDeskNextUp.tsx` draws the rows. The phone layout already carries dollars
  (`lienPhoneGroups`); the desktop row does not.
- The Board (`LienBoard.tsx` over `lienBoard.ts`, v2.7332) is the top of To do: four tiles, then the
  notices' and the affidavits' bins with a chip a job. It orders the papers by stage; the list under it
  orders the same papers by day. A bin's head narrows the list.
- The list is pinned under the Board as its own scroller (`lienDoNowFrame`'s `pinned`). Measured on prod
  data, 2026-11-15: the Board is 577 px tall at 1440 × 900 and the list 127 px; at 1024 × 768 the list
  is 32 px and starts below the bottom of the screen. The frame goes to one page only when the Board's
  columns stack, under 760 px.

## The three answers (in the mock-up)

Each keeps the Board whole and is the start of the next.

- **B · One page, clearer rows.** Taunya's direction. The Board and the list scroll as one page. Once
  the Board is out of view the find box pins to the top with the Board's numbers and **↑ The Board**.
  Needs you now reads in three parts, *Will not make tomorrow as they stand*, *Waiting on the leader*,
  *On track*, and *Coming up* follows. What asking "is this the best we can do" changed:
  - **The papers that will not make their day come first** inside Needs you now, under the tile's own
    words (*Will not make tomorrow as they stand*), the longest road first; the rest read *On track*,
    largest first. This turns the first drawing's "ready before held" around: a paper that needs a
    fact needs it today to ride with the rest, which is the owner's "get it accurate, then print".
    The rule is the Board's own (`lienBoardAtRisk`, the **!** chips), so the tile, the chips and the
    list agree.
  - **Waiting on the leader is a group a person can act on**: each row says when it was sent for
    approval and how long it has waited, and the head carries **Remind the leader of N**, which sends
    again what the approval went with (`tellLeaderOfLienApproval`, the push and the email).
  - **One vocabulary.** A row starts with its bin's name (*Ready to file*, *To send*, *Needs the
    owner*, *Needs the property facts*, *In the run*, *Awaiting approval*), then the one thing to
    know. A paper that waits on a fact asks its one question, on the row and on its button.
  - **The head carries the day**, as the phone's list does (`lienPhoneGroups`), so no row repeats it.
    The row is two lines and no job name or state is cut off, which today's one line does at 950 px.
    The four step dots leave the desktop row: the bin's name says the stage.
  - **The Board's numbers are presses**: the tile's red line narrows the list to the papers that will
    not make their day, the waiting tile to the approvals, and the pinned find box carries the same
    presses. What the list is narrowed to reads on the pinned line, with **Show every row**.
  - **One press for the ten**: *On track* carries **Print the N affidavits**, a door to the batch
    print that exists. The ten rows stay, each with its own button; folding them is A.

  Every row carries dollars, and every affidavit says where its notice stands (*Notice sent Oct 14*,
  *No notice needed · contracted with the owner*, *No notice on record*).
- **A · The list follows the Board.** Under the Board the list is drawn in the Board's order: one group
  for each bin, under the bin's name, tomorrow's papers first and everything later under one line. A
  pressed bin goes to its group. Papers that share one act fold into a batch row with a total and one
  button (*10 affidavits ready to file · Print 10*), so sixteen rows become seven.
- **D · One run.** The owner's way of working, opened from the Board's first tile (*21 by tomorrow*),
  as three steps in order under the Board:
  1. **Get it right.** The tile’s red line, *7 will not make tomorrow as they stand*, written out as one
     checklist counting down: an unanswered homestead question, a missing owner or GC address, a month
     dated from when the job was typed in, a notice written and not sent for approval, an approval
     waiting, an *ask the attorney first* flag. Each is one question with the chips it holds, its own
     button and **Leave out**, so one stuck paper never holds the run.
  2. **Print the run.** One button, live only when step 1 reads zero or everything left is left out.
     It says when every paper was last right and the stack's order (help sheet, notices by contractor,
     affidavits by county clerk), and names what was left out with a way to put it back.
  3. **Out the door.** Mail (every envelope's number, one window) and File (affidavits grouped by
     county clerk, then the copies owed to each owner within five days).

  The chips move on the Board as the run moves: settled papers gather in *In the run* and *Ready to
  file*, a paper left out turns dashed where it stands. After the print, a paper whose record changed
  turns amber on the Board and says what changed (*a payment came in; the affidavit says X and the
  record now says Y*) with Reprint, It stands, or Take it out. A tally line keeps printed, mailed,
  filed, left out and changed side by side.

The first mock-up's C (ready and held, two columns) is dropped: the Board's bins already split what is
ready from what waits on a fact. The owner liked A most of the first four, then asked whether it could
go further toward the batch; D is that. He has not picked between A and D.

## A train for D

1. **One page** (S), built, v2.7367: To do scrolls as one page wherever the Board leaves the list under
   320 px, and the find box pins with the Board's numbers, each a press, the line that says what the
   list is narrowed to, and the way back. A screen tall enough for both keeps the Board put.
2. **The order** (S), built, v2.7371: inside Needs you now, the papers the Board marks **!** first, then
   *Waiting on the leader* with its reminder press, then the rest as *On track*, largest first; the
   tile's red line as a press. `lienNextUp.ts` over `lienBoard.ts`, with `lienLeaderReminder.ts`.
3. **The clearer rows** (S), built, v2.7372: the bin's name first, the one question from `gateAct`, the
   notice line on every affidavit row, dollars on the desktop row, the day on the head
   (`lienRowWords.ts`). The bin's name opens the card the four dots opened, and a row with no bin keeps
   its dots. With step 2 this is B.
4. **The list by bin** (M): the groups under the Board's own names and the batch rows. This is A.
5. **The checklist** (M): step 1 as a kernel over the desk's queues, every open question with its
   button and a *Leave out* that the run remembers.
6. **The gate and the one print** (M): step 2. Needs the answer below on printing notices and
   affidavits together.
7. **Changed since printed** (S): a fingerprint of each paper's sworn fields at print, compared on
   every read after.
8. **Mail and file** (M): step 3's two cards and the tally, over the record steps that exist today.

## Open questions

- **One print for both kinds.** Today notices print from the run window and affidavits from the
  Affidavits list's batch print, each with its own help sheet. Can one run carry both, or does D keep
  two stacks under one gate?
- **Which run.** The desk's lien month cards (Reminders 1 to 5, Notices 6 to 9, Liens 10 to 13, the
  15th) already describe a monthly rhythm. A run is probably "everything due by this cycle's 15th".
- **Leave out.** A paper left out of this run: does it roll to the next run by itself, or wait on a
  person?

## Related

- #353: print a picked set of affidavits, and say why a job with a recorded notice still owes one. D's
  *Leave out* and its one print answer the first half from the other side.
- #354: a started paper stays on the desk whatever its day. D's run needs it, or a paper drafted early
  vanishes from the run.
- #356: the affidavit's months line on a job whose notice names other months. One of D's step 1
  questions.

## How to verify

- Open the mock-up on the dev server and walk the tabs, D's three states, light and dark; scroll B
  until the find box pins, and press a bin's name in Today, B and A.
- B, on the live desk: scroll To do until the find box pins; read *Needs you now* in its three parts;
  press the first tile's red line and *Show every row*; point at a row's bin name for its card.
- When A or D is built: kernel tests over a desk with ready, held, approved and printed papers due the
  same day; then a ZZ test run walked end to end before a live one.

## Where it stands

B is built and live: steps 1 to 3 of the train, v2.7367, v2.7371 and v2.7372, each with its fragment in
`docs/recent-features/`. Checked on the live desk on 2026-11-15, read only: 38 of 38 rows in two lines
with no job name cut off, eight rows at risk matching the Board's eight marked chips, three waiting
with the reminder press, twelve on track, the day on the head, the notice line on every affidavit row.
The reminder press was never pressed on a live paper: it messages the leader, and its smokes cover it
with the sends mocked.

A (step 4) and D (steps 5 to 8) are not started and wait on the pick. The mock-up still draws all
three; its B is what shipped, but for two things the build changed: the bin's name stands where the
mock-up dropped the four dots, and *Print N affidavits ›* opens the affidavits list at Ready to file
and does not print from To do.

The owner asked for this card on 2026-11-15 so another session can pick it up; the same day the Board
landed, Taunya had the mock-up redrawn with it in place, picked B and had it built.
