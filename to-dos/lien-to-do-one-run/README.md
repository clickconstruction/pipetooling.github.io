---
name: "Lien desk To do: one run — get every paper right, then print, mail and file them together"
number: 362
group: ready
status: written 2026-11-14 from a Lien desk session · mock-up redrawn 2026-11-15 with the Board in place (Today, B, A, D) at Taunya's ask · Taunya picked B's direction, B was refined the same day and she gave the go to build it · B is built and live (v2.7367, v2.7371, v2.7372), checked on the live desk 2026-11-15 · the owner picked D on 2026-11-16, the list by bin first, and one press, one stack for the print · step 4, the list by bin, built v2.7456 · a print at the foot of each Board column, the owner's *Yes, build this* of 2026-11-16, built v2.7470 · the two prints moved under the tiles, v2.7483 · the title bar's run door retired, v2.7490 · the run window redrawn for notices and built, v2.7477 (one count, three steps, one press); the liens' lane is drawn and not approved · step 5, the Get it right checklist with Leave out, built v2.8474 on Diane's word of 2026-11-24, with its one call written to flip · step 6, the one print, built v2.8536 on Diane's two answers of 2026-11-24 (live for what is right; the Board's prints unchanged), merged and live 2026-11-25 (pull request 9814) · six calls on the run's defaults written up for the owner 2026-11-25 and all answered the same day: each stands as built, and the first real press is the office's
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
next: Step 7, changed since printed (S), which also gives an affidavit a printed fact. Its first part needs no call and no migration: the sworn fields on the filed copy, the kernel that compares, and the read of each job's newest filed print. Its three presses wait on two calls, which fields count as sworn on each paper and where *It stands* is kept. Then step 8, mail and file (M). The six calls on the run's defaults are answered, each as built, under *Open questions*. The first real press is the office's, at its own printer, and nobody presses *Print the run* on real papers before that, a guarded press included. A print of the run on a real printer has not been seen.
size: L for D as five steps (M · M · M · S · M); B, the first three, step 4, the list by bin, step 5, the checklist, and step 6, the one print, are built; left: steps 7 and 8 (S · M)
blocker: none
ver: v2.4583 · v2.6515 · v2.7247 · v2.7367 · v2.7371 · v2.7372 · v2.7456 · v2.7470 · v2.7477 · v2.7481 · v2.7483 · v2.7489 · v2.7490 · v2.7559 · v2.8474 · v2.8536 · v2.8589
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
go further toward the batch; D is that.

## The pick

The owner, 2026-11-16, to *how far do we go from here?*: **D, the list by bin first**. A is built
first, as step 4, and stays the list under the Board while no run is open. The run's four steps follow,
each shipped when it is ready. To *may notices and affidavits come out of one print?*: **one press,
one stack**. One *Print the run* button, and the stack comes out as the help sheet, the notices in
envelope order, a divider page, then the affidavits by county clerk for the notary.

## A train for D

Steps 1 to 3 are B and are live. The owner's pick of 2026-11-16 is steps 4 to 8, in this order. Steps 4,
5, 6 and 8 redraw the same list under the Board (`lienNextUp.ts`, `LienDeskNextUp.tsx`), so they go one
after another. Step 7 is a kernel of its own over the papers' fields and can be built beside step 6. A
row's words come from the Board's own names (`LIEN_BOARD_WORDS`), so a rename of a bin reaches the list
by itself.

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
4. **The list by bin** (M), built, v2.7456: the groups under the Board's own names and the batch rows. This is A.
   A kernel beside `groupLienNextUp` puts the rows due by the tile's day in one group a bin, in the
   Board's order, and everything later under one line. Rows that share one act fold into one row with
   a total and one press that exists today: the affidavits ready to file (*Print N for notarization ›*,
   the door of v2.7398), the affidavits to send (*Send N for approval…* on the Affidavits list), the
   papers waiting on the leader (the reminder press of v2.7371). A GC's approved notices and the
   printed notices already fold. A pressed bin goes to its group.
