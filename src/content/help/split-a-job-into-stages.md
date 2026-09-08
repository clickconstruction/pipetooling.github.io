---
title: split a job into stages and bill stage by stage
category: Billing & Money
roles: assistant, master_technician
keywords: stages, segments, line items, reorder, partial invoice, break off, bill by stage, rough in, top out, trim set, segment bar, order, any time, not a stage, permit, change order, draw, stage kind, bill it, which kind
order: 11
---
A job's line items **are** its stages. Each line item says what kind of stage it is — **Order**, **Any**, or **—** — on the second line under its name in **① Line Items**, and the draws in **② Invoices** follow from that. Everything happens on the job's **Bill** tab.

## The three kinds

- {{button:gray|Order}} — a numbered stage in the sequence. It waits for the stage above it to pass inspection, and it becomes a **draw** (its own invoice) when it passes its own. Rough-in, top-out, trim, final.
- {{button:amber|Any}} — a stage with its own dates and no place in the line. A change order, an extra, a repair the customer added mid-job. It bills the day its work is done, without waiting on the sequence.
- {{button:outline|—}} — **not a stage**: a plain line item. A permit fee, plan review, a deposit, a dumpster or mobilization charge, a materials-only line. Nobody goes on site for it, so it has no window, no inspection and no percent. It rides on the final draw.

Every line item starts as **Any** — the one you add by hand, the ones a change order brings in, and every line item that existed before this feature. Nothing is in order until you say so.

## Which kind do I pick?

Ask two questions about the row:

1. **Does someone show up on site to do it, and would you want to know when it's done?** If no — a fee, a permit, a pass-through — it is **—**. Not a stage.
2. **If yes, does it have to wait its turn?** Rough-in before top-out before trim: **Order**. Could happen whenever the framing is ready, on its own dates: **Any**.

| The row | Pick | Because |
|---|---|---|
| Rough-in, Top-out, Trim & final, Final inspection | Order | Fixed sequence, each passes its own inspection, each is a draw |
| Relocate water heater (a signed change order) | Any | A sub does it whenever the closet is framed; bills the day it's done |
| Add hose bib, garage | Any | Same — its own dates, its own price |
| Permit & plan review, dumpster, mobilization | — | Nobody drives to the site for it; it goes out with the last draw |

:::example One bill with all three kinds — an eight-unit building for a GC, $44,420
① Rough-in $12,465 · ② Top-out $12,465 · ③ Trim & final $16,620 · ④ Final inspection $0 — all **Order**. ◆ Relocate water heater $1,850 and ◆ Add hose bib $420 — **Any** (two signed change orders). Permit & plan review $600 — **—**.

How it bills over the job: Rough-in passes → *draw 1* is ready → {{button:green|Bill it}}. The water heater gets moved while top-out is still going → its row reads *done* → Bill it breaks off its own $1,850, it never waited. Top-out passes → *draw 2* (had you forgotten draw 1, it would read *waits on stage 1* instead — nothing bills out of order). Trim & final passes → *draw 3* is the last money draw, so you tick the $600 permit line into the same invoice and bill $17,220. Final inspection passes with no draw. When the customer pays draw 3, every stage reads done.
:::

**Does the customer see a — line?** On the invoice, yes — every invoice lists the line items it covers at their real prices, so *Permit & plan review $600* prints on draw 3's bill (and on the portal's bills). Put the receipt detail in the row's scope note (the pencil in the name field) and it prints on the Stripe line too. What the — kind hides is only the **stage card**: the GC's *Where the job is* shows stages, never your fee lines. If a GC expects permits invoiced the day they're pulled, tick that row on its own and create the invoice then — *with the final draw* is the suggestion, not a lock.

## Set up the stages in ① Line Items

{{gif:split-a-job-into-stages.gif|The Bill tab: flip a row between Order and Any under its name — the badge, the strip and Still to bill follow}}

1. Open the job (Jobs → Pipeline → {{button:outline|Edit}} → **Bill**) and find **① Line Items**.
2. Enter one line per stage of work with its price.
3. On each stage's second line, press **Order**. The badge at the left of the row turns into its number; Order rows are numbered top to bottom.
4. Use the **▲▼ arrows** to put them in work order. The numbers follow.
5. Leave change orders on **Any** and plain charges on **—**.

:::example A staged plumbing job
① Rough-in $3,000 → ② Top-out $3,000 → ③ Trim set $3,000 → ④ Final $1,000 · ◆ Relocate water heater $1,850 (Any) · Permit & misc $600 (—)
:::

