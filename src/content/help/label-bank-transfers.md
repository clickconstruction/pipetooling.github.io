---
title: label bank transfers and wires
category: Billing & Money
roles: dev, controller
keywords: bank transfer, ACH, wire, check, attribution, unattributed, mercury, overhead, office job, payroll, card bill, moneyfill, banking, label, card charges, not split, user sort, rules, suggestions, approve all, approve themselves, auto-approve, needs you, card review, reconciliation, bank statements, tabs, nickname
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

On Moneyfill the same list sits inside a one-week page, so the section heading says **last 90 days, not just this week** and a line under it reconciles the two numbers: the **Bank transfers** chip in the close-week header counts only transfers posted in that Monday–Sunday week, while the list is everything still unlabeled from the last 90 days — older transfers belong to earlier weeks' closes.

:::example Bottom of the list
{{button:outline|Show older (52 more)}}
:::

Click it to work through the backlog; click again to tuck it away.

## Card charges not split to jobs

Card purchases are the other half of the close. Moneyfill's **Card charges not split to jobs** section lists every debit-card purchase posted in the close week that has no job splits yet, with its posted day, card, counterparty and amount.

:::example One unsplit charge
Wed, Aug 26 · 6783 · Ferguson · $412.18 {{button:blue|Sort in Banking → User Sort}}
:::

{{button:blue|Sort in Banking → User Sort}} opens **Banking → User Sort** with that counterparty already in the search box, so the charge is on screen. Press **Link…** on its row to split it across jobs (or onto the office job). Moneyfill and Banking read the same splits, so the charge leaves this queue as soon as the split saves — come back to Moneyfill and the count is one lower.

## Finding your way around the Banking tabs

The Banking page has eight tabs and several of them sound alike. A caption row under the tab strip says what each one is for:

:::example The caption row
User Sort — who spent it · Drag Sort — what kind · Accounting — rules & approvals · Reviews — read-only · Reconciliation — against bank statements, read-only · Jobs are sorted in Job Parts Tally; labels live here.
:::

- **User Sort** answers *who* spent it (the person on a card charge) and is where **Link…** splits a charge to jobs.
- **Drag Sort** answers *what kind* of spend it is (the accounting label); **Accounting** is the rules and the approvals queue from the previous section.
- **Card Review** and **Category Review** are read-only pivots of the same labels. Card Review's **Unassigned** row counts every transaction in the window — transfers and payouts included — until you set its {{chip:gray|Kind}} filter to **Card charges only**.
- **Reconciliation** checks the books **against Mercury's bank statements**, one closed month at a time. It writes nothing and saves nothing, and it is not the sync that pulls new bank transactions in every half hour — that runs by itself.
- A dev may also see an amber line under the strip saying an account has no nickname: {{button:amber|Name accounts…}} opens the nickname list so the account stops showing as a raw ID in every account filter.

## Undoing a label

Everything you label in the current visit is listed under **Labeled this session**. For Payroll, Card bill, and Not an expense, click {{button:outline|Undo}} to put the transfer back in the queue. Office and job-split labels are job allocations — edit those on the **Banking** page instead.

:::example
You mark a $1,850 ACH as Payroll, then realize it was actually the plumbing-supply autopay. Click Undo, then use Split across jobs… to put it where it belongs.
:::

## Rules that label for you

On **Banking → Accounting**, rules match bank transactions by counterparty, amount, description, or bank category and suggest a label. Each match lands in the **Approvals** list waiting for an OK — unless the org-wide switch is on:

:::example The Approvals toolbar
{{button:green|Approve all (12)}} {{chip:gray|Group by label}} {{chip:gray|Rule matches approve themselves (org-wide · on)}}
:::

- {{chip:gray|Rule matches approve themselves}} is one switch for the whole company (a dev or leader flips it). When it is **on**, every new rule match is approved the moment it is created — as the bank feed arrives or when someone clicks **Apply rules** — whether or not anyone has this page open. When it is **off**, matches wait in Approvals as before.
- Two things always wait for a person, even with the switch on: an **Internal Transfers** suggestion on a transaction that already has job splits (the two can't both be true), and anything created **before** the switch was turned on. {{button:green|Approve all}} clears that backlog.
- A label someone set by hand is never overwritten by a rule.

:::example The nudge
**340 bank-label suggestions have waited 3+ days for an OK** — $139,251 of card charges and transfers sit as "Unlabeled"… {{button:blue|Open approvals}}
:::

When suggestions sit for three days or more, the **Needs you** card on the Dashboard (and on Quickfill) counts them and the money they represent, and **Open approvals** takes you straight to the list. A same-week trickle never triggers it — only a stall does.
