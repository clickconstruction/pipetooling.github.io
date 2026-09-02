---
title: drill into the dashboard money cards
category: Office
roles: dev, master_technician, controller
keywords: accounts receivable, accounts payable, not billed out, dashboard, finance, money, drill down, aging, overdue, phone, mobile
order: 76
---
The three money cards on the Dashboard — **Accounts Receivable**, **Accounts Payable**, and **Not Billed Out** — each open a drill-down listing every item behind the number. Tap any row to open the job or bill it comes from.

Each card now carries a thin **aging bar** under its total — green under two weeks, yellow two to four weeks, red past a month, gray for money that isn't aged yet — plus a lead line with the amount at risk, like **$78.9k over 30 days · oldest 148d**. The bar uses the same bands as the drill-down's aging strip, so what you glance at on the card is exactly what the drill-down lets you filter to.

:::example Rows in the Accounts Receivable drill-down
{{chip:green|8d}} **1471 · Hillcrest Ave** — Garcia `$2,300`

{{chip:yellow|21d}} **1458 · Cypress Bend** — Delta Homes `$6,540`

{{chip:red|146d}} **1390 · Marbach Rd** — TNR Builders `$4,050`

The aging strip above the list totals each band: {{chip:green|0–14d $12k}} {{chip:yellow|15–30d $31k}} {{chip:red|30d+ $165k}} — click a band to see just that money.
:::

Accounts Receivable rows also carry the **job address** right after the name and an expandable {{chip:gray|3 line items ▾}} chip — tap it to unfold the job's billed work with a dollar amount per line, so you can see what the money is owed for without opening the job.

## Accounts Receivable groups by customer

The Accounts Receivable drill-down opens on a **Customers** view — one row per customer, because a collections call is about everything they owe, not one invoice. The {{button:blue|Customers}} / {{button:outline|Bills}} buttons switch between this view and the classic flat list.

Each customer row shows their open bills as a small **bar** (one segment per bill, sized by dollars) and how long they've kept you waiting **against their own pay speed** — the same 12-month median the Payment forecast uses:

:::example A customer row
**RMC- Dudley Mason** · {{chip:red|169d}} 35d avg · `$56,021` 14 jobs
:::

The right side is two tight columns — days waiting over their average pay speed ("35d avg" is their own 12-month median, or the company average when they have no history), and open dollars over the job count. Hover either column for the full story (exact cents, where the average comes from).

- Bill colors read against **that customer's** usual speed: {{chip:green|on pace}} at or under it, {{chip:yellow|past their avg}} over it, {{chip:red|2× their avg}} at twice it or more — the legend at the top of the list spells this out. A customer with too little history reads against the company average instead.
- The two pace totals above the list — {{chip:red|Past their pace $161k · 18}} {{chip:green|On pace $9.2k · 6}} — are click-to-filter, and on-pace customers fold into one quiet row so the list is only as long as the problem.
- {{button:blue|Slowest first}} is the call order (most overdue vs their own pace on top); {{button:outline|Biggest}} sorts by open dollars.
- Tap a row to unfold **every bill they owe** — wait chip, job link, billed date, amount, and the line items already unfolded — and the globe on the row opens their customer portal.
- Search matches the customer name **or any of their jobs** — typing a job number surfaces the whole customer.

## The call sheet

Customer rows also wear their **chase state**, straight from the Payment Chase queue: {{chip:red|Owes a call}} when they're past pace and untouched, {{chip:green|Promised Sep 4}} when they named a date, {{chip:red|Promise broken}} when that date slipped a week, {{chip:gray|Touched Aug 31}} while a recent call keeps them quiet, and a dispute pill when one is open.

Below the bills, each expanded customer gets a **call card** for office roles:

1. A ready-made opener — *3 bills past their ~35d — oldest 169d: 273 · Dudley (Lennox), $13,420.*
2. **They paid** chips: their last payments with how many days each took, colored against the company pace.
3. The **last touch** on record — who called, when, and how it went.
4. One-tap outcomes: {{button:outline|They promised…}} stamps the date they named on their late bills, {{button:outline|Can't reach — snooze 7d}} parks them, and {{button:outline|Copy summary}} puts the whole picture — bills and line items — on your clipboard for a text or email.

Outcomes here and in the Pipeline's Payment Chase are **the same records** — a promise logged on the Dashboard shows up in the chase queue, and a call logged there quiets the row here.

Not Billed Out rows get the same address + line-items treatment, and each amount carries context — *of $33,500 job total · 80% done* — so a job that's mostly billed reads differently from one that's untouched. Jobs **100% done with nothing billed at all** wear an amber {{chip:yellow|done — nothing billed}} flag: that money is one Bill Customer away.

In Accounts Payable, team payroll and sub labor each have their **own section** with their own count and subtotal. A person several weeks behind shows as **one row with their total owed**, aged by their oldest unpaid week — tap {{chip:gray|8 open weeks ▾}} to unfold the individual weeks, or tap the person's name to open the People → Payroll ledger with their name already searched.

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
