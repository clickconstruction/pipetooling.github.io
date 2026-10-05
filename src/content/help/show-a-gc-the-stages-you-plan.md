---
title: show a GC the stages you plan
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: gc, general contractor, builder, gc portal, stages, eye, shown to gc, share stage dates, customer portal, windows, next stage, see it as the customer, stage plan
order: 64
---
A GC's portal shows bills and payments. On the jobs you choose, it can also show the **stages** you plan, as one simple sequence.

The sequence reads like *Stage 2 of 4 · Top-out · on site now*. The sequence puts a check on what has passed. The sequence shows the live stage, how far along it is, and what comes next. The GC sees **our crew**, never a sub's name, and never that work was offered to anyone. Nothing shows until you turn it on for the job and turn the eye on for a stage.

## Turn it on for the job

1. Open **Edit Job → Customer → GC/Builder**. Under the GC picker, tick **Share stage dates with this GC**. The setting is off on every job by default.
2. You can tick **Offer the next stage on its own when one passes inspection**. Then the next stage's eye turns on without asking. Otherwise the dispatch inbox asks you each time.

## The eye — which stages the GC sees

{{gif:show-a-gc-the-stages-you-plan.gif|Edit Job → Stages: turn the eyes on, then See it as the customer — the drawer follows every flip}}

Open **Edit Job → Edit**. Above the job details sits **Stages**, a read-out of the plan set on the Bill tab. The summary reads like *4 in order · 2 any time · 5 shown to Summit General*. Open it and each stage reads on one line. The line has its number or ◆, its name, its draw, and where it stands. The draw is what you bill for that stage. Where it stands reads like *Sep 9 – 10 · 50%*, *passed Sep 4* or *no window yet*. A window is the span of days you want the stage done in. The **eye** sits at the right.

- **Eye on**: the GC sees this stage on their portal.
- Eye **off**: they don't. Use it for a stage you are still deciding on, or a change order they should not see yet. A change order is a priced change to the agreed work.

Click the eye to flip it. The change saves with the job. Order and kind are not set here. Press {{button:outline|Set stages on Bill →}} to change those on **① Line Items**.

:::example What the GC reads
**Stage 2 of 4 · Top-out · on site now** — ✓ Rough-in *Passed inspection Sep 4* — ② **Top-out** *On site Sep 9 – 10 · about halfway* — ③ Trim & final *Planned Sep 22 – Oct 2* · **Need other dates?** — ④ Final inspection *After trim & final*. Under it, **Also on this job**: ◆ Relocate water heater *Done Sep 16*. No name, no "offered", no price.
:::

{{gif:show-a-gc-the-stages-you-plan-portal.gif|The GC's portal: Where the job is — one sequence, the live stage's progress in words, Need other dates? on the next stage only}}

## See it as the customer

Press {{button:blue|See it as the customer}} on the Stages read-out. A drawer, a side panel, opens beside the dialog. The drawer holds the card exactly as the GC's portal draws it. The card follows every change you make. Flip an eye or move a window, and the card updates. **Open the sample portal ↗** at the foot shows the same card on the sample account's page.

The GC may never have been given a portal link. Then the foot of the drawer says **No portal link yet** and offers {{button:blue|Create their link}}. Press it and their page goes live right there. The door then reads **Open the portal ↗**. You still decide when to share the link. The globe on the customer shows it. Just looking? Leave it. Nothing is created until you press.

## Where the sub side reads it

On **Jobs → Subs → Work**, the GC chip sits beside a stage's dates. The chip reads {{chip:blue|On Summit's portal ›}} when the eye is on. The chip reads *Not shown · set on Edit* when the eye is off. The chip is a read-out here. The eye lives on Edit Job.

## After inspection

When you move a sheet to Post-inspection on its story, the next **Order** stage's eye can turn on by itself. The eye turns on by itself when the second switch is on. Otherwise a dispatch line asks *"a stage passed — show Top-out to Summit General?"* Any-time stages and plain lines are never picked by this rule.

## When the GC asks

Only the **next** stage carries **Need other dates?** on the portal. The GC picks two days and gives a why. The ask lands in the dispatch inbox, like *Summit General asks for Top-out Sep 22 → Oct 2 on #1004*. The ask also lands on the stage row on **Jobs → Subs → Work**, like *GC asked Sep 22 – Oct 2 · "framing slipped"*. Press {{button:blue|Accept}} to make that the window. Or press **Answer with…** to propose your own dates, with a why the GC reads. The sub may have already picked days that no longer fit. Then their portal asks them to confirm new dates inside the new window. Until they do, the GC reads *we're picking new days inside the window*.

## Related

- To set which line items are stages and in what order, see *split a job into stages and bill stage by stage*.
- To give a sub a stage's window, see *set a window for a sub's stage*.
