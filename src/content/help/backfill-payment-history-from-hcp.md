---
title: backfill payment history from HouseCall Pro
category: Office
roles: dev, master_technician, assistant, controller
keywords: HCP, HouseCall Pro, payment history, collected, paid no payment record, backfill, import, money rail, tips, tip line item
order: 44
---
Jobs imported from HouseCall Pro arrived marked Paid but with no payment records. The backfill tool fills them in with the real HCP collection dates, all at once.

Because of the missing records, the green "collected" numbers read $0 for that era. You see this on the Customers list and on customer pages.

## Before you start

Download the **jobs export** from HouseCall Pro. In HCP, open Reports, then Jobs, and export as CSV. The file has the "Job paid in full date" column. The tool uses that column to date each payment. The file is read on your device only. Nothing uploads anywhere.

## Run the backfill

1. Go to **Customers**. Some paid jobs may be missing payment records. Then the stat band shows a **Paid, no payment record** cell with the count.
2. Click **Backfill from HCP →** and choose the export file.
3. Every job appears with the payment it would get. That is the job's billed amount and the date HCP recorded the money.
   - {{chip:green|HCP paid date}} means the exact collection date from HCP.
   - {{chip:yellow|completed date}} or {{chip:yellow|HCP created date}} means HCP had no paid date. The tool uses the closest date it has.
4. Untick anything you are unsure about. Then click {{button:blue|Record}}.

:::example Nothing happens without you
The list is only a preview — no payments exist until you press Record, and Cancel walks away without writing anything. Jobs that already have any payment record are never touched, so re-running is always safe.
:::

## Tips HCP collected on top of the job total

HouseCall Pro's "Job amount" includes any tip the customer added. But jobs came into ClickTooling at the pre-tip figure. So a job HCP shows as $370 collected reads $360 here. The $10 tip is invisible. The same tool finds these. Below the payments list, a **Tips** section shows every tipped job with its before → after total.

1. Each checked row adds a *Tip (HCP)* line item to the job's bill. It also adds a matching tip payment, dated when HCP collected it. Billed and collected both land on the HCP total.
2. A Billed job may become fully collected once its tip lands. Then it moves to **Paid** on its own. The row says so in green.
3. Rows the tool will not touch are listed with the reason. The tip is **already in the job total**. Or the tip was **already added** on a previous run. Or the totals **don't reconcile** and need a human look. That includes when two jobs share a number.

## After applying

The paid and billed columns agree for HCP-era customers. Each backfilled payment carries a note saying its date source. So you can always tell a backfilled payment from one recorded by hand. HCP may have recorded a different amount than the job was billed for. Then the note keeps the HCP figure too. Tip payments carry a "Tip recorded in HouseCall Pro" note with the HCP collected total.
