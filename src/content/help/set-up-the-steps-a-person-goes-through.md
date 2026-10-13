---
title: set up the steps a person goes through
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: flows, flow, steps, step, lane, once, per job, any time, finished when, fact, fork, whose move, seat, nudge, reminder, repeats, papers, usual, history, removed, how it is going, funnel, settings
order: 100
---
Each customer, trade partner and architect goes through a flow of steps. The office sets up those steps in Settings. Every change is tried on everyone before you save it.

## Open the flows

1. Open [Flows](/settings?tab=settings-flows) in Settings.
2. Pick the flow you want: **Customer**, **Trade partner** or **Architect**.

A flow has three lanes. **Once** holds the steps a person goes through one time. **Per job** holds the steps for each job they are on. **Any time** holds the steps that can come up at any point.

## Read a step

Each row is one step. **Finished when** lists the facts that finish the step. The app already keeps these facts, so the step finishes by itself.

**Whose move** says who acts next on the step. **Nudge after** says when a reminder comes, and how it goes.

Two facts joined by **and** must both be true. Some steps are a fork. A fork finishes on either of its facts, so its facts join with **or**.

## Change a step

1. Type a new name in the step's name box. Type its Spanish name in the box under it.
2. Pick who moves under **Whose move**. For our move, pick the person who keeps the step.
3. Pick the quiet days under **Nudge after**. Then pick how the nudge goes and who sends it.
4. Move the step with {{button:outline|↑}} and {{button:outline|↓}}.
5. To move the step to another lane, pick the lane under **Lane**.

To add a step, press **+ a step in Once** or the button under another lane. Type its name. Then pick what finishes it.

To take a step off the flow, press **Remove** on it. The window says who is on the step now. The people on it move on to the next step.

## Pick what finishes a step

1. Press **+ a fact** under **Finished when**.
2. Pick a fact from the list. The list shows only what the app keeps.

To finish the step on either of two facts, press the **and** between them. The word turns to **or**, and the step becomes a fork.

When the fact you need is not on the list, press **Ask for a fact that is missing**. Write the fact in plain words. The office's request goes to the people who build the app.

## Add a paper to a step

1. Press **+** under **Papers**.
2. Pick a paper from the list.

When the app does not know the paper yet, press **+ Add a new paper** instead. See [add a new paper to a step of a flow](/help/add-a-new-paper-to-a-step-of-a-flow).

## Save or put it back

Every change is tried on everyone on the flow before you save. The box *Before you save · who moves* lists each person. A name in bold would move to another step.

Press {{button:blue|Save}} to keep every change. Press {{button:outline|Put it back}} to drop them all.

Save keeps all of your changes or none of them. Sometimes another person saves the flow while you work. Save then tells you so. Press **Put it back** to see their flow, and make your change again.

:::example Before you save
Tom Riddle: Papers in → MSA signed
Greg Paulk: Asked to quote · same
{{button:blue|Save}} {{button:outline|Put it back}}
:::

## See every change

Press **History** above the flow. Each line shows who changed what, and when. The last line is the flow as the app first drew it.

A step you removed waits under **Removed**. Press **Put it back** on the step, then press **Save**.

## See how it is going

Press **How it is going** above the flow. The funnel counts this quarter's jobs as they move through the **Per job** lane.

The table has one row for each step. Each row shows who is on the step now and the usual days the step takes. The row also shows who has waited longest, and the fact that is most often last.
