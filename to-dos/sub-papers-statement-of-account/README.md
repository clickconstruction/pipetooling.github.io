---
name: "Sub papers: a work statement per sheet, a payment record per sending and a statement of account, as PDFs that add up"
number: 350
group: ready
status: asked 2026-11-13 · the card and the mock-up the same day · read on the code and on prod through the dev seat, nothing written · the kernels built 2026-11-15 (v2.7401) · Taunya picked the card 2026-11-15 (*build the entire PR train*) · step 1, the window, live 2026-11-16 (v2.7453): a statement of account and a work statement to print or save, no numbers · step 2, the numbers' migration, on prod 2026-11-16 (v2.7474), its types following · Taunya kept the names 2026-11-16 (call 1) · step 4, the payment record, live 2026-11-16 (v2.7475) · step 5's function `send-sub-paper-email` merged 2026-11-16 (v2.7506), live since 2026-11-17 on the owner's word · step 3, the numbers on the papers, built 2026-11-16 (v2.7552) · step 5's press, the Send press, built 2026-11-19 (v2.7983) on Grace's go of that day · the press walked 2026-11-19 on Grace's yes, one work statement `WS-1113-1` to the mail service's test address, its sent copy on the sub and the job · the paper presses gated to the office 2026-11-20 (v2.8025), so a superintendent keeps Print · audited 2026-11-20 by a Fable 5.2 session, with four faults fixed as v2.8089, v2.8094, v2.8100 and v2.8106, the last on the owner's word (see *Audited 2026-11-20*) · the three faults that audit confirmed and left built 2026-11-21 (v2.8217): the first send's subject names the number, the office's payment record reads Got it, and the last press's line goes on a move · on the owner's word of 2026-11-21 (*Please do*): the audit's three open lines (v2.8262: papers past 12 get their own email, a failed read draws no sheet as unpaid, the window's presses take a thumb), a door for a sub with no email on the send step's To line (v2.8265), a payment typed late carried to the next statement on the owner's call of that day (v2.8269), and confirming a work statement built and switched off (v2.8273), with the dev seat's *since_last* brought to the same rule (v2.8274) · counsel's words are what is left (see *Where it stands*)
summary: >
  The owner wants to make part payments to a sub and hand them a paper that shows what is
  outstanding, our last payments and what we still owe, as PDFs: each piece of sub work as a
  reverse invoice, each payment as a receipt, and a statement of account over both. Today the
  only paper is the printed sub sheet, with no number, no payments and no balance, and one
  sending that pays several sheets is a row per sheet with nothing tying them. The card draws
  three papers that carry the same figures: a work statement per sheet, a payment record per
  sending that says how much went to each sheet and what stays open, and a statement of account
  for a period. It names them for what they are, marks six sentences for counsel, and stands on
  the hours statement's way of making a PDF. It builds on card #347's ledger and payment window.
next: counsel's words for sentence 2, then the confirm's switch (`SUB_PAPER_CONFIRM_LIVE`) and a walk on the test sub's page · a walk of the To line's save and of a send in two emails, on the test sub with the mail service's test address
size: L as a train of seven (S · S · M · S · M · M · M)
blocker: a real door for a sub with no email waits on Grace's word about the function, since it means a redeploy; PR 7 waits on counsel's words
opinion: build PR 1 now, it is the paper he asked for and reads rows the Pay view already holds; settle the names before PR 3 prints a number under one; do not let a paper say invoice, receipt or owed until counsel has read the six marked sentences
mockup: to-dos/sub-papers-statement-of-account/mockup.html
---

# Sub papers: a work statement, a payment record and a statement of account (#350)

## The ask

The owner, 2026-11-13:

> Looking at subs, I want to be able to make partial payments and offer a sub their outstanding
> due and our last payments to them and how much we still owe them, like a statement of account
> or pay due report. Would you be able to help me come up with how this could look if we were to
> build it? Usually we have to offer these via PDF, so perhaps we need to be able to treat all
> sub labor as a reverse invoice (as though it is coming from them to us) and a payment receipt
> (as though we are paying those invoices) and a statement of account (showing the invoices and
> what we still owe).

## Beside cards #346 and #347