The rest of the second line tells you where the stage stands — *window Sep 22 – Oct 2*, *on site Sep 9 – 10 · 50%*, *passed Sep 4* — and where its draw stands — *draw 3 after it passes*, *draw 2 billed Sep 5*, *draw 1 paid Aug 29*. The badge fills in as the job moves: a hollow number for a stage still ahead, a dark number for the stage the job is on, a green check once its draw is paid.

## Or generate the stages in one go

Click the blue **Multiple Segment Generator** link in the ① Line Items caption:

1. Set the **total amount** at the top (it prefills with the current Job Total).
2. Press a preset: **Commercial 30/30/30/10** (Rough In / Top Out / Trim Set / Final) or **Residential 40/40/20** (Rough In / Top Out / Trim Set). Every preset row is **in order** — numbered top to bottom — and its dollar value is its share of the total.
3. Or name each segment yourself and give it a **%**. The **Stage** column on every row is the same **Order / Any / —** selector as the line items: a row you flip to **Any** or **—** leaves the split and gets its own price box instead of a percentage.
4. Press {{button:amber|+ Change order}} to add an **Any** row with its own price — it sits outside the percentage split, so the line under the list reads *100% allocated · $41,550 in order · $1,850 outside the split*, and the summary counts *4 in order · 1 any time · Job total $43,400*.
5. Re-arrange with **▲▼** (the numbers follow), then press {{button:blue|Add to Job}} — the segments append to your line items with their stage already set. Nothing more to flip.

:::example Commercial preset plus a change order
① Rough In 30% $12,465 · ② Top Out 30% $12,465 · ③ Trim Set 30% $12,465 · ④ Final 10% $4,155 · ◆ Relocate water heater $1,850 (own price) — Job total $43,400
:::

## Watch the draws follow — the strip in ② Invoices

The colored strip at the top of **② Invoices** shows the whole job as blocks, one per line item, in stage order: the Order stages by number, then the Any stages, then plain lines. Each block's color is where its draw stands: {{chip:green|Paid}}, {{chip:blue|Billed}}, light-blue **Drafted** (a Ready to Bill invoice exists), {{chip:yellow|Ready to bill}} (nothing drafted yet, and the rule says it may be), hatched yellow **Waits on its stage** (it passed, but the stage above it is not on an invoice yet), and gray **Later**. Hover a block to read it in words.

Under the strip, **Still to bill** lists every line item with money still to invoice and what it is waiting on — *after it passes inspection*, *passed · waits on stage 1*, *bills when the work is done*, *with the final draw*. A row the rule says is ready turns yellow and gets a {{button:green|Bill it}} button.

Money that went out as a **dollar-amount bill** (the Make Invoice slider or a partial invoice) isn't tied to any one line item, so it shows as blue **hatching** across the blocks instead — first items first. The draggable **Make Invoice** track still sits under the strip, and every segment is listed one per line below it.

## Bill a stage

1. When a stage passes inspection (an Order stage) or its work is done (an Any stage), it appears in **Still to bill** as ready.
2. Press {{button:green|Bill it}} on that row. A **Ready to Bill** invoice is broken off for exactly that line item, it locks in ① Line Items with an *Invoiced* tag, and the Invoices table names the draw it is — *Draw 2 · Top-out*.
3. From there it's the normal billing flow — see *bill a customer and get paid*.

Nothing bills out of order: an Order stage that passed while the stage above it is still unbilled waits (its block hatches, its row says which stage it is waiting on). Bill the earlier one first and the later one turns ready on its own.

You can still tick several segments under the strip and press {{button:blue|Create invoice from remaining on N segments}}, or drag the **Make Invoice** slider and press {{button:blue|New Invoice}} for a plain dollar amount — the rule guides, it does not lock the door.

## Good to know

- A billed stage line can't be edited, removed, or change its kind while its invoice exists. Send the invoice back (or delete the draft) and the line unlocks automatically.
- Change your mind on a draft? Press the red **✕** on its row in the Invoices table and confirm — the draft is deleted and its segment goes back to *still to bill*.
- Re-ordering is always allowed, billed or not — the numbers follow the arrows.
- The draft tagged **auto** in the Invoices table is the job's remainder keeping itself up to date: it shrinks as you break stages off and disappears once every stage is on its own invoice. You never need to create it, resize it, or delete it.
- A job with no Order rows works exactly as before: its line items bill whenever you like.
- What the GC sees of these stages is set on the **Edit** tab — see *show a GC the stages you plan*.

## Related

- To bill and collect the invoice you just created, see *bill a customer and get paid*.
- To give a sub a stage's window, see *set a window for a sub's stage*.
