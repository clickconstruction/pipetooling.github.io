---
title: share a customer their portal
category: Office
roles: dev, master_technician, assistant, controller
keywords: customer portal, portal link, portal address, custom link, globe, pay online, statement, visit request, bid request, rotate link, as gc
---
Every customer (and GC) can have a private, no-login **portal page**: one merged account statement — their own jobs *and* the properties they GC, each of those tagged {{chip:yellow|AS GC}} with the owner's name — with {{button:blue|Pay online}} buttons, plus "request a visit" / "ask us to bid" forms that land straight in the dispatch inbox.

## The portal address

Click the **globe icon** next to any customer's name — on the **Customers** page, on **Jobs → Pipeline** rows, in **Job Detail**, in **Edit Job**, or beside each GC in **GC Review** (whose Share menu also offers **Copy portal link**, and whose Draft Message can carry a portal card).

For a customer who has **never** been given a portal, the modal opens to **No portal link yet** — just looking creates nothing. Click {{button:blue|Create their link}} when you're ready: their page goes live, a "Portal link created" toast confirms it, and the modal switches to the address view below. Everyone who already has a portal opens straight to it.

The top of the modal is their **portal address**, something like `my.clickplumbing.com/knight-contracting`:

- The address is **editable until it's first shared** — type anything short and recognizable (letters, numbers, dashes). A meter tells you if it's ⚠ easy or ✓ hard to guess; it never blocks you.
- {{button:blue|Copy link}} — copies the address for a text or email, and **locks** it (printed and texted copies should never go stale). The link is the key, no password needed.
- {{button:outline|Preview as customer}} — opens the page exactly as they see it, and a **live preview** sits right in the modal.
- The preview's corner buttons **⤢ Expand** (grow it in place) and **Full screen ↗** (open the portal in a new tab) are yours too.
- Under the preview, **Jobs on this statement** mirrors the statement row for row — same order, same dates — with **Pay ↗** (that bill's Stripe pay page, when it has one) and **Edit ↗** (straight into the job's Edit window). The dashed box is office chrome: customers never see any of it on their page.

## Behind the gear

The {{icon:gear}} button opens one flat list:

- **Direct link** — the long token link. Always works, even while the address changes; use it if you don't want to touch the address.
- **Address** — before the first share, 🎲 **Random tail** adds a hard-to-guess ending. After it's locked you can still change it here — with a warning, because the old address stops working.
- **Separate views** — need to give a GC's office *only* their GC bills, or only their own jobs? Create a scoped link on demand; each has its own Copy and Turn off.
- **Reset** — {{button:outline|Rotate}} makes a new link and kills the old one immediately (the custom address follows automatically); {{button:outline|Turn off}} shuts the whole portal down. A turned-off customer's globe turns **red** everywhere, and the modal offers {{button:blue|Turn portal back on}} when you're ready.
- **History** — every link and address change: what, when, and by whom.

:::example What the customer sees
A clean account statement: our letterhead, each open bill with the job name and amount — jobs on someone else's property carry a small copper AS GC tag naming the owner — a Pay online button for card-payable bills (check reference otherwise), and the two request forms. The visit form's "For" picker lists their **properties by address** (never job numbers or our internal job names). At the bottom, a **"Your account, any time"** card shows their short address with a **QR code**, so even a printed or screenshotted statement carries a way back in. No login, no other customers' data — only theirs.
:::

## When they send a request

Visit and bid requests appear in the **dispatch inbox** like any dispatch item, with the customer's notes, availability, and phone. Push notifications go to the dispatch group; to also email specific people, add them under **Settings → Email streams → Portal requests**.

## Safety

Treat the link like a mailed invoice: it exposes that customer's balances only, and Rotate is always one click away. Requests are rate-limited per link, so a leaked link can't flood the inbox.

## The statement reads job by job

The statement lists **every bill they owe, including bills on jobs still in progress** — a progress bill or change order billed while the crew is still on site appears the moment it is billed, with its own Pay online button. It is the same "what's owed" rule the GC statement email uses, so the portal's balance matches the office's **Who owes** figure. A job in progress with nothing billed yet shows nothing: the statement never turns a job's price into a bill.

The statement groups everything **by job**: each job opens with its own header band (trade, job number, address), with all of that job's bills and **payments already received** together underneath — a job with several progress bills stays in one place instead of scattering down the page.

:::example What a job section shows
Bills newest first (each with its billed date and its own {{button:blue|Pay online}} or check reference), and on the right a boxed recap that reads like a little ledger: **Billed to date**, then **each payment by the date it was received** with its amount, then **Balance on this job**.
:::

A **Print all** button at the top of the statement prints the whole account for paper review: a cover with the balance, then **every job on its own page** — bills, payments received, and the balance recap — then a closing page with the total and the portal QR code. Each page says whose it is and which job it covers (Job 3 of 11), so a customer can work through them one at a time or a GC can hand each owner their page. Choosing "Save as PDF" in the print dialog turns the same packet into a file. Pay-online buttons don't print; check references and the QR do.

The recap box is the same payment-totals box that prints on the invoice itself (preview, PDF, and the invoice email), so customers see one consistent story everywhere. A customer can confirm their check landed without calling the office. Internal payment notes never appear; customers see the payment method only — and a payment recorded with the catch-all type "other" simply reads "Payment".
