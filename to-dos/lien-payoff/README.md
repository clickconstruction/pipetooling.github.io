---
name: "A lien payoff: one check in, every lien at the place released"
number: 435
group: gated
status: asked 2026-11-24 by Diane, when a property owner paid off every lien at one place with one check · what exists read in the code, the law read in the published Code, a first draw, a critique as Grace would give it and a second draw, all the same day · nothing is built · waiting on the picks below
summary: >
  A payoff of the liens at one place runs today through three jobs, one bill and one tab at a time:
  about fifty presses for three liens, the check number typed four times, and nothing that ties a
  release to the money. The papers exist. The path between them does not. The card proposes a payoff
  as one paper on the Lien desk, kept by place: one check placed on the liened bills first and checked
  against its total, one release for each filed lien the money covers, each held until the check
  clears and shown with the day it is due, printed in the desk's one run, and kept on the desk until
  the county has recorded it and the copies are out.
next: The owner picks the shape and answers his four calls. Pieces 1 and 2 of the build wait on nothing else.
size: L as a train of seven (S · M · M · M · M · S · S)
blocker: The owner's go on the shape. Counsel's answers gate piece 7 and the words on the papers, not the first two pieces.
opinion: build — pieces 1 and 2 make today's by-hand path safe and need no door; the door follows the picks
---

# A lien payoff: one check in, every lien at the place released (#435)

The proposal and its mock-up are [`mockup.html`](./mockup.html), served at `/to-dos/lien-payoff/mockup.html`.
The second draw can be pressed: five stops, and three things that can happen to the check.
Every name, address, job, instrument number, check number and amount on it and in this card is made up.
The repo is public, so nothing here is copied from the live app or from the matter that raised the question.

## The ask

2026-11-24, Diane, with a real payoff in hand:

> We don't currently have features to make recording the collection of that money easy, and generating a
> release of lien easy. Can you take a look at what's on the lien desk and then help me come up with a
> proposal of what to build?

## In three lines

1. A payoff is one paper on the Lien desk, kept by place. It takes one check, places it on the liened bills first, and checks the total against the check.
2. It lines up one release for each filed lien the money covers. Each waits for the check to clear and shows the day it is due. The releases print in the desk's one run.
3. The card stays until the county has recorded each release and the copies are out. A check that comes back holds every release that has not left.

## What exists today

