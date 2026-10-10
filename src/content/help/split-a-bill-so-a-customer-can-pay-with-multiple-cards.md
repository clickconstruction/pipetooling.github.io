---
title: split a bill so a customer can pay with multiple cards
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: split bill, two cards, multiple credit cards, partial payment, split payment, stripe, pay in parts
order: 13
---
Stripe's pay page takes one card for the full amount, so it can't split a bill across two cards. Instead, you replace the bill with two smaller bills.

Do this when a customer asks to pay with **two or more cards**. Each smaller bill gets its own pay link. The customer pays each one with a different card.

## Split a bill that's already out

1. Open the bill. Use **View bill** from the Billing Pipeline, the job's Billing tab, or the Paid/Billed card.
2. At the bottom, click {{button:green|Split bill…}}. The button only appears on unpaid Stripe bills with no payments applied yet.
3. Enter the amount for **Part 1**. The last part always fills in with the remainder automatically. Use {{button:outline|+ Add another part}} for a third or fourth card.
4. Check the **due date**. All parts share it. Then click {{button:green|Split into 2 bills}}.

:::example what happens
The original Stripe bill is voided so its old pay link can't be paid. Two new bills replace it, each a normal Stripe bill with its own pay link and invoice number (part 1 of 2, part 2 of 2 on the memo). The job stays in **Billed Awaiting Payment** until every part is paid.
:::

5. Send each part like any bill, with {{button:purple|stripe}}{{button:amber|Send Email invoice}}. The purple tag means it is a Stripe bill, so they pay on Stripe's page. Or copy each pay link into a text.

## Good to know

- **Nothing is emailed by the split itself.** You choose when and how each part goes out.
- **A fee on the bill moves to a part.** A trip charge or a card fee goes onto the first part big enough to hold it. So the job's total still counts the fee.
- **Each part pays separately.** As each card goes through, that part flips to Paid on its own. The job goes to **Paid in Full** when the last part is paid.
- **Splitting is only possible before any money lands.** Once a payment is applied to a bill, split is hidden. Void or unwind the payment first if you really need to restructure.
- **Changed your mind?** Each part is a normal bill. You can void a part and re-bill it from **Bill Customer**, like any Ready-to-Bill line.
