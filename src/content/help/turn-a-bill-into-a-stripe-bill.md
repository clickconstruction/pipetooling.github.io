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

That's it — the line now has a hosted pay page and card payment, and the customer's portal statement swaps its check-reference box for {{button:blue|Pay online}} on its own. **Nothing is emailed** by converting; send it from Stripe afterward if you want, like any Stripe bill.

## The paperwork dates

Stripe won't accept a past due date, so the converted invoice shows **due now** — which is the truth for an outstanding bill. The original billed date still travels with the paperwork twice: the Stripe invoice **number** carries it, and the **memo** says "Originally billed …" right on the customer's invoice.

:::example When the button is greyed out
Hover it and it tells you why: **payments are already applied** to that line (unlink them under Payments received first), or the job has **no customer email** yet (add one on the Edit tab — Stripe needs somewhere to bill).
:::