| Step | What the office presses today | What is missing |
|---|---|---|
| Type the check | Job → Bill tab → **Record payment** on the bill → *Record a cash or check payment* → **Confirm** (`BilledPaymentConfirmationModal`, `mark_invoice_paid`). Once for each bill. | One row, one job, one bill. A check for more than the bill is refused. Nothing adds the rows up to the check. |
| Match the deposit | Accounts Receivable → the deposit → pick a bill → **+ Split across another bill** → **Apply** (`BankPaymentsModal`, `apply_mercury_bank_payment_allocations`). | It spreads over bills and jobs and checks the total, but only once the bank shows the deposit. It knows nothing of liens. |
| The desk sees it | The job's lien timeline reads *Paid — file the release of record* with **File the release ›** (`lienTimeline.ts`, `lienNextAct.ts`). | No pile, Board bin or Dashboard line for a release owed. The desk's list functions drop a job paid to zero, with its lien still on record. |
| Make the release | Job → Lien window → **Release of record** → *Payment / satisfaction date* → **Print for notarization** → **Save release record** (`LienFilingTabs.tsx`, `buildReleaseOfRecordBlocks`). | It works with no payment recorded. It takes the job's first filed affidavit. The date is typed by hand. |
| Sign and notarize | On paper, before a notary. | The notary block is the affidavit's sworn one (`juratWords.ts`). The signer's name is the job's master, with no signing in the app. |
| Record at the county | Nothing. The toast says *file it with the County Clerk*. | The row (`job_lien_filings`, kind `release_of_record`) holds the affidavit's instrument number and never its own. Its `filed_at` is never set, so *Released* reads the day the row was saved. The scan press is drawn for affidavits only. |
| Send the copy | Nothing. | No record that the payer got it, and no clock from a written request. |
| Waiver on final payment | A paid bill offers **Add the unconditional ›** once a check has had seven days (`lienWaiverCell.ts`, `checkClearing.ts`). The Release of Lien window makes the four statutory forms (`job_lien_releases`). | A different paper in a different table, with no link to a filed lien. A final form speaks for everything furnished to the property. |
| A check comes back | Accounts Receivable → *Came back* → **Take it off the job** (#76). A returned check cannot pay a bill. | The case does not know a release was printed or recorded on that money. |

Counted for three liens over four bills: seven windows, about fifty presses, the check number typed four times and the payment date three times.
A check typed on a Stripe bill reads paid here and leaves the Stripe invoice open for seven days (`heldStripeMark.ts`), which the payoff keeps.

## The law's shape, for counsel

This is a reading of the published text and not legal advice.
Each section was read on 2026-11-24 at texas.public.law, whose copy dates itself May 26, 2025.

- **Tex. Prop. Code § 53.152(a).** Once the debt is "paid by collected funds", the claimant must furnish a release within ten days of receiving a written request, to the extent of what was paid. The owner, the original contractor or whoever paid may ask.
- **§ 53.152(b)** asks for a form that can be filed of record. **§ 53.157(1)** says recording a release signed by the claimant discharges the filed affidavit.
- **Prop. Code § 12.001(a).** A paper can be recorded if it is acknowledged, sworn to with a proper jurat, or proved.
- **Lateness.** § 53.152 names no penalty of its own. § 53.156 has a court award costs and reasonable attorney's fees in a suit to declare a lien invalid or unenforceable. § 53.160 is the summary motion that removes one. Civ. Prac. & Rem. Code § 12.002(c) reaches a chapter 53 claimant only on intent to defraud.
- **§ 53.283 and § 53.284.** No one may demand an unconditional waiver before good funds. The conditional forms take effect when the bank has paid the check. The unconditional final form says the signer has been paid in full for what was furnished to the property.

## The shape

A payoff, kept by place, on the Lien desk.
A lien sits on a property, so the door is the place: every filed lien there, every open bill behind each, and what is open and not liened.
The office types one check.
The app places it on the liened bills first, oldest first, and shows the check, what is placed and what is left as three values.
One press records a payment on each bill.
From then on the payoff is a card on the desk with five stops: money recorded, check cleared, releases signed and notarized, recorded at the county, copies sent.
The card draws one release for each filed lien the money covers in full, from that affidavit's own facts.
It holds each release until its money is recorded and the check has cleared, and it shows the day the release is due beside the day the check clears.
The releases print in the desk's one run (#362) with the day's other papers.
Money recorded anywhere else in the app starts the same card by itself.

### What else was weighed

- **Mend the job's tab and stop.** Give the Release of record tab a money check and a place for the county's stamp. It is cheap, and it is pieces 1 and 2 of the build anyway. Alone it leaves three trips, a check typed four times, and a desk that never sees the payoff.
- **A receive-a-payment door in Accounts Receivable.** Good for any check over several jobs. Accounts Receivable already spreads a deposit once the bank shows it. The gap is the release, its clock and its run, and those belong to the desk. The build takes this door's kernel and puts it where the lien is.
- **No door: draft the release when a bill reads paid.** The app cannot know of a written request, a cashier's check, or which bills the payer meant. A release drawn from a payment placed on the wrong job is the worst mistake on offer. The build keeps the good half: the card appears by itself.

## The first draw, and Grace's critique

The first draw was one window, *Paid in full*, with four steps done in a sitting: the check, the bills, the releases, done.
Read as Grace would on a day with one payoff and twenty other papers:

1. **It is a sitting, and a payoff takes two weeks.** The check clears in a week. The notary is another day and the clerk another. A window cannot be left half done.
2. **The check may not be hers to type.** Money often lands in Accounts Receivable or on the job first. The window asked for it again.
3. **A second print run.** The desk has one run a day for what gets signed, notarized, mailed and filed. This made another.
4. **The name promises what a check may not keep.** *Paid in full* is wrong on a short check, and the window had no state for part.
5. **No day on it.** Every other paper on the desk shows its due day and the days left. Here the rule was a sentence and the day was nowhere.
6. **It covers the desk.** Twenty other papers wait behind a window that needs nothing for a week.

The second draw answers each.
The payoff is a card that stays, fed from wherever the money was recorded.
It is named for what it is.
Its days sit in a column.
Its releases join the run.
On a day it needs nothing, it says so in one line.

## The screens of the second draw

1. **The desk.** The place's filed liens in a group with one press, **They paid: take the payoff ›**, and a line for what is open there and not liened.
2. **The check.** Values in place: the amount, the check number, the day received and the day a release was asked for in writing can be changed; the due day and the clearing day are worked out. The spread groups bills under their lien, with *Open* and *Pays* in columns, and three totals: the check, placed, left to place. The button reads **Record 4 payments on 3 jobs**.
3. **Waiting.** The Payoffs pile holds the card: five stops, one line that says nothing is owed today, the two days side by side, a leader's **The bank confirmed the funds ›**, and a receipt to print for the payer.
4. **Releases.** One row for each release with its instrument, its amount and *Ready* or *Held* with the reason. The button takes its words from `batchWords`: **Print 3 releases for the notary**, or **Print 2 releases for the notary · 1 is short ▸**. It is dead only when nothing is ready.
5. **Afterwards.** Each lien reads *Released* with the release's own instrument number and day, the copies' day, and what is still open at the place. A short check leaves one lien *On record* with what was paid and what is owed.

Amounts draw through `Money`, changeable values through `ChangeableValue`, worked-out ones through `WorkedOutValue`.

## What stays a person's

| The act | Who | What the app prints | What the app tracks |
|---|---|---|---|
| Signing | The job's master, the affidavit's signer | One release for each lien, with that affidavit's instrument number, day, county and legal description | Printed on, and by whom |
| Notarizing | A notary, in person | The certificate counsel picks, with the county and the signer's name filled in | Out for the notary since, and the notarized scan when it comes back |
| Recording | The office, at the county clerk | A cover line for the clerk that names each instrument being released | The release's own instrument number, the day recorded, the stamped copy |
| Mailing | The office | A cover letter to the payer and the builder with the stamped copies behind it | Sent on, to whom and how, with the tracking number |
| Saying the funds are good | A leader | Nothing | Who pressed, when, and their note |

## What must never happen

| The mistake | The guard |
|---|---|
| A release goes out for a lien whose money is not recorded | A release is drawn only from payment rows. It is ready when every bill behind its lien reads paid and the check has cleared, or a leader has confirmed the funds. The print press counts only ready releases. The job's own tab gets the same gate. |
| A release for the wrong filing | Each release holds a link to one affidavit row and copies nothing by hand. A job with two filed liens shows two releases, never the first one found. |
| A release wider than the money | The release names one instrument and its claim. Where other bills stay open at the place, the app does not offer a final unconditional waiver there until counsel has said how it should read. |
| A paid bill left showing as liened | A filed lien has three states the desk can see: on record, paid and release owed, released. A released lien leaves every pile, the clock for copies and the year's suit reminder. |
| A lien paid and forgotten | A filed lien whose bills read paid shows in the Payoffs pile by itself, even when the job has left the desk's other lists. It stays until the county's stamp is recorded. |
| A check comes back after the release is filed | Before recording: the returned-check case holds every release on that check, and a printed one reads *Do not record*. After recording the app cannot undo it. The row reads *Released, money came back*, the bills go back to open, and one press opens the matter for counsel. |

## The build, in order

| # | The piece | Size | Kernel and tests | Migration | What proves it |
|---|---|---|---|---|---|
| 1 | **Paid, lien still on record.** A Payoffs pile on the desk, read only: each filed lien whose bills read paid, with its press to the job's Release of record tab. **Helps soonest.** | S | `lienPayoffOwed.ts`: filed affidavits, live releases and what the bills still owe in, rows out. Tests for paid, part paid, released, voided, two liens on a job. | None | Kernel tests, a render smoke, the pile on a ZZ test job |
| 2 | **The release knows its lien and its day at the county.** The tab releases the affidavit it was opened on, reads the payment day from the payment rows, warns when no money is recorded, and takes the county's instrument number, day and stamped scan (`LienFiledScanPress`). | M | `lienReleaseOfRecord.ts`: the gate and the states drawn, out for the notary, recorded. The timeline's *Released* reads the recorded day. | Two columns on `job_lien_filings`: the affidavit released and the release's own instrument number. Old rows filled by matching. | Kernel tests, the tab's render smoke, a walk on a ZZ test job with a made-up stamp |
| 3 | **One check over many bills.** One typed check becomes a payment on each bill in one write, each carrying the same check mark. | M | `checkSpread.ts`: liened first, oldest first, to the cent, the three totals, changes by hand. Tests for short, over, rounding and a bill at zero. | A check mark column on `jobs_ledger_payments` and one function that writes the rows through the guards `mark_invoice_paid` uses | Kernel tests, a database bed for the function, a walk on two ZZ test jobs |
| 4 | **The payoff door and card.** The place's press, the check pane, the card with its five stops, the written request's day and the leader's funds press. The guide ships here. | M | `lienPayoff.ts`: the stops, the next act, the due day, the held reasons. Render smokes for the pane and the card. | One small table for a payoff, with the four fence calls: the place, the check, the day asked, who confirmed funds | Kernel tests, smokes, a walk from check to card on ZZ test jobs |
| 5 | **The releases ride the run.** Print for the notary, mark notarized, record at the county, record the copies, each with its count and what it held. | M | `lienRunChecklist.ts` takes releases. `batchWords` gives the labels. | None | Checklist tests, a full run on ZZ test jobs with one release held |
| 6 | **A check that comes back knows its releases.** The case reads the check mark, holds what has not left and marks what has. | S | `payoffReturned.ts`: none printed, printed, recorded. Tests for each. | None | Kernel tests, a played-back returned check on a ZZ test job |
| 7 | **No final waiver wider than the money.** The unconditional prompt waits where other bills stay open at the place. Built on counsel's word. | S | `pickLienWaiverForBill` gains the place's open bills. Tests beside it. | None | Kernel tests |

Pieces 1 and 2 need no door and make today's by-hand path safe.
Piece 2 should land before the first stamped release comes back from a clerk.
Each piece is its own PR with its release note and fragment, and piece 4 carries the help guide.

## The calls

**For the company's owner**

1. Does a release wait for the check to clear? Pick: yes, the app's seven days, with a leader's press when the bank confirms the funds.
2. One release for each lien, or one paper for the place? Pick: one for each lien. Each matches one record at the clerk, and one can be held while the others go.
3. What does the payer get on the day of the check? Pick: a receipt that names the instruments. Nothing signed that waives.
4. Who signs a release? Pick: the affidavit's signer.

**For Grace**

1. Do releases print in the day's run or by themselves? Pick: in the run.
2. Who types the check? Pick: whoever holds it. The desk picks the money up from anywhere it was recorded.
3. Is a payoff kept by place or by payer? Pick: by place. A payer with two properties has two payoffs.
4. What is the pile called? Pick: *Payoffs*.

**For counsel** (questions only; the build takes the cautious reading until answered)

1. May the company wait for a check to clear before it releases, and what if the tenth day comes first?
2. If the payer asks for the release before or as the check changes hands, what may be given?
3. If no written request ever comes, is a release still owed, and by when?
4. Does a release take an acknowledgment or a jurat, and will the clerk record either?
5. May one release name several instruments?
6. With other bills still open at the place, how must a release or a waiver read so it gives up the lien paid and no more? Is a waiver needed at all beside a release?
7. The property owner paid and the builder owes the bills. Does that change the wording or who gets a copy?
8. A release is recorded and the check comes back. What can be done, and how fast?
9. What does a late release risk beyond costs and fees?

## Where it plugs in

- The desk: `src/components/jobs/LienDesk.tsx` under `src/pages/LienDeskPage.tsx`, `src/lib/jobs/lienBoard.ts`, `lienDeskAffidavits.ts`, the run in `lienRunChecklist.ts`; the map is `docs/LIEN_DESK_ARCHITECTURE.md`.
- The release paper: `src/components/jobs/LienFilingTabs.tsx` (the `release_record` tab), `src/lib/jobsDocuments/lienFilingDocuments.ts` (`buildReleaseOfRecordBlocks`), the timeline in `lienTimeline.ts` and `lienTimelineDesk.ts`, the cite in `lienRuleCites.ts`.
- The money: `jobs_ledger_payments`, `mark_invoice_paid`, `BilledPaymentConfirmationModal`, `BankPaymentsModal`, the clearing days in `checkClearing.ts`, the held Stripe mark in `heldStripeMark.ts`.
- Returned checks: `ArReturnCasePane.tsx`, `arReturnCase.ts`, the card [#76](../ar-returned-checks.md).
- Neighbours: [#362, the one run](../lien-to-do-one-run/README.md), [#366, the filed copies](../lien-serve-filed-copies/README.md), [#378, the scan](../lien-served-copy-is-the-scan.md).
- Spreads to copy: `in_kind_line_add` places one line on open bills oldest first with a dry run, and the sub pay window spills a payment across sheets.

## How to verify

Every walk runs on ZZ test jobs at one made-up place: two jobs with a filed affidavit each by hand, one job with a bill and no lien.
Type a check for the two liens, read the three totals, record it, and read one payment on each bill with the same check mark.
Print the releases, type a made-up stamp for each, and read the desk: both liens *Released*, the third bill still open.
Then a short check, and a check taken back under *Came back* before and after a release is printed.
