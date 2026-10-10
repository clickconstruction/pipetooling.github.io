---
title: share a customer their portal
category: Office
roles: dev, master_technician, assistant, controller
keywords: customer portal, portal link, portal address, custom link, globe, pay online, statement, visit request, bid request, rotate link, as gc, your customers' open bills, billed to your builder, shared bill, owner sees the bills, owner sees $0, property owner, billed to the GC
---
A customer's portal is a private page with their statement and Pay online buttons. You make the link from the globe next to their name.

Every customer and GC can have a private, no-login **portal page**. The page is one merged account statement, with {{button:dark|PAY ONLINE}} buttons and request forms.

The statement covers their own jobs *and* the properties where they are the GC. Each job where they are the GC carries an {{chip:yellow|AS GC}} tag, with the owner named beside it. A visit request lands in the Dispatch inbox. An "ask us to bid" request lands in the Estimator inbox.

A customer whose job we build as the general contractor also sees that job. Our contract waits there for them to read and sign, with the price and the file. See [send our contract to a GC customer to sign](/help/send-our-contract-to-a-gc-customer). The change orders waiting on the customer can be signed or declined there. At the end, the customer can accept the work there too. See [close out a GC job with the customer](/help/close-out-a-gc-job-with-the-customer).

Once a customer has a portal, every new Stripe bill's footer ends with *See your updated statement any time at https://my.clickplumbing.com/…*. The line is left off a bill sent to a typed email. The line is also left off when the footer would run too long for Stripe. So after paying on Stripe's page, they have one tap back to their statement. The statement refreshes itself. The statement shows ***Payment received — statement updated*** when the bill has cleared. Your own footer text stays exactly as you typed it. The line is added after your text. The bill email carries the same address with a **QR code**. If the customer has no short address yet, their first bill gives them one. The address is their name plus a random tail. The address is already locked, since it has gone out. You can still change it from the gear.

## The portal address

You click the **globe icon** next to any customer's name. The globe is on the **Customers** page and on **Jobs → Pipeline** rows. The globe is in the job window on both the **Job** tab and the **Edit** tab's Customer row. On the Job tab it sits beside the customer's name, above their phone and email. The globe is also beside each GC in **GC Review**. There the Share menu also offers **Copy portal link**, and the Draft Message can carry a portal card.

**The globe's colour is its state**, so you can tell who has a portal without opening anything. A **faint grey** globe means no link has ever been created. A **blue** globe means their portal is live. A **red** globe means it was turned off. You hover over it for the words, like *portal is live*. The sub globe on People → Subs uses the very same colours.

Some customers have **never** been given a portal. For them, the window opens to **No portal link yet**. Just looking creates nothing. You click {{button:blue|Create their link}} when you're ready. Their page goes live, and a "Portal link created" toast confirms it. The window switches to the address view below. Everyone who already has a portal opens straight to it.

The top of the window is their **portal address**, something like `my.clickplumbing.com/knight-contracting-x7kq`:

- The address is **editable until it's first shared**. The address starts as their name **plus a short random tail**. A bare name alone would not be safe. Anyone who knows our short address and who we work for could open the statement. The 🎲 beside the address rolls a new tail. You can type anything short and recognizable instead, using letters, numbers and dashes. A meter tells you if it's ⚠ easy or ✓ hard to guess, **and why**. A plain company name is graded easy on purpose: *it's just their name*. The meter never blocks you.
- {{button:blue|Copy link}} copies the address for a text or email, and **locks** it. Printed and texted copies should never go stale. The link is the key, with no password needed.
- {{button:outline|Preview as customer}} opens the page exactly as they see it. A **live preview** sits right in the window. Your previews are never counted as the customer looking. Any open from a signed-in staff browser doesn't count either.
- The preview's corner buttons are yours too. **⤢ Expand** grows it in place. **Full screen ↗** opens the portal in a new tab.
- Under the preview, **Jobs on this statement** lists the same bills as the statement, with the same dates. The list runs newest first, not grouped by job. A row's **Pay ↗** opens that bill's Stripe pay page, when it has one. A row's **Edit ↗** goes straight into the job's Edit window. A bill the office shared with this customer rides at the end with a {{chip:green|shared}} tag. The customer does not pay a shared bill. The dashed box is office chrome, for the office only. Customers never see any of it on their page.

## Behind the gear

The {{icon:gear}} button opens one flat list:

- **Direct link** is the long token link, with a secret code in it. The direct link always works, even while the address changes. You use it if you don't want to touch the address.
- **Address**: before the first share, 🎲 **Random tail** rolls a fresh hard-to-guess ending. The 🎲 at the top of the window does the same. A new address already starts with one. After it's locked, you can still change it here. You get a warning, because the old address stops working.
- **Separate views**: need to give a GC's office *only* their GC bills, or only their own jobs? You create a scoped link on demand, one that shows only that part. Each scoped link has its own Copy and Turn off.
- **Reset**: {{button:outline|Rotate}} makes a new link and kills the old one immediately. The custom address follows automatically. {{button:outline|Turn off}} shuts the whole portal down. A turned-off customer's globe turns **red** everywhere. A live one is blue, and a never-created one is faint grey. The window offers {{button:blue|Turn portal back on}} when you're ready.
- **Opened**: has the customer actually looked? The line reads ***Opened 3 times · last Sep 3***, or **Not opened yet**. Only customer opens count, not your previews or staff opens. So the number means what it says before a follow-up call.
- **History** lists every link and address change: what, when, and by whom.

## Safety

Treat the link like a mailed invoice. The link exposes that customer's balances only, and Rotate is always one click away. Each link can send only so many requests in a while. So a leaked link can't flood the inbox.

## More on the portal

- [See what a customer sees on their portal](/help/see-what-a-customer-sees-on-their-portal): the statement job by job, where each check went, and their requests.
- [Show an owner the bills their GC pays](/help/show-an-owner-the-bills-their-gc-pays): the owner switch, and a lien notice on their portal.
