---
title: record a return or credit from a supply house
category: Billing & Money
roles: assistant, controller, master_technician
keywords: credit, credit memo, return, returned parts, refund, negative, restock, price correction, supply house, invoice, reece, ferguson, hughes, morrison
---
When parts go back to a supply house, the house issues a credit memo. You record it the same way you record an invoice, and say it is a credit.

A credit memo is the house's own numbered paper for money it owes you back. It has its own date. It comes off what you owe them. The job that was charged for those parts gets the money back on its own.

## Add the credit

You open **Materials → Supply houses**, open the house and press {{button:blue|Add Invoice}}. The first thing the form asks is what the paper is.

1. You pick {{chip:green|Credit}}. Every label follows. The form asks for a **Credit #** and a **Credit date**. The button at the bottom reads {{button:blue|Save credit}}.
2. You type the amount **as a positive number**. Picking Credit is what takes it off the balance. You never type a minus sign.
3. You add the job the parts came back from, under *Which job gets it back*.
4. Before you save, the form tells you exactly what it will do. For example, it reads *Takes $888.10 off what we owe Reece, and $888.10 off J878's parts cost.* You read that line. It is the quickest way to catch a wrong house or a wrong job.
5. You paste the credit memo's PDF link under **Paperwork**, the same as an invoice.

:::example The form, filled in
**Reece · Credit # S124460299.001 · 09/04/2026 · − $888.10**, purchase order *Return*, job **J878 Take 5 Seguin**, status *Open — still on the account*.
:::

## What a credit does

- **The house's balance drops.** The aging table is the list of what you owe each house by how late it is. There the credit appears in its own **Credits open** column, next to the buckets. It is deliberately not filed under Current or 1–30. A credit has a size, but it does not have an age. Letting it sit in a bucket would cancel out invoices that really are late.
- **The job's parts cost drops** by the same amount. It is split across jobs the same way an invoice is split.
- **Nothing is marked late.** A credit is never counted as an invoice missing a due date.

## Open, then applied

A credit stays ***Open — still on the account*** until the house actually takes it off a statement. When that happens, you edit the credit and set **Applied on** to the day it came off. Open credits are the ones still working for you. That is the list worth watching before you pay a house.

## When *not* to use this

**Only use a credit when the house issued paper for it.** Sometimes the money came back to a card, like a counter return at Lowe's, Home Depot or O'Reilly. Then the bank already has it. The refund reaches the job through Banking. Entering it here as well would take the money off the job twice.

Two places will not take a credit at all, and each says so:

- It cannot be added to a project step as a line item.
- It cannot be linked to a card charge. A card charge can only be linked to what it paid for.

## Fixing one

You open the credit from the house's invoice list. Credits show their amount in green with a **credit** tag. You press {{button:outline|Edit}}. You can switch it back to {{chip:blue|Invoice}} if it was recorded as the wrong kind. Delete works the same as it does for an invoice.
