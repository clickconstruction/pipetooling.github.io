---
name: "Presses nothing takes back: the standing list"
number: 443
group: gated
status: standing list opened 2026-11-24 on the owner's word of that day · seventeen rows: the Lien desk, Bills sent, Accounts Receivable, Bill Customer, a person's card, the job form's address, a job's papers, a customer's portal, a person's desk, a job's notes, a painted map, an address the map could not place and View as · the six take-backs that need the client alone are built and live, v2.8561 and v2.8564 to v2.8568, each for a dev on a test row · none is walked, so every row they would clean still sits on prod · on 2026-11-25 the owner said rows 8 and 5 go wider, and that all eight that need a migration or a function are to be built, each on its own yes
summary: >
  Every press a walk or a thread meets that nothing takes back, one row each: what was pressed, on which
  screen, what it left, and what would take it back. The owner asked for the note on 2026-11-24, when he
  approved ZZ Test rows for anything in the app even where a press cannot be revoked. On 2026-11-25
  he said yes to the six take-backs that need the client alone, each a small PR under this card,
  seen by a dev alone and refusing a row that is not a test row. All six are live. The same day he
  said two of them go wider, and that all eight that need a migration or a function are to be
  built, each on its own yes.
next: Walk each of the six built take-backs on the ZZ rows it was built for, each on its own yes, and take its line off the list of what sits on prod. Widen rows 8 and 5 as the owner answered. Then build the take-backs that need a migration or a function, one at a time, each push or deploy on its own yes. Add a row each time a walk or a thread reports such a press.
size: a standing list · each take-back is sized on its own row
blocker: Each walk of a built take-back deletes or changes a ZZ row on prod and waits on its own yes. Each migration or function waits on its own yes at the time. Adding a row waits on nothing.
mockup: not required — a standing list of presses, no screen
pointer: true
---

# Presses nothing takes back (#443)

## The ask

The owner, on 2026-11-24, giving a standing yes for test rows:

> I approve making zz tests for anything in the app even if it is currently un revocable (But whenever we
> encounter something unrevocable, I would like to make a note to later add it revocable, even if it's a
> setting in settings for the dev user)

This card is that note. It is one list, kept in one place, so the same press is not written down on six cards.

## The go to build, 2026-11-25

The owner was asked: *Card #443 lists presses nothing takes back. Build the six client-only take-backs
now?* He answered:

> Yes, the six small ones

The option he picked read: one small PR each, invisible to every non-dev, refusing any row that is not
a test row or that a real record depends on. The ones that need a migration come back to him one by
one.

The six, smallest first: delete a way nobody used (row 3), delete a by-hand record of a test bill (row
4), **Remove the photo** (row 8), **Reopen** a closed case (row 5), delete a by-hand notice record (row
1, the record alone), and clear a kept address nothing is written under (row 9).

All six are built and live: row 3 in v2.8561, row 4 in v2.8564, row 8 in v2.8565, row 5 in v2.8566, row
1's record in v2.8567 and row 9 in v2.8568. Each is drawn for a dev alone and refuses a row that is not
a test row. None has been pressed on the live site.

## Two more answers, 2026-11-25

Both were given at that day's wind-down. They are history: neither is a yes for a push, a deploy or a
write on prod, and each of those is asked again at the time.

Asked *Remove the photo and Reopen a closed case were built for a developer on a test row only. Should
they be wider?*, the owner answered:

> Wider, as fixing picked

The pick read: **Remove the photo** for whoever may change that photo, and **Reopen** a closed case for
the office. Neither is widened yet. Rows 8 and 5 say what is built today.

Asked *Eight more take-backs need a migration or an edge function. Build which?*, he answered:

> All eight

The eight are rows 2, 7, 10, 11, 12, 13, 14 and 15, and with them the Activity line of row 1. Each
still needs its own yes before its push or its deploy. None is built. Row 16 was added to the list
after the question was written, so his answer does not name it.

## What counts

A press belongs here when all three are true.

1. A person, or the dev seat, can do it on a ZZ Test row.
2. It leaves a record behind.
3. No screen and no seat verb puts things back as they were.

A press with an **Undo**, a **Take back** or a delete does not belong here. A record that a trigger or a
ledger writes by design, such as a line on a job's Activity, is listed only when it gets in a walk's way.

## How to add a row

Read the code before writing a row. A report is that session's account, and a take-back may exist that
the walk did not find. Each row says who reported it, the day, and what was read to check it. Use ZZ Test
rows, ids and counts only. Name no real customer, job, address or amount.

