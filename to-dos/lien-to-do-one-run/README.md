---
name: "Lien desk To do: one run — get every paper right, then print, mail and file them together"
number: 362
group: gated
status: written 2026-11-14 from a Lien desk session · mock-up of four ways in this folder · the owner leaned to D, not yet picked · nothing built
summary: >
  The To do tab's Needs you now groups and orders rows by their day alone. Twenty-two rows sharing
  one day fall in no order that means anything, a held paper reads "the property record is not
  complete" without naming the one question, no affidavit row says where its notice stands, no
  desktop row carries dollars, and twelve rows carry the same File button. The owner works liens as
  one run: get every paper accurate and current, then print them all, mail them together and file
  them together. The mock-up draws today's list and four answers; the owner liked A and asked to take
  it further, which is D, one run in three steps with a gate before the print.
next: The owner's pick between A and D on the mock-up. Then the first PR (the clearer rows), which both share.
size: L as a train of five (S · M · M · S · M) for D; A alone is the first two
blocker: The owner's pick. For D's single print, whether notices and affidavits can come out of one print run.
ver: v2.4583 · v2.6515 · v2.7247
---

# Lien desk To do: one run (#362)

Mock-up: [`mockup.html`](./mockup.html), served at `/to-dos/lien-to-do-one-run/mockup.html` on the dev
server. Tabs switch between **Today**, **A**, **B**, **C** and **D**; D has three states of its own
(*Before*, *Ready to print*, *After the print*). Sample jobs (ZZ names) and made-up figures only.

## The ask

The owner, 2026-11-14, looking at the Lien desk's To do with 22 rows under Needs you now, all due the
same Monday: one affidavit row said *the property record is not complete* and *ready to lien* on a job
that had never had a notice. "Take a look holistically at how the needs you now is generated and help
me come up with a better way to present it." Then, on the mock-up: "the way I want to do liens is I
want to get all the information accurate and current and then I want to print them all in a batch and
mail them all together and file them all together."

That job needed no notice (contracted with the owner, so no § 53.056 notice applies), and its one hold
was an unanswered homestead question. The row said neither.

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
- The stage strip above the list (Find the owner · Draft · Approve · File it, per lane) counts the same
  papers in a different order than the list draws them.

## The four answers (in the mock-up)

- **A · By the next act.** The list follows the strip: one group per act, and papers that share one
  act and one day fold into a batch row with a total (*12 affidavits ready to file · Print 12*). The
  held paper names its question and its button answers it. Every affidavit row says where its notice
  stands: *Notice sent Oct 14*, *No notice needed · contracted with the owner*, *No notice on record*.
  Dollars on every row and batch.
- **B · Same list, clearer rows.** One row per paper; within a day, ready before held, then largest
  first; dollars; the named hold; the notice line. The smallest change. Its row changes are part of A.
- **C · Ready and held.** Two columns: what can be pressed now, and what waits on an answer with who
  can give it.
- **D · One run.** The owner's way of working, as three steps in order:
  1. **Get it right.** One checklist of everything not yet accurate across the run's papers, counting
     down: an unanswered homestead question, a missing owner or GC address, a month dated from when the
     job was typed in, a notice not on record, a claim that moved, an approval waiting, an *ask the
     attorney first* flag. Each is one question with its own button and **Leave out**, so one stuck
     paper never holds the run.
  2. **Print the run.** One button, live only when step 1 reads zero or everything left is left out.
     It says when every paper was last right and the stack's order (help sheet, notices by contractor,
     affidavits by county clerk), and names what was left out with a way to put it back.
  3. **Out the door.** Mail (every envelope's number, one window) and File (affidavits grouped by
     county clerk, then the copies owed to each owner within five days).

  After the print, a paper whose record changed says so with what changed (*a payment came in; the
  affidavit says X and the record now says Y*) and offers Reprint, It stands, or Take it out. A tally
  line keeps printed, mailed, filed, left out and changed side by side.

The owner liked A most of A to C, then asked whether it could go further toward the batch; D is that.
He has not picked between A and D.

## A train for D

1. **The clearer rows** (S): the named hold from `gateAct`, the notice line on every affidavit row,
   dollars on the desktop row, and within a day ready before held, then largest first. A needs this too.
2. **The checklist** (M): step 1 as a kernel over the desk's queues, every open question with its
   button and a *Leave out* that the run remembers.
3. **The gate and the one print** (M): step 2. Needs the answer below on printing notices and
   affidavits together.
4. **Changed since printed** (S): a fingerprint of each paper's sworn fields at print, compared on
   every read after.
5. **Mail and file** (M): step 3's two cards and the tally, over the record steps that exist today.

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

- Open the mock-up on the dev server and walk the tabs, D's three states, light and dark.
- When built: kernel tests over a desk with ready, held, approved and printed papers due the same day;
  then a ZZ test run walked end to end before a live one.

## Where it stands

Nothing is built. The mock-up is the whole of the design so far. The owner asked for this card on
2026-11-15 so another session can pick it up.
