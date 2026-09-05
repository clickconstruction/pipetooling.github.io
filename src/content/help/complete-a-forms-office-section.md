---
title: complete the office section of a form
category: Office
roles: dev, master_technician, assistant, controller
keywords: contracts, forms, I-9, office section, employer, Section 2, two-party, complete, verification
order: 80
---
Some forms have two halves. On the I-9 the employee fills and signs **Section 1**; the employer examines their documents and completes **Section 2**. In the app the employee's half is the signing page as usual, and the office's half is finished from the record.

## How a two-party form works

- In the **Form Studio**, each box has a **Filled by** setting: *the signer* or *the office*. The signer never sees office boxes; the phone lens skips them.
- When the signer signs (or the office keys their half from paper), the filed PDF holds the signer's answers but is **not final yet**: the office boxes are still open.
- The record shows an amber **Office section · not completed yet** line until you finish it.

## Find what is waiting

**People → Contracts** opens with **Office sections to complete** when anything is pending: one line per form, oldest signature first, with the I-9's deadline (Section 2 within three business days of the first day of work) and a {{button:blue|Complete}} button. Those people also count under **Needs attention**, their row shows {{chip:yellow|office section pending}}, and the Person Desk says the same.

:::example Signing on a shared device
When the employee signs on a device where a staff member is also signed in, the thank-you page offers **Complete the office section** right away, while their documents are in front of you.
:::

## Complete it

1. {{button:blue|Complete}} on the strip, or the person's row → {{button:outline|View signed}} → {{button:blue|Complete the office section}}.
2. The filed PDF opens. The signer's half is shaded **Signed by the employee · locked**; only the office boxes are open. A line at the top says who signed and when.
3. Fill them the way the paper asks — for the I-9, the document you examined (List A, or List B and C), its number and expiration, and the first day of employment.
4. **Your name and title** as it should appear, e.g. *Robert Douglas, Owner*. It is typed in cursive into the office signature box; office date boxes get today's date.
5. Tick the **attestation** — under penalty of perjury, that you examined the documents and entered them truthfully. The button stays off until you do; the record shows the office attested.
6. {{button:blue|Complete and finish the PDF}}.

:::example This is the moment the PDF becomes final
Completing flattens the document: the signer's answers and the office's become page content nobody can edit. Until then, staff could still fill the office boxes; after, the record shows **Office section · completed** with the date and the name it was signed as, and {{button:outline|View office section}} shows what was recorded.
:::

## Things to know

- Required office boxes must be filled before completing; the line under the page names what is still missing.
- Sensitive office boxes, if a form has them, live in the PDF only, like the signer's.
- One-shot: a completed office section cannot be edited. If something is wrong, ask the signer for a fresh copy (send the form again) and complete it anew.
- While the office section is pending the record's button reads **Open the PDF so far**; afterwards **Open the finished PDF**.
- Opening the finished PDF stays limited to devs, controllers, and pay-approved masters, and each open is logged.