## The list

| # | What was pressed | Where | What it left | What would take it back | Size | Reported |
|---|---|---|---|---|---|---|
| 1 | A § 53.056 notice recorded by hand: **Record it…**, the by-hand form, then save. The dev seat's `apply_notice_by_hand` writes the same row. | Lien desk, Notices, the job, *Months on this job*. The job's Lien window has the same door (`LienNoticeByHandPane`). | One `job_lien_filings` row, which counts as a live notice for its months until it is voided. One line on the job's Activity as well, written by the trigger `job_lien_filings_to_activity_ins` on the insert. | The record: built in v2.8567. A dev reads the folded line *Voided by-hand notice records · N* under *Filings on this job* in the job's Lien window, with **Delete…**, on a voided record of a ZZ test job that nothing points at. Not walked. The Activity line: still to build. The Activity table lets a signed-in person only read, so taking the line with the record needs a function. | The record: done, no migration. The Activity line: S to M, a migration (read 2026-11-25). | The #415 thread, 2026-11-24. Checked the same day: no `.delete()` on the table anywhere in `src/`, no seat verb for it, and the trigger fires on insert only. |
| 2 | **Void** on a filing, then **Confirm void**. The toast reads *Record voided.* **Take it back** on *Back from the clerk* does the same write. | A job's Lien window, the record's own line on its tab (`LienFilingTabs`). | `voided_at` set on the filing, and the record leaves the tab's list. Where a desk paper was tied to it, the database puts that paper back on the Lien desk in the same step. The Activity line of row 1 stays, and nothing on the Activity says the record was voided. | A press for the dev that puts the record back: clear `voided_at`, and where a paper was tied, undo what the void did to that paper. The second half is why this is more than one write. A line on the Activity that says the record was voided would close the other gap. | M, likely a migration beside `job_lien_filing_void_restores_paper` | The #415 thread, 2026-11-24. Checked the same day: `voidLienFiling` writes `voided_at` only, and nothing in `src/` clears it on a filing. |
| 3 | ~~**Add to the list**, in the **Edit list** window or from **＋ Add a way** in the form.~~ | ~~Bills sent, **Say how it went…**, the list under *How the bill went* (`BillHandWays`).~~ | ~~One `bill_hand_ways` row. **Take off** retires it and never deletes it, so it stands under *Taken off* for everyone who opens **Edit list**, for good.~~ | ~~A delete for the dev on a way no record was ever made with. The table already lets a dev delete (`bill_hand_ways_delete_dev`). No screen and no verb calls it.~~ | Built in v2.8561: **Delete…** beside **Bring back** on a taken-off way, for a dev, on a way named ZZ that no bill was recorded with. Not walked. | The WALKING thread, 2026-11-24, on card #340. Checked the same day: the office's writes on the table are insert and update, and nothing in `src/` deletes a way. |
| 4 | ~~**Record how it went**, on one bill or on several at once.~~ | ~~Bills sent, the form under **Say how it went…** on a bill with no send on record (`ByHandForm`).~~ | ~~One `sent_documents` row a bill, kind `bill_by_hand`. The table has no update policy, so the record cannot be changed, by design. The bill leaves the box and gets a line on the list.~~ | ~~A delete for the dev on a by-hand record of a ZZ test job's bill. The table already lets a dev delete (`sent_documents_delete_dev`). No screen and no verb calls it. A second record that says the first was wrong is the office's take-back, and card #340 lists it as not drawn.~~ | Built in v2.8564: **Delete this record…** under a by-hand line of a bill's record, for a dev, on a test bill. Not walked: no by-hand record stands on a test bill yet. | The WALKING thread, 2026-11-24, on card #340. Not pressed yet: the form opens on no ZZ test bill until the fix the walk asked for is live, and the walk that presses it is still owed. Checked the same day: the table's policies are select, insert and a dev's delete. |
| 5 | ~~**Close it as settled** or **Close it as not coming**, under **More** on a case, with *Settled another way…* or *Not coming…*.~~ | ~~Accounts Receivable, **Came back**, a case's pane (`ArReturnCasePane`, `closeCase` in `BankPaymentsModal.tsx`).~~ | ~~The case closed with its reason and note. It leaves **Came back** and no screen lists it again.~~ | ~~A **Reopen** press on a closed case. Three functions are in the database, open to the office, and have no caller: `reopen_ar_stripe_case`, `reopen_ar_return_case` and `reopen_ar_unbanked_check_case` (the third read 2026-11-25). The page already loads closed cases. The release note of v2.5891 says *Reopen still undoes it*, and no press does.~~ | Built in v2.8566: the folded line *Closed test cases · N* at the top of the window's list, with **Reopen…**, for a dev, on a case of a ZZ test job closed as settled or as not coming. Not walked. Wider is owed: for the office (the owner, 2026-11-25). | The WALKING thread, 2026-11-24, on card #76. Checked the same day: the only callers of either function are the database's own tests. |
| 6 | **Make the bill and email**. | Bill Customer, the Stripe tab. | A bill in Stripe and on the job, and an email to the customer. In test mode the email goes to the sender alone. | The bill can be voided (row 7). An email cannot be called back, so there is nothing to build for it. The row is here so a walk presses it in test mode only. | none | The WALKING thread, 2026-11-24, on card #343. |
| 7 | **Void invoice**, from **Void Stripe invoice…**. | Bill Customer. | The bill's row is deleted from the job (`void-stripe-invoice-for-revert`), and the rows of its sends go with it. Stripe keeps the invoice as void. | Nothing short of making the bill again. Keeping the row as voided, in place of deleting it, would leave the record and its sends to read. | M, an edge function and likely a migration | The WALKING thread, 2026-11-24, on card #343. Checked the same day: the function deletes the row, and the send rows cascade. |
| 8 | ~~**Save the photo**.~~ | ~~**Card and footer**, from People → Users on a person's row, and **Your card and footer** in Settings (`YourCardCard`).~~ | ~~The person's photo and its crop on their account, and one file in the photo bucket. A photo can be changed, never taken off.~~ | ~~A **Remove the photo** press that clears the two columns and deletes the file.~~ | Built in v2.8565: **Remove the photo…** under **Change the photo**, for a dev, on a ZZ Test person. Not walked. Wider is owed: for whoever may change that photo (the owner, 2026-11-25). | The WALKING thread, 2026-11-24, on card #313. Checked the same day: `CardIo` has no call that clears a photo, and the only file removals are the old file on a change and the new one when the save fails. |
| 9 | ~~An address typed in the **Job Address** box, then the box left. No press: leaving the box, or a pause of about a second on a whole address, starts the look-up.~~ | ~~Jobs → Pipeline → **New job**, and a job's Edit tab (`JobFormAddressPin`).~~ | ~~One `address_geocodes` row under the address as typed, kept by `geocode-one`. It stays when the form is closed with **Discard** and no job is made.~~ | ~~A line in Settings for the dev that lists the map's kept addresses no job and no bid is written under, and removes them. The table already has a delete policy for the map's roles. No screen calls it.~~ | Built in v2.8568: the folded block *Kept map addresses (dev)* in Settings, Data & recovery, with **Clear…**, for a dev, on a kept address no record holds. Not walked. | The #439 thread, 2026-11-24. Checked the same day: `geocode-one` upserts the row, and nothing in `src/` deletes from the table. |
| 10 | **Take off** on a paper's row, then **Take the paper off**. | A job's window, Documents, *Papers before this job opens*. | `removed_at` set on the `job_required_papers` row. The row is kept by design, since signatures hang on it. | A delete for the dev on a taken-off row that no person's copy points at. The table lets a signed-in person only read, and every write goes through a function, so the delete is a new function. The pane does not list a taken-off row, so the dev needs a list of them as well. | M, a migration | The #389 thread, 2026-11-24. Checked the same day: nothing in `src/` deletes from the table. The policies read 2026-11-25: one read policy, and insert, update and delete revoked. |
| 11 | **Turn off**, then **Turn the portal off**. | A customer's portal window, from the globe on Customers, under Advanced settings, Reset. | `revoked_at` set on the `customer_portal_links` row. The row is kept for the window's History. | A delete for the dev on a turned-off link of a ZZ Test customer. The table has no delete policy and no delete grant, so the press needs both first. | S, a migration | The #389 thread, 2026-11-24. Checked the same day: nothing in `src/` deletes from the table. The policies read 2026-11-25: one read policy, and select, insert and update granted. |
| 12 | **Delete…**, then **Delete** and the person's name. | People → Users, a person's desk, under Access (`PersonDeskAccessSection`), and the ⋯ menu of the person's row. It is offered only for a person with no login whom nothing points at. | The person's `people`, `users` and `people_pay_config` rows are removed (`delete_fresh_person`). Deleted records keeps a copy of the first and the third. It keeps none of the `users` row, and the copy of the person cannot go back without it. | A copy of the `users` row kept on the delete, and a put-back for the dev that restores the three together. | S to M, a migration | The WALKING thread, 2026-11-25, pressed once on a made-up ZZ Test person on the owner's word. Checked the same day: the function deletes the three rows, and no migration gives `users` a copy on delete. That the person's copy cannot be restored is read from `people_needs_users_row`, not run. |
| 13 | **Post note** on a job, and **Post** under a note a person was tagged in. | A job's window, Activity and notes (`JobThreadNotesPanel`). Inbox, **Tagged notes** (`TaggedJobNotesSection`). | One `jobs_ledger_thread_notes` row, or one comment on a task's day (`checklist_instance_events`) when the tag was on a task. Its tag rows, and a push to each person tagged. A posted note has no edit and no delete. | A delete for the dev on a note of a ZZ test job, which takes its tag rows with it. Neither table has a delete policy, so the press needs one first. | S, a migration | The WALKING thread, 2026-11-24, on card #363. Checked 2026-11-25: nothing in `src/` deletes or updates either table, their policies are select and insert, and the dev seat only adds a note. |
| 14 | **End this link now**. The press warns first. | A painted map's share sheet (`PaintedMapShareSheet`). | `ended_at` set on every open link of the map (`painted-map-link`, `desk.end`). The address already sent is dead, and the same code cannot be asked for again. A new link can be made, with a new address. | A reopen for the dev on an ended link that is not past its day: one more action in the same function. | S, an edge function | The WALKING thread, 2026-11-25, on card #345. Checked the same day: the function has no action that clears `ended_at`, and the table lets a client only read. |
| 15 | **Throw this map away**. The confirm says it cannot be undone. | A painted map's window (`PaintedMapWindow`). | The map's row is deleted, and its lines, places, links and visits go with it. Its photos are taken out of the bucket. A task that carried the map keeps the task and loses the map. | A copy kept on the delete, so Deleted records can put the map back, with the photos held until the copy is cleared. | S to M, a migration | The WALKING thread, 2026-11-25, on card #345. Checked the same day: `deletePaintedMap` deletes the row and then the photo files, and no painted map table keeps a copy on delete. |
| 16 | An address no map service can place, saved on a bid or a job, or typed in the job form's address box. No press of its own: the first screen that asks the map for it keeps the miss. **Try again** rewrites its day. | The Bid Board's sheet *Bids the map can't place*, the Map page's list, and the job form (row 9). | One `address_geocode_misses` row under the address as typed. It goes by itself when a point is saved for that address, and it stops counting after 30 days, when the address is asked again. Nobody deletes one by hand. | A delete for the dev on a miss whose address no bid and no job is written under. The table has no delete policy and no delete grant, so the press needs both first. | S, a migration | The WALKING thread, 2026-11-25, on card #441. Checked the same day: the table's policies are select, insert and update, and its one remover is the trigger that runs when a point is saved (`20261124091500_address_geocode_misses.sql`). |
| 17 | **View as**, any use of it. | The gear menu's View as, and every door that opens a sample account or a person. | One `user_imitations` row: who imitated whom, and when (`login-as-user`). It is written before the link is made, and it is kept on purpose: it is how the app refuses to read a person's mail in an imitated session. Nothing deletes one. | Nothing to build. The row is a record by design. It is listed because it held a walk: every look as a crew member, a leader or the office needs it, and the walk stopped to ask. | none | The SIMULATOR thread, 2026-11-25, on cards #398, #392 and #365. Checked the same day: the table lets a dev only read, and only the function writes (`20261101175329_user_imitations.sql`). |

