---
title: see what a sub put on a signed form and open the PDF
category: Office
roles: dev, master_technician, controller
keywords: W-9, signed form, form answers, open PDF, social security number, EIN, sensitive, compliance, contracts
order: 78
---
A sub fills a form like the W-9 on the signing page. The answers land on the form itself, and the office can read them.

A sub is a subcontractor. The W-9 is the tax form that carries their taxpayer number. The office sees two things. The plain answers sit on the record. The roles allowed can also open the signed PDF.

## The record

You open the {{chip:green|signed}} document on **People → Contracts** as usual. A form shows a **Form answers** card in place of contract text. The card holds:

- Every answer the signer typed or ticked, labelled the way the form labels it, in the form's order.
- A choice list shows as one line with what they picked. The W-9's tax classification is one.
- **Sensitive answers** show only their last four, tagged *in the PDF only*. That means a Social Security number or an EIN, the employer tax number. The full number is not stored on the record anywhere.
- Where it came from: *filled on the signing page* or *keyed in from paper*.

The same document on the **Person Desk** paperwork list ends in *· form*. So a filled W-9 reads differently from an uploaded link.

## Open the signed PDF

You press {{button:outline|Open signed PDF}}. It fetches the filled, flattened form and opens it in a new tab. Flattened means the answers are baked into the page. It is exactly what the signer saw, with their signature and date on the line. The link works for five minutes.

:::example Who can open it
Devs, controllers, and pay-approved leaders. Assistants can see the record and the last-four hints but get a clear "not allowed" message on the button. Every open is logged with who and when.
:::

Print from the browser when the IRS or a builder needs a hard copy. Never forward the PDF by email. If someone needs the number, they open the PDF themselves.

## When facts change

A W-9 does not expire. A new name, entity, or address means a new form. Send the person a fresh copy from Contracts the same way you sent the first. The signed one stays on file.
