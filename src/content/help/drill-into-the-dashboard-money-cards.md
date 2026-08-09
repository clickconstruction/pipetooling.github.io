---
title: drill into the dashboard money cards
category: Office
roles: dev, master_technician, controller
keywords: accounts receivable, accounts payable, not billed out, dashboard, finance, money, drill down, aging, overdue, phone, mobile
order: 76
---
The three money cards on the Dashboard — **Accounts Receivable**, **Accounts Payable**, and **Not Billed Out** — each open a drill-down listing every item behind the number. Tap any row to open the job or bill it comes from.

## On your phone

The drill-down opens as a full-height sheet built for one-hand use:

1. The **total and item count stay pinned** at the top, with the link to the full surface (Jobs Pipeline or Supply Houses) beside them.
2. **Search** filters every section at once — type a job number, customer, person, or supply house. While filtering, the footer shows exactly what you're looking at: *Showing 4 of 254 · $12,890*.
3. Two sort buttons: {{button:blue|Biggest}} puts the most money first, {{button:outline|Oldest}} floats the longest-waiting items to the top.
4. Every row shows the **amount on the right, always visible**, with an aging chip on the left side: {{chip:green|8d}} under two weeks, {{chip:yellow|21d}} two to four weeks, {{chip:red|146d}} older than a month.
5. **Section headers stick while you scroll** and tap to collapse — fold away the supply bills to read payroll, or Collections to read live receivables. The header carries each section's count and subtotal.
6. On Not Billed Out, the {{button:outline|→}} button on a row still sends a bill-this-job note to Task Dispatch.

## On a computer

The drill-downs keep their table layout, now wider and with the same controls as the phone: search, the {{button:blue|Biggest}} / {{button:outline|Oldest}} sort buttons, aging chips on every row, and collapsible sections everywhere. The title, controls, and total stay pinned while the rows scroll.

Next to the sort buttons sits the **aging strip** — three colored totals like {{chip:green|0–14d $12k}} {{chip:yellow|15–30d $31k}} {{chip:red|30d+ $165k}}. It answers "how much of this is old?" at a glance, and clicking a band filters the list to just that money; click again to clear.

## Good to know

- Row taps behave the same everywhere: jobs open **Job Detail**, supply bills open the **bill view** with the invoice facts and attachment.
- The aging chip counts from the date shown on the row — billed date for receivables, due date for payables, last work date for unbilled jobs.
- Collections money is listed in its own section and stays **out of** the Accounts Receivable headline total; the estimated upcoming payroll is **in** the Accounts Payable total, marked as an estimate.
