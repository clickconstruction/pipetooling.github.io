---
name: "Sub papers: a work statement per sheet, a payment record per sending and a statement of account, as PDFs that add up"
number: 350
group: ready
status: asked 2026-11-13 · the card and the mock-up the same day · read on the code and on prod through the dev seat, nothing written · nothing built
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
next: the owner's look at the mock-up and his answers to calls 1 and 2; PR 1 (the statement of account as a PDF, download only) needs neither
size: L as a train of seven (S · S · M · S · M · M · M)
blocker: none for PR 1 and PR 2; PR 3 is a migration; PR 4 waits on card #347's sending and on PR #7992's push; PR 5 and PR 6 are edge deploys; PR 7 waits on counsel's words
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
2. **One sending recorded once**, with a row per sheet tied to it, placed by hand with Oldest first as the fill. Its window is #347's to grow.
3. **A number per sending**, never reused. If #347 mints it, this card prints it. If not, PR 3 here mints it on the register.
4. **A Date sent on every new payment and a day on a back-charge** (#347's PR 4).
5. **The office note kept apart from the memo the sub reads** (#7992's call 3). A paper prints the memo only.
6. **An answer on overpayment** (#7992's call 1). If it becomes a credit, the statement of account needs a credit line.

## The plan

1. **The statement of account, as a PDF to download** (S). `_shared/subPapers.ts` with `buildSubStatementOfAccount` and its `addsUp` check, the HTML print and the PDF. **Statement of account…** on the Pay view's sub header and on People → Subs, with the period window. Filed as a sent copy when printed or downloaded. No number yet: the foot carries the day and time it was prepared. A method shows where a payment has one, else the memo. No migration, nothing from #347.
2. **The work statement** (S). The printed sub sheet grows into paper A: back-charges, payments, what it comes to, still open. **Work statement…** takes Print's place. No migration.
3. **The register and the numbers** (M, a migration). Table `sub_papers`: kind, number, revision, person, sheet, sending, period, the snapshot as issued, who and when, replaced by. The `WS-` mint per job, the `PR-` and `SA-` sequences. Policies for office staff. The migration ends with the four fence calls. Papers print again from their snapshot.
4. **The payment record** (S). Paper B. One per sending once #347 has sendings. For a payment recorded before then, one per row. The window after Record payment. Waits on PR #7992's push.
5. **Send** (M, an edge deploy). The send window, `send-sub-paper-email`, the texted link, the sent copies on the sub and the job, a guide. A sub with no email on the roster gets a line that says so and a door to add one.
6. **The portal's Statements tab** (M, an edge deploy of `sub-portal`). The three papers from the same kernel, paid sheets, the period, **Got it** on a payment record. Sits on #346's PR 6.
7. **Confirm a work statement** (M, behind a `SUB_PAPER_CONFIRM_LIVE` switch, off). The press, its record, the revision rule. Waits on counsel's sentence 2 and the owner's call 3.

## The owner's calls

1. **The names.** My pick: Work statement, Payment record, Statement of account, and *Still open* for what we owe. Your words go on once counsel has read sentences 1 to 6.
2. **How is one payment placed on several papers?** My pick: by hand, with Oldest first as the fill, shown before it is saved.
3. **Do subs confirm their work statement?** My pick: yes, as a press, and never a condition of being paid. What a confirm means is counsel's.
4. **Do payment records send by themselves?** My pick: no. The window after Record payment offers it. The portal shows the payment at once either way.
5. **What period does a statement cover by default?** My pick: since the last statement sent to that sub, and to date the first time.
6. **A sheet that is not payable yet.** My pick: it is on the statement under *Still open*, with counsel's one line about terms, and no due date.
7. **The *Paid this year* line.** My pick: keep it, leave out *Client direct*, and say it is not a tax form. Your accountant's call.
8. **The letterhead.** My pick: the bill's own block from Settings. The app has no logo to print.

## How to verify

- **Kernel tests carry the load:** a part payment on all three papers, a back-charge before and after a confirm, a sending over three sheets, a statement whose period starts after a sheet was part paid, a hidden memo, and the invariant that C's *Still open* equals the sum of A's across the sub and equals #346's Balance due.
- **On the live app, read only:** a sub's statement to date ends on their Balance due on People → Subs and on *owed* in the Pay view.
- **Test rows:** the test sub on the roster and its ZZ Test job. A paper is sent to a test inbox, never to a real sub.
- **Gotchas:** `payment_date` is a bare date and most old rows have none, so a statement must say *recorded* for those. A period's edges are cut in Central time. A sub with two portal links still has one set of papers.
