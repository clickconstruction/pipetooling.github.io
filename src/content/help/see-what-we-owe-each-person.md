---
title: see what we owe each person on payroll
category: Office
roles: dev
keywords: payroll, pay run, balances, ledger, balance, owe, back-charge, credit, offset, pay stub, paid out, unpaid, partial, residue, overpaid, pay to here, settle up, open reports
---
People → **Payroll** has two views (dev only for now): **Pay run** — this week's work: draft the reports, record the payments, catch the weeks still waiting — and **Balances** — where each person stands with us over all time, opening on the reports that are still owed.

## The roster

The left side lists everyone with payroll activity, ranked by what we owe them, then who owes us, then everyone who is even. The two centered lines at the top are the company-wide picture ("We owe $X across N" over "owed to us $Y across M"). Under each name a short line says *why* — `14 open · $27,879 · 9 unpaid · 5 partial`, `2 open · $1,502 · 4 charges −$6,618`, `nothing open · 10 credits +$1,436`, or `8 reports · all paid` — with a small bar per open week under it. Use the chips ({{chip:gray|We owe}} / {{chip:gray|Owes us}} / {{chip:gray|Even}}) or the search box to narrow it, and tap a name to open them.

**+ means we owe them, − means they owe us** — the same convention as the partner card (green plus / red minus).

## A person's open reports

The panel opens with the signed balance and the equation behind it (`earned − paid out − charges + credits = balance`, zero terms dropped), then **Open reports** — every pay report that is not exactly settled, **oldest week on top**, in the same columns Pay run uses:

- **Period (w#) · Hours · Net Pay** — the report.
- **Paid to date** — every payment recorded against that week, with a small meter.
- **Balance** — what is still owed on it (net − paid).
- **Payment** — {{chip:yellow|Unpaid}}, {{chip:yellow|Partial · 35%}}, {{chip:gray|$3.00 residue}} (short of net by under $5 — Cash App fees or rounding, not debt) or {{chip:blue|Overpaid $20.00}} (payments past net — usually a Less line added after paying, or a send recorded on the wrong week).
- **Pay to here** — what one send must be to clear every open week from the oldest through this one. Sending exactly that amount, oldest first, settles everything above the row.
- {{button:outline|Record payment}} opens the payment modal for that report. A residue row has {{button:outline|Mark settled}} instead — one Less line of the missing amount closes the week (remove it from the report to reopen). An overpaid row has {{button:outline|Move extra}} — the newest payment is trimmed by the extra and the same amount is recorded on the oldest open week under the same date and memo; with nothing open it files the extra as a credit.

Click a row to see the payments under it — date, memo (the Cash App id lives there) and amount.

Below the table:

- **Hours with no report yet** — weeks with clocked or salaried hours and no pay report, for this person, with an estimate at their current pay config and a {{button:outline|Report}} button. The same rows as Draft Payroll's *Earlier weeks*; without them Balances could read "clear" while a week was still unreported.
- **Off any report** — back-charges, damage and credits that never sat on a pay report. Click one to edit it; {{button:outline|+ Charge}} / {{button:outline|+ Credit}} add one. A charge has **Take out of a week…**: pick an open week and that report's Less window opens with the charge ready to apply under *Apply pending offset*.
- **The settle-up line** — one sentence that does the real sum: `Send $5,974.96 = open reports $4,127.60 + unreported weeks est. $1,847.36 → even`, or, when someone's charges cover their open weeks, `Send nothing. Charges $6,617.50 cover the open reports $1,501.60 → take them out of the open weeks → Tristen still owes $5,115.90`, or `Nothing to send. $3.00 of residue on 1 week → mark it settled → …`. The line's button does the thing it names: **Record one payment, oldest first…** (amount, date, how it was sent and a note once; the send fills the open weeks from the oldest, every box editable, one payment per week it reaches), take the charges out of the open weeks, or mark the residue settled.

:::example Reading Tristen
Two open weeks, $1,501.60, and four charges off any report, $6,617.50. The line says send nothing: the charges more than cover the open weeks, and after they are taken out of those weeks he still owes $5,115.90.
:::

## The statement

{{button:outline|▸ Show as a statement}} unfolds the dated journal for reconciling against the bank, in two modes:

- **Grouped by report** — newest report first, with its payments, deductions and additions nested under it and a *Left on report* column; settled reports stay hidden until {{chip:gray|Show N settled}}. Charges and credits that never sat on a report close the list.
- **Date order** — every posting on the day it happened with the running balance, the kind chips ({{chip:blue|Labor}}, {{chip:gray|Paid out}}, {{chip:red|Back-charge}}, {{chip:green|Credit}} …), and on every paid-out row a *for week of …* chip naming the report it was recorded against.

Click a labor row to open that pay report; click a charge or credit to edit it. A report deduction that merely mirrors a charge is not counted twice.
