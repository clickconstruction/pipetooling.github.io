---
title: send one contract to one person
category: Office
roles: dev, master_technician, assistant, controller
keywords: contracts, send for signature, quick send, agreements panel, add document, contract book, one document
order: 75
---
You don't need to assign a whole template just to get one document signed. There are two fast paths, both in **People → Contracts**.

## Send from the Agreements panel

Best when you're thinking document-first — "who still needs the Handbook?"

1. On desktop, the **Agreements** panel lists every document beside the people list. Each card has a {{button:blue|Send to…}} button.
2. Click it and pick the person. The list is split for you:
   - **Hasn't received it yet** — people with no copy (or an unsent one waiting to go).
   - **Already has it (resend)** — people with a {{chip:yellow|sent}} copy; picking them resends a fresh link.
3. The normal **Send for signature** email opens with the person's roster email already filled in. {{button:blue|Send email}} and you're done.

:::example Where the contract text comes from
The signing page uses the newest **Contract Book** copy of the document. If the document only exists as personal copies (no library entry), the most recent copy with contract text is used instead.
:::

People who have already **signed** the document aren't listed — the card's expanded view shows them.

## Send from a person's row

Best when you're thinking person-first — "get Darren set up."

1. Expand the person and click {{button:outline|+ Add document}}.
2. Pick **From Contract Book** — the common case. Choose the document; its name, contract text, and applied version fill in automatically.
3. {{button:blue|Send now}} opens the send email immediately, or {{button:outline|Save for later}} files it as {{chip:red|unsent}} to send from the row later.

Need something unusual? **Customize text or applied date** under the document list opens the full editors, and the **Custom or already-signed** path is the complete form — blank documents, uploads of already-signed copies, everything as before.

## What canceling does

Both paths create the person's unsent copy before the email step, so canceling the email keeps the document filed as {{chip:red|unsent}} — it counts toward **Needs attention** until you send or delete it (row ⋯ menu → Delete).
