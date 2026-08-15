---
title: see where someone stands and share a pay statement
category: Office
roles: dev, master_technician, assistant, controller
keywords: offsets, balance, backcharge, damage, credit, ledger, pay statement, payments, jobs worked, share
---

**People → Offsets** now opens with a **Balances** board: one row per person with offset history, showing their net position — {{chip:green|+$150.00}} when the company owes them (credits), {{chip:red|−$425.00}} when they owe the company (backcharges and damages). The headline number is **pending** offsets — what would hit their next pay report; people with nothing pending show as settled at the bottom. The offset list you already use is unchanged below.

## The person ledger

Click any person to open their money ledger — one dated timeline of everything:

- {{chip:red|Damage}} / {{chip:red|Backcharge}} / {{chip:green|Credit}} — every offset, signed, with an "applied" note once it's on a pay report
- {{chip:green|Paid}} — every pay report with its paid date, period, hours, and gross; unpaid reports show as {{chip:yellow|Pending}}
- **Jobs** — the jobs they worked in the range, with hours and **billing credit** (their share of job revenue, the same Crew P&L math used on Jobs → Crew P&L; clocked crew labor only)

Three cards up top total the picture for the selected range: **Paid in range**, **Billing credit**, and **Offsets net** — pay them, what they earned the company, and where the offsets stand. The range selector (this month / quarter / year / all time) drives everything.

## Sharing a pay statement

{{button:outline|Pay statement}} in the ledger opens a printable statement for the selected range — safe to hand to the person:

:::example What they see
**Paid Aug 8, 2026 — $1,840.00** · Period Jul 28 – Aug 3 · 41.5 hours

Terrell Road sewer repair — 16 h · Shearer pinpoint — 6 h

Less: windshield damage — −$425.00
:::

Each payment shows its paid date, the job hours that earned it, and any offsets applied to that report. It deliberately shows **hours and job names only** — never company revenue or margins. Print it or save as PDF from the print dialog, same as pay report documents.
