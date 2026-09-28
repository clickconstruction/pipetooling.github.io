---
title: turn a non-Stripe bill into a Stripe bill
category: Office
roles: dev, master_technician, assistant, controller
keywords: stripe, convert bill, pay online, hosted invoice, billed date, housecall pro, physical invoice, pay link
---
Billed something outside Stripe — HouseCall Pro, a paper invoice — and now want the customer to pay by card? Convert the bill in place. The **billed date never moves**, so AR aging, Pipeline, and the customer's statement history stay exactly as they are.

## Converting

1. Open the job (**Edit Job → Bill**) and find the line under **Invoices**.
2. Click {{button:blue|⚡ Make Stripe bill}} — it appears on billed lines that aren't Stripe yet.
3. The confirm shows the amount, the customer, a **live preview of the exact Stripe invoice**, and the promise that matters: *billed date stays put*. Click {{button:blue|Create Stripe bill}}.

That's it — the line now has a hosted pay page and card payment, and the customer's portal statement swaps its check-reference box for {{button:blue|Pay online}} on its own. **Nothing is emailed** by converting; send it afterward if you want, like any Stripe bill.

## What the customer gets when you send it

{{button:purple|stripe}}{{button:amber|Send Email invoice}} sends the bill email from ClickTooling — the purple tag means it is a Stripe bill, so they pay on Stripe's page.

:::example The bill email
**Invoice #1042-2610120930** for 100 Sample St — **$1,850.00**, due Oct 12, 2026
{{button:amber|Pay now}} — card or bank transfer; the invoice is attached as a PDF
**Your account, any time** — a QR code beside `my.clickplumbing.com/sam-sample-k7x2`
:::

- **Pay now** keeps working after Stripe's own link expires.
- The **QR code and short address** open their statement. They appear only for a customer who has a portal, and never on a bill addressed to someone else. A customer with a portal and no short address is given one on their first bill — their name plus a random tail — and you can change it from the globe.
- Replies come to whoever pressed Send.
- In **test mode** the email comes to you, marked as a test, and never to the customer.
- If our email cannot go out, Stripe sends its own instead and the toast says so. That one has no code.

Settings → **What customers see** shows the email as the customer reads it.

## The paperwork dates

Stripe won't accept a past due date, so the converted invoice shows **due now** — which is the truth for an outstanding bill. The original billed date still travels with the paperwork twice: the Stripe invoice **number** carries it, and the **memo** says "Originally billed …" right on the customer's invoice.

:::example When the button is greyed out
Hover it and it tells you why: **payments are already applied** to that line (unlink them under Payments received first), or the job has **no customer email** yet (add one on the Edit tab — Stripe needs somewhere to bill).
:::
