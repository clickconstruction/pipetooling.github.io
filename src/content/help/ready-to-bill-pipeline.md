---
title: From Ready to Bill to Paid
category: Billing & Money
roles: assistant, master_technician, primary
keywords: billing, ready to bill, invoice, stripe, bill customer, paid, accounts receivable
order: 10
---
Every job moves through one pipeline: **Waiting → Working → Ready to bill → Billed → Paid**. This guide covers the billing half — how a working job becomes money in the bank.

## Getting to Ready to bill

A job usually reaches Ready to bill one of two ways:

- A tech files a **Job Complete** report at 100% — the app offers **"Move to Ready to Bill?"** right there, with a checkbox confirming all Job Parts were reported.
- The office moves it manually from the Jobs Stages board.

Trip charges from Turnaways also land in Ready to Bill as their own standalone lines, independent of the job's status.

## The Ready to Bill queue

On the Dashboard, office roles see **Ready to Bill (N)** — every job and invoice line waiting to be billed. The **Not Billed Out** card in Dashboard Financials shows the total revenue that hasn't reached a customer invoice yet, so nothing slips.

## Billing a customer

Press **Bill Customer** on a Ready to Bill item. The modal shows the job and the RTB amount, with three ways to bill:

- **Stripe bill** — creates and sends a hosted Stripe invoice by email. This is the standard path; payment status syncs back automatically.
- **HouseCall Pro** — records a bill you sent through HCP.
- **Physical invoice** — a mailed paper invoice, with a date and optional memo.

A job needs a linked customer (with an email, for Stripe) before it can be billed — the modal guides you if something's missing.

## Billed → Paid

Once billed, the job shows under **Billed Waiting for Payment** on the Dashboard and on the Accounts Receivable page. Stripe payments mark themselves; outside payments are recorded against the invoice. When everything is collected, the job moves to **Paid**.

Jobs that are billed but proving hard to collect can be flagged for **Collections** — they get their own section so the AR picture stays honest.

## Where to watch it all

- **Dashboard** — Ready to Bill and Billed Waiting for Payment queues, plus the Financials cards (Accounts Receivable / Accounts Payable / Not Billed Out).
- **Jobs → Stages** — the full board, every status.
- **Quickfill** — the **Jobs Billing** and **Billing Awaiting Payments** sections put billing review into the office's daily loop.
