---
name: "A lien payoff: one check in, every lien at the place released"
number: 435
group: ready
status: asked 2026-11-24 by Diane, when a property owner paid off every lien at one place with one check · what exists read in the code, the law read in the published Code, a first draw, a critique as Grace would give it and a second draw, all the same day · the same day she asked where the door was and for the product to do the thinking, and said to build pieces 1 and 2 · the door and each lien's next press in v2.8504 · the release that waits for the money and takes the county's stamp in v2.8508, with no migration · on her *Yes, build 3* the same day, one check recorded over every bill it pays in v2.8510, with no migration either · calls 2 to 4 answered 2026-11-25 (UTC) in the managing session, each the card's pick: one release for each lien, a receipt that names the instruments and nothing signed that waives, and the affidavit's signer signs · call 1 answered later the same day in the managing session: it is settled by #437, and **The bank confirmed the funds** goes to a leader, a controller or a dev · piece 4, the payoff card with five stops, built as v2.8632, with no migration: on the answer of 2026-11-26 the written request's day and the funds confirmation live in the fields the affidavit row already saves, one per lien · asked 2026-11-26 whether piece 6 goes before piece 5, whose files another card's open PR held, the answer was yes · piece 6, a check that comes back knows its releases, built as v2.8639, with no migration and no write · the office's four calls answered 2026-11-26, each the card's pick · piece 5, the releases ride the run, built as v2.8648, with no migration · piece 7 is not built
summary: >
  A payoff of the liens at one place runs today through three jobs, one bill and one tab at a time:
  about fifty presses for three liens, the check number typed four times, and nothing that ties a
  release to the money. The papers exist. The path between them does not. The card proposes a payoff
  as one paper on the Lien desk, kept by place: one check placed on the liened bills first and checked
  against its total, one release for each filed lien the money covers, each held until the check
  clears and shown with the day it is due, printed in the desk's one run, and kept on the desk until
  the county has recorded it and the copies are out.
next: Pieces 4, 5 and 6 and the returned check's mark wait for their walks on ZZ test jobs. Piece 7 (S) waits on counsel. The office still walks a real payoff through Payoffs, check and release, and says what still reads wrong.
size: L as a train of seven (S · M · M · M · M · S · S); pieces 1 to 6 built; left: piece 7 (S)
blocker: Counsel's answers gate piece 7 and the words on the papers, the payer's receipt among them.
opinion: build — the door, the one check, the safe release, the card with five stops, the releases on the run and the returned check are built in pieces 1 to 6; the walks are next
ver: v2.8504 · v2.8508 · v2.8510 · v2.8632 · v2.8639 · v2.8648 · v2.8650 · v2.8662
---

# A lien payoff: one check in, every lien at the place released (#435)

The proposal and its mock-up are [`mockup.html`](./mockup.html), served at `/to-dos/lien-payoff/mockup.html`.
The second draw can be pressed: five stops, and three things that can happen to the check.
Its first stop shows the door as built; the check pane and the card with five stops are pieces 3 to 5.
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

## Where the door is

On the Lien desk, above the lists.
A line named **Payoffs** says what waits on a release and has one press, **Someone paid ›**.
The press opens every filed lien under its place, with the amount that pays the place's liens off.
Each lien says where it stands in one sentence and offers the one press that comes next: **Record the payment ›**, then **Make the release ›**, then **Record the county's stamp ›**.
The app works out the step from the bills, the payments and the release on record, so the office chooses buttons.

The first cut of this card put the door in piece 4 of the build, and pieces 1 and 2 only gave a pile that filled after money was recorded.
That was a fault: a person holding a check starts from the lien.
The door shipped first, in v2.8504.

## What existed before pieces 1 and 2

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
| A check comes back after the release is filed | Before recording: the returned-check case holds every release on that check, and a printed one reads *Do not record*. After recording the app cannot undo it. The row reads *Released, money came back*, the bills go back to open, and one press opens the matter for counsel. Built in v2.8639 but for that last press: the row says *Ask counsel*. |

## The build, in order