- **#346** (*People → Subs shows what makes up what we owe each sub*) is the same money on screen, by job. Its open row is the on-screen form of the statement of account. Its rule for whose a sheet is (`sheetParties`, `isRosterSub`) decides whose paper a sheet makes.
- **#347** (*Sub payments as a ledger*) is the same money by date, and it owns the payment itself: the Record payment window (PR #7992), the method, the ledger and one sub's on-screen statement with a running balance.
- **This card is the papers.** It draws no second ledger and no second payment window. Where it needs something from #347 it says so under *What this card asks of card #347*.

## What is there today

Read on 2026-11-13, counts only.

- **One paper exists.** The printed sub sheet (`buildSubLaborSheetHtml`, filed as `sub_labor_sheet`): the job, the lines, a total. No number, no payments, no back-charges, no balance.
- **A payment has no paper and no number.** It is a row on one sheet (`people_labor_job_payments.job_id`): amount, memo, Date sent, and whether the memo is hidden from the sub.
- **A part payment already works.** A sheet takes any number of payments. 4 sheets were paid in parts.
- **One sending over several sheets is a row per sheet.** Grouping payments by sub and day gives 38 sendings. 19 of them cover several sheets: 68 of the 87 payment rows, $57,484, the largest across 9 sheets. Rows with no Date sent group by the day they were typed, so 19 is a ceiling.
- **Most payments have no Date sent.** 62 of 87. None of the 3 back-charges has a day.
- **The method lives in the memo.** 50 of 87 memos name one. PR #7992 gives it a field.
- **The sub's portal** (`SubPortal.tsx`, *Work & pay statement*) shows open sheets only, their lines, Agreed · Paid · Backcharges · Open, all-time totals and the last 90 days of payments. Print prints the page. A sub agrees to an amount in one place only: signing a work order.
- **Reaching a sub.** Of 25 people of kind `sub`, 13 have an email on their login and 12 a phone.

## The three papers

Mock-up: `to-dos/sub-papers-statement-of-account/mockup.html` (on the dev server at `/to-dos/sub-papers-statement-of-account/mockup.html`). Made-up names and amounts throughout. The same three figures are tagged A, B and C wherever they repeat.

**A. Work statement, one per sub sheet.** The owner's *reverse invoice*.

- The sub, the job and its address, the day of the work.
- Each line and its amount. *Agreed for this work.*
- Each back-charge as a red line with its day and its reason. *This statement comes to.*
- Each payment on it: the day, part or full, how it was sent, the payment record's number.
- *Paid so far* and *Still open on this statement*, boxed.
- A box that says whether the sub confirmed it, which revision, and when.

**B. Payment record, one per sending.** The owner's *payment receipt*.

- Who was paid, the day it was sent, how, the reference, the amount.
- *Applied to*: a row per work statement with **open before**, **this payment** and **open after**, and the words *Part payment* or *Paid in full*.
- *After this payment*: every statement still open and the total.
- The office's note to the sub.
- A box that says whether the sub marked it received.

**C. Statement of account, one sub, a period.**

- *Still open* on the closing day, boxed at the top.
- Statements brought forward from before the period, then the work in the period. Each row: what it comes to, paid, open, and one line of words (part payments, a back-charge, paid in full on a day).
- *Last payments*: the day, how, the number, the amount, and the period's total.
- *How it adds up*, in one line: open at the start, plus new work, less back-charges, less payments, equals still open.

**A part payment reads the same on all three.** On A it is a line under *Paid on this statement*. On B it is a row whose *open after* is not zero. On C it is in the row's *Paid* and in its words. The kernel checks that the three agree before any paper is drawn, and refuses to draw one that does not add up.

**A change makes a revision, never a new number.** A back-charge after a work statement went out makes revision 2. The copy that was sent stays in the sent copies.

## How a payment is applied across papers

**What the data holds.** A payment belongs to one sheet. Nothing ties the rows of one sending. There is no rule in the app for oldest first, and no overpayment: PR #7992 refuses a payment past what remains on a sheet.

**The pick.** One sending is one act: a day, an amount, a method, a reference and a number. The office places it on named sheets. **Oldest first** fills the boxes as a start, and every box can be changed by hand. The press is dead until the parts sum to the amount, and it names its act: *Record $2,200.00 on 2 statements*. It is stored as today's row per sheet, tied by the sending.

Never applied silently. A sub reads the payment record and must find their own arithmetic on it.

## What to call them

