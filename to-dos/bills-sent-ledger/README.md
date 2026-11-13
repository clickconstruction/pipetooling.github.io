---
name: "Bills sent: one list of every bill that left, to whom, and the minute it went"
number: 327
group: close
status: built 2026-11-12 and 2026-11-13 on Grace's word · live at /bills-sent with the list, the sends with no copy, the no-send strip, delivered and bounced, one bill's record, print and CSV, a record made by hand (v2.7057 #7827), the Dashboard pin (v2.7129 #7912) and the phone layout (v2.7130 #7917), those three merged 2026-11-13 · left: the master's own look, and the notes under What should change next
summary: >
  The master asked for a ledger he can open at any time that shows which bills have gone out, to
  whom, and when exactly. The app already kept that record for every bill it emails, scattered and
  without amounts. Built as one screen, Bills sent at /bills-sent, that reads the records the app
  keeps and writes no second record: one line each time a bill leaves, with the minute, the job,
  the amount, the address, who sent it and whether it arrived, a band per day with its total, one
  bill's whole record, print and CSV, and a strip of bills that were made and have no send on
  record. What is left is written below as notes, not built.
next: The master opens /bills-sent and finds the bill that made him ask. #7827, #7912 and #7917, merged 2026-11-13, are walked live. The notes under What should change next wait for Grace's word.
size: L as a train of seven (M · M · S · M · S · M · S), built; left: notes only (the Pipeline doors S, the Monday email block S, the holes at the send M, the kernel split XS)
blocker: None for what is built. The notes are new behavior or a refactor, so they wait for Grace's word (no major changes on Opus 5.5, 2026-11-13).
opinion: your call — the list is live and answers the ask; what is left is doors and depth, none of it urgent
ver: v2.7049 · v2.7052 · v2.7053 · v2.7055 · v2.7056 · v2.7057 · v2.7129 · v2.7130
---

# Bills sent (#327)

Mock-up: [`mockup.html`](./mockup.html) (served at `/to-dos/bills-sent-ledger/mockup.html`). One spot, **Now** against **My suggestion**, at a desk and on a phone, then one bill's record. Every name, job, bill number and amount on it is made up.

## The ask

Grace, 2026-11-12, in her words:

> I just heard from the master of our system. I would like to create a ledger that is easy to read, that can always be accessed, so [the master plumber] can at any time see what bills have gone out and to who and when exactly they were sent. Does this make sense? If so, help me refine this idea and help me come up with a solution.

The master is the company's master plumber, a leader with the role `master_technician`. Read the ask as a trust question as much as a list. He wants to answer *did that bill go out, when, and to which address?* without asking the office.

## Does it make sense

Yes. And most of it exists. The record he is asking for has been kept since 2026-10-05 for every bill the app emails, and his role can already read it. Nobody would think to look where it is, and the list there was made for finding a paper, not for reading the day's billing.

So the answer to "create a ledger" is: **do not create a second record of the same sends. Build one screen over the record the app keeps.**

## What exists today

### How a bill leaves, and what each send writes

| Route | Where it starts | What is written | Time | To whom | Who sent | Copy |
|---|---|---|---|---|---|---|
| Email from the app with the pay link (first send) | Send on a Stripe bill: `StripeInvoiceSendFromStripeButton.tsx` → `send-stripe-invoice` (`sendOwnBillEmail`) | `jobs_ledger_invoices.sent_to_customer_at` + `sent_by_user_id`; a row in `jobs_ledger_invoice_stripe_email_sends`; `sent_documents` kind `bill` (and `bill_copy` per copy address); `email_send_log` type `stripe_bill`; `job_activity_events` `invoice_sent` | To the second | Name and each address (`sent_documents.recipient_emails`) | Yes | The email as read, with the bill's PDF |
| The same bill sent again | The **Resend** press on a billed row, View bill, Collect payment, Payment chase: the same function | The invoice stamp is **written over**; a new row in `…stripe_email_sends`; a new `sent_documents` row; `invoice_stripe_email_sent` on the job's trail, with no actor | To the second | Yes | Yes, on the sent copy | Yes |
| Stripe sends it for us | The fallback inside `send-stripe-invoice` when our own email fails or `BILL_EMAIL_SENDER` says Stripe | The invoice stamp and the `…stripe_email_sends` row only. **No sent copy, no address, no delivery answer** | To the second | Not kept | On the invoice row | None |
| A bill PDF emailed by the app, no Stripe | `SendRecordInvoiceModal.tsx`, the physical tab → `send-physical-invoice-email` | Invoice row (`external_send_channel = 'physical'`, the day at noon); `sent_documents` kind `bill`, then `bill_resent`; `email_send_log` | The day on the invoice, the second on the copy | Yes | Yes | Yes |
| Recorded from Housecall Pro | `SendRecordInvoiceModal.tsx` `confirmOutsideBill` | Invoice row only: `external_send_channel = 'housecallpro'`, a free note, the day at noon | **The day only** | Not kept | Not kept | None |
| A statement to a general contractor | GC Review → `send-gc-statement-email`; on a schedule → `gc-statement-email-dispatch` | `gc_statement_emails` (to, copies, total, job count, sender); `sent_documents` kind `gc_statement`; `email_send_log`. **Not which bills it listed**, except inside the copy | To the second | Yes | A person, or the app on a schedule | Yes |
| A pay application (AIA G702/G703) | `AiaG702G703Modal.tsx`: a download, not a send | `job_pay_applications`; `sent_documents` kind `pay_application`, how *Saved as a file*, with the figures in `source_snapshot` | To the second | Not known | Yes | The workbook |
| GC mode pay application, certified bill, reminder | `gc-customer-email` | `gc_owner_*` rows (a day); `sent_documents` kinds `bill_gc_pay_app`, `bill_gc_certified`, `bill_gc_reminder`, `bill_gc_interest`; `email_send_log` | To the second on the copy | Yes | Yes | Yes |
| A printed pay sheet | `BillQrModal.tsx` | `sent_documents` kind `bill_pay_code`, how *Printed* | To the second | Not known | Yes | Yes |
| A text with the pay link | Text the bill (#291): `TellCustomerSheet` → `quo-send` | A `messages` row (the number, the words, who, delivered or failed). **No bill id**: the bill is found by the `/pay/` link in the words | To the second | The number | Yes | The words |
| The customer's portal page, the pay page | `customer-portal`, `pay-link` | `public_page_views` per customer on the portal, not per bill. The pay page logs no view | — | — | — | — |
| A bill emailed from a person's own mailbox, or handed over on site | Outside the app | **Nothing** | — | — | — | — |

There is no courtesy or past-due email to a customer on a timer. Stripe's own delivery and open facts are not captured: `stripe-webhook` handles paid, voided, failed and disputed, and `stripe_webhook_events` keeps an id and a type.

### The records, and who may read them

| Record | Holds | Misses | The master can read |
|---|---|---|---|
| `sent_documents` (`src/lib/sent/`, `docs/SENT_COPIES.md`) | What, how, to whom (name and addresses), when (stamped by the database), by whom, the copy and its SHA-256, the Resend id, the job, the source bill | The amount, the bill number as a field, anything before 2026-10-05, any send that did not go through the app | Yes: `is_office_staff()` (dev, master, assistant, controller) |
| `sent_copy_stamps(ids)` | Opened (while it is the last event), the day it was paid and how | Delivered and bounced | Yes |
| `email_send_log` | Addresses, subject, type, the **last** delivery event from Resend | Every earlier event (a later one writes over it), any job or bill id, the sender | Yes, every row (`is_master_or_dev()`). The assistant and the controller read only statement and price-request rows |
| `jobs_ledger_invoices` stamps | Amount, status, the last send's time and sender, the channel | The first send once a bill is resent, the address (`bill_to_email` was empty on all 39 sent in the window) | Yes |
| `jobs_ledger_invoice_stripe_email_sends` | One row per email of a Stripe bill since 2026-05-12, with the copy addresses | The main address, the sender | Yes |
| `gc_statement_emails` | Each statement: to, copies, total, job count, sender | The bills it listed | Yes |
| `messages` | Each text and email from Messages | A bill id | Yes |
| `job_activity_events` | `invoice_sent`, `invoice_stripe_email_sent`, `invoice_resent` per job | The address (except a PDF resend), the amount; a resend has no actor | Yes |
| `stripe_webhook_events` | An id and a type | Everything else | No, and it is not needed |

### What already shows it to a person

| Screen | Time | Address | Across jobs | The master |
|---|---|---|---|---|
| Documents → **Sent copies**, the Bills chip (`DocumentsSentLedger.tsx`) | Day band and time | Only after opening the copy: the line reads *to* a name | Yes | Yes |
| A billed row on Jobs → Stages (`StagesJobCellActivityFooter.tsx`) | *Resend · Email sent Fri 9:28 AM (5d)*: weekday and time of the **last** send, no date | No | One row | Yes |
| The Resend press's confirm window | Up to 20 past sends, weekday and time | Copy addresses only | One bill | Yes |
| View bill (`HostedStripeBillPanel.tsx`) | *Sent:* a day | No | One bill | Yes |
| A job's Documents tab, **Sent from this job** | Yes | By name | One job | Yes |
| The job's activity box | Yes | No | One job, wide desk only | Yes |
| Who owes what (`BilledByCustomerBreakdownModal.tsx`) | *Email sent* a day | No | Open bills | Yes |
| GC Review, the statement history | A day | Yes | Statements only | Yes |
| The Bridge's Bill desk | A day, with *Sent by* | No | Eight pay weeks | Yes |
| Messages → Went out | Yes | Yes | Texts and Messages' own emails. **Bill emails are not in it** | Yes |
| The customer's timeline | *Bill sent*, a day | No | One customer | Yes |
| People → Day book | A day | No | Yes | **No** (dev and controller) |
| Accounts Receivable, the Dashboard | Nothing about sends | | | |

## The count

Read on the live app on 2026-11-12 with every write refused, counts only, for 2026-10-13 to 2026-11-12:

- **39 bills went out.** 36 by email from the app, 3 entered from Housecall Pro.
- **38 emails carried those 36 bills**: 2 were sent a second time. Every one has the time to the second, the sender, one address, the copy with the bill attached, and a delivery answer. 0 bounced. **36 of 36 have the full record.**
- **The 3 Housecall Pro bills** have a day and a note. No time, no address, no sender, no copy.
- **9 more live bills were made and have no send on record**: the bill exists with a pay link, and the app sent no email. 5 are paid and 4 are open. (4 test-mode bills are the same and do not count.)
- **7 texts carried a pay link**, all delivered, 4 tied to a job.
- **14 statements** went to general contractors, all on the schedule and by the app, listing 305 job rows between them. 13 delivered, 1 with no answer yet.
- 0 bill PDFs emailed without Stripe (2 ever). 0 GC reminders. 0 pay-application sends.
- Before 2026-10-05 the record is thinner. The Stripe email rows go back to 2026-05-12, 174 in all, and each carries a time and no address.
- Two people sent every bill. About three lines a working day.

## The gap

Not missing data, for the bills the app emails. Not missing reach: the master can read every table above. **It is shape, plus three small holes.**

Shape:

1. The list is under Documents, where nobody looks for billing, and the Bills chip is not in the address.
2. A line has no amount and no address, and a day has no total.
3. A bounce reads the same as a delivery.
4. Statements sit under another chip. Texts sit in Messages. Housecall Pro bills sit nowhere.
5. **A bill that never went out is on no list.** That was 9 of 48 live bills in the window.
6. The billed row's stamp shows the last send only, with no date and no address.

Holes in the record:

1. A Housecall Pro bill keeps a day and nothing else.
2. When Stripe sends the email for us, no copy and no address are kept. It did not happen in the window. The code path is there.
3. A statement does not record which bills it listed. A text does not record which bill it carried.

## The recommendation

**One screen, Bills sent, at its own address, read from the records the app already keeps.**

1. **What counts as a bill going out.** Every send is its own line: a first send, a resend, a text, a print, a statement. He asked *when exactly*, and a bill sent three times went three times. The day's total counts each bill once, on the day of its first send. A resend and a statement are listed and not added. A statement is one line, because one email went, and it opens to the copy that lists its bills.
2. **The line.** The time to the minute. The bill number, the job, the customer or general contractor. The amount. The person and each address or number. The route. Who pressed send, or *the app, on a schedule*. Whether it arrived: *Delivered*, *Bounced*, *Opened*. *Copy as sent*, one press away. Paid since, as a quiet word.
3. **Honesty.** A billed bill with no send on record is shown in a strip at the top. A Housecall Pro line says *the day only, no address, no sender, no copy*. A send before 2026-10-05 says its time and *no address kept*. The list never fills a blank with a guess.
4. **Easy to read.** Newest first under a band per day, with the day's count and total. Four tiles: today, this week, did not arrive, no send on record. One search box for a job, a customer, an address or a bill number. Chips by route. No filter by sender: two people send, and the name is on the line. On a phone the time moves above the line and the address stays on it.
5. **Always there.** Its own address, `/bills-sent`, which he can bookmark. A press in the Billed header on Jobs → Stages beside Payment forecast. One line on Documents → Sent copies under the Bills chip. The four office roles that read Sent copies today see it, so no access rule changes.
6. **Out of the app.** Print and a CSV from the screen. For a weekly email, add one block to the Monday Bridge email he already gets, with a link. No new email.
7. **Reuse.** The kernel reads `sent_documents`, the invoice rows, the Stripe email rows, the statement rows and the pay-link texts, and writes nothing. Day bands, the copy window, search and the retry panel come from `src/lib/sent/` and `DocumentsSentLedger.tsx`. Messages → Went out is not the base: bill emails were never in it, and it reads seven days.
8. **Proof.** The sent copy is already close to evidence: the database stamps the time, the row cannot be edited, the copy carries a SHA-256, and Resend's id ties it to a delivery answer. One bill's record, with **Print this record**, puts every send of that bill in order. Three things would make it stronger: keep every delivery answer instead of the last, file a row when Stripe sends for us, and let a person record a by-hand send with a name. *Delivered* means their mail server took it, and the record says so. Whether that is enough for the Lien desk or the Legal desk is counsel's to say.

### What I would not build

- **A new ledger table.** It would be a second record of the same sends, and the two would drift.
- **Tracking of our own.** No pixel and no link wrapping. Resend's answer is enough.
- **Editing or deleting a line.** The record is append-only, and that is its worth.
- **Guessed addresses for old sends.** What was not kept is said, not rebuilt.
- **A push for every send.** The list is for looking, not for interrupting.
- **Other papers.** Lien notices, estimates and contracts stay on Sent copies.
- **A filter by sender, a date-range builder.** Three lines a day do not need them. Search and a month jump are enough.

### Is this the best we can do

The cheapest test was the count. It moved the design three ways. The record is already full for 36 of 36 emailed bills, so the build is a screen and not a system. Nine bills had no send at all, so the strip at the top is the part that answers his real question. And at three lines a day, the screen should stay simple.

One test is still owed, and only the master can supply it: the bill that made him ask. Before PR 1 is called done, find that bill on the screen and read its line to him.

## The train

| PR | What | Size | Database |
|---|---|---|---|
| 1 | **The screen, for the sends with a full record.** Kernel `src/lib/billing/billsSent.ts` (lines, day bands, totals, routes) with tests, `billsSentIo.ts`, page `/bills-sent`. Emailed bills, resends, statements, printed pay sheets, GC mode papers. Search, route chips, *Copy as sent*, the phone layout. The four office roles. Guide, release note, `APP_DIRECTORY.md`, `ACCESS_CONTROL.md`. | M | None |
| 2 | **The honest rows.** Housecall Pro and PDF bills by their invoice stamp. Sends before 2026-10-05 from the Stripe email rows. Texts with a pay link from `messages`. The strip **No send on record**. | M | None |
| 3 | **Arrived or not.** *Delivered*, *Bounced*, *Opened* on each email line, *Paid* since, and the tile **Did not arrive**. The assistant and the controller cannot read `email_send_log`, so a small read function returns the last event for a list of copies. | S | One function, no table. The client calls it, so push right after the merge |
| 4 | **The doors and one bill's record.** The press in the Billed header. The line under the Bills chip, and the chip in the address. The billed row's stamp and View bill's *Sent* line open the bill's record: every send in order, with **Print this record**. | M | None |
| 5 | **Out of the app.** Print and Download CSV. One block in the Monday Bridge email. | S | None. Deploy `bridge-weekly-sheet` |
| 6 | **Close the holes where a send is made.** A row is filed when Stripe sends for us. The bill email files its number and amount in `source_snapshot`, so a line shows the amount as sent. A statement files the bills it listed the same way. A press on a no-send row, **Say how it went**: handed over, mailed, from Housecall Pro, from my own mailbox, or paid in person and never sent, with to whom and when. | M | None: `source_snapshot` and the hows *hand* and *mail* exist. Deploy `send-stripe-invoice`, `send-gc-statement-email`, `gc-statement-email-dispatch` |
| 7 | **Every delivery answer kept**, if counsel wants it. `resend-webhook` appends each event instead of writing over the last. | S | One table |

PRs 1 to 3 answer the ask. PR 1 alone covers 36 of the 39 bills in the window and needs no migration.

Order with the other work of 2026-11-12:

- **#323 Pay calendar** edits `SendRecordInvoiceModal.tsx` (one line), `billedDatesLedger.ts` and the Stages row. PRs 1 to 3 here touch new files and one route, so they can go beside it. PR 4 touches `StagesJobCellActivityFooter.tsx` and `JobsStagesTab.tsx`'s Billed header: start it after #323's stack has merged.
- **#325** redraws the lien lines of the same billed row. PR 4 starts after its PR 1.
- **#318 Bridge spike** is reworking the weekly money card. PR 5's email block waits for it, and the Bridge's Bill desk can then read the same kernel.
- **#324 Messages**: nothing shared. Went out stays as it is.

## How to verify

- The count: a local copy of the app signed in at `/dev-login?as=1`, every request that is not a GET refused except the sign-in, then PostgREST by GET with the page's own session. The scripts and the tallies are in the shared notes folder of the lead session, in `327-bills-sent-ledger.md`. Counts only went into this card.
- The mock-up was shot at 375, 768 and 1400 wide, light and dark, with no element past the edge.
- For PR 1: the same read, then the screen's 30-day lines against the tally (38 email lines, 14 statements). Then the master's own bill.
- A send cannot be tested without sending. `test-email` with `file_copy_only: true` files a `self_test` copy and sends nothing. A ZZ Test customer and a test-mode Stripe bill do the rest.

## The calls

Grace's and the master's:

1. **Build it this way?** One screen over the records the app keeps. Or a new ledger table, which I advise against.
2. **What a line is.** Every send is its own line, and the total counts each bill once. Or one line a bill, with its sends inside.
3. **The gap strip.** A billed bill with no send on record is shown at the top. Or it is left off.
4. **Who may open it.** The four office roles that read Sent copies today. Or the master and developers only.
5. **The main door.** The Billed header on Jobs → Stages. Or a line in the menu. Or the Dashboard.
6. **The Monday email.** A block in the weekly Bridge email he already gets. Or no email.
7. **By-hand sends.** A press that says how a bill went and to whom. Or they stay as *No send on record*.
8. **Proof for counsel.** Keep every delivery answer. Or wait until counsel asks.

One thing only the master has: which bill made him ask.

## Where it stands

Built 2026-11-12 and 2026-11-13, on Grace's word: *build the PR train and let me know when it is live and the link for a master to access it*. The link is `https://clicktooling.com/bills-sent`.

The calls were taken as recommended, since she said build: one screen over the records the app keeps, every send its own line, the gap strip shown, the four office roles, a record made by hand offered. For the main door she asked for a button on the leaders' Dashboard; the answer is the Dashboard's pinned row (#7912), so the button goes to the people who want it.

| Step | What | State |
|---|---|---|
| 1 | The screen at `/bills-sent`: a line a send, day bands and totals, the search, the copy one press away. A door in the header search and a line under Documents → Sent copies → Bills. | v2.7049, live |
| 2 | The sends that kept no copy (an older email with no address, a Housecall Pro day, a text with the pay link) and the strip **No send on record**. | v2.7052, live |
| 3 | *Delivered*, *Opened*, *Bounced* on each email, *Paid* and the day, the tile **Did not arrive**. One read function, `bill_send_marks` (migration `20261113030000`, pushed). | v2.7053, live |
| 4 | One bill's record at `/bills-sent?bill=<id>`, with **Print this record**. | v2.7055, live |
| 5 | **Print** and **Download CSV** of what the list shows. | v2.7056, live |
| 6 | **Say how it went…** on a bill with no send on record: a record made by hand. | v2.7057, merged 2026-11-13 (#7827) |
| | Bills sent can be pinned to the Dashboard (Pin, and Pin for someone). | v2.7129, merged 2026-11-13 (#7912) |
| | The press in the Billed header on Jobs → Pipeline, after Paid notifications, and its row in the ☰ Section tools menu: the recommendation's door 5, asked for by Todd on 2026-11-13 with a screenshot. | v2.7146 (#7949) |
| | The phone layout: the list first, a short card a send whose whole face opens the record, presses a thumb can hit. | v2.7130, merged 2026-11-13 (#7917) |

What the live reads showed, counts only: 349 lines back to the spring under 101 days, 128 of them older emails that say the address was not kept, 24 open bills with no send on record and 58 more paid behind the press. Of the 69 emailed bills with a kept copy, 62 read *Delivered*, 6 have no answer from the mail server yet, and none bounced. The CSV's rows match the screen's lines, and the rows marked as in the day total add up to the screen's day totals.

The walks ran on the same build as the live site, against the live data, through a local copy with every write refused. Nobody signed in to clicktooling.com to walk it.

Left, and only the master can do it: find the bill that made him ask, and read him its line.

## What should change next

Notes, not built. Each is new behavior, a schema change or a refactor, so each waits for Grace's word.

1. **The doors on the Pipeline.** A **Bills sent** press in the Billed header beside Payment forecast, and the billed row's stamp (*Resend · Email sent …*) opening that bill's record at `/bills-sent?bill=<id>`. They edit `JobsStagesTab.tsx` and `StagesJobCellActivityFooter.tsx`. (S)
2. **One block in the Monday Bridge email.** Last week's bills sent, the count, the total and what did not arrive, with a link to the list. It belongs with the Bridge rework (#318). (S)
3. **The holes at the send itself.** When Stripe emails a bill for us, `send-stripe-invoice` files no sent copy, so the address is lost. The bill's number and amount are not filed with its copy, so a line reads today's amount and an older line has no number to search by. A statement does not file the bills it listed. All three live in `_shared/sentCopyEmail.ts`, which rides in every email function's bundle, so the fix is a full redeploy. (M)
4. **Keep every delivery event.** `resend-webhook` writes over `email_send_log.last_event`, so a line shows one word, not a history. Only if counsel asks. (S, one table)
5. **Split the path and the gate out of the kernel.** `src/lib/search/doors.ts` and `DocumentsSentLedger.tsx` import `BILLS_SENT_PATH` and `canOpenBillsSent` from `src/lib/billing/billsSent.ts`, so the whole kernel, about 1,000 lines, rides in the app's entry bundle on every page. Moving those two exports to a small file of their own takes it out. (XS, a refactor)
6. **The office edits the list under *How the bill went*.** The owner's ask of 2026-11-13, with three fixes to the form beside it: its own card, [#340](../bills-sent-how-it-went-list/README.md). He picked the chips, and a record has kept its words since v2.7145. (M)

One for the office, not code: once **Say how it went…** is live, the 24 open bills with no send on record can be cleared by saying how each went. Sixteen of them date from September.
