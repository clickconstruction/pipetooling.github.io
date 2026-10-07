---
title: share a customer their portal
category: Office
roles: dev, master_technician, assistant, controller
keywords: customer portal, portal link, portal address, custom link, globe, pay online, statement, visit request, bid request, rotate link, as gc, your customers' open bills, billed to your builder, shared bill, owner sees the bills, owner sees $0, property owner, billed to the GC
---
Every customer and GC can have a private, no-login **portal page**. The page is one merged account statement, with {{button:blue|Pay online}} buttons and request forms.

The statement covers their own jobs *and* the properties where they are the GC. Each property where they are the GC is tagged {{chip:yellow|AS GC}} with the owner's name. The "request a visit" and "ask us to bid" forms land straight in the dispatch inbox.

Once a customer has a portal, every new Stripe bill's footer ends with *See your updated statement any time at my.clickplumbing.com/…*. So after paying on Stripe's page, they have one tap back to their statement. The statement refreshes itself. The statement shows ***Payment received — statement updated*** when the bill has cleared. Your own footer text stays exactly as you typed it. The line is added after your text. The bill email carries the same address with a **QR code**. If the customer has no short address yet, their first bill gives them one. The address is their name plus a random tail. The address is already locked, since it has gone out. You can still change it from the gear.

## The portal address

You click the **globe icon** next to any customer's name. The globe is on the **Customers** page and on **Jobs → Pipeline** rows. The globe is in the job window on both the **Job** tab and the **Edit** tab's Customer row. On the Job tab it sits beside the customer's name, above their phone and email. The globe is also beside each GC in **GC Review**. There the Share menu also offers **Copy portal link**, and the Draft Message can carry a portal card.

**The globe's colour is its state**, so you can tell who has a portal without opening anything. A **faint grey** globe means no link has ever been created. A **blue** globe means their portal is live. A **red** globe means it was turned off. You hover over it for the words, like *portal is live*. The sub globe on People → Subs uses the very same colours.

Some customers have **never** been given a portal. For them, the window opens to **No portal link yet**. Just looking creates nothing. You click {{button:blue|Create their link}} when you're ready. Their page goes live, and a "Portal link created" toast confirms it. The window switches to the address view below. Everyone who already has a portal opens straight to it.

The top of the window is their **portal address**, something like `my.clickplumbing.com/knight-contracting-x7kq`:

- The address is **editable until it's first shared**. The address starts as their name **plus a short random tail**. A bare name alone would not be safe. Anyone who knows our short address and who we work for could open the statement. The 🎲 beside the address rolls a new tail. You can type anything short and recognizable instead, using letters, numbers and dashes. A meter tells you if it's ⚠ easy or ✓ hard to guess, **and why**. A plain company name is graded easy on purpose: *it's just their name*. The meter never blocks you.
- {{button:blue|Copy link}} copies the address for a text or email, and **locks** it. Printed and texted copies should never go stale. The link is the key, with no password needed.
- {{button:outline|Preview as customer}} opens the page exactly as they see it. A **live preview** sits right in the window. Your previews are never counted as the customer looking. Any open from a signed-in staff browser doesn't count either.
- The preview's corner buttons are yours too. **⤢ Expand** grows it in place. **Full screen ↗** opens the portal in a new tab.
- Under the preview, **Jobs on this statement** mirrors the statement row for row. The list keeps the same order and the same dates. A row's **Pay ↗** opens that bill's Stripe pay page, when it has one. A row's **Edit ↗** goes straight into the job's Edit window. A bill the office shared with this customer rides at the end with a {{chip:green|shared}} tag. The customer does not pay a shared bill. The dashed box is office chrome, for the office only. Customers never see any of it on their page.

## Behind the gear

The {{icon:gear}} button opens one flat list:

- **Direct link** is the long token link, with a secret code in it. The direct link always works, even while the address changes. You use it if you don't want to touch the address.
- **Address**: before the first share, 🎲 **Random tail** rolls a fresh hard-to-guess ending. The 🎲 at the top of the window does the same. A new address already starts with one. After it's locked, you can still change it here. You get a warning, because the old address stops working.
- **Separate views**: need to give a GC's office *only* their GC bills, or only their own jobs? You create a scoped link on demand, one that shows only that part. Each scoped link has its own Copy and Turn off.
- **Reset**: {{button:outline|Rotate}} makes a new link and kills the old one immediately. The custom address follows automatically. {{button:outline|Turn off}} shuts the whole portal down. A turned-off customer's globe turns **red** everywhere. A live one is blue, and a never-created one is faint grey. The window offers {{button:blue|Turn portal back on}} when you're ready.
- **Opened**: has the customer actually looked? The line reads ***Opened 3 times · last Sep 3***, or **Not opened yet**. Only customer opens count, not your previews or staff opens. So the number means what it says before a follow-up call.
- **History** lists every link and address change: what, when, and by whom.

:::example What the customer sees
A clean account statement: our letterhead, each open bill with the job name and amount — jobs on someone else's property carry a small copper AS GC tag naming the owner — only the bills **this customer pays** are on the ledger and count toward the balance. A bill on their job that went to the other party is **not on the page at all** unless the office shared it (Bill Customer → *Show it on … statement*, or the owner switch below); a shared bill sits below the ledger in its own card — a GC reads *Your customers' open bills* (who owes it, where, billed when and how long ago, received so far, open), an owner reads *On your job, billed to your builder* — with no Pay button and never in the balance. Then a Pay online button for card-payable bills (check reference otherwise), and the two request forms. The visit form's "For" picker lists their **properties by address** (never job numbers or our internal job names). At the bottom, a **"Your account, any time"** card shows their short address with a **QR code**, so even a printed or screenshotted statement carries a way back in. No login, no other customers' data — only theirs.
:::

