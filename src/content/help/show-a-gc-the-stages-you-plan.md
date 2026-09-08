---
title: show a GC the stages you plan
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: gc, general contractor, builder, gc portal, stages, eye, shown to gc, share stage dates, customer portal, windows, next stage, see it as the customer, stage plan
order: 64
---
A GC's portal shows bills and payments. On the jobs you choose, it can also show the **stages** you plan as one simple sequence — *Stage 2 of 4 · Top-out · on site now* — with a check on what has passed, the live stage and how far along it is, and what comes next. The GC sees **our crew**, never a sub's name, and never that work was offered to anyone. Nothing shows until you turn it on for the job and turn the eye on for a stage.

## Turn it on for the job

1. Open **Edit Job → Customer → GC/Builder**. Under the GC picker, tick **Share stage dates with this GC**. It is off on every job by default.
2. Tick **Offer the next stage on its own when one passes inspection** if you want the next stage's eye to turn on without asking. Otherwise the dispatch inbox asks you each time.

## The eye — which stages the GC sees

{{gif:show-a-gc-the-stages-you-plan.gif|Edit Job → Stages: turn the eyes on, then See it as the customer — the drawer follows every flip}}

Open **Edit Job → Edit**. Above the job details sits **Stages** — a read-out of the plan set on the Bill tab: *4 in order · 2 any time · 5 shown to Summit General*. Open it and each stage reads on one line: its number or ◆, its name, its draw, where it stands (*Sep 9 – 10 · 50%*, *passed Sep 4*, *no window yet*), and the **eye** at the right.

- **Eye on** — the GC sees this stage on their portal.
- Eye **off** — they don't. A stage you are still deciding on, or a change order they should not see yet.

Click the eye to flip it; it saves with the job. Order and kind are not set here — press {{button:outline|Set stages on Bill →}} to change those on **① Line Items**.

:::example What the GC reads
**Stage 2 of 4 · Top-out · on site now** — ✓ Rough-in *Passed inspection Sep 4* — ② **Top-out** *On site Sep 9 – 10 · about halfway* — ③ Trim & final *Planned Sep 22 – Oct 2* · **Need other dates?** — ④ Final inspection *After trim & final*. Under it, **Also on this job**: ◆ Relocate water heater *Done Sep 16*. No name, no "offered", no price.
:::

{{gif:show-a-gc-the-stages-you-plan-portal.gif|The GC's portal: Where the job is — one sequence, the live stage's progress in words, Need other dates? on the next stage only}}

## See it as the customer

Press {{button:blue|See it as the customer}} on the Stages read-out. A drawer opens beside the dialog with the card exactly as the GC's portal draws it, and it follows every change you make — flip an eye, move a window, and the card updates. **Open the sample portal ↗** at the foot shows the same card on the sample account's page.

## Where the sub side reads it

On **Jobs → Subs → Work**, the GC chip beside a stage's dates reads {{chip:blue|On Summit's portal ›}} when the eye is on, or *Not shown · set on Edit* when it is off. The chip is a read-out here — the eye lives on Edit Job.

## After inspection

When you move a sheet to Post-inspection on its story, the next **Order** stage's eye either turns on by itself (the second switch) or a dispatch line asks *"a stage passed — show Top-out to Summit General?"* Any-time stages and plain lines are never picked by this rule.

## When the GC asks

Only the **next** stage carries **Need other dates?** on the portal — two days and a why. It lands in the dispatch inbox (*Summit General asks for Top-out Sep 22 → Oct 2 on #1004*) and on the stage row on **Jobs → Subs → Work**: *GC asked Sep 22 – Oct 2 · "framing slipped"*. Press {{button:blue|Accept}} to make that the window, or **Answer with…** to propose your own dates with a why the GC reads. If the sub had already picked days that no longer fit, their portal asks them to confirm new dates inside the new window, and the GC reads *we're picking new days inside the window* until they do.

## Related

- To set which line items are stages and in what order, see *split a job into stages and bill stage by stage*.
- To give a sub a stage's window, see *set a window for a sub's stage*.
