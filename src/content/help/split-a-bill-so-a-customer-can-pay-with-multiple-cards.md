---
title: split a bill so a customer can pay with multiple cards
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: split bill, two cards, multiple credit cards, partial payment, split payment, stripe, pay in parts
order: 13
---
Stripe's pay page takes one card for the full amount — it can't split a single bill across two cards. When a customer asks to pay with **two (or more) cards**, replace the bill with two smaller bills instead. Each gets its own pay link, and the customer pays each one with a different card.

## Split a bill that's already out

1. Open the bill — **View bill** from the Billing Pipeline, the job's Billing tab, or the Paid/Billed card.
2. At the bottom, click {{button:green|Split bill…}}. (It only appears on unpaid Stripe bills with no payments applied yet.)
3. Enter the amount for **Part 1** — the last part always fills in with the remainder automatically. Use {{button:outline|+ Add another part}} for a third or fourth card.
4. Check the **due date** (all parts share it), then click {{button:green|Split into 2 bills}}.

:::example what happens
The original Stripe bill is voided so its old pay link can't be paid. Two new bills replace it, each a normal Stripe bill with its own pay link and invoice number (part 1 of 2, part 2 of 2 on the memo). The job stays in **Billed Awaiting Payment** until every part is paid.
:::

5. Send each part like any bill — {{button:purple|stripe}}{{button:amber|Send Email invoice}} (the purple tag means Stripe sends the email, not ClickTooling), or copy each pay link into a text.

## Good to know

- **Nothing is emailed by the split itself.** You choose when and how each part goes out.
- **Each part pays separately.** As each card goes through, that part flips to Paid on its own; the job goes to **Paid in Full** when the last part is paid.
- **Splitting is only possible before any money lands.** Once a payment is applied to a bill, split is hidden — void or unwind the payment first if you really need to restructure.
- **Changed your mind?** Each part is a normal bill: you can void a part and re-bill it from **Bill Customer** like any Ready-to-Bill line.
