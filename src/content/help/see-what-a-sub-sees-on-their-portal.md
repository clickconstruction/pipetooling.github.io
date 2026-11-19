---
title: see what a sub sees on their portal
category: Office
roles: dev, master_technician, assistant, controller
keywords: which bill does this sheet ride on, request the draw, no bill tied, sub portal, subcontractor portal, got it, something is wrong, received, mark answered, statements, statement of account, work statement, payment record, still open, work and pay, what the sub sees, how do i get paid, backcharge memo, pay run, paperwork, plans, stage, inspection, work done, waiting on customer, queued, window, pick a start day, days off, progress, percent
---
A sub's portal shows their jobs, their pay and their paperwork. Each job card says in one sentence what stands between them and the money.

## What feeds it

The portal shows work you already do, and adds no new chores:

- **Jobs & line items** come from their Sub Labor sheets.
- **Payments and backcharges** come from the payment modals, the pop-ups where you record them. A backcharge is money taken off a sub's pay. **Memos are shown to the sub**, so write them like they'll read them. The Edit Payment modal has a *hide this memo* checkbox for the rare office-internal note. The amount always shows.
- **"When do I get paid"** comes from the sheet's **stage**, described below. The answer also comes from the {{chip:blue|Shown on the sub's portal}} box in the sheet editor. That box holds a *payable after* date and a plain-words reason, like *Builder's inspection — scheduled Sep 9*. Leave those blank and the stage sentence speaks for itself.
- The company-wide **pay-run day**, the weekday we pay subs, lives at ***Settings → People & teams → Sub portal · pay schedule***. So does the "How pay works here" wording.
- **Paperwork status** comes from People → Contracts. The status shows signed dates and expirations. A {{button:amber|Sign now}} button opens the same signing page your contracts use.

## "How do I get paid?" — the guide at the bottom

The very bottom of the sub's page carries a copper-edged card, ***How do I get paid? · How this page works · 2 min***. On a phone the card opens a bottom sheet, a panel that slides up from the bottom. On a desktop the card opens a dialog. The guide answers that question first, in one paragraph. Then the guide walks the four steps with the same dots the job cards use: ***Work · Pre-inspection · Post-inspection: Trigger draw · You're paid***. Each step carries the sentence the job card shows at that step. Each step also has a You / Us split, saying what the sub does and what we do. On Pre-inspection the split covers punch lists, the small fixes left at the end. On Post-inspection the split covers the occasional advance. On You're paid the split says "documents current = same day it hits us, it hits you".

Below the steps come the one button, *✓ My work here is done*, and new work offers. After those come the four documents that keep a sub payable, deductions, and two *Coming soon* cards. English and Spanish follow the page's own toggle.

A job card wears a **📐 Plans** pill in its header when its Pipeline job has a plans link. The link is set in Edit Job → Files & Plans. Or the link is the bid's set in CountTooling, the app where we count from the plans. The guide points subs to the pill. A CountTooling plans link opens for the sub **without CountTooling's email prompt**. The portal signs a short-lived pass into the link that says who they are. CountTooling's access log for that view link shows their name with *via PipeTooling portal*.

## Walk a sheet through its stages

Every sub sheet sits at one of three stages. The portal draws them as a four-dot tracker under the job: ***Work · Pre-inspection · Post-inspection: Trigger draw · You're paid***. One plain sentence says what stands between the sub and the money.

| On Sub Labor | What the sub reads |
| --- | --- |
| {{chip:yellow|Waiting on work}} | "Finish the work, so we can call it in for inspection." |
| {{chip:purple|Waiting on inspection}} | *"You told us the work's done Sep 4. We've called it in for inspection — a short punch list may come first."* |
| {{chip:blue|Waiting on customer}} | *"Passed inspection Sep 6. Draw requested from the customer — their payment is the last thing between you and this money…"* |
| {{chip:blue|Waiting on customer}}, and the customer has five recent payments | One more line: *"This customer usually pays 4 to 6 weeks after we ask."* |
| {{chip:blue|Waiting on customer}}, and the customer paid the sheet's bill | A green {{chip:green|Customer paid Nov 12, 2026}} chip: *"The customer paid on Nov 12, 2026. Your payment is next. We will give it a pay run day."* |
| {{chip:blue|Waiting on customer}} + a *payable after* date | The fourth dot lights with a green {{chip:green|Queued for Friday}} chip: *"Queued for the pay run — the date is right below."* |
| {{chip:green|Paid}} | The card leaves *Your jobs*. Paid sets itself when the balance hits $0. |

