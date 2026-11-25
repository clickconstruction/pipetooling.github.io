---
name: "Bills sent: the office adds to and edits the list under How the bill went"
number: 340
group: close
status: asked 2026-11-13 by the owner · the card and the mock-up the same day · he picked Option B, the chips, and took calls 2 to 5 as suggested, the same day · PR 1 (a record keeps its words) in v2.7145 · PR 2 (the list's own table) in v2.7166, migration `20261114060000` pushed 2026-11-14 · PR 3 (the chips and the window) in v2.7167 · Taunya picked Build all three for calls 6 to 8 on 2026-11-15 · R1 (the day offers the day the bill was made) in v2.7349 · R2 (several bills to one person at once) in v2.7350 · R3 (the form reads the record back) in v2.7351 · R1 to R3 read on the live page on 2026-11-15 with nothing saved · walked live 2026-11-24: the list's presses hold on ZZ-named ways and the form reads right, and the write could not be staged, because v2.8445 took test bills out of the yellow box · v2.8540 gives a dev who shows ZZ test jobs a box of test bills · walked again 2026-11-25: the presses hold at 44 px and that box never drew, because the read dropped every bill made in Stripe's test mode · v2.8559 mends the read and stands the form's typed boxes 44 px · the box read on the live site 2026-11-25 on v2.8559: it draws four test bills, the totals do not move, and the form's boxes stand 44 px · left: the write walk on a test bill · seen as the sample assistant on 2026-11-25, through View as: no test box, and every total reads the same as the dev's · the write walk made on 2026-11-25, on a yes for each step: a bill recorded with a ZZ way, the way renamed and the older line kept, two bills in one press, and the arrows moving two ZZ ways against each other, a second ZZ way being the owner's yes of that day · every record and both ways deleted after, read back as gone · every step of the card is now walked
summary: >
  Bills sent has one form, Say how it went…, with a list of four fixed ways a bill can go. The
  owner asked that the people who open the page can add to that list and edit it, and to be shown
  how before anything is built. The page is open to the office only, as he assumed. The card says
  what an editable list must get right: a record keeps the words it was made with, a way is taken
  off and never deleted, and every way counts under Recorded by hand. The mock-up draws the form
  as it is, three ways to edit the list from where the person stands, and three separate fixes to
  the form itself. I suggest the chips.
next: Every step is walked and nothing of the walk is left on prod. The card can close on the owner's word. One line of How to verify was wrong and is corrected: the filter chips carry no count.
size: M as a train of three (S · M · M), then three small ones for the form's own fixes (S each); left: the live walk (S)
blocker: None. The owner's word to close it.
opinion: walk it live, then retire the card
ver: v2.7145 · v2.7166 · v2.7167 · v2.7349 · v2.7350 · v2.7351 · v2.8540 · v2.8559
---

# Bills sent: the list under *How the bill went* (#340)

Mock-up: [`mockup.html`](./mockup.html), served at `/to-dos/bills-sent-how-it-went-list/mockup.html`. The form as it is, three options at a desk and on a phone, the window that edits the list, three separate fixes to the form, and the calls. Option B can be pressed. Every name, job and amount on it is made up.

This card follows [#327, Bills sent](../bills-sent-ledger/README.md), which built the page and the form.

## The ask

The owner, 2026-11-13, with a screenshot of **Say how it went…** open on a bill in the yellow box: a new and improved look in which the people who can open the page can add items to the dropdown and edit its items. He assumes the page is open to the office only. He wants to see how it could be offered first.

## The answer, in short

- **Who opens the page: the office only. He has it right.** Four roles: dev, master, assistant, controller.
- **The list can be made the office's own** with one small table and no change to any record already made.
- **He picked Option B, the chips,** on 2026-11-13, as suggested. One press picks a way, a new way is typed in the form, and nothing covers the next field.
- **A record keeps its words** since v2.7145 (PR 1). Before it, a record kept a code for its way and the screen looked the words up.

## How it works today

Read from the code on 2026-11-13.

| | Where | What |
|---|---|---|
| The four choices | `BILLS_SENT_BY_HAND_HOWS`, `src/lib/billing/billsSent.ts` | A fixed list in code: `handed` *Handed over*, `mailed` *Mailed*, `own_mailbox` *Emailed from a person's own mailbox*, `housecall_pro` *Sent from Housecall Pro*. Only a release changes it. |
| The form | `ByHandForm`, `src/components/billing/BillsSentLedger.tsx` | A native `<select>`, two text boxes and a date that offers today and refuses a later day. `byHandProblem` says what is missing. |
| The write | `recordBillByHand`, `src/lib/billing/billsSentIo.ts` | One insert into `sent_documents`. No copy body. The table's stamp trigger writes who and when. |
| What is stored | `byHandFiling` | `kind = 'bill_by_hand'`, the bill as `source_id`, the job in `job_ids`, the typed name in `recipient_name`, no address. `source_snapshot = { by_hand, how, went_on, note }`, where `how` is the code above. The column `how` gets `hand`, `mail` or `email`. The title carries the words: *Bill · job · Handed over, recorded by hand*. |
| What the database fixes | `20261005173119_sent_documents.sql` | `kind` must look like a code name. The column `how` must be one of `print, email, hand, mail, link, download`. `source_snapshot` must be an object. **Nothing checks the code inside the snapshot.** |
| The words on a line | `billsSentLines` → `byHandHowOf` | Looked up from the code each time the list draws. A code the list does not know reads *Recorded by hand*. |

So **the words were not on the record**, except inside its title: a choice renamed in code would have changed every older record's words with it. PR 1 closed that (v2.7145): a record keeps its words in `source_snapshot.how_label` and `byHandWordsOf` reads them first.

Every reader of the choice takes the same looked-up words (`routeWords`):

- the pill on the line, at a desk and on a phone, and the search box, which finds a line by them;
- the bill's own record at `?bill=<id>` and its print (`recordHead`);
- **Print** and the **CSV** column for how it went;
- the chip **Recorded by hand**, which shows every line whose route is `by_hand`, whichever of the four was picked. A bill recorded as *Sent from Housecall Pro* sits under this chip, not under **Housecall Pro**, which is for the bills Housecall Pro stamped itself;
- the tiles **Today** and **This week**, which count the bill once on the day the person named;
- Documents → Sent copies, which shows the title and the column `how`.

## Who opens the page, and who writes

- **Opens it:** `canOpenBillsSent` is `canReadSentCopies`: `dev`, `master_technician`, `assistant`, `controller`. An estimator lands on Bids and anyone else on the Dashboard (`Layout.tsx`). The database agrees: `sent_documents_select_office` reads for `is_office_staff()`, which is those four.
- **Records how a bill went:** the same four. The insert policy `sent_documents_insert_staff` is wider, because an estimator, a primary and a superintendent file their own printed sheets there. None of them can open the page or read a bill with no send, so none can reach the press.
- **Refused:** an account in training mode, a digital twin and an archived account, by the table's fences.
- **The owner's assumption holds.** No field role opens Bills sent.

**Who should edit the list** is his call. I would let the same four add, rename, reorder and take off:

- the assistant and the controller are the ones clearing the yellow box, so they are the ones who meet a missing way;
- a record is never rewritten, so no edit to the list can change history;
- every change carries a name and a day, shown in the window.

The narrower choice is the master and the dev only. Then an assistant who needs a new way types it in the note and asks.

## What an editable list has to get right

1. **A record keeps its words.** Built in v2.7145. Each new record writes the words it was made with into `source_snapshot.how_label`, beside the code. A line reads the record's own words first, then the list, then the four in code, then *Recorded by hand*. A rename changes the form from that moment and no record before it.
2. **Take off, never delete.** A way gets `retired_at` and `retired_by`. It leaves the form, stays in the window under *Taken off* with who and when, and **Bring back** returns it. The office has no delete.
3. **Every way counts under Recorded by hand.** The chips sort a line by who says the bill went: the app, or a person. *Email* means the app sent it and the mail server answered. A typed way under *Email* would sit beside *Delivered 9:28 AM* and look like the same proof. So a new way adds no chip and moves no count. The tiles count its bill on the day it went. Print and the CSV say its words.
4. **The column `how` for a typed way.** A new way files `how = 'other'`, which the table's check does not allow today. The migration adds that one value. `parseSentCopy` drops a row whose `how` it does not know, so the client learns `other` in PR 2, a release before PR 3's editor can make the first such row. The office is never asked for this.
5. **Where the list lives:** a small table, `bill_hand_ways`. A single settings row would be less code, but two people saving at once would overwrite each other and no way would carry its own who and when.
   - Columns: `id`, `key` (a stable code, never made from the words: the four keep theirs, a new one is `w_` and ten random characters), `label` (1 to 60 characters), `sent_how` (`hand`, `mail`, `email`, `other`), `sort_order`, `retired_at`, `retired_by`, `created_by`, `created_at`, `updated_by`, `updated_at`.
   - One live label at a time: a unique index on the lower-cased label where `retired_at` is null.
   - RLS: `is_office_staff()` reads, inserts and updates, or `is_master_or_dev()` writes if the owner picks the narrower set. No delete policy but a dev's.
   - A trigger stamps who and when, holds `key` and `sent_how` still, refuses a 13th live way and refuses taking off the last one.
   - The migration starts with `SET lock_timeout = '3s';` and ends with the four fences a new table needs: `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()`, `apply_digital_twin_write_blocks()` and `apply_archived_read_blocks()`.
6. **The four ways there today** become the table's first four rows, with their codes kept. The office may rename, move and take them off like any other. Nothing in the app depends on their words.
7. **Order and cap.** The form shows the ways in `sort_order`. The cap is 12, so the chips never pass four rows on a phone. The window says *5 of 12*.
8. **Before the migration is pushed** the client's read is refused and the form falls back to the four in code, so the form never breaks between the merge and the push.

## The options

All three are in the mock-up at a desk and on a phone.

| | What changes on the form | For it | Against it |
|---|---|---|---|
| **A · a line in the list** | The select gains a last line, *Edit this list…*, which opens the window | The smallest change. Someone who never edits sees nothing new | The system still draws the open list over the next field. A line that opens a window is easy to miss. Four presses to add a way |
| **B · chips** (my suggestion) | The select becomes chips, with **＋ Add a way** and **Edit list** | One press picks, where the select took two. Nothing covers anything. A way is added without leaving the form | The form is one row taller. Twelve long ways fill four rows on a phone |
| **C · a card in Settings** | A quiet line under the select, *Edit this list in Settings* | Lists that shape the app have one home | The door leaves the page and the half-filled form. **Settings → Jobs, bills and liens opens for a dev alone today**, so the tab would need a new gate. The stage checklist questions already moved the other way, out of Settings to the job's own tab |

Options A and B share one small window: rename, move up or down, take off, bring back, add. Each change saves when pressed. It refuses a name already on the list, a 13th way and the last way's removal, and says why.

**The recommendation was B, and the owner picked it.** The office has 24 bills to clear in that box, and each one is a pick from this list. Chips make that pick one press, and they fix the covered field at no extra cost.

## The form itself, separate from the list

Three fixes the screenshot suggests. None needs the list to change and none needs a migration. Each is its own small PR.

- **R1 · The day offers the day the bill was made.** Today the date offers today, on a bill that may be weeks old, and a record cannot be changed once saved. Offer the billed day, with **Today** one press away. **Built, v2.7349.**
- **R2 · Several bills to one person at once.** The form lists that person's other bills with no send on record, to tick. The button counts what it will record (`batchWords`), each bill gets its own record, and a bill that fails is named with its reason while the rest save. **Built, v2.7350.**
- **R3 · The form reads the record back.** Above the button, the sentence the record will say: the day, the way, the person, the recorder. It replaces the small grey line. **Built, v2.7351.**

## The train

| PR | What | Size | Migration |
|---|---|---|---|
| 1 | **A record keeps its words.** `byHandFiling` writes `how_label`. `billsSentLines` reads it first (`byHandWordsOf`). Kernel tests. **Built, v2.7145** | S | none |
| 2 | **The list in the database.** `20261114060000_bill_hand_ways.sql`: the table, its policies and guard, the four first rows, `other` added to `sent_documents_how_known` and to the client's `SENT_HOWS`, the four fences. `readBillHandWays` with the fall-back to the four in code. The form reads the live list. **Built, v2.7166** | M | one |
| 3 | **The editor**, as the owner picked: the chips with **＋ Add a way** and **Edit list**, the window, the kernel that words each refusal, the screen's tests, the guide's new section, the glossary line. **Built, v2.7167** | M | none |
| 4 | **R1**, the day offers the day the bill was made. `byHandDayOffered` and `byHandDayPicks`. **Built, v2.7349** | S | none |
| 5 | **R2**, several bills to one person at once. `byHandOthers`, `byHandRecordLabel`, `byHandOutcome`; a refused bill stays on the strip with its reason. **Built, v2.7350** | S | none |
| 6 | **R3**, the form reads the record back. `byHandReadBack`, with the recorder's name from the sign-in. **Built, v2.7351** | S | none |

PR 2's client reads a table only the migration creates, so it is pushed right after the merge and merges when the person who pushes is at hand.

## How to verify, when built

- Record a bill as *Mailed*. Rename *Mailed*. The older line, its record page, Print and the CSV still say *Mailed*.
- Add a way and record a bill with it. The line is under **Recorded by hand**. The chips carry no count, so there is no number to read (seen on the walk of 2026-11-25).
- Take the way off. The chip leaves the form and the line keeps its words. Bring it back.
- As an assistant in training mode, press **＋ Add a way**. The press is refused with its reason.
- As an estimator, open `/bills-sent`. Bids opens, as it does for every page closed to an estimator. **Seen live 2026-11-24.**
- Read on the live page on 2026-11-15, with nothing saved: a bill made weeks ago opened on its own day and **Today** set today (R1); 11 of 24 bills offered the customer's other bills and the button counted the ticks (R2); the box over the button read the record back with the signed-in name (R3). Not pressed: the record of several bills, which writes.

## The live walk of 2026-11-24

Walked on clicktooling.com as the dev, at 730 px and 380 px, in light, on the deploy that holds v2.7145 to v2.7351.

**Holds.**

- The form, opened on one real row and read only, then closed with **Cancel**: the day offered was the billed day with **Today** beside it (R1), the customer's four other bills were listed with ticks (R2), and the read-back named the way, the person and the signed-in name (R3).
- The list, on ZZ-named ways only, at 380 px: **Add to the list** from **Edit list**, **Rename**, **Take off**, **Show**, **Bring back**, then **＋ Add a way** from the form, which picked the new chip. The foot counted 4, 5, 4, 5, 6, 4 of 12 as it should. Taking off the picked way unpicked it and the button went dead.
- An estimator is turned away from the page.
- No sideways scroll at either width.

**Could not be walked, and why.** The write: record a bill with a way, read the older line after a rename, and record two bills in one press. Since v2.8445 (#422) a bill on a ZZ test job is out of the yellow box, and **Say how it went…** opens only from a row of that box. So the form opened on no test bill. v2.8540 closes that: a dev who shows ZZ test jobs on the Pipeline sees the test bills with no send in a box of their own, each with **Say how it went…**.

**Still to walk, once v2.8559 is live.**

1. As a dev: Pipeline → Hide groups… → **ZZ test jobs** on. Open `/bills-sent`. The box *N test bills have no send on record* stands under the yellow box. v2.8540's box did not draw here on 2026-11-25. See [the second walk](#the-second-walk-of-2026-11-25).
2. Record a test bill with a ZZ-named way. Its line reads the way's words and *A test bill. It is in no total.*, and shows under **Recorded by hand**.
3. Rename the way. The older line, its record page, **Print** and the CSV keep the old words.
4. Record two ZZ Test bills to one ZZ Test customer in one press. Each gets its own line.
5. **Done 2026-11-24.** As the sample assistant with training mode turned on for the walk and off again after, **＋ Add a way** took a name and **Add to the list** added nothing: no chip, the count stayed *4 of 12*, and no row was made. The reason shows as a toast at the press (`BillHandWays.tsx`), which the walk's hidden browser did not draw, and the page's own training mode banner says the same.
6. ▲ and ▼ on two ZZ-named ways. A move against one of the four first ways changes a real row, so the first walk left it.

A record made in steps 2 and 4 cannot be changed or deleted, and neither can a way once added. Both are on the list of presses nothing takes back (#443). The walk of 2026-11-24 left two ZZ-named ways under *Taken off*.

**Small things seen, not this card's.** In the list window at 380 px, **Rename**, **Take off**, **Bring back**, **Show** and **Hide** stand 36 px high, ▲ and ▼ 40 px, and the form's chips 40 px. That was under the 44 px of #414, and v2.8543 stands each 44 px on a phone. After a rename the row still reads *Added by*, and nothing says who renamed it.

## The second walk of 2026-11-25

Walked on clicktooling.com as the dev at 380 px, on the deploy that holds v2.8540 and v2.8543. Nothing was typed and nothing was recorded.

**Holds.**

- v2.8543's presses, seen live. Every press on `/bills-sent` stands 44 px or more, and the page does not scroll sideways.
- Inside the opened form: **Say how it went…**, every bill's row, every way chip, **＋ Add a way**, **Edit list**, both day chips, **Record how it went** and **Cancel** stand 44 px.

**Two faults, both mended in v2.8559.**

- **The box of test bills did not draw.** With **ZZ test jobs** shown, `/bills-sent` drew no box. The ZZ jobs held eight bills. Six were made in Stripe's test mode, and two carry a send stamp. The page's read of bills with no send left out every test-mode bill at the database, and the kernel marked a row a test by its job's name alone. Stripe's test mode is the only way a walk is cleared to make a bill, so the box could hold none of them. v2.8559 keeps those bills in the read with their mode, and a row is a test when its bill is test mode or its job is a ZZ job. The yellow box, the **No send on record** chip and the **Not paid** tile still hold neither kind.
- **Two typed boxes of the form stood under 44 px.** The name box read 34 px and the day box 36. v2.8559 stands the name, the day and the note boxes 44 px on a phone.

**The look v2.8559 is owed.** Read only, as the dev.

1. Pipeline → Hide groups… → **ZZ test jobs** on. Open `/bills-sent`. The box *N test bills have no send on record* stands under the yellow box. N was 6 on 2026-11-25, unless a test bill was made or sent since.
2. Read the yellow box's count and the **Not paid** tile before and after the deploy. Neither moves.
3. Turn **ZZ test jobs** off. The box is gone. As the sample assistant through **View as**, there is no box and the tiles read as before.
4. At 380 px, open **Say how it went…** on a row of the box and close it with **Cancel**. The name, the day and the note boxes stand 44 px.

Then steps 2 to 4 and 6 of the first walk can be made on a test bill. Steps 2 and 4 write records nothing takes back (#443), so that walk needs its own yes.

## The look at the box, 2026-11-25 (v2.8559)

Walked on clicktooling.com as the dev, on the deploy that holds every version through v2.8568. Nothing was typed and nothing was recorded.

- **The box draws.** With **ZZ test jobs** shown, `/bills-sent` reads *4 test bills have no send on record* under the yellow box, with the line *You see these because you show ZZ test jobs. They are in no total.* Each row has **Say how it went…**.
- **Four, where step 1 above says six.** Six bills stand in Stripe's test mode with no send stamp. Two of them were texted with a pay link in other walks, and the page counts a text that names a bill as a send. So four is right.
- **The totals do not move.** All six tiles and the yellow box read the same with the switch on and off.
- **At 380 px the form holds.** The way chips, **＋ Add a way**, **Edit list**, the name box, the day box, both day chips, the note box, **Record how it went** and **Cancel** are 44 px high, and the page does not scroll sideways. The form names one more bill to the same customer, so the two-bills-in-one-press step has its rows.
- **With the switch off the box is gone.**

**Not walked.** The sample assistant's look through **View as** (step 3's second half). Steps 2 to 4 and 6 of the first walk, which write. A record made on a test bill can now be deleted by a dev (#443 row 4, v2.8564), so that walk can take its own records back.

## The calls

The owner's, a word each:

1. **Which option?** **B, the chips.** Picked 2026-11-13.
2. **Who may edit the list?** **The four roles that open the page.** Taken as suggested, 2026-11-13.
3. **May the four ways there today be renamed and taken off?** **Yes.** Taken as suggested.
4. **Does every way count under Recorded by hand?** **Every way.** Taken as suggested.
5. **Is 12 the right cap?** **12.** Taken as suggested.
6. **R1, the day offers the day the bill was made?** **Yes.** Taunya picked Build all three, 2026-11-15. Built in v2.7349.
7. **R2, several bills to one person at once?** **Yes.** Taunya picked Build all three, 2026-11-15. Built in v2.7350.
8. **R3, the form reads the record back?** **Yes.** Taunya picked Build all three, 2026-11-15. Built in v2.7351.

## Not drawn

- **A count per way** under the chip **Recorded by hand** (*Handed over 9 · Mailed 4*). Worth a look once the office has added ways of its own.
- **Correcting a record made by hand.** A record cannot be changed, by design. A second record that says the first was wrong is a card of its own.
- **The same list anywhere else.** No other screen asks how a bill went.