| The owner's word | The name on the paper | Why |
|---|---|---|
| Reverse invoice | **Work statement** | We wrote it from our records. An invoice is the seller's paper. |
| Payment receipt | **Payment record** | A receipt is the word of the one who received. We can only say we sent it. |
| Statement of account, pay due report | **Statement of account** | The usual name. It claims nothing but our own books. |
| What we still owe | **Still open** | *Owed* can read as due today. Much of it waits on a customer's payment or an inspection. |

**Would a sub's confirm make it theirs?** A sub pressing **Confirm** on their portal is recorded the way a signed work order is today: their name, the time, the address it came from, and the revision they saw. Whether that turns our statement into their bill is counsel's call, not the app's. The same goes for **Got it** on a payment record.

**Six sentences on the papers wait on counsel.** The repo's rule is that legal papers use counsel's words. These are drafted in plain words as placeholders and marked § on the mock-up:

1. *[Company] prepared this statement from its own records. It is not an invoice from [sub].*
2. *By confirming, [sub] agrees that the statement is its bill to [company] for this work.*
3. *Payment follows the terms of the work order for this job.*
4. *This record shows a payment [company] sent. It is not a release or a waiver of any lien right. A waiver is a separate paper.*
5. *This figure is for your records. It is not a tax form.*
6. *Open amounts are paid under the terms of each job's work order.*

**Two questions for counsel or the accountant, not for the app.**

- **Lien waivers.** The Pay view already sends the Texas § 53.284 waiver as its own paper. Should a payment record name the waiver that goes with it, or say nothing?
- **Tax records.** The app has no 1099 feature. The statement's *Paid in 2026* line is the sum of payments by Date sent. A back-charge is not a payment. A payment marked *Client direct* was not ours. Whether the line belongs on the paper at all is the accountant's call.

## Where each is made and seen

**In the office.** No new page. Each paper is a press where its row already is.

| Press | Where | Makes |
|---|---|---|
| **Work statement…** | a sheet's ⋯ menu on Jobs → Subs → Pay, in place of Print. A sheet in #346's open row | A |
| **Payment record…** | a payment's line on the sheet, on #347's ledger line, and the window after Record payment | B |
| **Statement of account…** | the sub's header on the Pay view, #347's by-sub statement, #346's open row in place of *Print statement* | C |

**Statement of account…** opens a window: the period, what it will show, what to attach, then Preview, Download or Send.

**Send.** One window for all three: who it goes to, by email or as a texted link, the real message, the files, and a box that says what the press does. Email carries the PDFs. A text carries a link to the same papers on the sub's page. Every send is filed as a sent copy on the sub and on each job, so the office sees what the sub was given and when.

**On the sub's portal.** A **Statements** tab: the statement of account to date, live, with a period and Save as PDF. Every work statement, paid ones too, with its PDF and **Confirm**. Every payment record with its PDF and **Got it**. A memo the office hid stays hidden. The amounts always show.

## How the PDF is made

**Stand on the signed hours statement.** One pure kernel builds the words and the numbers. An HTML print and a pdf-lib PDF both read it. The kernel sits under `supabase/functions/_shared/`, so the app, the portal's function and the tests draw the same paper. The statement of charges adds the other half: a saved snapshot, so a paper prints again exactly as it read.

| Piece | Exists | New |
|---|---|---|
| A sheet's money | `subLaborJobBalance` | reused |
| Whose a sheet is | `sheetParties`, `isRosterSub` | reused |
| One sub's lines by date | #347's `subPaymentsLedger` | read, not copied |
| The papers' model | none | `_shared/subPapers.ts`, pure: three builders and one `addsUp` check across them |
| The PDF | `_shared/hoursStatementPdf.ts` as the pattern | `_shared/subPapersPdf.ts` |
| The print | `openHtmlPrintWindow`, `printPdfAndFile` | reused |
| Letterhead | the bill's issuer block (`physical_invoice_issuer_v1`), used by bills, demand letters and lien papers | reused. The app holds no logo |
| Dates | `todayYmdInAppTz`, `_shared/appTimeZone.ts`, Central time | reused. The paper says which zone |
| Sent copies | `sent_documents`, a new kind needs no migration | kinds `sub_work_statement`, `sub_payment_record`, `sub_statement_of_account` |
| Email with a file | `sendEmailViaResend` with `options.file`, as the bill's email | one function, `send-sub-paper-email` |
| The numbers | `HS-<job>-<n>` and `SC-<job>-<n>` per job. The box sticker's sequence, never given out twice | below |

**Numbers.**