5. **The checklist** (M), built, v2.8474: step 1 as a kernel over the Board's chips and the To do rows
   (`lienGetItRight.ts`), every open question with its row's own press and a *Leave out* the run
   remembers (`lienLeftOut.ts`, the table `lien_run_left_out`, one migration). The call it took is
   under *Open questions*; what the build changed from the drawing is under *Where it stands*.
6. **The gate and the one print** (M), built, v2.8536 (kernels first, pull request 9730): step 2. One
   press, one stack, the owner's answer of 2026-11-16: the notices in envelope order behind their mail
   sheet (`lienRunPacket.ts`, pinned to the run window's own packet by a parity test), a divider page,
   then the affidavits by county clerk behind their help sheet. The two documents share one print job
   with neither redrawn (`lienRunStack.ts`). The notices' print stamps `printed_at` as the run window
   does. The press is live for what is right, where the drawing locked it: see *Open questions*.
7. **Changed since printed** (S): a fingerprint of each paper's sworn fields at print, compared on
   every read after. The first part is built, v2.8589: every lien print's filed copy keeps what the
   paper said, with the kernel that compares and the read of each job's newest print
   (`lienPrintSworn.ts`, `lienPrintsIo.ts`). Nothing on the desk reads it yet.
8. **Mail and file** (M): step 3's two cards and the tally, over the record steps that exist today.

## The two prints on the Board (built, v2.7470; moved under the tiles, v2.7483)

The owner, 2026-11-16, asked whether To do offers good enough tools to print batches. A band between
the Board and the list was drawn and not liked; one line beside the find box was drawn next; the third
drawing split it by the Board's columns, and on that one he said *"Yes, build this"*. Each column ends
in its own print: under the notices *Print and mail N notices* opens the whole run, under the
affidavits *Print N for notarization* prints from To do, each with one line for what it leaves out and
its door. The same pair stands beside the find box once the list is scrolled. Not in it: chips by GC,
ticks on To do's rows, one print job for both kinds (that is step 6).

The same day he asked whether the batches were now easy to reach. At 1,024 by 768 both presses sat below
the first screen, so to *move them up beside the tiles?* he said *"Yes, move them up"*. Since v2.7483
they stand between the tiles and the columns, each over its own column, and the third tile only reads.

Two things he agreed to in direction the same day, both built since:

- ~~**Retire the title bar's run door.**~~ **Done, v2.7490**, on the owner's *"Retire it everywhere"* after he was
  told what else it did: the only way to print the run from By date and By job, and the only sign of the run's
  progress on those views. By job now has no door to the run; a phone's More sheet keeps its row.
  `runDoorPill`, `runDoorTail` and `lienRunPill`, left with no caller, are deleted with their tests.
- **Redraw the run window with D**: drawn, shown to him, approved for notices and built, v2.7477 (*The
  run window* below). His screenshot counted one batch several ways on one screen (15 notices, 16
  built, *of 10*, 9 envelopes, 8 ready and 7 waiting, 10 to print and 5 held). It wanted one total with
  its parts in the same words, or the unit beside each number; three steps on the journey where there
  were six; the *Combine the jobs at one property* box out of the lead; and one primary press for the
  step the run is on. The liens' lane, a fourth step, is drawn and not approved.

## Open questions

- ~~**One print for both kinds.**~~ Answered 2026-11-16: one press, one stack (*The pick* above).
- ~~**Which run.**~~ Answered 2026-11-25, as built. Asked, as one line with the two below it: *"The
  Board's own two prints still take a left-out paper once it is ready, the run's stack order stays as
  built, and "the run" is every paper due by the Board's first tile's day"*. The pick was as built.
  Asked whether every pick on that sheet stands, the answer was *Yes, all picks*.
  Built to the plan's default, the Board's first tile: every paper due by the day that tile counts to, since the run opens from it.
  The desk's lien month cards (Reminders 1 to 5, Notices 6 to 9, Liens 10 to 13, the 15th) describe
  the same rhythm. Steps 5 and 6 both stand on it. The two other answers are *every paper on the desk,
  whatever its day* and *the office picks the day when it opens the run*. A ready paper due later
  still prints from the Board's own prints.
- ~~**Leave out.**~~ Answered 2026-11-25, as built. Asked: *"A paper left out of one run: the next run
  asks about it again, and it does not print until answered"*. The pick was as built.
  Asked whether every pick on that sheet stands, the answer was *Yes, all picks*.
  Built to a default on 2026-11-24 (v2.8474). The question: where is a left-out paper remembered, and does the next run take it by itself? The pick: it is on
  record, with the reason, who and when, so every office seat sees it. The next run neither takes it
  nor leaves it out. It asks about the paper again, first on the checklist, with the old reason, and
  a person answers **Put it back** or **Leave out again**. The two other answers are *it stays out
  until someone puts it back* (a paper can sit out of every run with nobody asked) and *the next run
  takes it back by itself* (a paper left out because the customer was paying prints next month with
  nobody having looked). One function decides, `lienLeftOutStandings`.
- ~~**What Leave out holds back.**~~ Answered 2026-11-25, as built, in the line quoted under *Which
  run*: the Board's own two prints still take a left-out paper once it is ready.
  Asked of Diane first, on 2026-11-24. The run's one print (v2.8536) never takes a left-out paper. The Board's own two prints are unchanged: they
  take every ready paper on the desk, left out or not, so no rule about when a paper may go changed.
  The other answer was that the Board's prints skip a left-out paper too. To keep one ready paper
  from going today, the leader's Hold does it.
- ~~**The gate.**~~ Answered 2026-11-25, as built. Asked: *"Print the run with questions open: it
  prints what is right and says what it held (your drawing shows it locked)"*. The pick was as built.
  Asked whether every pick on that sheet stands, the answer was *Yes, all picks*.
  Asked of Diane first, on 2026-11-24. His drawing locks *Print the run* until every question is settled or its paper left out. The house rule born on this desk
  (v2.5533) says a batch press is dead only when nothing is ready. Built to the rule: the press
  prints what is right, says its count, and names how many it held. With nothing held it reads
  *Print the run*. One function decides, `lienRunPrintPress`.
- ~~**The stack's order and its cover sheets.**~~ Answered 2026-11-25, as built, in the line quoted
  under *Which run*: the run's stack order stays as built.
  His drawing has one help sheet over the whole stack and the notices sorted by contractor.
  Built: the notices lie in the order the run window puts their envelopes in, behind the run window's
  mail sheet, then the divider, then the affidavits by county clerk behind their own help sheet. The
  mail sheet lists the envelopes in the order the papers lie, so a person stuffs them straight down
  the stack. The drawn answer means redrawing two papers that are proven not to move today.
- ~~**Who makes the first real press.**~~ Answered 2026-11-25: yes, the office. Asked: *"The first
  real press of Print the run is the office's, at its own printer"*. The pick was yes.
  Asked whether every pick on that sheet stands, the answer was *Yes, all picks*.
  So nobody else presses *Print the run* on real papers first. A press with the print window held
  shut counts too, and waits for a yes of its own by name.
  The press cannot be kept to a test job: it takes every right paper of the run, and no tick, filter or
  find narrows it. One real press stamps every notice in it printed and files a copy on every job in
  it, and a filed copy is never deleted. It does not ask first, as the run window's own print does
  not. A stamp is taken back with a notice's **Printed** tick. The pick: the office makes it, on the
  next day it means to print the run, after the card has been read on the live desk. The other answer
  was a walk that presses it now on the office's real papers.

## What steps 7 and 8 need

Read in the code on 2026-11-25, with step 6 on `main`.

**Step 7, changed since printed (S).**

- ~~The sworn fields at print ride on the filed copy.~~ Built, v2.8589: every lien print fills the
  filing's snapshot field (`sourceSnapshot`, `src/lib/sent/sentCopies.ts`) with each paper's values
  as it printed. No migration. Five presses file it: the run's one print, the run window, the
  Board's batch and a job's Lien window, notice and affidavit.
- ~~A kernel that compares that snapshot with today's fields.~~ Built, v2.8589
  (`src/lib/jobs/lienPrintSworn.ts`). It keeps every value the paper prints and compares a shorter
  list, `LIEN_SWORN_FIELDS`, so the first call below changes one list and still reads the prints
  already filed. `lienNoticeParted` (`src/lib/jobs/lienNoticeParted.ts`) still compares a notice not
  yet printed to its bills.
- ~~A read of each job's newest filed print.~~ Built, v2.8589 (`src/lib/jobs/lienPrintsIo.ts`). A read
  that fails is never read as nothing printed.
- Not built: anything on the desk that reads it. The checklist does not say *changed since printed*
  yet, and a printed affidavit still counts as to print after a reload. Both follow the first call,
  since the list of fields decides which printed paper reads as the same today.
- A paper printed before v2.8589 has no values kept. It reads as printed with nothing to compare.
- The drawing's three presses on a changed paper: *Reprint*, *It stands*, *Take it out*. *It stands*
  has to be remembered somewhere. That is the one piece that may need a migration.
- Two calls to ask before it is built: which fields count as sworn on each paper, and where *It
  stands* is kept.

**Step 8, mail and file (M).** It goes after step 7, since its tally needs the affidavits' printed
fact.

- The checklist's third card, *Out the door*. Its name is already on the step strip.
- Mail: the notices this run printed, through the run window's own *Mail and record* step, which
  exists (`record_mailing`).
- File: the affidavits grouped by county clerk (`lienAffidavitClerkOrder`, which the batch print
  uses), then the copies owed to each owner, through the Board's presses that exist.
- The tally line: printed, mailed, filed, left out, changed.
- The liens' fourth step, the copies after filing, is drawn and not approved. What goes in that
  envelope is punch list #366 and waits on counsel.

## Related

- #353: print a picked set of affidavits, and say why a job with a recorded notice still owes one. Both
  parts are on main (v2.7268, v2.7269). D's *Leave out* and its one print answer the first half from
  the other side.
- #354: a started paper stays on the desk whatever its day. On main since v2.7261, so a paper drafted
  early stays in the run.
- #335: an approved affidavit a gate closes on moves to Held with the gate's question (its second fix,
  built 2026-11-16). Step 5's checklist reads the same gates.
