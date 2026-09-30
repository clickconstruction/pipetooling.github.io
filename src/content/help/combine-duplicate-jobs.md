---
title: combine two duplicate jobs into one
category: Office
roles: dev, master_technician, assistant, controller
keywords: combine, duplicate, jobs, merge, separate, migrate, delete, two cards, same address, status, percent, activity note
order: 73
---
Sometimes the same work ends up as two job cards. Each card collects its own costs, hours and activity, so the money and the story split in half.

It may be a second Job # for the same address. Or it may be a job re-entered under a slightly different name.

## Combine them

1. Open the **Pipeline** board and press the tools menu, then {{button:outline|Combine / Separate…}}.
2. On the **Combine** tab, search and pick the **source** and the **target**. The source is the card that goes away. The target is the card that stays. The duplicate-address finder can pre-fill both.
3. Read the Summary. It shows line items, parts-style costs, billed materials, and team labor for Source, Target, and the combined **New** card.
4. Check the status line under the Summary. The source's progress may differ from the target's. Say the source was marked {{chip:green|Ready to bill}} at 100% while the target is still {{chip:blue|Working}}. Then an amber warning spells it out **before** you confirm.
5. Press {{button:red|Confirm migrate and delete source}}.

Everything real moves to the target: costs, labor, schedule, reports, notes, and the job total. The source card is then deleted.

A job made from an estimate carries that estimate with it. The exception is when the target was made from an estimate of its own. A job can hold one estimate. In that case the source's estimate stays on the **Estimates** page on its own, no longer linked to a job. The success message says so.

:::example The combined job keeps the target's status
Combining never changes the target's status or % done. If a tech had marked the source further along, that mark doesn't transfer — which is exactly why the warning shows first, so you can move the target forward yourself if the work really is done.
:::

## The activity note

After a combine, the target's **Job activity** gets a note posted under your name. It reads like *Combined "Johnny Ingram" (Job #877) into this job — source was Ready to bill at 100%*. The office and the crew both see the same explanation of where the extra history came from. The note preserves the source's last status and % done. Those otherwise disappear with the card.

The same note is posted when you delete a job via {{button:outline|Reassign to another job…}} in the Delete flow.