Row 2 has one exception, and it is not a gap. A line that applied a paper already on record reads **Undo**
in place of **Void**, and its notice goes back on the desk (v2.7508).

Read on the live site on 2026-11-25, as the dev, with nothing confirmed and nothing deleted. Rows 3, 5,
8, 1 and 9 each draw their press where their row says, with the counts under *What sits on prod*. A real
teammate's **Remove the photo…** is dead with its reason, and so is **Reopen…** on a case closed another
way. Two refusals cannot be shown on prod: no taken-off way has a name that is not ZZ, and no real job
holds a voided by-hand record. Row 4 has nothing to press. One small fault beside row 8: while a
person's photo loads, the card reads **Add a photo** and *No photo yet* for about two seconds. It is
briefed with the widening of rows 8 and 5.

Checked and left off the list, 2026-11-25. **Send** on a new task and **Mark done** both have a way back. A done
task's own press reads **Mark not done**, History has **Reopen**, and Checklist → Manage → **Delete** removes a
task with its day rows for a dev, a master or an assistant. The dev seat has no verb for either.

Checked and left off the list, 2026-11-25. A part added to a box on site, and any other press on the
materials ledger. The ledger keeps every row, but a dev can take a press back: Jobs → Materials, the
site, the look by person, the press, **Take it back**. That hides the row from every read and deletes
nothing. Row 9's own leftover may be a miss and not a kept address: row 16 says what a miss is.