- **Work statement:** `WS-<job>-<n>`, the house style, minted the first time the sheet's paper is made. It belongs to the sheet for good. A change is a revision.
- **Payment record:** `PR-<n>` across the company, from a sequence, since one sending spans jobs.
- **Statement of account:** `SA-<n>` across the company.
- **Never reused.** A paper that is voided keeps its number and reads *void*. A deleted sheet's number is not given to another.

## Who may see and send

- **The office roles who see sub pay today:** dev, master, assistant, controller. They make, download and send. Nobody more.
- **A superintendent** has no policy on the payments table and gets no press.
- **A sub** sees their own papers on their portal and no one else's. A teammate named on a sub's sheet gets no paper for it: the paper is the sheet's sub's (the rule of #346, and its PR 6).
- **Crew sheets** make no papers. They pay through payroll.
- **Sent copies** are read by the office roles only, as they are today.

## What this card asks of card #347

1. **The method and its reference on a payment.** PR #7992 adds both. The papers print them.
2. **One sending recorded once**, with a row per sheet tied to it, placed by hand with Oldest first as the fill. Its window is #347's to grow. **Built in #347, v2.7235**, with the fill, and the hand placement since v2.7404: `sub_payment_sendings`, and `people_labor_job_payments.sending_id` on each row.
3. **A number per sending**, never reused. If #347 mints it, this card prints it. If not, PR 3 here mints it on the register. **#347 mints it, v2.7235**: `sub_payment_sendings.number`, from a sequence. A payment recorded before then has none.
4. **A Date sent on every new payment and a day on a back-charge** (#347's PR 4).
5. **The office note kept apart from the memo the sub reads** (#7992's call 3). A paper prints the memo only.
6. **An answer on overpayment** (#7992's call 1). **Answered 2026-11-13: it becomes a credit**, so the statement of account needs a credit line. Card #347's call 6 holds what the credit is.

## The plan

1. **The statement of account, as a PDF to download** (S). `_shared/subPapers.ts` with `buildSubStatementOfAccount` and its `addsUp` check, the HTML print and the PDF. **Statement of account…** on the Pay view's sub header and on People → Subs, with the period window. Filed as a sent copy when printed or downloaded. No number yet: the foot carries the day and time it was prepared. A method shows where a payment has one, else the memo. No migration, nothing from #347.
2. **The work statement** (S). The printed sub sheet grows into paper A: back-charges, payments, what it comes to, still open. **Work statement…** takes Print's place. No migration.
3. **The register and the numbers** (M, a migration). Table `sub_papers`: kind, number, revision, person, sheet, sending, period, the snapshot as issued, who and when, replaced by. The `WS-` mint per job, the `PR-` and `SA-` sequences. Policies for office staff. The migration ends with the four fence calls. Papers print again from their snapshot.
4. **The payment record** (S). Paper B. One per sending once #347 has sendings. For a payment recorded before then, one per row. The window after Record payment. Waits on PR #7992's push.
5. **Send** (M, an edge deploy). The send window, `send-sub-paper-email`, the texted link, the sent copies on the sub and the job, a guide. A sub with no email on the roster gets a line that says so and a door to add one.
6. **The portal's Statements tab** (M, an edge deploy of `sub-portal`). The three papers from the same kernel, paid sheets, the period, **Got it** on a payment record. It sat on #346's PR 6, which is not built: a sheet names one person, so a sub's portal shows only their own sheets (card #346, call 3).
7. **Confirm a work statement** (M, behind a `SUB_PAPER_CONFIRM_LIVE` switch, off). The press, its record, the revision rule. Waits on counsel's sentence 2 and the owner's call 3. **Built 2026-11-21, v2.8273, and switched off**, on the owner's word (*Please do*): the press on the sub's page, the `confirmed` row and the rule that reads it onto the work statement on both sides. A sub confirms only a copy the office made and that has not changed since. Turning it on waits on counsel's words for sentence 2: it is a one-line change, a client deploy and a redeploy of `sub-portal`, then a walk on the test sub's page.

## Where it stands

The kernels are on main (v2.7401): `subPapersHtml.ts`, `subPapersInputs.ts` and `subPaperSend.ts` in `src/lib/subWorkOrders/`, and `supabase/functions/_shared/subPapers.ts` and `subPapersPdf.ts`, with their tests. Everything else was built in the sub labor design spike, where Taunya saw it as screenshots. It sits on the pushed branch `claude/sub-labor-spike-82d6a9` at commit `7616bc399`. That branch is never merged; keep it until this card closes. Take whole files with `git checkout 7616bc399 -- <path>`. In a shared file take only the papers' hunks: `git diff origin/main 7616bc399 -- <file>` shows them beside hunks that shipped another way.

Cut each PR from fresh `origin/main`, in this order:

1. **The window** (PR 1 and PR 2 above). **Built, v2.7453.** `src/components/jobs/SubPapersWindow.tsx` and `SubPapersWindowConnected.tsx`. *Statement of account…* on People → Subs and on a sub's group in Jobs → Subs. *Work statement…* takes Print's place on the ⋯ menu of a sheet that is one person's. No numbers yet. The view keeps the snapshot's payment record pick, send step and *Since the last statement*, each drawn only when its caller hands it in (`paymentRecords`, `canSend` with `onSend`, `lastStatement`), so steps 3 to 5 turn their part on in `SubPapersWindowConnected.tsx`. The phone's sheet of actions and the opened row keep Print.
2. **The numbers' migration, alone** (PR 3's database half). **On prod since 2026-11-16, v2.7474, as `20261117040000_sub_papers.sql`**, with the bed `sub-papers`. It adds to the snapshot's file: both functions refuse a training account, a digital twin and an archived account, the mint locks per sheet and per sending, and the tables are read-only by grant. The snapshot's `supabase/migrations/20261115060000_sub_papers.sql`: `sub_papers`, `sub_paper_job_counters`, `sub_paper_acks`, `mint_sub_paper` and `void_sub_paper`. Renumber it from `origin/main`'s newest file, claim it, and give it a SQL bed of its own. No client code calls it, so its merge holds no deploy. Push it right after the merge, prove it on prod, then the types PR.
3. **The numbers on the papers** (PR 3's other half). **Built, v2.7552.** Written, not cut: the snapshot never called the mint. Print and Download register the paper through `mint_sub_paper` first (`src/lib/subWorkOrders/subPaperRegister.ts`), then draw it under its number. A paper the register refuses is not made. The mint was first called on prod on 2026-11-19, by the Send press's walk: `WS-1113-1`, the test sheet's. The window calls `mint_sub_paper`, only after that push.
4. **The payment record** (PR 4). **Built, v2.7475**, ahead of step 3. A payment record prints its sending's own number (`PR-<n>`), since the names are kept. The after-payment window's press reads *Payment record…* and opens the paper; step 5 makes it *Send the payment record…*. *Payment record…* beside a payment on the sheet, and `AfterRecordPaymentWindow` after Record payment in `src/components/jobs/SubLaborPaymentModals.tsx`. Its tests in `SubLaborPaymentModals.sending.render.test.tsx` are rewritten.
5. **Send** (PR 5). The function `send-sub-paper-email` alone first, deployed only on Taunya's go that names it. **The function is merged, v2.7506, and live since 2026-11-17** (version 1, 02:01 UTC). It went up ahead of Taunya's go, by a deploy outside the build session, and the owner said the same day to leave it deployed. It boots: a call with no login is refused by its own code. Nothing in the app calls it until the press lands. It sends as the company to the roster's own address and keeps each paper as a sent copy of its own. A texted link is not built, so the press offers email alone.
   **The press is built, v2.7983**, on Grace's go of 2026-11-19 (*Please build*). It was cut from fresh `main` with the hunks of the pushed branch `claude/350-send-press`, which is never merged and can go once this card closes. *Send to <name>…* in the papers window opens a send step: who it goes to, the message, the files, what the press does, then *Send 3 papers by email*. The window after Record payment reads *Send the payment record…* and opens on that step. Only a dev, a master technician, an assistant and a controller are offered Send, and an account in training is not.
   Past the branch: the papers of one email are registered as one set, every work statement first, so the statement of account names each by its number (`registerSubPaperSet`). One email carries 12 papers and the rest are held and named. The step offers *Done* once the papers went. The window's period holds while it is open. `docs/recent-features/v2.7983.md` has each.
   **What is left of this step.**
   - *The live walk, done 2026-11-19.* Grace said yes to one address on one row: the mail service's own test address, which takes a mail and delivers it to no person, on the roster's test sub (*"Yes, use it"*, relayed by the lead session). The address went on through Settings → People as the dev. On the test sub's one sheet, on its ZZ Test job: *Statement of account…* on the Pay view, the sheet's work statement, *Send to <name>…*, then *Send 1 paper by email*, pressed once. The window read *Sent 1 paper to … at delivered@resend.dev* and the press turned into *Done*. The register gave the paper `WS-1113-1`, its first row on prod. The function filed one sent copy, kind `sub_work_statement`, on the person and the job, with the PDF and the page it went in. Documents → Sent copies lists it, and so does *Sent from this job* in the job's window. The address came back off the row afterwards, through the same door, and the row was read again on prod: no email, as before. No statement of account was made, so no `SA-` number is spent. Left behind: the register's row, the sent copy and one line in the email log.
     The press was made on a local build of `main` at the merge, against prod, signed in through the app's own dev sign-in. No session was moved onto the live site. The Pages deploy of that merge succeeded at 05:11 UTC on 2026-11-20, and the live build was read to carry the press: its code calls `send-sub-paper-email` and holds the label *Send the payment record…*. The press has not been made on the live site itself, which needs a person signed in there.
   - *A real door for a sub with no email. Built 2026-11-21, v2.8265*, on the owner's word (*Please do*), another way than the pick below. The send step's To line takes the address in place and saves it on the roster row, for the office roles who send. Read on prod that day: the standing update policy on `people` already lets those roles write any roster row, so the gap was a screen and nothing in the database changed. The function is not changed: it still sends only to the roster's own address. A sub's sign-in address is offered under the To line and goes on the row only on its press. Not written on prod: the save is a write to a real sub's row. What follows is the door as it stood. The press is dead for such a sub and the line says so, with Print and Download as the way out. Read on prod on 2026-11-19, counts only: 24 active subs, 13 with no email on the roster row, 2 of those with an address on the login tied to the row. **Only a dev can add one today.** Every one is tied to a login row, so the office's roster edit does not reach them, and the desk's email change does not copy onto an empty roster row. A dev edits a row another account made in Settings → People; a row the dev made has no edit there. My pick: the function falls back to the login's address, the rule the work order send already uses, and the window's door opens the sub's desk. That changes the function and means a redeploy, so it was asked of Grace on 2026-11-19. She has not said yes, and the lead session's advice was to keep it out of the press's own change, so the press shipped on the function as it is.
   - *The Pay view's three presses for a superintendent, done 2026-11-20 (v2.8025).* A superintendent reaches the Pay view and was shown *Statement of account…*, *Work statement…* and *Payment record…*, which the register refused. The presses now show only for the office roles who see sub pay, on the Pay view and on People → Subs, and a superintendent keeps Print.
   - *The first email of a work statement had no number in its subject, fixed 2026-11-21 (v2.8217).* The send step builds the subject from the paper as previewed, and the register numbers the paper only when Send is pressed. So a sheet's first work statement went out as *Work statement from <company>*, while its file was `WS-1113-1.pdf`. The walk's own email read so. The connected window's send now builds the subject again from the lead paper as numbered (`subPaperSendSubject`), and the step says the subject will name the number. A statement of account still names no number in its subject, and a payment record already carried its sending's. Not pressed on a live build: a send needs an address on the test sub's row.
   - *Papers past 12 had no press of their own. Built 2026-11-21, v2.8262*: the send step sends one email at a time, and *Open the next email, <n> papers* opens the one the held papers go in, before or after the first went (`subPaperSendParts`). A later email reads *More papers from <company>, email 2 of 3*. What follows is the fault as it was noted. One email carries 12 papers, the function's limit (`SUB_PAPER_SEND_MAX`). A statement of account sends the first 11 that ride along, oldest first, and a yellow line names the rest. Nothing sends the rest: another statement attaches the same first 11 again, so the office opens each held sheet's work statement and sends it alone. It takes a sub with more than 11 open sheets, and that is close: on 2026-11-20 one sub had 10. A fix would be a press under the yellow line that opens the send step on the held papers. Noted 2026-11-20, from the press's own review.
6. **The portal tab** (PR 6, with PR 7's confirm left behind its switch, off). **Moved to card #371**, with a mock-up and calls of its own. **Built and live 2026-11-17** as the sub's *Statements* view (v2.7569, v2.7597, v2.7609), walked on the test sub, and #371 retired the same day; its record is the #371 paragraph under *Closed* in `to-dos/README.md`. The confirm stays off.

Hard lines:

- The six sentences for counsel stay marked placeholders, and no paper says invoice, receipt or owed. That holds the papers' own labels. A line the office typed on a sheet prints as typed: on the live look of 2026-11-16 one sheet's line was the sub's own bill number, and its work statement prints that line's words. Whether a typed line may say so is a question for call 1 and counsel.
- Send puts a paper in front of a sub. The press is the office's since v2.7983. A walk or a test sends to a test inbox, never to a real sub.
- Where the snapshot calls `useTeamSheetRule()`, use `TEAM_SHEET_RULE` from `src/lib/subWorkOrders/teamSheetRule.ts`, as the merged train did.
- Leave out what is the spike's alone: `src/spike/*`, `spike-sub-labor.html`, `src/hooks/useTeamSheetRule.ts` and `src/lib/subWorkOrders/sheetAmountsView.ts`.

## The owner's calls

1. **The names.** My pick: Work statement, Payment record, Statement of account, and *Still open* for what we owe. Your words go on once counsel has read sentences 1 to 6. **Taunya's to answer**, since she picked the card on 2026-11-15. **Answered 2026-11-16: she keeps the names**, relayed by the owner. A number may print under them.
2. **How is one payment placed on several papers?** My pick: by hand, with Oldest first as the fill, shown before it is saved. **Built as picked** in v2.7404, card #347's *By hand*.
3. **Do subs confirm their work statement?** My pick: yes, as a press, and never a condition of being paid. What a confirm means is counsel's. **Built as picked 2026-11-21 (v2.8273), switched off**: the owner said to build PR 7, and the press says *You are paid the same whether or not you confirm.*
4. **Do payment records send by themselves?** My pick: no. The window after Record payment offers it. The portal shows the payment at once either way.
5. **What period does a statement cover by default?** My pick: since the last statement sent to that sub, and to date the first time. Since v2.8106 a statement made earlier the same day does not move it. The period still starts after the last statement from before today. **How a period is cut, answered by the owner 2026-11-21: by the date on the payment, and a late one is carried.** A payment typed after the last statement was made and dated inside it is listed on the next statement under its own date, so each statement opens on what the last one closed on. Built in v2.8269, for a back-charge and a sheet typed late as well.
6. **A sheet that is not payable yet.** My pick: it is on the statement under *Still open*, with counsel's one line about terms, and no due date.
7. **The *Paid this year* line.** My pick: keep it, leave out *Client direct*, and say it is not a tax form. Your accountant's call.
8. **The letterhead.** My pick: the bill's own block from Settings. The app has no logo to print.

## Audited 2026-11-20

The owner asked for this card's work to be audited by a session on Fable 5.2. The findings, the method and nine sheets of
screenshots are in the lead session's shared notes (`review-350-sub-papers.md` and the `review-350-screenshots` folder).
Every build of the train carries the Fable 5.2 trailer except the office gate of v2.8025 (#9014), which is Opus 5.5.

**What held.** The money is right. The audit rebuilt the papers of all 14 people who have them from the app's own reads:
94 sheets and 84 payment records. Each sheet's Agreed, Paid, back-charges and Still open match arithmetic written apart
from the kernel, to the cent. Each statement matches the Pay view's balance. All 192 PDFs were drawn and every figure was
read back off the page. Twelve periods a person, 168 statements, each add up, and each opens on what the one before
closed on. What prod does not hold yet was run on made-up rows and checked by hand: a credit kept, a credit used, a
customer paying the sub direct, and one check over two sheets. The register cannot repeat a number. A gap is possible only
for an `SA-` number whose send failed after the mint, and the window says so. The office gate is the same in the app, the
database and the function: through the dev seat the sample superintendent is refused the mint and reads no paper. Every
edge function was current. The walk's sent copy and register row are as *Where it stands* says, and so is the count of
13 of 24 active subs with no email.

**Four faults, fixed.**

- **v2.8089 (#9103).** A box that ran over a page left the first page with no frame and the last with an empty one below
  the text. Two real subs' statements did this. The frame is now drawn on every page the box covers, and the lists that
  had no page check ask for room first. The edge function `sub-statement` draws the same PDF and was redeployed after the
  merge.
- **v2.8094 (#9106).** On a phone the papers window opened under the *What we owe* sheet, with every press covered. It
  opens on top now.
- **v2.8100 (#9150).** A paper's press drew nothing while its first reads were slow. The window now opens at once and
  reads *Getting the papers ready…*, with Close.
- **v2.8106 (#9116), on the owner's word.** A second statement of account on the same day read a backwards period, such
  as *Nov 21, 2026 to Nov 20, 2026*. Its figures were right. A statement made today no longer moves *Since the last
  statement*, as call 5 now says.

**The two rough edges.** The subject with no number was small, as the card says, and is fixed in v2.8217. Papers past 12 is closer than it looked,
as step 5 now says, and has its press since v2.8262. The card missed one more: held papers and files not yet numbered are named by their job, so several
sheets of one job read alike. Since v2.8262 a held work statement names its sheet's day too. A file is still named by its job until its paper is made and numbered.

**Still open.**

- *A payment typed on a later day and dated on or before the last statement's closing day. Built 2026-11-21, v2.8269, on the
  owner's call of that day* (call 5): cut by the date, and a late one is carried. *Since the last statement* lists it under its
  own date as *recorded after the last statement* and opens on what the last one closed on. The fault as it was: no statement lists it under
  *Last payments*, though its amount is in the next statement's opening figure. On made-up rows one statement closes at
  $750 and the next opens at $550 with no payment listed. The owner's call: is a period cut by the date on the payment or
  by the day it was typed?
- *The office's payment record ignored Got it. Built 2026-11-21, v2.8217.* It always said *Not marked yet*, even after the sub
  pressed Got it, since the window never handed the sub's marks to the builder. The window now reads the person's marks
  before it draws, and the preview, the PDF and the register's snapshot say the day. A read that fails leaves
  *Not marked yet* and the window says it could not tell.
- *The last press's line stayed* when the paper or the step changed. *Built 2026-11-21, v2.8217*: it goes on either move, and
  stays gone on the way back. A statement's period is not a move, since the line names its file.
- *The Pay view's ledger ignored a failed read* of lines or payments, and the papers stand on it. One failed payments read
  would draw every sheet unpaid, and a statement made then would say so under a number. Seen in the code, not on prod.
  *Built 2026-11-21, v2.8262*: a read that fails is not drawn. The ledger keeps what it last read whole and the page says
  why (`subLedgerReadFailure`), on the Pay view and on People → Subs.
- *On a phone* every press in the window was 26 to 33 px tall. *Built 2026-11-21, v2.8262*: each stands 44 px tall at 640 px
  and under. The phone's Pay view had no paper press: the door on a phone was People → Subs. *Built 2026-11-22, v2.8303*, on
  the owner's word: a sheet's bottom sheet of verbs offers *Work statement…* in Print's place and *Statement of account…*
  after it, on a sheet that is one person's and for the office. A payment record is reached from the window's own pick.
- *The dev seat and the window differed, built 2026-11-21 (v2.8274)*: the seat's *since_last* now sets a statement made today apart and carries a line typed late, as the window does. `sub-statement` is redeployed after the merge. As it was noted: *The dev seat and the window differ* after a statement made today. The seat refuses *since_last* and asks for
  *to_date*. The window runs from the last statement before today. Since v2.8269 they differ in one more way: the window's
  *Since the last statement* carries a line typed late, and the seat's *since_last* is still cut by the date alone. The
  owner's call covers both. Bringing the seat to the window's rule changes `_shared/subStatementMake.ts`, `sub-statement`
  and the seat's own words, and is not built.
- Lower: the letterhead reads *Our company* when Settings cannot be read on a browser that never loaded it. The window says
  the copies are filed, though the function files them best effort. A paper rounds each line and the Pay view rounds the
  sum. No live sheet differs.
- *Not done by the audit.* No real send, since one needs an address written onto the test sub's roster row. The live site
  was not walked: everything ran on a local build of `main` against prod, read only. The *do not add up* state and the
  Print tab were not shot. The Record payment window opens from the same phone sheet and stacks under it. That window is
  card #347's and was not walked.

## How to verify

- **Kernel tests carry the load:** a part payment on all three papers, a back-charge before and after a confirm, a sending over three sheets, a statement whose period starts after a sheet was part paid, a hidden memo, and the invariant that C's *Still open* equals the sum of A's across the sub and equals #346's Balance due.
- **On the live app, read only:** a sub's statement to date ends on their Balance due on People → Subs and on *owed* in the Pay view.
- **Test rows:** the test sub on the roster and its ZZ Test job. A paper is sent to a test inbox, never to a real sub.
- **Gotchas:** `payment_date` is a bare date and most old rows have none, so a statement must say *recorded* for those. A period's edges are cut in Central time. A sub with two portal links still has one set of papers.