- #356: the affidavit's months line on a job whose notice names other months. One of D's step 1
  questions.

## The run window (the notices' window built, v2.7477)

Drawing: [`run-window.html`](./run-window.html), served at `/to-dos/lien-to-do-one-run/run-window.html`.
Tabs **Today**, **1 Get them right**, **2 Print**, **3 Mail and record** and **The liens**.

- **What was built**, for notices, v2.7477. The owner's screenshot of 2026-11-16
  counted one batch several ways on one screen. He approved the redraw for notices the same day: "I
  think this run window is great for the notices … I like the run window and think we can build it."
  The window now has one total in notices with its parts in the same words everywhere (ready, wait on
  the signature, held; after the print, ready to record and owe a number), the run's three steps on
  the journey, the rows in groups by part, *Combine the jobs at one property* under More, and one
  primary press for the step the run is on. The count kernel is `src/lib/jobs/lienRunParts.ts`.
- **The presses follow the count.** *Print N notices* prints the ready notices, each whole. A notice
  that waits on a signature no longer keeps the original contractor's envelope out of the packet: its
  copy goes in the next packet's envelope. What each number counts is in
  `docs/recent-features/v2.7477.md`.
- **The liens' lane is drawn and not approved.** He said the liens have one more step, sending the
  copies after filing. The last tab draws it as a fourth step. It answers his question and is not
  built. What goes in that envelope is punch list #366.