## What sits on prod because of these

Counted on prod through the dev seat on 2026-11-25, after the six take-backs went live. Nothing has
been cleaned yet.

- Three § 53.056 notices recorded by hand on the ZZ Test job of #415's walks, with notes that start
  *ZZ TEST*. Two were voided on 2026-11-24 by the #415 thread, once its walks no longer needed them. The
  third was recorded and voided on 2026-11-25 by the walk of v2.8541 and v2.8554. No desk paper was tied
  to any, so no void moved a paper. They stay in the table as voided records until a dev deletes each
  from the job's Lien window (row 1, v2.8567). Not pressed yet.
- Three lines on that job's Activity, one for each record, each saying a lien notice went out by hand.
  All three records are voided and all three lines still stand. Deleting a record leaves its line:
  row 1's Activity line is not built.
- Two ways on the Bills sent list, both named *ZZ Test*, added and taken off by the walk of #340 on
  2026-11-24. Both stand under *Taken off* in the **Edit list** window until a dev deletes each there
  (row 3, v2.8561). Not pressed yet.
- Three test cases closed on Accounts Receivable, each as settled another way. Two were closed by the
  walk of #76 on 2026-11-24, both on one ZZ TEST job. The third was closed by the walk of v2.8552 on
  2026-11-25, on another ZZ test job. A dev can reopen each from *Closed test cases* (row 5, v2.8566).
  Not pressed yet, and a reopened case stands open for the office until it is closed again. That line
  reads *Closed test cases · 4* on the live site: the fourth is a test case put back on 2026-11-09, no
  walk's leftover, and its **Reopen…** is dead with the reason.