| # | The piece | Size | Kernel and tests | Migration | What proves it |
|---|---|---|---|---|---|
| 1 | **The door, and each lien's next press.** The line *Payoffs* with *Someone paid ›*, and the window of every filed lien under its place, each with one sentence and one press. **Built, v2.8504.** | S | `lienPayoff.ts`: the step, the sentence and the press from the bills, the payments and the release on record. 22 tests, 6 render tests. | None | Its tests, and a read-only look at the live desk |
| 2 | **The release waits for the money and takes the county's stamp.** The tab is on one filed lien, holds its print and save while the bills still owe unless a reason is typed, starts the payment date on the last payment, saves one release a lien, and takes the day recorded and the release's own instrument number in place. **Built, v2.8508.** | M | `lienReleaseOfRecord.ts`: the targets, the money hold, the stamp. 12 tests, 6 render tests. | None after all: the link and the number live in the fields a release already saves | Its tests, and a read-only look at the hold on a live job |
| 3 | **One check over many bills.** *One check for this place ›* in Payoffs: the check typed once, placed on the liened bills first and oldest first, three totals, one press that records each ready bill and holds a part payment on a Stripe bill. **Built, v2.8510.** | M | `lienPayoffCheck.ts`: the order, the spread to the cent, the plan and the button's words. 14 tests, 7 render tests. | None after all: one `mark_invoice_paid` a bill, and the check's number, day and note are its mark | Its tests, and a read-only look at the pane on the live desk |
| 4 | **The payoff door and card.** The place's press, the check pane, the card with its five stops, the written request's day and the funds press for a leader, a controller or a dev. The guide gains its three sections here. **Built, v2.8632.** | M | `lienPayoffCard.ts`: the stops, the line for today, the due day, who may confirm. `lienPayoffFields.ts`: the two facts on the affidavit row. 28 tests, 9 render tests. | None after all: the day asked and the confirmation live in the `fields` the affidavit row already saves, one per lien (answered 2026-11-26) | Its tests. The walk from check to card on ZZ test jobs is the walkers', from a recipe |
| 5 | **The releases ride the run.** Print for the notary, mark notarized, record at the county, record the copies, each with its count and what it held. **Built, v2.8648.** | M | `lienReleaseRun.ts`: the four acts, the held reasons, the press worded by `batchWords`. `lienReleaseFacts.ts`: the three facts on the release row. 25 tests, 13 render tests. It stands on #362's *Out the door*, not on `lienRunChecklist.ts`, which is the run window's notice checklist. | None | Its tests. A full run on ZZ test jobs with one release held is the walkers', from a recipe |
| 6 | **A check that comes back knows its releases.** The case reads the check mark, holds what has not left and marks what has. **Built, v2.8639.** | S | `payoffReturned.ts`: none printed, printed, recorded, the check's mark and the desk's flag. 23 tests, and 20 more across the hook, the pane, Payoffs and the tab. | None | Its tests. The played-back returned check on a ZZ test job is the walkers', from a recipe |
| 7 | **No final waiver wider than the money.** The unconditional prompt waits where other bills stay open at the place. Built on counsel's word. | S | `pickLienWaiverForBill` gains the place's open bills. Tests beside it. | None | Kernel tests |