Move a sheet from the **Where it stands** rail on **Jobs → Subs → Pay**. The **→** beside the rail advances one stage. Clicking the rail's current dot opens all three, so you can jump or step back. The same control sits in the sheet editor's *Shown on the sub's portal* box.

:::example The sub tells you first
While a sheet is *Waiting on work*, the sub sees {{button:green|✓ My work here is done}} on that job. Pressing it (with an optional note — "Cleanout is behind the water heater — gate code 4471") moves the sheet to *Waiting on inspection* by itself. You'll see **Ready to walk — Danny Vasquez · 1004 162 Forest Drive** in the dispatch inbox, and the chip on Sub Labor reads *Waiting on inspection · sub* with their note behind ✎.
:::

**A sheet moves itself when the facts do.** The sub may report **100%** from the portal. Or the signed work order's last day may pass. Either way, the rail shows {{chip:purple|Waiting on inspection}} on its own, with a small ***· auto*** mark. Nobody has to click. If you move it back to *Waiting on work* by hand after that, your call stays. *Waiting on customer* is still yours to set once the inspection passes.

Every move, yours or the sub's, writes a **Sub labor** line on the job's Activity feed. The line says who moved the sheet, from what to what, and the note. So the history is always on the job.

## Tie a waiting sheet to one bill

A sheet that is *Waiting on customer* rides on one of the job's bills. The sheet waits on that bill's payment.

The sub's page says the customer paid when that bill is paid in full. The page shows the day and never the amount. A part payment changes nothing on their page.

A bill is open until it is paid. A bill you have not sent yet counts as open.

- **The job has one open bill.** The sheet is tied to it when you move the sheet. You are not asked.
- **The job has several open bills.** A window asks **Which bill does this sheet ride on?** Pick the bill, then press {{button:blue|Request the draw}}.
- **The job has no open bill.** The sheet moves and rides on no bill.

The window also offers **No bill**. Pressing **Cancel** leaves the sheet where it was.

The sheet's row on **Jobs → Subs → Pay** says which bill it rides on, under the rail. A sheet with no bill reads *No bill tied*. Press that line to pick the bill, change it or clear it.

Moving the sheet back a stage clears the bill. Deleting the bill clears it too.

The sub does not see which bill the sheet rides on.

## How long the customer usually takes

While a sheet waits on the customer, their page can say how long that customer usually takes.

- **One line under the waiting sentence.** It reads *This customer usually pays 4 to 6 weeks after we ask.*
- **It is in weeks.** Their page never shows days, an amount or the customer's name.
- **It needs five payments.** A customer with fewer than five payments in the last 12 months shows no line.
- **It reads the same payments as *Pays in*.** The weeks are wide enough to hold that range of days.
- **The customer is whoever the bill goes to.** A bill sent to the builder reads the builder's pace.
- **Your row says what they read.** Under the rail it reads *Sub sees: usually 4 to 6 weeks*.
- **The line goes away when the customer pays.** It also goes away once you set a payable-after date.

## When the customer pays

You record the customer's payment on the bill as you always do. Nothing more is needed for the sub's page.

- **Their page changes by itself.** The chip reads *Customer paid* with the day. The sentence says their payment is next.
- **Your row says what they read.** Under the rail it reads *Sub sees: Customer paid Nov 12*.
- **Set a payable-after date next.** Their page then reads *Queued for* that day.
- **After two days with no date the row turns amber.** It reads *Customer paid Nov 9 · not queued, 3 days*. The sub can see the day, so you see the same clock.
- **A hold shows under their sentence.** Type the reason in *Why the wait*. The sub reads it right under *The customer paid*. A held sheet's row stays grey.

