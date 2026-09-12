---
title: read the Bridge
category: Billing & Money
roles: dev
keywords: bridge, vectors, who moved the number, truth check, paper vs bank, net position, cash forecast, cash on hand, cash floor, bills due, receipts expected, profit rate, overhead, earned revenue
order: 62
---
**The Bridge** (devs only for now — the compass icon in the header, or **Bridge** in the ☰ menu; `/bridge`) answers three questions on one page: where we stand, where cash is going, and what would change it. One clock — days.

## First, type cash on hand

The app doesn't sync a bank balance, so the cash line starts from a number you type. Under the cash chart, enter today's bank balance in **Cash on hand today** and {{button:outline|Set}}. It's remembered with the date; on later days the page rolls it forward through the bank transactions since, and the Data Gaps strip says which day you typed it. Retype it whenever you look at the bank.

Set the **Floor** the same way — the cash level you never want to go under (it starts at $5,000).

## The three numbers on top

- **Daily profit rate** — earned per day minus costs per day, over the last 14 days. Costs are job costs (field labor, purchases and supply invoices on jobs, sub sheets) plus overhead at the 90-day rate from People → Overhead.
- **Money owed** — owed to you (collections excluded), owed by you, finished work not yet billed, and the collections balance written off for planning.
- **Crew hours** — approved field time in the last 7 days, office and bid time, and how much still awaits approval.

## Net position — last 8 weeks

The solid line is **cash + owed to you − owed by you**, today's real number, with the last 8 weeks rebuilt from dated flows: bank transactions, invoices sent, payments received, supply invoices dated and paid. The readout says where it is today and how much it moved since the start of the window. Hover any day for the split.

## Truth check — does the paper agree with the bank?

The profit rate is an accrual reading (earned − costs); net position is what the bank and the ledgers actually did. Over the same 8 weeks they should tell one story. The **Truth check** panel puts the two side by side — **Profit on paper** and **Net position moved** — and splits the difference between them exactly in two:

- **Earned but not invoiced** — work that earned on paper and hasn't been billed yet. Real, and the biggest lever on the page: bill it and the net line catches up.
- **Costs the paper doesn't see** — what the bank and the supply ledger charged beyond what the profit rate counted. Under 15% of paper costs reads as agreement.

The sentence on the right is the verdict: *steer by the profit rate*, *bill it to see it*, or *not a number to steer by yet*. Under it, the rows that make the cost side dirty, sized where they can be: {{chip:yellow|186h awaiting approval}} (labor payroll pays that the paper hasn't counted), {{chip:yellow|bank transfers unsorted}} (rent, insurance, trucks that hit the bank and never the paper), {{chip:yellow|open jobs assumed half done}} (earned dollars resting on a guess), and worked jobs with no contract price.

:::example Reading it
Profit on paper +$194k · net position moved −$3.4k · the $197k between them: +$180k earned but not invoiced, +$17k costs the paper doesn't see. The verdict says the profit is real on paper — bill it to see it — and the cost side is close enough to trust.
:::

A loan or an owner deposit is money in that isn't a customer payment, so it shows here as a negative cost; payroll and sub labor count when the bank pays them, not when the hours are worked.

## Vectors — who moved the number

Under the Truth check, **Vectors** lists one row per person for one pay week (Sunday–Saturday; ‹ › steps back through the eight weeks on the page, and the current week reads *so far*). The headline is the week's **field contribution**: what approved field hours earned minus what those hours cost in wages.

- **Field people** carry Field h (with hours still {{chip:yellow|waiting}} on approval), Earned, Labor, **Contribution** and $/h. Earned uses the Bridge's own rate — the job's contract ÷ its expected hours — so a person's earned dollars add up to the company's.
- **Office people** carry Billed (invoices they sent) and Collected (payments they recorded); everyone carries **% reports** (job % updates + field reports filed).
- **The estimator** carries Bids sent and Bids won, by value.

**A name is a door.** Click it and People → Review opens on that pay week with the person's panel expanded — jobs worked with day rows, hours and pay, reports, tasks. Review counts earned the same way, so its Gross is the Earned you clicked.

An amber **≈** on Earned or Contribution means some of it rests on a job with no % complete — the kernel assumed it half done, so the rate is a guess. Set the % on the job and the mark goes away. Hover the Contribution cell for the split (earned, labor, guessed, hours on jobs with no contract price, no wage on file).

:::example Reading a week
+$125k field contribution on 50 approved hours — but ≈ $124k of it is one person's day on a job with no % complete, and 166h are still waiting on approval, so most rows read "—". The number becomes real when the % is set and the hours are approved.
:::

Materials and sub sheets are job costs, not anyone's vector, so contribution here is labor-only. Invoice sends that the system wrote with no signed-in sender, and bids with no estimator, are listed under the table as *not on anyone's row*.

## Cash — next 8 weeks

The dashed line starts at cash today. It **drops on the day each bill is due** — supply invoices by due date, sub labor by its payable-after date, payroll every Friday at the 8-week average — and **rises on the day each receipt is expected**: a promised pay date if the customer named one, otherwise that customer's usual pay speed, otherwise the company's, otherwise 45 days. An invoice already past its expected day is assumed to arrive within 14 days; one more than 60 days late isn't counted at all and is listed as doubtful. Collections never count. Office parts drain a little every day at the 90-day rate.

The readout is a date and a number: **the lowest cash point in the window and whether it clears your floor.** The dot on the line marks it.

:::example What the lists under the chart are
**Bills coming due** and **Receipts expected** are the same events the chart uses, day by day, with the reason for each receipt date. **What would change it** sizes the levers — billing finished work, approving pending hours, trimming overhead, an extra field day, a bid due soon.
:::

## Data gaps

When the amber strip shows, the numbers read low or thin: unapproved hours, unsorted bank transfers or card purchases, open jobs with no % complete (assumed half done), worked jobs with no contract price, or a typed cash figure that's a few days old. Insurance, rent, and card bills aren't scheduled as bills yet — they arrive as bank transfers and only show once sorted.
