---
title: see which months need a lien notice
category: Billing & Money
roles: dev, master_technician, assistant, controller, primary
keywords: lien, months worked, work month, weeks worked, 53.056 notice, notice due, closes in, notice sent, send notice, lien desk, affidavit, property kind unknown, clock sessions, payment forecast
---
Texas counts lien deadlines from the month the work was done. A payment forecast row whose job has clock sessions has a chevron that opens those months, with their dates.

## The months people worked, under a row

A lien is a legal claim on a property for unpaid work. Texas counts lien deadlines from the **month the work was done**, not from the bill date. So every forecast row whose job has clock sessions carries a small chevron arrow at its left edge. You tap it and the months worked open under the row, one line per month:

- **The weeks as bars**: each bar is one week, sized by hours. The number of people that week sits above it. You hover over a bar for the names, the hours, and how many days ago that week was. The hover reads like *Week of Jun 8 (98d ago)*. A hatched bar has sessions still awaiting approval. Only approved hours count toward the lien clock.
- **What counts** reads like {{chip:gray|5 people · 82.7 h · 5 days · 24% of hours}}. The share is this month's part of the job's hours. The share is a rough guide to how much of the open balance the month represents.
- **The notice, on jobs with a GC**: every unpaid month has its own § 53.056 notice date. The § 53.056 notice is the Texas form we send the owner and the GC for each unpaid month. The date shows {{chip:red|due tomorrow}} inside a week and {{chip:yellow|closes in 12d}} inside two. The date shows {{chip:green|notice sent}} once the Lien window has recorded one for that month. {{button:outline|Send notice…}} opens the **Lien desk** on that job. There the notice is drafted, approved and sent. See *send lien notices from the Lien desk*. Direct-with-owner jobs say *no monthly notice*. Those jobs show their single affidavit date instead. The affidavit is the sworn lien claim filed with the county.

:::example You do not have to open anything to see the one that matters
A sub row whose notice month closes within 14 days wears it on the row itself — {{chip:red|⏱ Jun notice due tomorrow}} — and one amber line above the buckets counts every month closing with the dollars riding on them. Rows with nothing closing look exactly as before.
:::

A {{chip:yellow|property kind unknown}} chip means no property record is linked. So the residential dates are shown, the earlier ones. A commercial property would be a month later on every line. You link the property on **Edit Job → Property record**. The rule itself is in *file a lien and never miss its deadlines*.

## Where the forecast is

You open the payment forecast with the green Forecast button at the top of the Pipeline. Its buckets are explained in [read the payment forecast](/help/read-the-payment-forecast).
