---
title: read the Overhead tab
category: Billing & Money
roles: dev, master_technician
keywords: overhead, overhead rate, pool, method a, method b, method c, see the math, how it moved, what moves it, watch-outs, trending up, trending down, flat, click a bar, spike, biggest purchases, biggest single lines, what is that, day panel, internal transfer, who makes up overhead, behind any cell, forgotten clock-out, office parts
---
**People → Overhead** shows what the office costs to run and the rates that follow from it. Each lens card, chart bar and table cell opens to the numbers behind it.

## Click a lens to see its math

Each of the three lens cards is a button. {{button:outline|See the math ›}} opens a window that shows the actual arithmetic with today's numbers. The pool, the overhead dollars, sits on top: office labor, bid labor and office parts, each itemized. The denominator, the number the pool is divided by, sits underneath, with the exact rule for what counts. Then comes the result.

Below that, **How it moved** charts the rate week by week across the 90 days. The chart has a rolling 4-week line and a dashed line for the 90-day headline. So you can see whether this week is unusual or the whole quarter is drifting.

**What moves it** lists the levers, each sized at today's numbers. Examples are *"+100 hr → −$0.51/hr"* on Method A, or *"+$10,000 invoiced → −0.34 pts"* on Method B. Green arrows lower the rate, and amber arrows raise it. Some field time may still await approval. Then Method A also shows what the rate would read if all of it were rejected.

**Watch-outs** names the ways each lens can mislead. The ways are salaried hourly pricing on A and billing rhythm on B. On C, a raise makes the number drop even when overhead stays the same. C divides overhead by wage dollars, so a drop on C is not a saving. Compare crews on A as well. Watch-outs also states plainly whether any session is being counted on both sides of the math.

## Is the pool going up or down?

The ***Overhead pool — 90 days*** card answers that directly. The card's pill compares the average $/day over the last 30 days with the 30 days before. {{chip:yellow|↑ Trending up · +12%}} means overhead is growing. {{chip:green|↓ Trending down · −8%}} means it's shrinking. Anything inside ±5% reads as **flat**, so a single parts spike doesn't flip the arrow.

Under the pill is the ledger of what the pool is made of. The ledger lists **office labor**, **bid labor**, and **office parts**, each with its dollars and share. Office parts are materials bought for the office, not for a job. There is also a day-by-day chart stacked the same way, with a 7-day average line. You hover any bar for that day's split.

:::example Reading a flat pill with a rising chart
If the pill says flat but the bars climb across the last two weeks, the rise is recent and hasn't moved the 30-day average yet — check back in a week, or read the 7-day line, which reacts sooner.
:::

## Click a bar to see what's in it

Every bar on the ***Overhead pool — 90 days*** chart opens. You hover one for the day's split and how it compares to a typical day. Hovering also shows the single biggest line of that day. You click a **colored segment** to see that category's lines. Purple and blue are the office and bid sessions. Amber is the purchases. Or you click the **empty space above a bar** for the whole day.

The panel is built to answer "is this normal?", not just "what is it":

- Each **purchase** carries a source badge: {{chip:gray|card}}, {{chip:gray|supply invoice}} or {{chip:gray|tally}}. The purchase also shows the card it was paid with, and a note like *6× in 90 days · $2,940 total · the largest*. An **internal transfer** is money moved between our own accounts. The transfer is listed struck through with {{chip:gray|internal transfer · not counted}}. The transfer was never in the pool.
- Each **session** shows clock in → out, hours and labor $. The session also shows the person's typical day and whether this is the longest. A session nobody has reviewed yet shows {{chip:yellow|awaiting approval}}. That session still counts, as recorded time.
- The header reads the day's size: *$1,485 of that day's $1,917 · 5.9× a typical day for office parts · 4.0% of the 90-day pool*.

You use ‹ › or the arrow keys to walk to the neighboring days. The tabs flip between **Whole day**, **Office labor**, **Bid labor** and **Office parts**. {{button:outline|Show this week in the table below ↓}} jumps the week table to that week. The footer links to **Banking → Accounting**, where you re-label or move a card purchase. The footer also links to **People → Hours**, where you approve or reject a session.

:::example Finding the spike
The amber bar sticking above the rest is a supply invoice. Under the chart, **Biggest single lines in these 90 days** already names it — hover the row to see its bar light up, click it to open the day. Or click the legend's *Office parts* swatch to hide that series and read office labor on its own scale.
:::

## Who makes up the pool

The **Who makes up overhead** table lists every person with office or bid time in the window. People with office-job card purchases are listed too. There is one row each, with columns for **office labor**, **bid labor**, **office parts**, and **total**. Every cell shows the dollars and that person's share of the column, so the biggest contributors read at a glance. The Pool row at the bottom shows each column's share of the whole.

You switch the window with the chips: {{chip:blue|Today}} {{chip:gray|Last 7 days}} {{chip:gray|Last 30 days}} {{chip:gray|Last 90 days}}. The numbers re-slice instantly, and nothing reloads.

### Behind any cell

Every dollar in the table is a door. You click Taunya's office labor and a window opens with the days that add up to it. There is one row per day with its hours, the wage the dollars used, and the amount. Inside the row is every punch's clock-in and clock-out. The days are grouped by week, newest first. Each week has a subtotal and a small bar, so the shape reads at a glance. A punch under 15 minutes is marked {{chip:gray|stray punch}}. A stray punch is real time, just noisy. A purchase cell lists each purchase with its source and its accounting section. The source reads like {{chip:gray|card · Malachi}} or {{chip:gray|supply invoice}}. The Pool row's cells open the whole column grouped by person. The groups stay collapsed to subtotals until you expand one.

The header proves the number: hours × the average rate. The footer says whether the lines tie to the cell. Pills across the top move between the person's columns without closing.

Anything that needs a human is chipped on its line and counted in the header. {{chip:yellow|awaiting approval}} is counted as recorded time, and a rejection removes it. {{chip:yellow|no wage on file}} means the hours count but the dollars read $0. {{chip:yellow|13.2 h — forgotten clock-out?}} marks any session over ten hours. Each flag links to where the fix lives: People → Hours, People → Users → Pay, or Banking → Accounting. You switch to {{chip:gray|Largest first}} to bring the outliers to the top. You type in the filter box to find one note, bid, or merchant. {{button:outline|Copy as CSV}} takes the lines to a spreadsheet.

:::example Finding the odd one
Malachi's office parts read high this month. Open the cell, sort largest first: the top line is a $900 Ferguson charge on the card that should have gone to a job. Banking → Accounting is one click away to move it.
:::

:::example Where purchases land
A Mercury card purchase on the office job goes to the cardholder (by card nickname). Supply-house invoices, ACH/wire payments, and tally lines don't belong to a person, so they sit on an italic last row — that way the parts column still adds up to the pool instead of quietly shrinking.
:::

## More on the Overhead tab

- Keeping these numbers accurate is in [keep the overhead numbers accurate](/help/understand-overhead-numbers).
