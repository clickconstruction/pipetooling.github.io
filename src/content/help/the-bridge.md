---
title: read the Bridge
category: Billing & Money
roles: dev
keywords: bridge, vectors, who moved the number, by the day, profitable day, red day, green day, truth check, paper vs bank, net position, cash forecast, cash on hand, cash floor, bills due, receipts expected, profit rate, overhead, earned revenue
order: 62
---
**The Bridge** answers three questions on one page: where we stand, where cash is going, and what would change it. The Bridge runs on one clock: days.

The Bridge is for devs only for now. You open it from the compass icon in the header, or **Bridge** in the ☰ menu. The page's address is `/bridge`.

## First, type cash on hand

The app doesn't sync a bank balance, so the cash line starts from a number you type. Under the cash chart, you enter today's bank balance in **Cash on hand today** and press {{button:outline|Set}}. The number is remembered with the date. On later days the page rolls it forward through the bank transactions since. The Data Gaps strip says which day you typed it. You retype it whenever you look at the bank.

You set the **Floor** the same way. The floor is the cash level you never want to go under. The floor starts at $5,000.

## The three numbers on top

- **Daily profit rate**: earned per day minus costs per day, over the last 14 days. Costs are job costs plus overhead, the office's running cost, at the 90-day rate from People → Overhead. Job costs are field labor, purchases and supply invoices on jobs, and sub sheets. A sub sheet is a subcontractor's labor sheet.
- **Money owed**: owed to you, owed by you, finished work not yet billed, and the collections balance. Owed to you leaves collections out. The collections balance is written off for planning.
- **Crew hours**: approved field time in the last 7 days, office and bid time, and how much still awaits approval.

## Net position — last 8 weeks

The solid line is **cash + owed to you − owed by you**. The line ends at today's real number. The last 8 weeks are rebuilt from dated flows. The flows are bank transactions, invoices sent, payments received, and supply invoices dated and paid. The readout says where the line is today. The readout also says how much the line moved since the start of the window. You hover any day for the split.

## Truth check — does the paper agree with the bank?

The profit rate is an accrual reading: earned minus costs. Accrual means earnings and costs count on the day they happen, not when cash moves. Net position is what the bank and the ledgers actually did. Over the same 8 weeks, the two should tell one story. The **Truth check** panel puts the two side by side: **Profit on paper** and **Net position moved**. The panel splits the difference between the two figures exactly in two:

- **Earned but not invoiced**: work that earned on paper and hasn't been billed yet. This money is real, and the biggest lever on the page. You bill it and the net line catches up.
- **Costs the paper doesn't see**: what the bank and the supply ledger charged beyond what the profit rate counted. Under 15% of paper costs reads as agreement.

The sentence on the right is the verdict: *steer by the profit rate*, *bill it to see it*, or *not a number to steer by yet*. Under the verdict sit the rows that make the cost side dirty. Each row is sized where it can be. {{chip:yellow|186h awaiting approval}} is labor that payroll pays and the paper hasn't counted. {{chip:yellow|bank transfers unsorted}} is rent, insurance and trucks that hit the bank and never the paper. {{chip:yellow|open jobs assumed half done}} is earned dollars resting on a guess. Worked jobs with no contract price get a row too.

:::example Reading it
Profit on paper +$194k · net position moved −$3.4k · the $197k between them: +$180k earned but not invoiced, +$17k costs the paper doesn't see. The verdict says the profit is real on paper — bill it to see it — and the cost side is close enough to trust.
:::

A loan or an owner deposit is money in that isn't a customer payment. The Bridge shows that money as a negative cost. Payroll and sub labor count when the bank pays them, not when the hours are worked.

## Vectors — who moved the number

Under the Truth check, **Vectors** lists one row per person for one pay week. A pay week runs Sunday–Saturday. You step back through the eight weeks on the page with ‹ ›. The current week reads *so far*. The headline is the week's **field contribution**. Field contribution is what approved field hours earned minus what those hours cost in wages.

- **Field people** carry Field h, Earned, Labor, **Contribution** and $/h. Field h also shows hours still {{chip:yellow|waiting}} on approval. Earned uses the Bridge's own rate: the job's contract ÷ its expected hours. With this rate, a person's earned dollars add up to the company's.
- **Office people** carry Billed and Collected. Billed is the invoices they sent. Collected is the payments they recorded. Everyone carries **% reports**: job % updates plus field reports filed.
- **The estimator** carries Bids sent and Bids won, by value.

**A name is a door.** You click it and People → Review opens on that pay week. The person's panel is expanded. The panel shows jobs worked with day rows, hours and pay, reports and tasks. Review counts earned the same way, so its Gross is the Earned you clicked.

