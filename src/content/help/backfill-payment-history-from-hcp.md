---
title: backfill payment history from HouseCall Pro
category: Office
roles: dev, master_technician, assistant, controller
keywords: HCP, HouseCall Pro, payment history, collected, paid no payment record, backfill, import, money rail, tips, tip line item
order: 44
---
Jobs imported from HouseCall Pro arrived marked Paid but without payment records, so the green "collected" numbers on the Customers list and customer pages read $0 for that era. The backfill tool fills them in with real HCP collection dates, all at once.

## Before you start

Download the **jobs export** from HouseCall Pro (Reports → Jobs → export as CSV). It has the "Job paid in full date" column the tool uses to date each payment. The file is read on your device only — nothing uploads anywhere.

## Run the backfill

1. Go to **Customers**. If any paid jobs are missing payment records, the stat band shows a **Paid, no payment record** cell with the count.
2. Click **Backfill from HCP →** and choose the export file.
3. Every job appears with the payment it would get: the job's billed amount, and the date HCP recorded the money.
   - {{chip:green|HCP paid date}} — exact collection date from HCP.
   - {{chip:yellow|completed date}} or {{chip:yellow|HCP created date}} — HCP had no paid date, so the tool uses the closest date it has.
4. Untick anything you're unsure about, then click {{button:blue|Record}}.

:::example Nothing happens without you
The list is only a preview — no payments exist until you press Record, and Cancel walks away without writing anything. Jobs that already have any payment record are never touched, so re-running is always safe.
:::

## Tips HCP collected on top of the job total

HouseCall Pro's "Job amount" includes any tip the customer added, but jobs came into ClickTooling at the pre-tip figure — so a job HCP shows as $370 collected reads $360 here and the $10 tip is invisible. The same tool finds these: below the payments list, a **Tips** section shows every tipped job with its before → after total.

1. Each checked row adds a **Tip (HCP)** line item to the job's bill and a matching tip payment dated when HCP collected it — billed and collected both land on the HCP total.
2. A Billed job that becomes fully collected once its tip lands also moves to **Paid** automatically (the row says so in green).
3. Rows the tool won't touch are listed with the reason: the tip is **already in the job total**, the tip was **already added** on a previous run, or the totals **don't reconcile** and need a human look (including when two jobs share a number).

## After applying

The paid and billed columns agree for HCP-era customers, and each backfilled payment carries a note saying its date source — so you can always tell a backfilled payment from one recorded by hand. If HCP recorded a different amount than the job was billed for, the note keeps the HCP figure too. Tip payments carry a "Tip recorded in HouseCall Pro" note with the HCP collected total.
