---
title: split a job into stages and bill stage by stage
category: Billing & Money
roles: assistant, master_technician
keywords: stages, segments, line items, reorder, partial invoice, break off, bill by stage, rough in, top out, trim set, segment bar
order: 11
---
A job's line items can double as its **stages**: put them in the order the work happens, then bill each stage on its own invoice as it finishes. Everything happens in Edit Job.

## Set up the stages in ① Line Items

1. Open the job (Jobs → Stages → {{button:secondary|Edit}}) and find **① Line Items**.
2. Enter one line per stage of work with its price — for a plumbing job that's usually *Rough In*, *Top Out*, *Trim Set*, and maybe a *Final* line.
3. Use the small **▲▼ arrows** on the left of each line to put them in work order. The order sticks with the job.

## Or generate the stages in one go

Click the blue **Multiple Segment Generator** link in the ① Line Items caption:

1. Set the **total amount** at the top (it prefills with the current Job Total).
2. Name each segment and give it a **%** — the dollar value of each segment calculates as you type and always adds back to your total.
3. Or press a preset: **Commercial 30/30/30/10** (Rough In / Top Out / Trim Set / Final) or **Residential 40/40/20** (Rough In / Top Out / Trim Set).
4. Re-arrange with **▲▼**, then press {{button:primary|Add to Job}} — the segments append to your existing line items.

:::example A staged plumbing job
Rough In $3,000 → Top Out $3,000 → Trim Set $3,000 → Final $1,000 — Job Total $10,000
:::

## Watch the job fill in — the segment strip in ② Invoices

The colored strip at the top of **② Invoices** shows the whole job as blocks, one per line item, in your ① order, each sized by its share of the Job Total. The colors follow the same lifecycle as everywhere else: {{chip:yellow|Unbilled}}, light-blue {{chip:blue|Ready to Bill}}, {{chip:blue|Billed}}, {{chip:green|Paid}}. Hazmat riders show as a gray block at the end.

## Bill a stage

1. Tick the checkbox under the strip for each stage that's finished.
2. Press {{button:primary|Create invoice from N segments ($X)}}.
3. A **Ready to Bill** invoice is broken off for exactly those stages' total, and the stage lines lock in ① Line Items with an *Invoiced* tag.

From there it's the normal billing flow — see *bill a customer and get paid*.

## Good to know

- A billed stage line can't be edited or removed while its invoice exists. Send the invoice back (or delete the draft) and the line unlocks automatically.
- Re-ordering is always allowed, billed or not — order is just presentation.
- The regular break-off amount box still works for billing an arbitrary dollar amount; stages and dollar break-offs can mix on the same job.
- Nothing changes for jobs that don't use stages.

## Related

- To bill and collect the invoice you just created, see *bill a customer and get paid*.