- **Left open by the drawing.** Its step 3 lists envelopes; the build keeps one row a notice with a
  box an envelope. Two packets to one contractor printed before either is recorded share one number
  box, as two prints to one address always have.
- **Un-print one notice, built, v2.7481.** Taunya, 2026-11-16: "I clicked printed by accident. Can
  you un-print it?" The owner said to pass it on. A row's Printed tick is a press that asks first and
  puts that notice alone back in *Approved · to print*, and a mark by hand has a one-press undo right
  after. The run's own *Take back…* is still every printed notice.
- **The window says which paper it holds, built, v2.7489.** Taunya counted a property's invoices,
  then its lien affidavits, against an envelope of the notices' run. Both times the envelope was
  right and nothing on screen said why. The head now reads *Monthly notices (§ 53.056), approved and
  not yet mailed*, and says a job whose notice already went and the lien affidavits are not here. A
  row shows the property's street after a job's name that does not say it.
- **The envelope says where the property's other jobs stand, built, v2.7559.** An envelope's card
  ends with one line (*At this property: 1 notice in this envelope · 4 notices sent Oct 14 · 6 lien
  affidavits ready to file*) and a press that opens the property card over the run. Its words are
  the whole-property view's own (`lienPropertyPapers.ts`). The owner picked the shape on 2026-11-16:
  **one line for the envelope**. A contractor's envelope that spans properties gets a single line
  that totals them, with a press a property, not one line a property.
