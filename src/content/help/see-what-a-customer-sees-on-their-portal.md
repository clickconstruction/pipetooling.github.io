---
title: see what a customer sees on their portal
category: Office
roles: dev, master_technician, assistant, controller
keywords: portal statement, what the customer sees, pay online, check reference, print all, save as pdf, your payments, where each check went, find a check, show all, visit request, ask us to bid, ask the office, we'll call you at, as gc, your customers' open bills, job by job, balance on this job, billed to date, your account any time
---
A customer's portal shows one statement of the bills they pay us, job by job. The portal also shows where each check went, and lets them ask for a visit or a bid.

## What the customer sees

:::example What the customer sees
A clean account statement: our letterhead, each job under a band with its trade, job number and address — a job on someone else's property carries a copper AS GC tag, with *owner:* and the owner's name beside it — only the bills **this customer pays** are on the ledger and count toward the balance. A bill on their job that went to the other party is **not on the page at all** unless the office shared it (Bill Customer → *Show it on … statement*, or the owner switch below); a shared bill sits below the ledger in its own card — a GC reads *Your customers' open bills* (who owes it, where, billed when and how long ago, received so far, open), an owner reads *On your job, billed to your builder* — with no Pay button and never in the balance. Then a PAY ONLINE button for card-payable bills (check reference otherwise), and the two request forms. The visit form's "For" picker lists their **properties by address** (never job numbers or our internal job names). At the bottom, a **"Your account, any time"** card shows their short address with a **QR code**, so even a printed or screenshotted statement carries a way back in. No login, no other customers' data — only theirs.
:::

The owner switch is in [show an owner the bills their GC pays](/help/show-an-owner-the-bills-their-gc-pays).

## The statement reads job by job

The statement lists **every bill they owe, including bills on jobs still in progress**. A progress bill bills part of the work as it goes. A progress bill or change order billed while the crew is still on site appears the moment it is billed. Each such bill has its own **PAY ONLINE** button. The statement uses the same "what's owed" rule as the GC statement email. So the portal's balance matches the office's **Who owes what** figure. A job in progress with nothing billed yet shows nothing. A job in Billed with no bill line is different. That job shows what is left of its price as one row.

A payment can be recorded on the job without a bill attached. Such a payment first covers any work that no sent bill covers. What is left pays the oldest sent bill first. The office's Bill tab and the bill's own paper count it the same way. So a customer's balance here never disagrees with what they were sent.

The statement groups everything **by job**. Each job opens with its own header band, showing the trade, job number and address. All of that job's bills and **payments already received** sit together underneath. So a job with several progress bills stays in one place, instead of scattering down the page.

:::example What a job section shows
Bills newest first (each with its billed date, a line saying what has paid it and when — *paid $12,000.00 by check #48211 on Sep 24, 2026 · $1,333.00 still open*, or *nothing applied yet* — and its own {{button:dark|PAY ONLINE}} or check reference), and on the right a boxed recap that reads like a little ledger: **Billed to date**, then **each payment by the date it was received** with its amount, then **Balance on this job**.
:::

On a phone, each bill is a card with its own {{button:dark|PAY ONLINE}} button. The date, the amount due and the button stack top to bottom. So nothing sits off the edge of the screen, and there is no sideways scrolling. On a desktop or tablet, the same bills read as one ruled ledger.

A **Print all** button at the top of the statement prints the whole account for paper review. First comes a cover with the balance. Then comes **every job on its own page**, with bills, payments received and the balance recap. Then comes a closing page with the total and the portal QR code. Each page says whose it is and which job it covers, like *Job 3 of 11*. So a customer can work through them one at a time. Or a GC can hand each owner their page. Choosing "Save as PDF" in the print dialog turns the same packet into a file. Pay-online buttons don't print. Check references and the QR do.

The recap box is the same payment-totals box that prints on the invoice itself. That box shows on the preview, the PDF and the invoice email. So customers see one consistent story everywhere. A customer can confirm their check landed without calling the office. Internal payment notes never appear. Customers see the payment method only. A payment recorded with the catch-all type "other" shows no method word, only the day it was paid.

## Your payments: where each check went

Under the statement, **Your payments** answers the bookkeeper's question before they call. The section shows every check they sent us and where it sits now, one line per job and bill. The section also shows any move since a check was recorded.

:::example One payment, as they read it
**Check #48211 · $18,400.00 · received Sep 24, 2026 (mailed Sep 19)**
Applied now to $6,400.00 on 210 Maple Ct · 1058 Maple Ct, Invoice 1 of 1, which it paid in full and $12,000.00 on 4410 Oak Ridge Dr · 1041 Oak Ridge Ph 2, Invoice 2 of 3.
:::

- The box above the list finds a payment by **check number, amount or the day it reached us**. The box is the same lookup you have in GC Review → Share → Find a check.
- The newest five show first. **Show all** lists everything on record.
- Only their own money is there. A bill someone else pays on the same job never reaches the page. Any payment that could name such a bill never reaches the page either.
- A check the office recorded without its number says so, and asks them for it. That note is on screen only. The printed statement already lists every payment under its job.

## When they send a request

A request from the portal is a **customer waiting**. The request lands at the top of the inbox. The request shows a red rail, the customer's words, and one big **Call** button. A banner follows everyone in that inbox around the app, until someone lowers or closes it.

The **Dispatch inbox** gets visit requests, a GC's *Need other dates?*, and a GC's **Ask the office** on a shared bill. **Ask the office ›** offers *Bill this to us instead* and *Remind the owner for us*. **Ask us to bid** goes to the **Estimator inbox**. Ask us to bid goes to Dispatch when nobody is in the estimating group. Working one is its own guide: *answer a customer who sent a request from their portal*.

The form already knows their number. The form shows ***We'll call you at (512) 555-0142***. The number comes from the customer record, or else the newest job's phone. A *use a different number* link sits beside it. A number is required, because it is what your Call button dials. After sending, they read *We'll call you at … as soon as we can during office hours*. So keep that promise. Push notifications go to the group. To also email specific people, a dev adds them under **Settings → Emails & reports → Portal requests**.

## More on the portal

- The link, the gear and whether they have looked are in [share a customer their portal](/help/share-a-customer-their-portal).
- Bills the GC pays on an owner's property are in [show an owner the bills their GC pays](/help/show-an-owner-the-bills-their-gc-pays).
