---
title: label bank transfers and wires
category: Billing & Money
roles: dev, controller
keywords: bank transfer, ACH, wire, check, attribution, unattributed, mercury, overhead, office job, payroll, card bill, moneyfill, banking, label
order: 60
---
Card purchases get sorted on the Banking page, but money that leaves by **ACH, wire, or check** — rent, insurance, contract labor, credit-card bill payments — used to have no home. Until it's labeled, that spending never reaches the overhead numbers or any job's costs.

The **Bank transfers needing attribution** section on the **Moneyfill** page (the money-bill icon next to the Quickfill heart — devs and controllers only) collects every unlabeled non-card payment so you can label them in one pass. Devs and controllers get the queue automatically; if Moneyfill tells you to ask a dev instead, your access hasn't caught up yet — a dev can grant it directly.

## Labeling a transfer

Each row shows when the payment posted, who it went to, the amount, and the bank memo. Pick the label that fits:

:::example A rent payment
Tue, Jul 14, 2026 · Highline Property Mgmt · $4,200.00 · External Transfer
{{button:blue|→ Office}} {{button:outline|Payroll}} {{button:outline|Card bill}} {{button:outline|Not an expense}} {{button:outline|Split across jobs…}}
:::

- {{button:blue|→ Office}} — true overhead like rent, insurance, and utilities. Puts the full amount on the office job so it counts in the overhead numbers. (This button appears once the office job is configured in **People → Overhead**.)
- {{button:outline|Payroll}} — payroll and contract-labor payments. Labor is already counted from hours × wage, so counting the payment too would double-count it.
- {{button:outline|Card bill}} — credit-card bill payments (like the AMEX bill). The actual spending lives on the card's own transactions, so the bill payment itself isn't an expense here.
- {{button:outline|Not an expense}} — anything else that isn't a business expense in this system, like owner draws or refunds.
- {{button:outline|Split across jobs…}} — opens the job-split window to divide the payment across one or more jobs, the same way card transactions are split. The window always opens on the transaction's current splits and person, and if someone else saves a change while you have it open, your save is refused with a **Reload** instead of overwriting theirs.

The row disappears from the queue as soon as it's labeled, and the section's count drops.

## The 90-day window

The list shows the last **90 days** by default. Older unlabeled transfers stay tucked behind:

:::example Bottom of the list
{{button:outline|Show older (52 more)}}
:::

Click it to work through the backlog; click again to tuck it away.

## Undoing a label

Everything you label in the current visit is listed under **Labeled this session**. For Payroll, Card bill, and Not an expense, click {{button:outline|Undo}} to put the transfer back in the queue. Office and job-split labels are job allocations — edit those on the **Banking** page instead.

:::example
You mark a $1,850 ACH as Payroll, then realize it was actually the plumbing-supply autopay. Click Undo, then use Split across jobs… to put it where it belongs.
:::
