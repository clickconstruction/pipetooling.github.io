---
title: work the Pipeline from my phone
category: Jobs & Scheduling
roles: dev, master_technician, assistant, controller
keywords: pipeline, phone, mobile, stages, needs me, swipe, advance, ready to bill, mark paid, overview, map, chip, quiet, no contract, set % done, no price yet, check returned, lien
order: 31
---
On a phone the Pipeline opens on a list of jobs. It shows one stage at a time, and every job is two lines. The desktop board is the same as before.

## The stage chips

A row of stage chips stays pinned as you scroll: {{chip:gray|Waiting 20}} {{chip:blue|Working 39}} {{chip:gray|Ready 0}} {{chip:gray|Billed 71}} {{chip:red|Coll. 7}}. You tap one to see that stage's jobs. Only that stage shows. The phone remembers which stage you left open.

Under the chips sit three filters. **All** shows every job in the stage. **Needs me** shows only the rows with a red or amber chip. Those are the jobs that want something from you. **Today** shows the rows with a block on the schedule today. A line under the filters gives the stage's money, like *Working · $393.4k · $42,334 capable of billing*.

## A job is two lines and one chip

:::example A row
**1040** Iannotti PRV · Sal Iannotti
NEXT Thu Sep 24 1–4 PM · Abraham · ✍ Signed · estimate #146 {{chip:gray|›}}
:::

The first line is the job and the customer. The second line is the next block on the schedule and who is on it. With nothing scheduled, it says who was last on site. Then comes one fact. That is the signed agreement, when the bill is due, or how long the job has been open.

On the right sits **at most one chip**. It is the first of these that applies:

- {{chip:red|no price yet}} means the job has no priced line items. You tap it to add the price.
- {{chip:red|check returned · $1,200}} means the bank returned a payment the job still counts as paid. You tap it to open the payments.
- {{chip:red|set % done}} means a bill went out with no progress recorded.
- A lien chip like {{chip:yellow|notice in 17 d}} or {{chip:red|file first}} means a lien deadline needs you. You tap it to open the Lien window. [The money view guide](/help/read-the-pipeline-money-view) explains each one.
- {{chip:red|quiet 15 d}} or {{chip:yellow|quiet 6 d}} means nothing has happened on the job for that many days. That is past the stage's follow-up limit.
- {{chip:yellow|12 d past expected}} means a Billed job is past the day its customer usually pays.
- {{chip:yellow|no contract}} means there is no agreement on file. Nobody has marked one as not needed either.
- {{chip:green|draw 2 ready}} means a stage draw can be billed now.
- {{chip:green|$4,200 done, not billed}} means finished work is on no bill yet.

You **tap the chip** to open the fix. That can be the line items, the job's Notes or the Contract window. You **tap the row** to open the job window. You **press and hold** a row for the ⋯ sheet. It holds Edit, Partial invoice, Send back and the rest.

## Moving a job on: swipe right

No row has a live status button. You **swipe a row to the right** and the stage's next move slides out. A Waiting job shows {{button:green|Move to Working ✓}}. A Working job shows {{button:green|Ready to Bill ✓}}. A Ready to Bill job shows {{button:green|Bill Customer ✓}}. A Billed job shows {{button:green|Mark Paid ✓}}. You let go and it **always asks first**:

:::example Ready to bill
**Ready to Bill · 1040 Iannotti PRV**
Working → Ready to bill · $600 capable · ✍ Signed · estimate #146 · Abraham's block Thu stays on the schedule
☑ I have reported all the Job Parts I've used
☐ The customer knows the work is done and is satisfied
{{button:blue|Confirm}} {{button:outline|Not yet}}
:::

The questions are the same ones the desktop asks. The line under the title is new. It shows the money the move touches, the agreement on file and the block it leaves on the schedule. So nothing moves by surprise. Bill Customer and Mark Paid open the same windows as on the desktop.

## The map and the money

The map and the money are still there, under the list. The bottom of the board reads *Overview · map · money tiles · today's opportunities*. You tap {{button:outline|Show ▾}} beside it to open it. It stays open on this phone until you tap {{button:outline|Hide ▴}}. You type in the search box to see every stage's matches. Each match shows its stage name.
