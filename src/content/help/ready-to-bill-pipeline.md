---
title: bill a customer and get paid
category: Billing & Money
roles: assistant, master_technician, primary
keywords: billing, ready to bill, invoice, stripe, bill customer, paid, accounts receivable
order: 10
---
Every job moves through one pipeline. This guide covers the billing half — how a working job becomes money in the bank.

:::example The job pipeline
{{chip:gray|Waiting}} → {{chip:blue|Working}} → {{chip:yellow|Ready to bill}} → {{chip:red|Billed}} → {{chip:green|Paid}}
:::

## Reading the Progress & payment bar

Every stage on the Jobs Stages board — Waiting through Paid in Full — shows one **Progress & payment** cell instead of separate money columns. The bar is the job's whole bid, filled in order: the green part is **paid**, the blue part is **billed but not yet paid** (an invoice has gone out and you're waiting on the money), the amber part is work **done but not yet billed** (unbilled), and the empty part is work not done yet. Under the bar the same numbers are spelled out — **Paid**, **Billed** (shown only when an invoice is out and unpaid), **Unbilled**, and **Owed** (bid minus payments). In Waiting and Working, the **% done** box at the top is where the office records how complete the job is — type a number and press Enter (later stages show the % read-only). No % and no bid value yet shows an empty dashed bar. On billed rows, a small line under the numbers shows what **this row's bill** covers (e.g. `This bill: $0 paid · $3,850 left`) and any amount **unallocated** — money on the job that isn't on any bill yet.

:::example One glance at a Working job
70 % done · $41,550 bid
{{chip:green|Paid $16,620}} {{chip:yellow|Unbilled $12,465}} → **Owed $24,930**
:::

:::example A billed job waiting on payment
$3,850 bid
{{chip:blue|Billed $3,850}} → **Owed $3,850**
:::

The **Edit Job** window shows the same bar at the top of its billing section, so you get one picture there too. Under it, three numbered steps make the flow obvious: **① Line Items** (the specific work & materials — their sum is the Job Total), **② Invoices** (the bills you break off and send), and **③ Payments received** (money collected). **The whole money section saves itself**: line items and payments auto-save a moment after you stop typing (watch the small **Saving… / Saved** note next to the Billing title), and creating or sending an invoice saves right away — so you can enter work and break off a bill in one motion, no Save button in between. The bar adds a striped **Draft** slice for a bill you've carved off but haven't sent yet, and the break-off amount has **Quick set** buttons (20 / 40 / 60 / 80 / Max) next to the slider.

Under the break-off control, **all of the job's bills sit in one Invoices list** — a **Status / Date / Amount / Actions** table where each row is tagged {{chip:yellow|Draft}} (carved off, not sent) or {{chip:blue|Billed}} (sent). A draft's row has a {{button:blue|Send bill…}} button right there, so you bill the customer straight from the list; once sent it flips to Billed and keeps its **Bill** (view), share, and **Add discount** actions.

A big amber slice is the signal to bill: work is finished but the money hasn't been asked for. A blue bar means the bill is already out — you're waiting on the customer, not on the office.

Next to each job's **Last activity**, a small stack of shortcuts covers the common jump-offs: the green calendar opens the job's **schedule**, the blue grid opens its **week dispatch**, the red pin opens the address in **Google Maps**, the phone icon **calls the customer** (it only appears when the job has a phone number on file), and the purple send arrow **sends the job to someone as a task** — it opens the New task form with the job attached as a link, you add your note and pick who it's for, and when they open the task, clicking the job's name takes them straight to its **Job Detail**.

## Getting to Ready to bill

A job usually reaches Ready to bill one of two ways:

- A tech files a **Job Complete** report at 100% — the app offers the move right there:

:::example After a 100% Job Complete report
**Move to Ready to Bill?**
☑ I have reported all the Job Parts I've used

{{button:outline|Not yet}} &nbsp; {{button:green|Move to Ready to Bill}}
:::

- Or the office moves it manually from the Jobs Stages board.

Trip charges from Turnaways also land in Ready to Bill as their own standalone lines, independent of the job's status.

## The Ready to Bill queue

On the Dashboard, office roles see **Ready to Bill (N)** — every job and invoice line waiting to be billed, each with its own billing button:

:::example A Ready to Bill card
**J512** · Smith House Repipe
123 Main St &nbsp;·&nbsp; Remaining: $4,250.00

{{button:blue|Bill Customer}} &nbsp; {{button:outline|Delete draft bill}}
:::

The **Not Billed Out** card in Dashboard Financials shows the total revenue that hasn't reached a customer invoice yet, so nothing slips.

## Breaking off a partial invoice

To bill part of a job now and the rest later, use the green partial-invoice icon on a Jobs → Stages row. It opens a small modal:

:::example Create partial invoice
**J512** · Smith House Repipe
Remaining: $1,500.00

Amount ($) &nbsp; `500`

{{button:outline|Cancel}} &nbsp; {{button:green|Create invoice}}
:::

**Remaining** is what's still unallocated — the job total minus payments already made *and* minus every invoice line that already exists on the job (drafts and billed alike). An amount above it is clamped down automatically, and the icon greys out when nothing is left to allocate. Entering the full remaining amount on a Ready to Bill job simply opens Bill Customer instead.

The Edit Job modal's **Break off invoice** slider is the other way to do the same thing, with the same Remaining math.

## Billing a customer

Press {{button:blue|Bill Customer}}. The modal shows the job and the RTB amount, with three method tabs:

:::example Bill Customer — method tabs
{{button:blue|Stripe bill}} &nbsp; {{button:outline|HouseCall Pro}} &nbsp; {{button:outline|Physical invoice}}
:::

- **Stripe bill** — creates and sends a hosted Stripe invoice by email. This is the standard path; payment status syncs back automatically.
- **HouseCall Pro** — records a bill you sent through HCP.
- **Physical invoice** — a mailed paper invoice, with a date and optional memo.

A job needs a linked customer (with an email, for Stripe) before it can be billed — the modal guides you if something's missing.

## Billed → Paid

Once billed, the job shows under **Billed Waiting for Payment** on the Dashboard and on the Accounts Receivable page. Stripe payments mark themselves; outside payments (cash, check, ACH) you record yourself. To record one against a specific bill, add it in the Edit Job window's **③ Payments received** table and set its **Applies to** dropdown to that billed invoice — the payment then pays *that* bill down; leave it on **Job (unassigned)** for a general job payment. When everything is collected, the job moves to {{chip:green|Paid}}.

Jobs that are billed but proving hard to collect can be flagged for **Collections** — they get their own section so the AR picture stays honest.

## Where to watch it all

- **Dashboard** — Ready to Bill and Billed Waiting for Payment queues, plus the Financials cards (Accounts Receivable / Accounts Payable / Not Billed Out).
- **Jobs → Stages** — the full board, every status.
- **Quickfill** — the **Jobs Billing** and **Billing Awaiting Payments** sections put billing review into the office's daily loop.