## When the GC pays: show the owner their property's bills

Some jobs are billed to the GC, while the customer is the property owner. There, the owner's portal lists nothing, since they pay none of the bills. So the owner's portal reads **$0** and *all paid up*, even while the GC owes on their house. Beside the owner's 🌐 on the job's Pipeline row, a chip says so: {{chip:gray|☐ owner sees $0}}.

You click the chip. The app reads **every job at that property** with the same owner. The app asks *Show Umar Khan the bills at 9703 Lenox Hl?* The prompt lists each job, its open bills and what is open. A job not billed yet reads *no bill yet — shows once billed*.

{{button:blue|Show them}} puts every open bill the GC pays on the owner's portal, for their records. Those bills show no Pay button, and never count in the owner's balance. Every bill after that shows too. The chip turns {{chip:blue|☑ owner sees the bills}}. The same click again offers {{button:outline|Stop showing}}. Stop showing takes the open bills back off. Paid ones stay in their history.

{{chip:yellow|owner sees some bills}} means only part is shared. The shared part can be a bill ticked by hand at Bill Customer. The shared part can also come from Edit Job's older *next bills* tick. The switch finishes the job.

The owner's 🌐 window lists the same thing under **On <owner>'s jobs, billed to someone else**. The window has one line per property, with the switch. The live preview under it re-reads when you flip it.

### When a lien notice has gone to the owner

A § 53.056 notice to the owner can be **recorded as sent**. The ways to record it are the run's *Record the run*, or *Already mailed? Record it…* on the Lien desk. Once the notice is recorded, the owner's portal shows it on its own. No switch is needed, since the owner already holds the paper.

The notice shows as a card headed *Notice on your property · mailed Sep 25, 2026*. The card has these:

- the address
- what the GC has not paid, and for which months
- that they did not hire us, and this is not a lawsuit
- what they may hold back
- the three clean ways to finish it. The GC pays us. Or the owner holds it back and calls. Or the owner pays us only with the GC's written okay, never a joint check. A joint check is one check made out to both the GC and us.
- a **Call** button with the signer's name and our number

A draft or a notice awaiting approval never shows. The page stops saying *all paid up*. Instead the page reads *Nothing is billed to you directly. Work on your property is billed to your builder*. The shared bills below read *On your property, billed to your builder*. Each noticed job reads *on the notice above*. When the job is paid off, the card goes.

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

The **Dispatch inbox** gets visit requests, a GC's *Need other dates?*, and a GC's **Ask the office** on a shared bill. Ask the office offers *bill this to us instead* and *remind the owner for us*. **Ask us to bid** goes to the **Estimator inbox**. Ask us to bid goes to Dispatch when nobody is in the estimating group. Working one is its own guide: *answer a customer who sent a request from their portal*.

The form already knows their number. The form shows ***We'll call you at (512) 555-0142***. The number comes from the customer record, or else the newest job's phone. A *use a different number* link sits beside it. A number is required, because it is what your Call button dials. After sending, they read *We'll call you at … as soon as we can during office hours*. So keep that promise. Push notifications go to the group. To also email specific people, you add them under **Settings → Email streams → Portal requests**.

## Safety

Treat the link like a mailed invoice. The link exposes that customer's balances only, and Rotate is always one click away. Each link can send only so many requests in a while. So a leaked link can't flood the inbox.

## The statement reads job by job

The statement lists **every bill they owe, including bills on jobs still in progress**. A progress bill bills part of the work as it goes. A progress bill or change order billed while the crew is still on site appears the moment it is billed. Each such bill has its own Pay online button. The statement uses the same "what's owed" rule as the GC statement email. So the portal's balance matches the office's **Who owes** figure. A job in progress with nothing billed yet shows nothing. The statement never turns a job's price into a bill.

A payment can be recorded on the job without a bill attached. Such a payment is counted against the oldest bill first. The office's Bill tab and the bill's own paper count it the same way. So a customer's balance here never disagrees with what they were sent.

The statement groups everything **by job**. Each job opens with its own header band, showing the trade, job number and address. All of that job's bills and **payments already received** sit together underneath. So a job with several progress bills stays in one place, instead of scattering down the page.

:::example What a job section shows
Bills newest first (each with its billed date, a line saying what has paid it and when — *paid $12,000.00 by check on Sep 24 · $1,333.00 still open*, or *nothing applied yet* — and its own {{button:blue|Pay online}} or check reference), and on the right a boxed recap that reads like a little ledger: **Billed to date**, then **each payment by the date it was received** with its amount, then **Balance on this job**.
:::

On a phone, each bill is a card with its own {{button:blue|Pay online}} button. The date, the amount due and the button stack top to bottom. So nothing sits off the edge of the screen, and there is no sideways scrolling. On a desktop or tablet, the same bills read as one ruled ledger.

A **Print all** button at the top of the statement prints the whole account for paper review. First comes a cover with the balance. Then comes **every job on its own page**, with bills, payments received and the balance recap. Then comes a closing page with the total and the portal QR code. Each page says whose it is and which job it covers, like *Job 3 of 11*. So a customer can work through them one at a time. Or a GC can hand each owner their page. Choosing "Save as PDF" in the print dialog turns the same packet into a file. Pay-online buttons don't print. Check references and the QR do.

The recap box is the same payment-totals box that prints on the invoice itself. That box shows on the preview, the PDF and the invoice email. So customers see one consistent story everywhere. A customer can confirm their check landed without calling the office. Internal payment notes never appear. Customers see the payment method only. A payment recorded with the catch-all type "other" simply reads "Payment".
