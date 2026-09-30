---
title: drill into the dashboard money cards
category: Office
roles: dev, master_technician, controller
keywords: accounts receivable, accounts payable, not billed out, dashboard, finance, money, drill down, aging, overdue, phone, mobile
order: 76
---
The three money cards on the Dashboard each open a drill-down listing every item behind the number. Tap any row to open the job or bill it comes from.

The cards are **Accounts Receivable**, **Accounts Payable** and **Not Billed Out**. Accounts receivable is money customers owe you. Accounts payable is money you owe.

Each card now carries a thin **aging bar** under its total. Green is under two weeks. Yellow is two to four weeks. Red is past a month. Gray is money that isn't aged yet. A lead line names the amount at risk, like *$78.9k over 30 days · oldest 148d*. The bar uses the same bands as the drill-down's aging strip. So what you glance at on the card is exactly what the drill-down lets you filter to.

:::example Rows in the Accounts Receivable drill-down
{{chip:green|8d}} **1471 · Hillcrest Ave** — Garcia `$2,300`

{{chip:yellow|21d}} **1458 · Cypress Bend** — Delta Homes `$6,540`

{{chip:red|146d}} **1390 · Marbach Rd** — TNR Builders `$4,050`

The aging strip above the list totals each band: {{chip:green|0–14d $12k}} {{chip:yellow|15–30d $31k}} {{chip:red|30d+ $165k}} — click a band to see just that money.
:::

Accounts Receivable rows also carry the **job address** right after the name. They also carry an expandable {{chip:gray|3 line items ▾}} chip. Tap it to unfold the job's billed work with a dollar amount per line. So you can see what the money is owed for without opening the job.

## Accounts Receivable groups by customer

The Accounts Receivable drill-down opens on a **Customers** view. That is one row per customer. A collections call is about everything they owe, not one invoice. The {{button:blue|Customers}} and {{button:outline|Bills}} buttons switch between this view and the classic flat list.

Each customer row shows their open bills as a small **bar**. Each segment is one bill, sized by dollars. The row also shows how long they've kept you waiting **against their own pay speed**. That is the same 12-month median the Payment forecast uses. The median is the middle value of their past pay times.

:::example A customer row
**RMC- Dudley Mason** · {{chip:red|169d}} 35d avg · `$56,021` 14 jobs
:::

The right side is two tight columns. The first is days waiting over their average pay speed. "35d avg" is their own 12-month median, or the company average when they have no history. The second is open dollars over the job count. Hover either column for the full story, with exact cents and where the average comes from.

- Bill colors read against **that customer's** usual speed. {{chip:green|on pace}} is at or under it. {{chip:yellow|past their avg}} is over it. {{chip:red|2× their avg}} is at twice it or more. The legend at the top of the list spells this out. A customer with too little history reads against the company average instead.
- The two pace totals above the list are click-to-filter. They read like {{chip:red|Past their pace $161k · 18}} and {{chip:green|On pace $9.2k · 6}}. On-pace customers fold into one quiet row. So the list is only as long as the problem.
- {{button:blue|Slowest first}} is the call order. It puts the most overdue against their own pace on top. {{button:outline|Biggest}} sorts by open dollars.
- Tap a row to unfold **every bill they owe**. Each shows the wait chip, job link, billed date and amount, with the line items already unfolded. The globe on the row opens their customer portal.
- Search matches the customer name **or any of their jobs**. Typing a job number surfaces the whole customer.

## The call sheet

Customer rows also wear their **chase state**, straight from the Payment Chase queue. {{chip:red|Owes a call}} means they're past pace and untouched. {{chip:green|Promised Sep 4}} means they named a date. {{chip:red|Promise broken}} means that date slipped a week. {{chip:gray|Touched Aug 31}} shows while a recent call keeps them quiet. A dispute pill shows when one is open.

Below the bills, each expanded customer gets a **call card** for office roles:

