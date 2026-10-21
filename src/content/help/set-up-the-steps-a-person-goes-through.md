---
title: set up the steps a person goes through
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: flows, flow, residential customer, sub, the app and this move, asks, pipeline, steps, step, lane, once, per job, any time, finished when, fact, fork, whose move, seat, nudge, reminder, the app sends this reminder, morning run, read the run, repeats, papers, usual, history, removed, how it is going, funnel, settings, call script, suggest a call
order: 100
---
Each customer, trade partner, architect, residential customer and sub goes through a flow of steps. The office sets up those steps in Settings. Every change is tried on everyone before you save it.

## Open the flows

1. Open [Flows](/settings?tab=settings-flows) in Settings.
2. Pick the flow you want: **Customer**, **Trade partner**, **Architect**, **Residential customer** or **Sub**.

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

## Let the app send a reminder

A step can send its own reminder. Pick **the app sends it** under **Nudge after**, then press **Save**.

The step then shows a control called **The app and this reminder**. It has three ways. Every step starts on **Off**. Only the owner or a dev changes it.

- **Off**. The app does nothing with this reminder.
- **Offers**. Each morning at 9 AM the app prepares the text and puts it on the Dashboard under Today's sends. The office reads it and presses Send. See [work Today's sends](/help/work-todays-sends).
- **Sends**. The app texts the reminder at 9 AM from the company number.

Either way the text waits for the step's quiet days to pass. The words under the control are the text it prepares or sends. The app sends texts only, so a call or an email stays with a person.

The control saves the moment you press it. It does not wait for **Save**.

The same control is on Phone and texts, under **Reminders the app offers**. The owner sees every step the app can text there, with the other Messages switches. See [offer the app's reminders](/help/offer-the-apps-reminders).

:::example A step the office presses
{{chip:gray|Off}} {{chip:green|Offers}} {{chip:gray|Sends}}
Each morning the app prepares the text for Today's sends on the Dashboard. The office presses it.
“Chris, did the invite come through?”
:::

## Ask before a text when a job moves

Three steps on the **Residential customer** flow follow the Pipeline. They are **Working**, **Done** and **Billed**. Each shows a control called **The app and this move**. It has two ways. Every step starts on **Off**. Only the owner or a dev changes it.

- **Off**. Nothing happens on the board when a job reaches the stage.
- **Asks**. When the office moves a job to the stage, Tell the customer opens with the text ready. The office reads it, changes a word if it wants, and presses Send or Skip.

The words under the control are the text it would ask about. They come from the step's line, or from the app's own words until the office writes one. A move back asks nothing. A move by the crew asks nothing.

:::example A move that asks
{{chip:gray|Off}} {{chip:green|Asks}}
Move a job to Ready to Bill and the sheet opens with the Done text.
“Dana, this is Rosa with Click Plumbing. The work on the water heater is done. Your bill follows by email. Text me here with any question.”
:::

## Write the call script

After a step's text goes to a customer, the receipt suggests a call and shows what to say. The words come from the step.

1. Open the step and press **Call script**.
2. Write the words in English, then in Spanish. Use the same blanks as the lines, like {first} and {day}.
3. Leave both boxes empty to use the app's own words.
4. Untick **Suggest a call after this goes** when a step needs no call.

The script saves with **Save**. See [call a customer from a task](/help/call-a-customer-from-a-task).

## See the morning run

The line above the flow says what the last morning run did. It counts the texts that went, the texts it prepared for Today's sends, and the reminders kept back. It also says why each one was kept back. Press **Read the run** to see every line the run wrote.

## Save or put it back

Every change is tried on everyone on the flow before you save. The box *Before you save · who moves* lists each person. A name in bold would move to another step.

The **Residential customer** and **Sub** flows do not show who is on them yet. Their box says so, and so does **How it is going**. **Save** still changes the flow for everyone on it.

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
