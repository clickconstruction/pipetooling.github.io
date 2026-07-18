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

Once billed, the job shows under **Billed Waiting for Payment** on the Dashboard and on the Accounts Receivable page. Stripe payments mark themselves; outside payments are recorded against the invoice. When everything is collected, the job moves to {{chip:green|Paid}}.

Jobs that are billed but proving hard to collect can be flagged for **Collections** — they get their own section so the AR picture stays honest.

## Where to watch it all

- **Dashboard** — Ready to Bill and Billed Waiting for Payment queues, plus the Financials cards (Accounts Receivable / Accounts Payable / Not Billed Out).
- **Jobs → Stages** — the full board, every status.
- **Quickfill** — the **Jobs Billing** and **Billing Awaiting Payments** sections put billing review into the office's daily loop.
