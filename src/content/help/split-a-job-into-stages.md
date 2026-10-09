---
title: split a job into stages and bill stage by stage
category: Billing & Money
roles: assistant, master_technician
keywords: stages, segments, line items, reorder, partial invoice, break off, bill by stage, rough in, top out, trim set, money card, make a bill, in order, any time, permit, change order, draw, stage kind, bill it, which kind
order: 11
---
A job's line items are its stages. Each line says whether it waits its turn. The bills follow from that. Everything happens on the job's Bill tab.

You set each line under its name in **① Line Items**. You pick **In order** or **Any time**. The draws in **② Bills and payments** follow from that choice.

Often you do not have to set anything. The line items may already read like a plan. An example is **Rough In**, **Top Out** and **Trim Set** in order. That is the way the Multiple Segment Generator's preset writes them. The Pipeline row and the crew's report picker then recognize the stages by name. Setting **In order** here is what makes the **draws** follow the stages too. A draw waits on the stage above it. Recognition alone never changes how a job bills. Some jobs have lines the board cannot read as stages, like *Phase A* or *Beginning of Job*. Those show a small **Set stages** link under their bar on the Pipeline. It opens this tab with ① Line Items lit.

## The two kinds

- {{button:gray|In order}} is a numbered stage in the sequence. It waits for the stage above it to pass inspection. It becomes a **draw**, its own invoice, when it passes its own. Rough-in, top-out, trim and final are in order.
- {{button:amber|Any time}} is a stage with its own dates and no place in the line. A change order, an extra or a repair added mid-job is any time. It bills the day its work is done, without waiting on the sequence.

Every line item starts as **Any time**. That covers the ones you add by hand and the ones a change order brings in. It also covers every line item from before this feature. Nothing is in order until you say so. A **discount** row is neither kind. It has no switch and follows the work it applies to. See *give a customer a discount*.

## Which kind do I pick?

Ask one question about the row. Does it have to wait its turn? Rough-in comes before top-out, and top-out before trim. Those are **In order**. A job that can happen whenever, on its own dates, is **Any time**.

| The row | Pick | Because |
|---|---|---|
| Rough-in, Top-out, Trim, Final | In order | A fixed sequence, each a draw |
| Relocate water heater | Any time | A signed change order, done whenever |
| Add hose bib, garage | Any time | Its own dates, its own price |
| Permit, dumpster, mobilization | Any time | Nobody reports it done, so you tick it in |

:::example One bill with both kinds — an eight-unit building for a GC, $44,420
① Rough-in $12,465 · ② Top-out $12,465 · ③ Trim & final $16,620 · ④ Final inspection $0 — all **In order**. ◆ Relocate water heater $1,850 and ◆ Add hose bib $420 — **Any time** (two signed change orders). ◆ Permit & plan review $600 — **Any time** too, a line nobody goes on site for.

How it bills over the job: Rough-in passes → *draw 1* is ready → {{button:green|Bill it}}. The water heater gets moved while top-out is still going → its row reads *done* → Bill it breaks off its own $1,850, it never waited. Top-out passes → *draw 2* (had you forgotten draw 1, it would read *waits on stage 1* instead — nothing bills out of order). Trim & final passes → *draw 3* is the last money draw, so you tick the $600 permit line into the same invoice and bill $17,220. Final inspection passes with no draw. When the customer pays draw 3, every stage reads done.
:::

**What about fees, permits and pass-throughs?** They are any-time lines like everything else. Nobody reports progress on a permit. So its row on the money card keeps reading *not billed* until you tick it into a draw yourself. On the invoice it prints at its real price, like every line the invoice covers. Put the receipt detail in the row's scope note. That is the pencil in the name field. It prints on the Stripe line too. The GC's *Where the job is* card shows only the rows whose eye is on. So a fee line never appears there unless you turn it on. A GC may expect permits invoiced the day they are pulled. Then tick that row on its own and make the bill then.

## Set up the stages in ① Line Items

:::example Under one line in ① Line Items, before and after you press In order
◆ **Top-out** $3,000
{{button:outline|In order}} {{button:amber|Any time}}

② **Top-out** $3,000
{{button:dark|In order}} {{button:outline|Any time}}
:::

1. Open the job from Jobs → Pipeline → {{button:outline|Edit}} → **Bill**. Find **① Line Items**.
2. Enter one line per stage of work, with its price.
3. Under each stage's name, press **In order**. The badge at the left of the row turns into its number. In-order rows are numbered top to bottom.
4. Use the **▲▼ arrows** to put them in work order. The numbers follow.
5. Leave change orders, extras and fee lines on **Any time**.

:::example A staged plumbing job
① Rough-in $3,000 → ② Top-out $3,000 → ③ Trim set $3,000 → ④ Final $1,000 · ◆ Relocate water heater $1,850 (Any time) · ◆ Permit & misc $600 (Any time)
:::

The badge fills in as the job moves. A hollow number is a stage still ahead. A dark number is the stage the job is on. A green check means its draw is paid. Where each stage stands is said once, on its row in the money card below. Press **ⓘ How stages work** under the lines for a short reminder of the two kinds.

## Or generate the stages in one go

Click the blue **Multiple Segment Generator** link in the ① Line Items caption.