1. A ready-made opener, like *3 bills past their ~35d — oldest 169d: 273 · Dudley (Lennox), $13,420.*
2. **They paid** chips: their last payments with how many days each took, colored against the company pace.
3. The **last touch** on record. It says who called, when, and how it went.
4. One-tap outcomes. {{button:outline|They promised…}} stamps the date they named on their late bills. {{button:outline|Can't reach — snooze 7d}} parks them. {{button:outline|Copy summary}} puts the whole picture on your clipboard for a text or email. That means the bills and the line items.

Outcomes here and in the Pipeline's Payment Chase are **the same records**. A promise logged on the Dashboard shows up in the chase queue. A call logged there quiets the row here.

Not Billed Out rows get the same address and line-items treatment. Each amount carries context, like *of $33,500 job total · 80% done*. So a job that's mostly billed reads differently from one that's untouched. Jobs **100% done with nothing billed at all** wear an amber {{chip:yellow|done — nothing billed}} flag. That money is one Bill Customer away.

In Accounts Payable, team payroll and sub labor each have their **own section** with their own count and subtotal. A person several weeks behind shows as **one row with their total owed**. That row is aged by their oldest unpaid week. Tap {{chip:gray|8 open weeks ▾}} to unfold the individual weeks. Or tap the person's name to open the People → Payroll ledger with their name already searched.

## On your phone

The drill-down opens as a full-height sheet built for one-hand use:

1. The **total and item count stay pinned** at the top. The link to the full surface sits beside them. That is Jobs Pipeline or Supply Houses.
2. **Search** filters every section at once. Type a job number, customer, person or supply house. While filtering, the footer shows exactly what you're looking at, like *Showing 4 of 254 · $12,890*.
3. Two sort buttons. {{button:blue|Biggest}} puts the most money first. {{button:outline|Oldest}} floats the longest-waiting items to the top.
4. Every row shows the **amount on the right, always visible**. An aging chip sits on the left side. {{chip:green|8d}} is under two weeks. {{chip:yellow|21d}} is two to four weeks. {{chip:red|146d}} is older than a month.
5. **Section headers stick while you scroll**. Tap one to collapse it. Fold away the supply bills to read payroll, or Collections to read live receivables. The header carries each section's count and subtotal.
6. On Not Billed Out, the {{button:outline|→}} button on a row still sends a bill-this-job note to Task Dispatch.

## On a computer

The drill-downs keep their table layout. They are now wider and have the same controls as the phone. That means search, the {{button:blue|Biggest}} and {{button:outline|Oldest}} sort buttons, aging chips on every row and collapsible sections everywhere. The title, controls and total stay pinned while the rows scroll.

Next to the sort buttons sits the **aging strip**. It is three colored totals like {{chip:green|0–14d $12k}} {{chip:yellow|15–30d $31k}} {{chip:red|30d+ $165k}}. It answers "how much of this is old?" at a glance. Clicking a band filters the list to just that money. Click again to clear.

## The Overhead card (devs and pay-approved leaders)

A fourth card, **Overhead**, sits beside the money cards for devs and pay-approved leaders. It reads the same way as its neighbors. The headline is the 90-day burn per day. Burn is the money the office spends. The thin bar shows what the pool is made of: office labor, bid labor and office parts. The small line under it is the trend against the prior 30 days. The three lenses sit in one row: {{button:outline|A $14.39/hr}} {{button:outline|B 11.8%}} {{button:outline|C $0.50/$1}}. Tap any lens, or the headline, for the same math window People → Overhead opens. {{button:outline|Open tab ›}} goes to the full tab.

It loads once the card scrolls into view. It remembers the numbers for an hour. So it never slows the Dashboard down.

## Good to know

- Row taps behave the same everywhere. Jobs open **Job Detail**. Supply bills open the **bill view** with the invoice facts and attachment.
- The aging chip counts from the date shown on the row. That is the billed date for receivables, the due date for payables and the last work date for unbilled jobs.
- Collections money is listed in its own section. It stays **out of** the Accounts Receivable headline total. The estimated upcoming payroll is **in** the Accounts Payable total, marked as an estimate.
