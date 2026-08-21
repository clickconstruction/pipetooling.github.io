---
title: share a customer their portal
category: Office
roles: dev, master_technician, assistant, controller
keywords: customer portal, portal link, globe, pay online, statement, visit request, bid request, rotate link
---
Every customer (and GC) can have a private, no-login **portal page**: their open bills at the top with {{button:blue|Pay online}} buttons, and "request a visit" / "ask us to bid" forms at the bottom that land straight in the dispatch inbox.

## Opening the link

Click the **globe icon** next to any customer's name — on the **Customers** page, on **Jobs → Pipeline** rows, in **Job Detail**, or in **Edit Job**. The modal shows their portal link with:

- {{button:blue|Copy link}} — paste it into a text or email; the link is the key, no password needed.
- {{button:outline|Preview as customer}} — opens the page exactly as they see it.
- A **live preview** right in the modal — a scaled-down view of the actual page this link opens, so you can sanity-check what they'll see before sending. It follows the **As customer / As GC** toggle.

Behind the {{icon:gear}} **Advanced** button:

- {{button:outline|Rotate}} — makes a new link and kills the old one immediately (use if a link leaked or an email went to the wrong person).
- {{button:outline|Turn off}} — revokes the link with no replacement. A turned-off customer's globe turns **red** everywhere, and the modal offers {{button:blue|Turn portal back on}} when you're ready (that makes a brand-new link).
- **Link history** — when each link was created, rotated, or turned off, and by whom.

GCs get a GC-flavored view (bills across all their jobs) — the **As GC** toggle in the modal manages that link separately.

:::example What the customer sees
A clean account statement: our letterhead, each open bill with the job name and amount, a Pay online button for card-payable bills (check reference otherwise), and the two request forms. No login, no other customers' data — only theirs.
:::

## When they send a request

Visit and bid requests appear in the **dispatch inbox** like any dispatch item, with the customer's notes, availability, and phone. Push notifications go to the dispatch group; to also email specific people, add them under **Settings → Email streams → Portal requests**.

## Safety

Treat the link like a mailed invoice: it exposes that customer's balances only, and Rotate is always one click away. Requests are rate-limited per link, so a leaked link can't flood the inbox.
