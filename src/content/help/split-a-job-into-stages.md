---
title: split a job into stages and bill stage by stage
category: Billing & Money
roles: assistant, master_technician
keywords: stages, segments, line items, reorder, partial invoice, break off, bill by stage, rough in, top out, trim set, segment bar
order: 11
---
A job's line items can double as its **stages**: put them in the order the work happens, then bill each stage on its own invoice as it finishes. Everything happens in Edit Job.

## Set up the stages in ① Line Items

1. Open the job (Jobs → Pipeline → {{button:outline|Edit}}) and find **① Line Items**.
2. Enter one line per stage of work with its price — for a plumbing job that's usually *Rough In*, *Top Out*, *Trim Set*, and maybe a *Final* line.
3. Use the small **▲▼ arrows** on the left of each line to put them in work order. The order sticks with the job.

## Or generate the stages in one go

Click the blue **Multiple Segment Generator** link in the ① Line Items caption:

1. Set the **total amount** at the top (it prefills with the current Job Total).
2. Name each segment and give it a **%** — the dollar value of each segment calculates as you type and always adds back to your total.
3. Or press a preset: **Commercial 30/30/30/10** (Rough In / Top Out / Trim Set / Final) or **Residential 40/40/20** (Rough In / Top Out / Trim Set).
4. Re-arrange with **▲▼**, then press {{button:blue|Add to Job}} — the segments append to your existing line items. Every appended row is fully added the moment it lands (nothing more to confirm); the dashed {{button:outline-blue|+ Add line item}} button below the list is only for adding another row by hand.

:::example A staged plumbing job
Rough In $3,000 → Top Out $3,000 → Trim Set $3,000 → Final $1,000 — Job Total $10,000
:::

## Watch the job fill in — the segment strip in ② Invoices

The colored strip at the top of **② Invoices** shows the whole job as blocks, one per line item, in your ① order, each sized by its share of the Job Total — with the segment's name right in the block (trimmed with … when narrow). The colors follow the same lifecycle as everywhere else: {{chip:yellow|Unbilled}}, light-blue {{chip:blue|Ready to Bill}}, {{chip:blue|Billed}}, {{chip:green|Paid}}. Hazmat riders show as a gray block at the end. Money that went out as a **dollar-amount bill** (the Make Invoice slider or a partial invoice) isn't tied to any one line item, so it shows as **hatching** across the blocks instead — first items first (the Make Invoice chips below the strip carry the paid / billed / left-to-bill totals). A line item the hatching covers completely gets a {{chip:blue|covered}} tag and loses its checkbox until that bill is voided or deleted; a partly covered item stays selectable — the **Create invoice from remaining on selected segments** button subtracts the covered money automatically and bills only what's left on your selection. The draggable **Make Invoice** track sits right under the strip (its $0-to-total scale rides the legend line above), and below it every segment is listed one per line; clicking a block highlights it and its line together (for unbilled segments, that's the same as ticking its checkbox).

Not sure how the pieces travel? Click **ⓘ How invoices and jobs move** above the strip — it shows how invoices break off as green cards that move through the Pipeline on their own, while the blue job card floats through to Paid when the last payment lands.

## Bill a stage

1. Tick the checkbox under the strip for each stage that's finished.
2. Press {{button:blue|Create invoice from remaining on N segments ($X)}} — it sits just below the Make Invoice chips. If any ticked stage is partly covered by an earlier dollar bill, that covered amount is subtracted and the helper text says so.
3. A **Ready to Bill** invoice is broken off for what's left on exactly those stages, and the stage lines lock in ① Line Items with an *Invoiced* tag.

As you tick stages, the **Make Invoice** slider moves to the selection's remaining total so you can see the bill take shape on the paid/billed track — but it never locks. You can still drag the slider or retype the amount and press {{button:blue|New Invoice}} instead if a plain dollar amount fits better; untick everything and the slider returns to its usual suggestion.

From there it's the normal billing flow — see *bill a customer and get paid*.

## Good to know

- A billed stage line can't be edited or removed while its invoice exists. Send the invoice back (or delete the draft) and the line unlocks automatically.
- Change your mind on a draft? Press the red **✕** on its row in the Invoices table and confirm — the draft is deleted and its segments go back to unbilled.
- Re-ordering is always allowed, billed or not — order is just presentation.
- The draft tagged **auto** in the Invoices table is the job's remainder keeping itself up to date: it shrinks as you break stages off, it *is* the bill for whatever you never split out, and it disappears on its own once every stage is on its own invoice. You never need to create it, resize it, or delete it.
- The regular break-off amount box still works for billing an arbitrary dollar amount; stages and dollar break-offs can mix on the same job. If the amount you type exactly matches one stage's remaining value, the invoice attaches to that stage automatically (a toast says *Billed as "…"*) — the customer's bill shows that stage as its own line instead of every line item scaled down.
- Nothing changes for jobs that don't use stages.

## Related

- To bill and collect the invoice you just created, see *bill a customer and get paid*.
