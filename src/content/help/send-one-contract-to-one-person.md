---
title: send one contract to one person
category: Office
roles: dev, master_technician, assistant, controller
keywords: contracts, send for signature, quick send, agreements panel, add document, contract book, one document, email, what the sub sees
order: 75
---
You don't need to assign a whole packet just to get one document signed. There are two fast paths, both in **People → Contracts**.

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

## What the email looks like

The **Send for signature** dialog shows the real email before you send it, built by the same code that sends it.

:::example The email, top to bottom
The CLICK. letterhead on the same paper as the sub portal · **One document to sign** · the document name · "Sent to you by <you> · Click Plumbing and Electrical" · your opening message · three steps (open, read, type or draw a signature) · {{button:blue|Read and sign}} · the link and the date it stops working · a note that the signed copy stays on their portal page (or on file with us when they have no page) · one line in Spanish pointing at the portal's **Español** button · how to reach you.
:::

- It comes from **Click Plumbing and Electrical**, and replies go to **you**.
- The subject is **Please sign: <document> · Click Plumbing and Electrical**. Type your own in the **Email subject** box to replace it.
- **Opening message** is the only part in your words. Leave it blank for the default line, or write it like a text to the person: "Taunya, here's the agreement we talked about. Sign once and it covers every job."
- The link works for **14 days**. Sending again mints a fresh link and a fresh email.

## What canceling does

Both paths create the person's unsent copy before the email step, so canceling the email keeps the document filed as {{chip:red|unsent}} — it counts toward **Needs attention** until you send or delete it (row ⋯ menu → Delete).