Pieces 1 to 3 are built and carry the door.
Since v2.8525 (piece 1 of [#437](../held-check/README.md)) Payoffs, the release tab and the check pane wait for the bank to clear a check, where pieces 1 to 3 only warned.
The guide shipped with them: `release-a-filed-lien-after-it-is-paid`.
Each piece has its release note and fragment.

### Piece 4 as built (v2.8632)

Each open place in Payoffs carries the card: five stops, one line for today, the day a release was asked for in writing changed where it sits, the due day ten days on and the clearing day worked out, and **The bank confirmed the funds ›** for a leader, a controller or a dev.
A confirmed lien offers **Make the release ›** before the bank's day, the release tab lets the release go, and the release saved carries whose word it rested on.
The check pane takes the asked day with the check.

**Where the two facts live.** The plan above was one small table for a payoff.
Asked on 2026-11-26, the answer was the other pick, A: the day asked and the funds confirmation live in the `fields` the affidavit row already saves (`job_lien_filings`, kind `affidavit`), one per lien, with no migration.
Why: a written request and a release are per lien in the Code, the check is already named by the payment rows' number, day and note, and pieces 2 and 3 each planned a column or a function and shipped with none.
So piece 4 was one client PR with no push owed.
A later piece may lift the two facts into columns.
The three roles are checked on the client, the same gate the tab's *Release it anyway…* has today.

Left from piece 4, each named in its fragment:

- The fifth stop, *Copies sent*, and the notary on the third stop had no fact to read. Both read piece 5's facts since v2.8648.
- The payer's receipt of screen 3 is not built. It is a paper, and counsel's answers gate the words on the papers.
- A confirmation of the funds cannot be taken back from the card.
- The place's press keeps the name it was built with, *One check for this place ›*, where screen 1 reads *They paid: take the payoff ›*.
- Piece 4's looking-only walk was made on the live desk on 2026-11-26: every open place had its card, five stops, the line for today and the asked day's field, and the check pane showed its four fields and both worked-out days. It found one fault, a *Check clears* line read off an older check on a lien still waiting on its money, mended in v2.8650. No lien waited for the bank and no place was all released, so those two steps were not seen.
- Piece 4's first walk with a write was made on 2026-11-26, on two ZZ test jobs at one made-up place, each with a part bill and an affidavit recorded by hand: the place read 2 liens with its first stop lit, the asked day kept on both liens showed *Release due* ten days on, and it was still there after a reload. No real place was touched, nothing was sent, and every row was deleted. The jobs stayed Working after a part bill sent by hand, so no Ready to bill notice left. No check, funds confirmation, release or stamp has been saved on a ZZ test lien yet: those steps record payments, which send the office its paid notices.

### Piece 5 as built (v2.8648)

The run has a card named **Releases**, under *Out the door*.
It lists every saved release under the act it is on: *Print for the notary*, *At the notary*, *Record at the county*, *Send the copies*.
One press prints every ready release, a release a sheet, and holds the rest with the reason: *short* when the job's bills owe again, or the check came back.
The notary's day and the copies' day are values typed where they sit, and **Record the county’s stamp ›** opens the release's own tab.
A release keeps three facts in the `fields` its row already saves: `printedForNotary`, `notarizedYmd` and `copiesSent`. No migration.
In Payoffs the card's third stop says how many releases are notarized, its fifth stop reads the copies, the card takes the copies' day too, and a place stays in the open list until its copies are out.

Left from piece 5, each named in its fragment:

- The releases print as their own job, not as a third paper in the run's one stack, whose pages are measured.
- A release is still made on its tab, one lien at a time. The run prints what is saved.
- A release printed from its tab before v2.8648 stands under *Print for the notary* until it is printed in the run or its notary's day is typed.
- The copies are a day and who typed it. To whom, how and the tracking number are not kept, and the cover letter is a paper counsel's answers gate.
- The copies are asked for thirty days from the county's day.
- The run's step strip does not count releases.
- Piece 5 has not been walked: nothing was printed or kept on a ZZ test release.

### Piece 6 as built (v2.8639)

Built before piece 5.
Asked on 2026-11-26 whether piece 6 goes first, since card #362's open PR held the files piece 5 stands on, the answer in the managing session was yes ("All picks stand", the pick being yes).

A check that came back on a job with a filed lien shows **Liens on this money** in its Accounts Receivable case.
Each filed lien on the check's jobs is in one of three cases: none printed (*On record*, or *Release held* for one saved and never printed), printed (*Do not record*, with the day and who printed it) and recorded (*Released, money came back*, ask counsel).
The case finds a check typed once in Payoffs by the check's mark: the deposit's own number on unlinked check payments typed near its day, adding up to no more than the check.
In Payoffs and on the Release of record tab a saved release whose check came back reads *Do not record*, and a recorded one stays in the open list in red.
It reads only: no migration, no function, no write.

Left from piece 6, each named in its fragment:

- No press opens a matter for counsel, as the guard table says one does. The app has no door from a job to a matter, and counsel's question 8 is not answered.
- The desk's flag lasted only while the payment was on the job. Mended in v2.8662: the case has one press, *Hold N releases on the Lien desk*, that keeps a mark on each saved release, and the desk heeds it until a later payment has cleared. The mark is a press of its own, not a side effect of **Take it off**.
- The case's **Take it off** does not reach a payment found by the mark. That is the database's function and its match, so it is a migration and the database lane's.
- A release sent out as a downloaded PDF reads *Release held*: only a print files a copy.
- A check the bank could not read, a typed check never deposited and a card dispute draw no box.
- Piece 6's looking-only walk on 2026-11-26 saw Payoffs read right, with no lien held or marked, and saw none of the three cases: Accounts Receivable held no open returned-check case. No returned check has been played back on a ZZ test job.

Left from pieces 1 to 3, each small:

- The stamped copy of a release is a Drive link on its line under *Filings on this job*; the scan press there is still for affidavits only.
- The job's lien timeline reads *Released* from the moment a release is saved; only Payoffs and the tab tell a saved release from a recorded one.
- The check pane records a check only; cash, a wire or a card still goes on each bill.
- The rows of one check share its number, day and note, not a column. Piece 6 finds them from a returned-check case by the number and the day, with no column.
- No piece has been walked with a write: no test payment, release or stamp was saved on a ZZ job.

## The calls

**For the company's owner**

1. Does a release wait for the check to clear? Pick: yes, the app's seven days, with a leader's press when the bank confirms the funds. It was not on the first record of 2026-11-25. [#437](../held-check/README.md) says it answers this call for the owner. Its call 1, answered 2026-11-24, makes cleared the bank's named day, and its piece 1 (v2.8525) holds a release until then. Its call 4, answered 2026-11-25, names a leader, a controller or a dev for a release before that. **Answered 2026-11-25 (UTC) in the managing session**, later the same day, each answer quoted from that session's record of the user's answers. Asked *#435 call 1: is it settled by #437?*, the answer was "Yes, settled by #437". Asked whether *Count it now*, the sooner release for a payer whose check came back and **The bank confirmed the funds** go to a leader, a controller or a dev, as the early release does, the answer was "Yes, the same three". So a release waits for the bank's named day, as v2.8525 holds it, and **The bank confirmed the funds** is a leader's, a controller's or a dev's press. The pick's seven days give way to the bank's named day. What it frees: piece 4, drawn with that press for the three and not for a leader alone. What it leaves open: counsel's answers, which gate piece 7 and the words on the papers.
2. One release for each lien, or one paper for the place? Pick: one for each lien. Each matches one record at the clerk, and one can be held while the others go. **Answered 2026-11-25:** *One for each lien.*
3. What does the payer get on the day of the check? Pick: a receipt that names the instruments. Nothing signed that waives. **Answered 2026-11-25:** *A receipt that names the instruments, nothing signed that waives.*
4. Who signs a release? Pick: the affidavit's signer. **Answered 2026-11-25:** *The affidavit's signer.*

Calls 2 to 4 were answered on 2026-11-25 (UTC) in the managing session.
Each answer above is quoted from that session's record of the user's answers.

5. Where does piece 4 keep the written request's day and the bank's funds confirmation? A: in the fields the affidavit row already saves, one per lien, no migration, so piece 4 is one client PR. B: the small table this card planned. Pick: A. **Answered 2026-11-26 (UTC) in the managing session**, quoted from that session's record of the user's answers: asked whether the picks of that round stand, this one among them, the answer was "All picks stand". So piece 4 is built as A, in v2.8632. What it leaves open: a later piece may lift the two facts into columns.

**For Grace**

1. Do releases print in the day's run or by themselves? Pick: in the run.
2. Who types the check? Pick: whoever holds it. The desk picks the money up from anywhere it was recorded.
3. Is a payoff kept by place or by payer? Pick: by place. A payer with two properties has two payoffs.
4. What is the pile called? Pick: *Payoffs*.

**Answered 2026-11-26 (UTC)**, all four as picked. Asked whether the card's four calls for the office stand as picked, so piece 5 can start, the answer was "All picks stand". So piece 5 puts the releases in the day's run.

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
- Returned checks: `src/components/jobs/ar/ArReturnCasePane.tsx`, `arReturnCase.ts`, and since piece 6 `payoffReturned.ts`, `payoffReturnedIo.ts` and `useReturnedCaseLiens`; the card [#76](../ar-returned-checks.md).
- Neighbours: [#362, the one run](../lien-to-do-one-run/README.md), [#366, the filed copies](../lien-serve-filed-copies/README.md), [#378, the scan](../lien-served-copy-is-the-scan.md).
- Spreads to copy: `in_kind_line_add` places one line on open bills oldest first with a dry run, and the sub pay window spills a payment across sheets.

## How to verify

Every walk runs on ZZ test jobs at one made-up place: two jobs with a filed affidavit each by hand, one job with a bill and no lien.
Type a check for the two liens, read the three totals, record it, and read one payment on each bill with the same check mark.
Print the releases, type a made-up stamp for each, and read the desk: both liens *Released*, the third bill still open.
Then a short check, and a check taken back under *Came back* before and after a release is printed.
