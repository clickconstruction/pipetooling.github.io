---
title: see which jobs made or lost money this week
category: Office
roles: dev, controller
keywords: weekly money movement, money out, money in, job cost this week, value created, earned, cash, lost money, made money
order: 75
---
Money goes out into jobs all week and comes in as payments. Weekly money movement shows one week of that per job.

Money out is team labor, sub sheets and materials. Money in is payments. **Weekly money movement** shows one week of that per job. It also says whether the spend bought progress.

## Open it

On **Jobs → Pipeline**, you open the hamburger menu at the left of the stage strip. The **Pipeline** group holds {{button:outline|Weekly money movement}}. Only devs and controllers see it.

The report opens on the **close week**. That is the previous complete Monday–Sunday week, the same week Moneyfill's picker shows. The header says so. It reads *Week of Aug 24 – 30 · close week*. You use ‹ › to move. You step into the week still in progress and it shows *still running*. Its close cannot be final yet. Moneyfill's {{button:outline|See the week's report}} opens the report pinned to whichever week you were closing.

## The two lenses

- **Earned** asks one thing. Did the work performed this week cover its cost? Each job's **Value created** is its % done movement for the week × the job total. The net is value created minus money out.
- **Cash** is what actually moved. It is money in from payments minus money out.

:::example A job can look great in Cash and terrible in Earned
Collecting $5,000 on an old invoice while spending $4,900 of labor with no % progress shows +$100 cash — and −$4,900 earned. Both are true; the lenses keep them separate.
:::

## Reading the rows

Jobs are split into **Made money this week** and **Lost money this week** under the active lens. Each row shows the week's % movement, for example *42% → 55%*. It shows value created, money out, money in, and the net. You hover money out for the labor, subs and materials split.

You watch for the two amber flags:

- {{chip:yellow|spend, no progress}} means money went out but the % did not move. Someone should look at the job.
- {{chip:yellow|no job total}} means the job has no total. So earned value cannot be computed. You open **Edit Job** and set one.

The **Not on jobs** line at the bottom holds office and bid labor plus office-job charges. That is real money out that no job absorbs.

## Email it weekly

The **Email this report** box schedules sends to another dev or controller. You pick the person and a first-send date. The date defaults to next Monday 7:00 AM Central. You leave **Repeat weekly** on for a standing copy. Each send covers the previous complete week, rebuilt fresh at send time. It lists on the recipient's **Settings → My email schedule**. You cancel the pending row to end a weekly chain.

## Print it

{{button:outline|🖨 Print}} opens a print-friendly copy of the current week and lens. You choose **Save as PDF** to download.