- No by-hand record on a test bill. Row 4's delete (v2.8564) has nothing to press until a walk of #340
  makes one.
- Two test emails to the sender and two voided test invoices in Stripe's test mode, one of each from
  the walk of #343 on 2026-11-24 and one of each from its walk of 2026-11-25, because of rows 6 and 7.
- One kept address in the map's cache, a made-up spelling of the ZZ Test address that no job is written
  under, from the #439 thread's look at the New job form on 2026-11-24. A dev can clear it from
  Settings (row 9, v2.8568). Not pressed yet.
- Eight taken-off papers on one ZZ test job, the newest from the #389 thread's walk of 2026-11-24, because
  of row 10. `to-dos/sub-nda-builder/README.md` lists them by id under its loose ends.
- Four turned-off portal links on one ZZ Test customer, the newest from the same walk, because of row 11.
- A photo on one ZZ Test person, saved by the walk of #313 on 2026-11-24. A dev can remove it from the
  person's **Card and footer** (row 8, v2.8565). Not pressed yet. The team's batch of cards leaves ZZ
  Test people out since the fix that walk asked for.
- Three notes on the ZZ Test walk job, posted by the walk of #363 on 2026-11-24, because of row 13.
- One kept miss for a made-up address, from the walk of #441 on 2026-11-25, because of row 16. It stops
  counting on its own after 30 days.
- Five ZZ Test parts in box ZZ4 on the ZZ Test walk job, ten ledger rows, added by the simulator's walk of
  #398 on 2026-11-25. No row of this list holds them there: a dev can take each press back. They are kept
  on the owner's word of 2026-11-25, *Keep them*, for his look at a box with several kinds of part.
- One View as record for each look a walk makes as someone else, because of row 17. The owner said yes
  to those looks on 2026-11-25, *Yes, looks only*. The simulator's looks of that day left three. The
  table holds one for every use by anyone, so its own count is far higher and is not a walk's leftover.
- Nothing because of rows 12, 14 and 15. The made-up person is gone, as the press means. The walk of #345
  ended a link and threw a map away that it had made for the look.

## When a take-back is built

Its row gets the card's number or the version that shipped it, and stays on the list struck through until
the rows it left on prod are cleaned up. A take-back may be a press on the record for the dev, or a
switch in Settings that only the dev sees, as the owner's words allow.
