---
name: "Sub payments as a ledger: every payment made to a sub, by date, on Jobs → Subs and People → Subs"
number: 347
group: ready
status: asked 2026-11-13 · PR 1 (dates on the Pay rows), PR 2 (the Ledger by date), PR 2b (the Record payment window), PR 3 (by sub, one sub's statement, People → Subs, v2.7231) and the credit with sendings (v2.7235, migration 20261114020000) are built · the owner 2026-11-13: an overpayment becomes a credit, and "build it all"
mockup: to-dos/subs-payments-ledger/mockup.html
summary: >
  The owner wants to reconcile the payments made to subs and cannot see them by date. The Pay
  view is one row per sheet, a payment's date shows only inside an opened row and never on a
  phone, and People → Subs loads every payment and shows none. The card adds the payment dates
  to the Pay rows, then a third view on Jobs → Subs, the Ledger: one line per payment or
  back-charge, newest first, a total for each month, a search, a period, Print and a CSV. The
  same view groups by sub, where one sub's lines read oldest first with a running balance that
  ends on the roster's Balance due, and People → Subs opens on that grouping. The first three
  PRs read what the Pay view already loads and need no migration. A check mark against the bank
  and a How paid field are the first step that stores anything, and matching a payment to a
  bank line waits on how subs are paid.
next: PR 4, the check mark; then PR 5, the match to Mercury
size: M as a train of six (XS · S · S · S · S · M)
blocker: none; PR 4 and PR 5 each carry a migration that is pushed right after its merge
opinion: PR 4 ticks a sending, not a row, now that one check is one sending; a row from before sendings is ticked by itself
---

# Sub payments as a ledger (#347)

## The ask

The owner, 2026-11-13, on Jobs → Subs → **Pay**, with the **Paid** chip on:

> On this screen, I want to be able to see the dates payments were made

and a few minutes later:

> in the [Jobs → Subs → Pay] and [People → Subs] views I want to have the ability to see things
> as a ledger so I can quickly reconsile payments we have made to people. help me come up with
> a mockup and plan to add this

## What is there today

- **A payment has a date and the page hides it.** The Pay view (`JobsSubLaborTab`) is one row per sheet: Agreed, Paid, Due, Where it stands, Pay when. A paid sheet reads *Paid · balance is $0*. The dates sit in the opened row's **Payments** table (Date, Type, Amount, Memo), one sheet at a time.
- **A phone shows no payment at all.** The phone rows open a sheet of verbs. There is no payment list.
- **People → Subs shows one figure.** `PeopleSubsTab` reads every payment (`id, job_id, amount, memo, created_at`) to work out Balance due and draws none of them. It does not read `payment_date`.
- **Nothing is in date order across sheets**, nothing totals a month, and nothing exports. No CSV of sub payments exists, and the printed sub sheet carries no payments.
- **The app does not know how a sub was paid.** A payment row (`people_labor_job_payments`) holds `amount`, `memo`, `payment_date` (the modal's *Date sent*), `created_at`, `hidden_from_sub`, `sequence_order`. There is no method, no check number, no who-recorded-it, and no link to a bank line. A back-charge is a row below zero, saved with no `payment_date`.
- **Moves and removals are recorded** in `people_labor_job_payment_events` with the actor and a reason. The opened row already draws them as grey traces (`subPaymentTraceLines`).

Every payment and event is already in memory on the Pay view: `useSubLaborLedger().loadLaborJobs` reads all sheets, all their payments and all events in three queries and hangs `payments` and `payment_events` on each `LaborJob`.

## The design

Mock-up: `to-dos/subs-payments-ledger/mockup.html` (on the dev server at `/to-dos/subs-payments-ledger/mockup.html`). Made-up names throughout.

1. **Dates on the Pay rows.** Under the Paid amount: each date for one or two payments, the count and the last date for more. A paid sheet's Pay when line reads *paid in full Nov 12* in place of *balance is $0*. A payment with no Date sent reads *recorded Oct 28*. The phone row's line gets the same words.
2. **The Ledger, by date.** A third view beside Work and Pay (`?view=ledger`). One line per payment or back-charge: Date sent, Paid to, Job · sheet, Memo, Amount, Left on the sheet. Newest first, a header per month with the count and the total. Period chips (This month, Last month, This quarter, This year, All, a custom range), a Paid to picker, a search over sub, job, memo and amount, Print and Download CSV. Tiles: paid in the period, back-charged, and how many lines have no Date sent. A back-charge is a red line. A moved payment leaves its grey trace. The job's name opens the sheet.
3. **By sub, with a running balance.** The same view's other grouping. The list is one row per person: payments, first and last date, paid in the period, back-charged, we owe today. A name opens that sub's statement: oldest first, *Sheet agreed* adds, a payment takes away, and the last column is what we owe after each line. The foot checks the last line against the roster's Balance due. On **This year** the Paid total is the figure a 1099 starts from. **People → Subs** gets a **Roster | Ledger** switch that opens on this grouping.
4. **On a phone** both groupings are cards, a month at a time.
5. **Checking it against the bank**, in three depths:
   - **A, read and export.** Steps 2 and 3. No stored change.
   - **B, a check mark and How paid.** A ✓ per line, with who ticked it and when, a *Not checked* chip, and a tile *6 of 8 checked · 2 left · $3,600.00*. Each payment gets **How paid** (check, ACH, Zelle, Cash App, cash) and a reference, so one account is checked at a time. Changing a ticked payment's amount or date clears its tick and says so.
   - **C, match to the bank line.** For a payment that left a Mercury account, the ledger offers the bank line with the same amount within three days. A matched line ticks itself.

**Roles stay as they are.** The ledger reads the tables the Pay view reads, under the same policies. It shows for the roles who open Jobs → Subs → Pay today (dev, master, assistant, controller). A superintendent sees the Subs tab and has no policy on the payments table, so the Ledger switch is not drawn for them.

## Beside card #346

Card #346 (*People → Subs shows what makes up what we owe each sub*, PR #7976) opens a sub's row into jobs, sheets and lines. That is the money **by job**. This card is the same money **by date**. They meet in three places:

- **One rule for whose a sheet is.** Both read `sheetParties` / `isRosterSub`, the Pay view's rule that #7974 put on People → Subs. *Paid to* here is that rule's sub.
- **One statement.** #346's PR 5 lists *one sub's statement to print*. That statement is this card's PR 3. Whichever card reaches it first builds it, and the other links to it.
- **A door each way.** #346's open row gets **By date ›**, landing on that sub's statement. A statement line's job opens #346's row once it exists.

Neither card edits the other's kernel. #346's is `subOwedBreakdown` (sub → job → sheet → lines). This one's is `subPaymentsLedger` (lines by date).

**Card #350 (sub papers, `to-dos/sub-papers-statement-of-account/`)** is the same money as PDFs to hand a sub. Its *Statement of account…* press sits on this card's by-sub statement, and its payment record prints what Record payment saved. It draws no second ledger and no second payment window. What it needs from this card is listed on its own card under *What this card asks of card #347*: read that list before building PR 3 or PR 4 here, since two of its asks land on them. One is a single sending recorded once across several sheets. The other is a number for each sending that is never reused.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| Sheets, payments, events in memory on Jobs | `useSubLaborLedger` (`src/hooks/useSubLaborLedger.ts`), `LaborJob.payments`, `.payment_events` | nothing for PR 1 to PR 3 |
| A sheet's money | `subLaborJobBalance` (`src/lib/subLaborOutstanding.ts`) | reused |
| Whose a sheet is | `sheetParties`, `isRosterSub` (`src/lib/subWorkOrders/`) | reused |
| Moved and removed traces | `subPaymentTraceLines` (`src/lib/jobs/subPaymentMoveRemove.ts`) | reused |
| The view switch | `JobsSubsTab` (`?view=`, Work and Pay) | `ledger` |
| The ledger's rows | none | `src/lib/subWorkOrders/subPaymentsLedger.ts`, pure: lines, month groups, period, search, by-sub rows, one sub's statement with its running balance and an `endsOnBalanceDue` flag |
| Row dates | none | `sheetPaymentDates` in the same kernel |
| CSV | `billsSentCsv` as the pattern (`BillsSentLedger`) | `subPaymentsCsv`, `subPaymentsCsvFileName` |
| The screen | `PartnershipLedgerTab`, `PeoplePayLedgerView`, `BillsSentLedger` as patterns | `src/components/jobs/SubPaymentsLedger.tsx`, mounted by both pages |
| People → Subs data | `PeopleSubsTab.load()` reads payments without `payment_date` | add `payment_date`, read events |
| The tick and How paid | none | PR 4's columns and RPC |
| The bank link | `mercury_transaction_job_allocations` and `_attributions` link bank lines to jobs and people, never to a sub payment | PR 5's link table |

## The plan

1. **Dates on the Pay rows** (XS). `sheetPaymentDates(payments)` gives the dates, the count, the last date and how many have no Date sent. The Paid cell's second line, the paid sheet's Pay when words, the phone row's line. Guides `sub-labor-outstanding` and `work-the-subs-tab-on-a-phone`. No migration.
2. **The Ledger on Jobs → Subs, by date** (S). The kernel's lines and month groups, `?view=ledger` on `JobsSubsTab`, the desk table and the phone cards, periods, Paid to, search, the tiles, Print and CSV, with no ✓ column. A new guide, *see every payment made to subs by date*. `PROJECT_DOCUMENTATION.md`, `GLOSSARY.md` and `docs/JOBS_TABS_ARCHITECTURE.md` gain the view. No migration.
3. **By sub, and People → Subs** (S). **Built, v2.7231.** The by-sub rows, one sub's statement with its running balance and the check against Balance due, the statement's print, the **Roster | Ledger** switch on `PeopleSubsTab` (`/people?tab=subs&view=ledger`, and `&sub=<id>` for one sub). `docs/PEOPLE_TABS_ARCHITECTURE.md`, guide `review-your-subs`. No migration.
4. **The check mark** (S, a migration). On `people_labor_job_payments`: `checked_at timestamptz`, `checked_by uuid`. A definer RPC `set_sub_payment_checked(p_payment_id, p_checked)` for office staff, and a trigger that clears the tick when `amount` or `payment_date` changes. The ✓ column, the *Not checked* chip, the tile, a How paid filter and a Method column on the ledger. **How paid itself shipped with PR 2b**: `method` and `method_ref` are on the row since migration 20261113180000. A back-charge gets a date field. The client reads columns only the migration creates, so it is a *push right after the merge* PR.
5. **Match to the bank** (M, the owner's yes to call 2). A link table from a Mercury transaction to a sub payment, a pure matcher (same amount, within three days, the payee's name as a tiebreak), **Match** on a ledger line and the same from the Banking side. Built only if most sub money leaves Mercury.

## PR 2b, added the same day: the payment window

The owner, 2026-11-13, on the sub's Make Payment window:

> On this modal, when I go to pay a sub, I would like the modal to be more similar to the record payment modal, if not exactly like the record payment modal in People Pay stubs. This way we can better track partial payments.

Built with this card's edit, between PR 2 and PR 3:

- **One window, two doors.** The pay stubs' Record payment is lifted into `src/components/pay/RecordPaymentPieces.tsx`, and both windows are built from it. The sub's kernel is `src/lib/subWorkOrders/subPaymentWindow.ts`.
- **Part payments.** One line reads Total · Paid · Remaining. The amount opens on what remains, and the window says what a part payment leaves due. The sheet keeps its place in the pay run until nothing is left.
- **How it was sent.** Chips: Check, Zelle, Mercury, Cash App, Apple Pay, Cash, Client direct, Other, with a box for a check number, a Cash App id or a confirmation. Stored on the row as `method` and `method_ref` (migration `20261113180000_sub_payment_method.sql`), carried through a removal and its undo. Edit Payment has the same chips, so an old payment can be given its method.
- **Past what remains is refused**, with the reason. See call 6.
- **The portal is unchanged.** The memo is still the only text of a payment the sub reads, and the hide tick is now on both windows.
- **Left for PR 3 and PR 4:** the ledger's Method column and How paid filter, once the Ledger and this are both on `main`. The dev seat's `plan_sub_labor_payment` does not take a method yet.

## The owner's calls

1. **Which date leads?** My pick: *Date sent*. A payment with none shows the day it was recorded, marked, with a door to set it.
2. **How are subs paid, and from where?** If most leaves Mercury, PR 5 is worth building. If it is Zelle, Cash App and checks from several places, PR 4 is the right stop. My pick until told: stop at PR 4.
3. **Crew pay sheets in the ledger?** My pick: yes, with a *crew* chip and a filter, and out of every *We owe*.
4. **Who sees it?** My pick: the roles who open the Pay view today.
5. **Order.** My pick: newest first by date, oldest first on one sub's statement.
6. **An overpayment to a sub. Answered 2026-11-13: a credit. Built, v2.7235.** The owner: "overpayment -> credit". An amount past what remains is still refused today. What the answer asks for: the window records what remains on the sheet and keeps the rest as a credit for that sub; the credit shows on the sub's row, on their statement and in the ledger; and the next payment to that sub offers the credit first. Nothing holds a credit today: a sheet that is paid past its total reads *Over* and never counts against another sheet. So it needs a place to live, which is a migration, and it is the same shape as card #350's ask for one sending recorded across several sheets: one amount sent, landing in more than one place. Build the two together.

## How to verify

- **Kernel tests** carry the load: lines sorted by Date sent with the recorded day as the fallback, month sums, a back-charge below zero, a moved payment's trace, the period's edges in the app's timezone (`todayYmdInAppTz`, never `new Date()` on a bare date), and one invariant: a sub's statement ends on `subLaborJobBalance` summed over their sheets.
- **On the live app, read only:** the ledger's total for *All* equals the sum of the Pay view's Paid column across every chip, and each sub's *We owe today* equals their Balance due on People → Subs. On 2026-11-13 the Pay view read 88 sheets, 81 paid, $13,400 owed.
- **Test rows:** the *Claude Test Sub* on the roster and its *ZZ Test Walk Project* sheet. Record a ZZ payment with a Date sent in the past and one with none, see both lines, then remove them through the sheet form's Remove, which leaves its trace.
- **Gotchas:** `payment_date` is a bare date and `created_at` a timestamp, so the fallback day must be cut in the app's timezone. Old rows from before 2026-08-14 have no `payment_date` at all. PostgREST caps a read at 1,000 rows: the payments read on People → Subs must page once the table passes that.

## The credit and the sending, built 2026-11-13 (v2.7235)

- **A sending** is one money movement: `sub_payment_sendings`, with a number that is never reused. The Record payment window makes one for every payment. It stores no amount: what was sent is its rows plus the credit kept with it.
- **Past the sheet.** The extra fills the sub's other open sheets, oldest first, and a tick switches that off. What is still left is kept as their credit. The window lists each line before the press.
- **The credit** is a ledger, `sub_credit_entries`: kept above zero, used below. A sub holds one only as one person on the roster. Anyone else is refused past what their sheets need, with the reason.
- **Offered first.** A sub with a credit gets *Use $… on this sheet* at the top of the window. It makes a payment row with the method *From credit*, and no money leaves.
- **Where it shows:** the Pay row's payment, the Ledger by date (a green note, a *From credit* chip, the sending's number), the Ledger by sub, a statement (*Credit kept*, *Credit used*), and under Balance due on People → Subs.
- **It cannot drift.** A payment that carries a credit stays on its sheet. One made from a credit keeps its amount. Removing a use puts the credit back, and removing a payment whose credit was already used is refused.
- **Not built:** placing a sending's lines by hand (card #350's ask 2 wanted the fill as the start and the hand as the override), and turning a sheet that is already paid past its total into a credit. One sheet is in that state today.
