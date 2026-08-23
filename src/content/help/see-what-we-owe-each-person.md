---
title: see what we owe each person on payroll
category: Office
roles: dev
keywords: payroll, ledger, balance, owe, back-charge, credit, offset, pay stub, paid out, unpaid, settle up
---
People → **Payroll** has two views (dev only for now): **Pay reports** — the table of generated pay reports — and **Ledger** — one money story per person, with a running balance.

## The roster

The left side lists everyone with payroll activity, ranked by what we owe them, then who owes us, then everyone who is even. The totals at the top are the company-wide picture ("We owe $X across N · owed to us $Y across M"). Under each name a short line says *why* — `6 unpaid · $13,855 · 4 partial`, `3 charges · 1 credit`, or `21 stubs · all paid`. Use the chips ({{chip:gray|We owe}} / {{chip:gray|Owes us}} / {{chip:gray|Even}}) or the search box to narrow it, and tap a name to open their ledger.

**+ means we owe them, − means they owe us** — the same convention as the partner card (green plus / red minus).

## A person's ledger

- A signed balance headline with the words under it (**we owe Malachi** / **Tristen owes us**), and an equation showing how it is built: `earned − paid out − charges + credits = balance` (zero terms are dropped).
- An amber note when reports are unpaid or partially paid, with what paying them would do to the balance.
- One dated table, newest first, with month separators: {{chip:blue|Labor}} (each pay report, with its hours and week, tagged paid / partial / unpaid), {{chip:gray|Paid out}} (every payment, on the day it was paid), {{chip:red|Back-charge}} / {{chip:red|Damage}} and {{chip:green|Credit}} (person offsets, on the day they happened), plus deductions and additions from the reports. The balance column is the running total after each line.
- Filter chips narrow the table to one kind; **Unpaid only** shows just the reports still waiting on payment.

:::example Reading Tristen's ledger
`earned $13,299.37 − paid out $12,679.31 − charges $6,617.50 = −$5,997.44 · Tristen owes us`. The amber note adds: 1 report unpaid · $620.06 — paying it would leave him owing $6,617.50. Tap **Charges** to see the four back-charges behind the number.
:::

## Acting from the ledger

- Click a labor row to open that pay report; unpaid and partial rows also carry a **record payment** link straight to the payment modal.
- Click a charge or credit to edit it; {{button:outline|+ Charge}} / {{button:outline|+ Credit}} add a new one for the selected person.

Everything books on the day it happened — labor on the report's week end, payouts when paid, charges and credits on their own date, whether or not a report has picked them up yet. A report deduction that merely mirrors a charge is not counted twice.
