---
name: "Bills sent: the office adds to and edits the list under How the bill went"
number: 340
group: close
status: asked 2026-11-13 by the owner · the card and the mock-up the same day · he picked Option B, the chips, and took calls 2 to 5 as suggested, the same day · PR 1 (a record keeps its words) in v2.7145 · PR 2 (the list's own table) in v2.7166 · PR 3 (the chips and the window) in v2.7167 · left: the migration's push, a walk on the live page, and his calls 6 to 8
summary: >
  Bills sent has one form, Say how it went…, with a list of four fixed ways a bill can go. The
  owner asked that the people who open the page can add to that list and edit it, and to be shown
  how before anything is built. The page is open to the office only, as he assumed. The card says
  what an editable list must get right: a record keeps the words it was made with, a way is taken
  off and never deleted, and every way counts under Recorded by hand. The mock-up draws the form
  as it is, three ways to edit the list from where the person stands, and three separate fixes to
  the form itself. I suggest the chips.
next: Push migration `20261113170000` right after PR 2 merges, then walk the live page: add a way, record a bill with it, rename it, and read the older line. Then the owner's calls 6 to 8 on the form's own fixes.
size: M as a train of three (S · M · M), then up to three small ones for the form's own fixes (S each)
blocker: The push of migration `20261113170000`. Until then the form offers the four ways kept in code and draws no ＋ Add a way or Edit list.
opinion: walk it live once the migration is pushed, then take R1 first — a wrong day on a record cannot be fixed
ver: v2.7145 · v2.7166 · v2.7167
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

- **Opens it:** `canOpenBillsSent` is `canReadSentCopies`: `dev`, `master_technician`, `assistant`, `controller`. Anyone else lands on the Dashboard. The database agrees: `sent_documents_select_office` reads for `is_office_staff()`, which is those four.
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
   - Columns: `id`, `key` (a stable code, never made from the words: the four keep theirs, a new one is `w_` and eight random characters), `label` (1 to 60 characters), `sent_how` (`hand`, `mail`, `email`, `other`), `sort_order`, `retired_at`, `retired_by`, `created_by`, `created_at`, `updated_by`, `updated_at`.
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

- **R1 · The day offers the day the bill was made.** Today the date offers today, on a bill that may be weeks old, and a record cannot be changed once saved. Offer the billed day, with **Today** one press away.
- **R2 · Several bills to one person at once.** The form lists that person's other bills with no send on record, to tick. The button counts what it will record (`batchWords`), each bill gets its own record, and a bill that fails is named with its reason while the rest save.
- **R3 · The form reads the record back.** Above the button, the sentence the record will say: the day, the way, the person, the recorder. It replaces the small grey line.

## The train

| PR | What | Size | Migration |
|---|---|---|---|
| 1 | **A record keeps its words.** `byHandFiling` writes `how_label`. `billsSentLines` reads it first (`byHandWordsOf`). Kernel tests. **Built, v2.7145** | S | none |
| 2 | **The list in the database.** `20261113170000_bill_hand_ways.sql`: the table, its policies and guard, the four first rows, `other` added to `sent_documents_how_known` and to the client's `SENT_HOWS`, the four fences. `readBillHandWays` with the fall-back to the four in code. The form reads the live list. **Built, v2.7166** | M | one |
| 3 | **The editor**, as the owner picked: the chips with **＋ Add a way** and **Edit list**, the window, the kernel that words each refusal, the screen's tests, the guide's new section, the glossary line. **Built, v2.7167** | M | none |
| 4 to 6 | R1, R2, R3, each alone, in the order he wants them | S each | none |

PR 2's client reads a table only the migration creates, so it is pushed right after the merge and merges when the person who pushes is at hand.

## How to verify, when built

- Record a bill as *Mailed*. Rename *Mailed*. The older line, its record page, Print and the CSV still say *Mailed*.
- Add a way and record a bill with it. The line is under **Recorded by hand**, the count there rises by one, and no other chip's count moves.
- Take the way off. The chip leaves the form and the line keeps its words. Bring it back.
- As an assistant in training mode, press **＋ Add a way**. The press is refused with its reason.
- As an estimator, open `/bills-sent`. The Dashboard opens.

## The calls

The owner's, a word each:

1. **Which option?** **B, the chips.** Picked 2026-11-13.
2. **Who may edit the list?** **The four roles that open the page.** Taken as suggested, 2026-11-13.
3. **May the four ways there today be renamed and taken off?** **Yes.** Taken as suggested.
4. **Does every way count under Recorded by hand?** **Every way.** Taken as suggested.
5. **Is 12 the right cap?** **12.** Taken as suggested.
6. **R1, the day offers the day the bill was made?** I suggest yes.
7. **R2, several bills to one person at once?** I suggest yes, after the list is done.
8. **R3, the form reads the record back?** I suggest yes.

## Not drawn

- **A count per way** under the chip **Recorded by hand** (*Handed over 9 · Mailed 4*). Worth a look once the office has added ways of its own.
- **Correcting a record made by hand.** A record cannot be changed, by design. A second record that says the first was wrong is a card of its own.
- **The same list anywhere else.** No other screen asks how a bill went.