- **Not checked on the live desk.** It was looked at with sample ZZ rows at 1,280, 1,024 and 375 px.

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

Step 4, the list by bin, is built (v2.7456): one group a bin on a computer, the ready affidavits and
the ones to send folded into one row each, and Later under one line. Two things it left: notices to
send do not fold, because the desk has no press that sends several for approval at once, and a pressed
bin still narrows the list and does not scroll to its group. It was looked at with sample rows at
1,280, 1,024 and 375 px, not on the live desk. D's steps 6 to 8 are picked (2026-11-16) and not built.

Step 5, the checklist, is built (v2.8474, 2026-11-24, on Diane's word to build it): one line over the
list opens the run, *Get it right* lists each paper that cannot print as it stands with its row's own
press, *Leave out* takes a paper out of this run with a reason, and the list says who left it out and
when. Four things differ from the drawing. The door is a line under the find box and not the first
tile, whose red line is a press of its own on `main`. Each paper has its own line, where the drawing
folded two notices under one question. No *ask the attorney first* line is drawn, since no fact marks
a ready affidavit that way. And nothing is locked: the gate is step 6, so the Board's prints still
take every ready paper. It was looked at on a harness with made-up papers at 730 and 380 px, light
and dark. Not seen on the live desk: the table is on prod only after the push, and no paper has been
left out there. (Since then the table is on prod, and one notice was left out and put straight back
on the live desk, 2026-11-24.)

Step 6, the one print, is built (v2.8536, 2026-11-24) and merged on 2026-11-25 (pull request 9814,
16:32 UTC). The client deploy of that commit ended in success at 16:48 UTC, and at 17:23 UTC the live
site's Lien desk chunk held the press's words. The checklist's second card, *Print the run*,
prints every paper of the run that is right as one stack and stamps the notices printed. Five things
differ from the drawing. The press is live for what is right and is not locked. No one help sheet
covers both kinds: each paper keeps its own first sheet. The notices lie in the run window's envelope
order, not sorted by contractor. The card does not say when every paper was last right, since nothing
records it. And a left-out paper is named on the affidavits' help sheet, not on the notices' mail
sheet. Each paper prints as it prints alone: in Chromium every word of 28 notice pages and 5 affidavit
pages sat where it sits alone, at printer margins of 0 and 0.4 in. Where a browser cannot give a named
page its own margins the card shows two presses. Not seen: the live desk, a real printer, Safari,
Firefox. No print is recorded for an affidavit yet, so after a reload a printed affidavit still counts
as to print: step 7 is next and gives it that fact.

The look at step 6 is written as a recipe in three parts, and no part is walked yet as of 2026-11-25.
The first reads the card on the live desk and writes nothing. The second presses with the print window
held shut, which proves the office's real papers merge into one stack and writes nothing while the
guard holds. It needs the owner's yes, since without the guard the press is real. The third is the
real press, a real printer and Safari, and is the office's own on a day it means to print.

The six calls on the run's defaults were answered on 2026-11-25, and each stands as built: which run,
Leave out, what Leave out holds back, the gate, and the stack's order. The first real press is the
office's, at its own printer. The words asked and the answer are under *Open questions*. The second
part of the look, the guarded press, is not covered by that answer and is not walked.

The mock-up still draws all three; its B is what shipped, but for two things the build changed: the bin's name stands where the
mock-up dropped the four dots, and *Print N for notarization ›* (*Print N affidavits ›* until v2.7398, renamed to the button it opens) opens the affidavits list at Ready to file
and does not print from To do.

The owner asked for this card on 2026-11-15 so another session can pick it up; the same day the Board
landed, Taunya had the mock-up redrawn with it in place, picked B and had it built.