1. Set the **total amount** at the top. It starts at the current Job Total.
2. Press a preset. **Commercial 30/30/30/10** makes Rough In, Top Out, Trim Set and Final. **Residential 40/40/20** makes Rough In, Top Out and Trim Set. Every preset row is **In order**, numbered top to bottom. Its dollar value is its share of the total.
3. Or name each segment yourself and give it a **%**. The **Stage** column on every row is the same **In order / Any time** switch as the line items. A row you flip to **Any time** leaves the split. It gets its own price box instead of a percentage.
4. Press {{button:amber|+ Change order}} to add an **Any time** row with its own price. It sits outside the percentage split. The line under the list then reads *100% allocated · $41,550 in order · $1,850 outside the split*. The summary counts *4 in order · 1 any time · Job total $43,400*.
5. Re-arrange with **▲▼** and the numbers follow. Then press {{button:blue|Add to Job}}. The segments join your line items with their stage already set. Nothing more to flip.

:::example Commercial preset plus a change order
① Rough In 30% $12,465 · ② Top Out 30% $12,465 · ③ Trim Set 30% $12,465 · ④ Final 10% $4,155 · ◆ Relocate water heater $1,850 (own price) — Job total $43,400
:::

## Watch the draws follow on the money card

The money card at the top of **② Bills and payments** shows the whole job as blocks. There is one block per line item, in stage order. The in-order stages come first by number, then the any-time stages. Each block's color is where its draw stands. Green is {{chip:green|Paid}}. Blue is {{chip:blue|Billed}}. Light blue is **Drafted**, a Ready to Bill invoice that has not gone out. Yellow is {{chip:yellow|Ready to bill}}, with nothing drafted yet. Hatched yellow **waits on its stage**. It passed, but the stage above it is not on an invoice yet. Gray is **later**. A dark marker across the blocks is the job's **% done**.

Under the blocks, each line gets a row. The row says where its work stands when the job has stage dates. Examples are *passed Sep 4* and *on site Sep 9 – 10 · 50%*. It always says where its money stands. Examples are *billed Sep 5 · open*, *paid Aug 29* and *after it passes inspection*. A row the rule says is ready reads *ready to bill* and gets a {{button:green|Bill it}} button.

:::example The money card's rows on a three-draw job with a permit line
**Draw 1 · Rough-in** $3,000 {{chip:green|paid Aug 29}}

**Draw 2 · Top-out** $3,000 {{chip:yellow|ready to bill}} {{button:green|Bill it}}

**Draw 3 · Trim** $3,000 {{chip:gray|after it passes inspection}}

**◆ Permit & misc** $600 {{chip:gray|not billed}}
:::

Money can go out as a **dollar-amount bill**, from **Bill part of it** or a partial invoice. That bill is not tied to any one line item. So it shows as blue **hatching** across the blocks, first items first. A line covered to the cent reads *covered* on its row. A line covered in part says how much, like *$1,000 of $3,000 covered*.

## Bill a stage

1. A stage passes inspection, or an any-time stage's work is done. Its row on the money card then reads *ready to bill*.
2. Press {{button:green|Bill it}} on that row. A **Ready to Bill** invoice is made for exactly that line item. The line locks in ① Line Items with an *Invoiced* tag. The Invoices list names the draw it is, like *Draw 2 · Top-out*.
3. From there it is the normal billing flow. See *bill a customer and get paid*.

Nothing bills out of order. An in-order stage can pass while the stage above it is still unbilled. Then it waits. Its block hatches and its row says which stage it waits on. Bill the earlier one first. The later one turns ready on its own.

The rule guides you, but it does not lock the door. You can tick several lines on the money card. Then press {{button:blue|Bill the 2 picked · $6,000}}. Or open **Bill part of it** under **Make a bill** for a plain dollar amount. A tick never fills that box. So each button bills what it says.

## Good to know

- A billed stage line can't be edited or removed while its invoice exists. Its kind can't change either. Send the invoice back, or delete the draft, and the line unlocks.
- Change your mind on a draft? Press the red **✕** on its row in the Invoices list and confirm. The draft is deleted and its line reads *not billed* again.
- Re-ordering is always allowed, billed or not. The numbers follow the arrows.
- The draft tagged **auto** in the Invoices list is the job's remainder keeping itself up to date. It shrinks as you break stages off. It disappears once every stage is on its own invoice. You never need to create it, resize it or delete it.
- A job with no in-order rows works as before. Its line items bill whenever you like.
- A **discount** row from {{button:green|− Add discount}} is never a stage. It follows the work it applies to. So each draw carries its share as a labeled line. {{button:green|Bill it}} on the last in-order stage puts the discount on that final bill. Then the discount reads billed, not left open. See *give a customer a discount*.
- What the GC sees of these stages is set on the **Edit** tab. See *show a GC the stages you plan*.

## Related

- To bill and collect the invoice you just made, see *bill a customer and get paid*.
- To give a sub a stage's window, see *set a window for a sub's stage*.

## Reports follow the stages

A job may have an in-order row. Then the crew's field report asks **which stage** they worked on and how far along it is. The job's percent is the weighted sum. Each stage counts by its share of the job's value. The stage's own percent shows on its row in the money card. So a stage at *60%* and the job's percent always agree. See *file and review field reports*.