A sheet with no bill tied never says the customer paid. Its page stays on *Draw requested* until you queue the payment.

## What they see when an offer has a window

A work order drafted from a stage reaches the portal with the window drawn as a calendar. A window is the span of days you want the work done in. The guide *set a window for a sub's stage* covers it. The sub taps a start day. The job's working days fill to the end. Signing carries the pick. You get a dispatch line, like *Behar picked Sep 22 → Sep 23 for #1004 · Top-out*. The Subs → Work row reads *picked Sep 22 – Sep 23 by the sub*. The sub can move the dates inside the window until the day before the start. After that the card tells them to call.

## Their days off

Subs mark days off on the portal's **Your days**. Those days show as stripes on their lane on **Projects → Forecast → Subs**. A booking over one of those days gets the red outline. The days also show hatched, shaded with lines, on their row on **Schedule → Dispatch → People → Subs**. If a sub marks off a day their pick already covers, a dispatch line says so. Move the window or call them.

## How far along they say they are

A sub can report 25, 50 or 75 percent from the job card, with a note. Each report is a **Sub progress** line on the job's Activity feed. A note also lands in the dispatch inbox. A bare percent never does. You see the percent beside their name on **Jobs → Subs → Work** and on the sheet story's Work row. A 100% report is the same "my work here is done" as before, and moves the sheet to Pre-inspection.

## Their statements

A switch sits under the head of the sub's page. It reads ***Today*** and ***Statements***.

***Today*** is the page as it always was. ***Statements*** holds the sub's own papers:

- **Statement of account.** It is live to date, with *Still open* at the top. A sub can pick dates and save it as a PDF.
- **Work statements.** One for every sheet that is theirs alone. Open ones come first, then paid ones.
- **Payments.** One line for each check or transfer, newest first. Each line says what went to each statement.

Each row saves the same PDF you print from **Statement of account…** and **Work statement…**. The PDFs are in English.

**The sub's page never gives out a number.** A work statement shows its number only after you have made that paper. A statement of account a sub saves has no number. Its foot reads *Saved from your page*, with the day and time.

A sheet can change after you made its paper. The row then says it changed since your copy. Its PDF keeps the number and says the same.

A sheet two people share stays on ***Today***. It is not on ***Statements***.

A memo you hid stays hidden. The amount always shows.

Sometimes the papers do not add up. The sub then sees no figure. The page says the office is checking, with your phone number. You see the reason on your own **Statement of account…** window.

Print still prints the ***Today*** page.

### What they say back

A sub can answer two ways from ***Statements***. Neither is a condition of being paid.

- {{button:gray|Got it}} sits on a payment. It asks one question, *Did this payment reach you?* A yes marks the payment received. It cannot be undone from their page.
- ***Something is wrong*** sits under a statement and under a payment. It sends you a note in the sub's own words. Nothing on the statement changes.

You see both on **Jobs → Subs → Pay**:

- A payment they marked wears a grey chip, like {{chip:gray|Received Nov 2 · from their page}}. A payment nobody marked says nothing. A sub who never taps the button has done nothing wrong.
- A note flags the sub's group and the sheet in red. A note about a payment shows on each sheet that payment paid on. Open the sheet to read it under **From the sub's page**.
- A note also lands in the dispatch inbox, and phones hear it. It reads like *Harlan says something is wrong on WS-2041-1*.

Answer the sub the way you usually would. Then press {{button:gray|Mark answered}} on the note. The flag goes away. The note stays on the sheet with who answered it and when.

You cannot answer for a sub. When you open their page signed in, or as a preview, both presses are refused.

How you make these papers is in [make a statement of account for a sub](/help/make-a-statement-of-account-for-a-sub).

## More on the portal

- The link, the address and whether they have looked are in [share a sub their portal](/help/share-a-sub-their-portal).
- How a sub signs to accept work is in [assemble a sub work order](/help/assemble-a-sub-work-order#sign-to-accept-work).
