---
title: release a filed lien after it is paid
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: payoff, payoffs, paid, someone paid, paid off, one check, several bills, several jobs, spread, check number, release, release of record, filed lien, lien paid, county, clerk, notary, instrument, stamp, check, clears, cleared, at the bank, waits for the bank, deposit, posted, came back, lien desk, payoff card, five stops, written request, asked in writing, release due, ten days, bank confirmed the funds, funds, copies sent, returned check, bounced, do not record, money came back, counsel
where: /lien-desk
---
When someone pays off a filed lien, the Lien desk tells you what to do next. You press one button at a time.

A filed lien stays on the county's record until its release is recorded there. Paying the bill does not remove it. This guide walks the three steps.

## Open Payoffs

Open the [Lien desk](/lien-desk). A line named **Payoffs** sits above the lists. The line says how many liens are paid and still on record. On a phone the line is the first thing in the list and scrolls away with the list. Press {{button:blue|Someone paid ›}}.

A window opens. It lists every filed lien under its place. A place is one property. The line under the place says how much pays its liens off.

## Read a lien's row

Each row is one filed lien. It shows the job, the amount on the affidavit and the county's instrument number. Three small rounds stand for the three steps. A tick means the step is done. The blue round is the step you are on.

One sentence says where the lien stands. One button says what to do next.

## Read the payoff card

Each place with a lien still on record has a card with five stops. The stops read **Money recorded**, **Check clears**, **Releases**, **Recorded at the county** and **Copies sent**. A tick means the stop is done. The blue stop is the one you are on. A red stop needs care.

One line under the stops says what to do today. On a day the payoff needs nothing, the line says so.

Two days sit under the line. **Release due** shows once a written request is on record. **Check clears** shows the day the bank names for the check.

**Copies sent** has no button yet. Mail the stamped copies to the payer once the county has recorded each release.

## Step 1, record the payment

The row says how much is still open on the job's bills. Press {{button:blue|Record the payment ›}}. The job opens on its Bill tab. Record the payment there on each bill it pays.

Close the job when you are done. The row moves to step 2 by itself.

## Record one check that pays several bills

One check may pay several bills on several jobs. Type it once. Press {{button:outline|One check for this place ›}} beside the place's name.

Type the **Check amount**, the **Check number** and the day it was **Received**. The amount starts on what pays the liens off. Change it to what the check says.

The app places the check on the bills with a lien first, oldest first. Three totals show the check, what is placed and what is left to place. To change what a bill gets, press its amount, type the new one and press **Keep**. Press **Spread it again** to undo that.

Then press the green button. It reads like {{button:green|Record 4 payments}}. Each bill gets a payment with the same check number and day.

A line may read *Part of a Stripe bill is recorded on the bill itself.* That line is held. Press *Record it on the bill ›* beside it and record that part on the bill.

A line under the place may say more money is open there on a job with no lien. The check does not pay it unless you place money on it. A release does not cover it.

## Record the day a release was asked for in writing

A payer may ask for the release in writing. The release is then due ten days after that request.

Press the value beside **Asked for a release in writing** on the place's card. Pick the day the request came and press **Keep**. The card then shows **Release due** and counts the days left.

The check pane has the same field. Type the day there when the request comes with the check.

## Wait for the bank to clear a check

A check is not money until the bank clears it. The bank posts a check first. It also names a later day, about a week out. The check has cleared when that day comes.

After you deposit a check, look at the place in Payoffs. A line may read *Check 1184 for $16,455.50 is at the bank.* It names the day the bank says the check clears. There is nothing to record until then.

Press {{button:outline|One check for this place ›}} to see the check. The amount, the number and the day are already filled in from the bank. The green button waits, and a line says the day you can record it.

On that day the Payoffs line on the Lien desk turns amber. It reads *1 check has cleared for liens on record. Record it.* Open the place and record the check. Each lien then moves to step 2.

A row may read {{chip:yellow|Waits for the bank}}. Its bills read paid by a check that has not cleared. The row has no button until the bank clears the check.

A line may say the bank shows no deposit of the check. The release then waits seven days from the day the check was received.

A line may say the check came back. Press {{button:blue|Open the bills ›}} and take the payment off the bill.

## Tell the app the bank confirmed the funds

A leader, a controller or a dev may call the bank about a check. Suppose the bank says the funds are good. Press {{button:outline|The bank confirmed the funds ›}} on the place's card. Type what the bank said and press {{button:green|Confirm the funds}}.

Each lien paid by that check then moves to step 2. The **Release of record** tab lets the release go. The card keeps your name and the day.

Other roles do not see the button.

## Step 2, make the release

The row reads *Paid*, with the day and how the money came. Press {{button:blue|Make the release ›}}. The job's Lien window opens on **Release of record**.

A line at the top says what the money says. Green means the bills read paid. Amber means a check has not cleared, and the buttons wait. Red means money is still open, and the buttons wait.

The payment date is already the day of the last payment. Press **Print for notarization**. Then press **Save release record**. A lien takes one release, so the save press goes away once it is saved.

The leader signs the paper before a notary.

A job with two filed liens asks **Which lien** first. Pick the one that was paid.

## Release a lien with money still open

Sometimes a lien is settled for less than the bills. The red line holds the buttons. Press **Release it anyway…** and type why. The buttons wake, and the reason is saved with the release.

## Release a lien before its check clears

A leader may decide a release goes out before the bank clears the check. A cashier's check is one case. The amber line holds the buttons. Press **Release it anyway…** and type why. The reason is saved with the release.

## Step 3, record it at the county

Take the notarized release to the county clerk. The clerk records it and stamps it.

Back on the Lien desk, press {{button:blue|Record the county’s stamp ›}} on the row. The tab shows **The county's stamp**. Press the value beside **Recorded on**, set the day and press **Keep**. Do the same beside **Instrument number**. The row then reads *Released*.

The stamped copy goes on the release's line under **Filings on this job**. Press *link the saved copy* there and paste its Drive link.

## If the check comes back after a release is made

A check can come back after its release is saved, printed or recorded. The app then says so in three places.

In Payoffs the lien's row turns red. A saved release reads *Do not record it*. Press {{button:blue|Open the bills ›}} and take the payment off the bill.

A release the county already recorded reads *Released, money came back*. The app cannot undo the county's record. Ask counsel what to do. The place stays in the open list until the payment is off the job.

The **Release of record** tab shows the same words in red over **The county's stamp**. You can still set the day and the number there. A stamp the clerk already gave is a fact to keep.

Accounts Receivable shows it too. The check's case has a box named **Liens on this money**. Read [the liens on a check that came back](/help/match-bank-deposits-to-bills#the-liens-on-a-check-that-came-back).

## What the window does not do

The window does not make the paper. The Lien window's **Release of record** tab does that. A single payment is recorded on the job's Bill tab. The window says which one to open and when.

The app counts days. It does not give legal advice.
