---
title: see what a sub put on a signed form and open the PDF
category: Office
roles: dev, master_technician, controller
keywords: W-9, signed form, form answers, open PDF, social security number, EIN, sensitive, compliance, contracts
order: 78
---
When a sub fills a form like the W-9 on the signing page, the answers land on the form itself. The office sees two things: the plain answers on the record, and, for the roles allowed, the signed PDF.

## The record

On **People → Contracts**, open the {{chip:green|signed}} document as usual. A form shows a **Form answers** card in place of contract text:

- Every answer the signer typed or ticked, labelled the way the form labels it, in the form's order.
- A choice list (the W-9's tax classification) shows as one line with what they picked.
- **Sensitive answers** — a Social Security number or EIN — show only their last four, tagged *in the PDF only*. The full number is not stored on the record anywhere.
- Where it came from: *filled on the signing page* or *keyed in from paper*.

The same document on the **Person Desk** paperwork list ends in *· form*, so a filled W-9 reads differently from an uploaded link.

## Open the signed PDF

{{button:outline|Open signed PDF}} fetches the filled, flattened form — exactly what the signer saw, with their signature and date on the line — and opens it in a new tab. The link works for five minutes.

:::example Who can open it
Devs, controllers, and pay-approved masters. Assistants can see the record and the last-four hints but get a clear "not allowed" message on the button. Every open is logged with who and when.
:::

Print from the browser when the IRS or a builder needs a hard copy. Never forward the PDF by email; if someone needs the number, they open the PDF themselves.

## When facts change

A W-9 does not expire, but a new name, entity, or address means a new form. Send the person a fresh copy from Contracts the same way you sent the first; the signed one stays on file.