An amber **≈** on Earned or Contribution means some of it rests on a job with no % complete. The app assumed that job half done, so the rate is a guess. You set the % on the job and the mark goes away. You hover the Contribution cell for the split. The split shows earned, labor, guessed, hours on jobs with no contract price, and no wage on file.

:::example Reading a week
+$125k field contribution on 50 approved hours — but ≈ $124k of it is one person's day on a job with no % complete, and 166h are still waiting on approval, so most rows read "—". The number becomes real when the % is set and the hours are approved.
:::

Materials and sub sheets are job costs, not anyone's vector, so contribution here is labor-only. Some invoice sends were written by the system with no signed-in sender. Those sends, and bids with no estimator, are listed under the table as *not on anyone's row*.

## Vectors by the day — was each person's day worth it

Under the Vectors table, the same rule runs one day at a time. The view is a grid with one row per field person and one cell per day of the month. Each cell is **green when the day's hours earned more than they cost, red when they cost more**. The shade is set by dollars per hour. A **wk** column after every Saturday sums the week. The month's total sits at the end, with the hours and $/h under it.

The zoom row beside the title changes the columns. **Days** is the month. **Weeks** is the last thirteen pay weeks, one cell per person per week. **Months** is the last twelve months. A week or month cell is the same days folded together. So a person's month equals the sum of their week columns. ‹ › steps a month, thirteen weeks or twelve months at a time. The running period reads *so far*.

- You click a cell and a card opens under the grid. The card lists the jobs worked, each at its earned rate beside the wage. The card also shows the labor line and the contribution. A sentence says why the day reads the way it does. The card has doors to open the job, set its % complete, or see that day on People → Review. The {{chip:yellow|≈}} hatch means part of it rests on a job with no % complete.
- Under each name, a **Why** line counts the red days by job. *7 red · all on 990* is a pricing problem, not a slow person.
- A **↻** on a day means last week's rates read it the other way. A % update or the hours landing since then re-priced every day on that job.
- **A grey cell with hours** is an office or bid day. That day costs a wage and earns nothing here, so it is never judged.
- **A salaried person's day** costs the flat workday, the way payroll prices it, whatever the clock says.
- The **Field crew** row at the bottom is the company line day by day.
- The grid reads **recorded time**. Recorded time counts every closed session not rejected or revoked, the way job costing does. This week is on the grid before approvals catch up. Hours still waiting draw with a dashed border and say so. {{button:outline|Approved only}} beside the zoom row switches to what payroll paid. This browser remembers that choice. The Vectors table above always reads approved time, so the two never disagree about what was paid.

:::example Reading a red day
Tristen's Tuesday reads −53: 7.5 h on J1044 at $31 an hour, against a $38 wage. That is the job's price against the hours it is taking, not how fast the day went — everyone on J1044 reads red this month. The job has no % complete, so its expected hours are a guess: set the % and the rate firms up either way.
:::

A red day is a job's verdict, not a person's. Every hour on a job earns the same rate. A day goes red only when the job's rate is under the wage. The job's rate falls under the wage when the job is priced low or has no contract price. The rate also falls under when the job has run past its expected hours. And the past moves. A job's rate is its contract ÷ its expected hours. A job's expected hours are its hours to date ÷ % complete. So every new hour and every % update re-prices every day ever worked on that job. The grid is always as of today.

## Cash — next 8 weeks

The dashed line starts at cash today. The line **drops on the day each bill is due**. Supply invoices count on their due date. Sub labor counts on its payable-after date. Payroll counts every Friday, at the 8-week average. The line **rises on the day each receipt is expected**. The expected day is a promised pay date if the customer named one. Without a promise, the app uses that customer's usual pay speed. Next comes the company's usual pay speed, and last of all 45 days. An invoice already past its expected day is assumed to arrive within 14 days. An invoice more than 60 days late isn't counted at all and is listed as doubtful. Collections never count. Office parts drain a little every day at the 90-day rate. Office parts are materials bought for the office, not for a job.

The readout is a date and a number. The readout shows **the lowest cash point in the window and whether it clears your floor.** The dot on the line marks that point.

:::example What the lists under the chart are
**Bills coming due** and **Receipts expected** are the same events the chart uses, day by day, with the reason for each receipt date. **What would change it** sizes the levers — billing finished work, approving pending hours, trimming overhead, an extra field day, a bid due soon.
:::

## Data gaps

When the amber strip shows, the numbers read low or thin. The gaps are these:

- unapproved hours
- unsorted bank transfers or card purchases
- open jobs with no % complete, which are assumed half done
- worked jobs with no contract price
- a typed cash figure that's a few days old

Insurance, rent, and card bills aren't scheduled as bills yet. These bills arrive as bank transfers and only show once sorted.
