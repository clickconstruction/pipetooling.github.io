---
title: see what we owe each person on payroll
category: Office
roles: dev
keywords: payroll, pay run, balances, ledger, balance, owe, back-charge, credit, offset, pay stub, paid out, unpaid, partial, residue, overpaid, pay to here, settle up, open reports
---
**Balances** shows where each person on payroll stands with us over all time. The view opens on the pay reports that are still owed.

Balances is one of two views on People → **Payroll**. Only devs see the two views for now. **Pay run** is the other view, for this week's work. On Pay run you draft the reports, record the payments and catch the weeks still waiting.

## The roster

The left side lists everyone with payroll activity. The list is ranked by what we owe them, then who owes us, then everyone who is even.

The two centered lines at the top are the company-wide picture. The top line reads "We owe $X across N". The line under it reads "owed to us $Y across M".

Under each name, a short line says *why*. The line reads like one of these:

- *14 open · $27,879 · 9 unpaid · 5 partial*
- *2 open · $1,502 · 4 charges −$6,618*
- *nothing open · 10 credits +$1,436*
- *8 reports · all paid*

A small bar for each open week sits under that line. You narrow the list with the chips {{chip:gray|We owe}}, {{chip:gray|Owes us}} and {{chip:gray|Even}}, or with the search box. You tap a name to open that person.

**+ means we owe them, − means they owe us**. The partner card uses the same convention: a green plus and a red minus.

## A person's open reports

The panel opens with the signed balance, the amount with its plus or minus. Then the panel shows the equation behind the balance: *earned − paid out − charges + credits = balance*. Terms that are zero are dropped.

Then comes **Open reports**. Open reports lists every pay report that is not exactly settled, **oldest week on top**. The list uses the same columns Pay run uses:

- ***Period (w#) · Hours · Net Pay*** show the report itself.
- **Paid to date** is every payment recorded against that week, with a small meter.
- **Balance** is what is still owed on it: net minus paid.
- **Payment** shows {{chip:yellow|Unpaid}}, {{chip:yellow|Partial · 35%}}, {{chip:gray|$3.00 residue}} or {{chip:blue|Overpaid $20.00}}. Residue means the week is short of net by under $5. The shortfall is Cash App fees or rounding, not debt. Overpaid means payments past net. The cause is usually a Less line added after paying, or a send recorded on the wrong week. A Less line is a deduction on the report.
- **Pay to here** is what one send must be to clear every open week, from the oldest through this one. Sending exactly that amount, oldest first, settles everything above the row.
- {{button:outline|Record payment}} opens the payment window for that report. A residue row has {{button:outline|Mark settled}} instead. Mark settled adds one Less line of the missing amount, which closes the week. You remove that line from the report to reopen the week. An overpaid row has {{button:outline|Move extra}}. Move extra trims the newest payment by the extra. The same amount is recorded on the oldest open week, under the same date and memo. With nothing open, the extra is filed as a credit.

You click a row to see the payments under it. Each payment shows the date, the memo and the amount. The Cash App id lives in the memo.

Below the table:

- **Hours with no report yet** lists this person's weeks with clocked or salaried hours and no pay report. Each week has an estimate at their current pay setup and a {{button:outline|Report}} button. These rows are the same as Draft Payroll's *Earlier weeks*. Without them, Balances could read "clear" while a week was still unreported.
- **Off any report** lists back-charges, damage and credits that never sat on a pay report. A back-charge is a cost charged back to the person. You click any entry on the list to edit it. {{button:outline|+ Charge}} and {{button:outline|+ Credit}} add one. A charge has **Take out of a week…**. You pick an open week, and that report's Less window opens. The charge is ready to apply under *Apply pending offset*.
- **The settle-up line** is one sentence that does the real sum. The line can read *Send $5,974.96 = open reports $4,127.60 + unreported weeks est. $1,847.36 → even*. When someone's charges cover their open weeks, the line can read *Send nothing. Charges $6,617.50 cover the open reports $1,501.60 → take them out of the open weeks → Tristen still owes $5,115.90*. The line can also read *Nothing to send. $3.00 of residue on 1 week → mark it settled → …*. The line's button does the thing it names. **Record one payment, oldest first…** asks once for the amount, the date, how it was sent and a note. The send fills the open weeks from the oldest. Every box is editable. The send makes one payment for each week it reaches. When the line reads otherwise, the button takes the charges out of the open weeks, or marks the residue settled.

:::example Reading Tristen
Two open weeks, $1,501.60, and four charges off any report, $6,617.50. The line says send nothing: the charges more than cover the open weeks, and after they are taken out of those weeks he still owes $5,115.90.
:::

## The statement

{{button:outline|▸ Show as a statement}} unfolds the dated journal. The journal is for reconciling, which means checking it against the bank. The journal has two modes:

- **Grouped by report** puts the newest report first. Each report's payments, deductions and additions sit nested under it, with a *Left on report* column. Settled reports stay hidden until you press {{chip:gray|Show N settled}}. Charges and credits that never sat on a report close the list.
- **Date order** shows every posting on the day it happened, with the running balance. Date order also shows the kind chips: {{chip:blue|Labor}}, {{chip:gray|Paid out}}, {{chip:red|Back-charge}}, {{chip:green|Credit}} and more. Every paid-out row has a *for week of …* chip. The chip names the report the payment was recorded against.

You click a labor row to open that pay report. You click a charge or credit to edit it. A report deduction that merely mirrors a charge is not counted twice.
