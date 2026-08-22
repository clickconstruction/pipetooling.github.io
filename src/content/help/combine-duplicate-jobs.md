---
title: combine two duplicate jobs into one
category: Office
roles: dev, master_technician, assistant, controller
keywords: combine, duplicate, jobs, merge, separate, migrate, delete, two cards, same address, status, percent, activity note
order: 73
---
Sometimes the same work ends up as two job cards — a second Job # for the same address, or a job re-entered under a slightly different name. Each card collects its own costs, hours, and activity, so the money and the story split in half.

## Combine them

1. Open the **Pipeline** board and press the tools menu, then {{button:outline|Combine / Separate…}}.
2. On the **Combine** tab, search and pick the **source** (the card that goes away) and the **target** (the card that stays). The duplicate-address finder can pre-fill both.
3. Read the Summary — line items, parts-style costs, billed materials, and team labor for Source, Target, and the combined **New** card.
4. Check the status line under the Summary. If the source's progress differs from the target's — say the source was marked {{chip:green|Ready to bill}} at 100% while the target is still {{chip:blue|Working}} — an amber warning spells it out **before** you confirm.
5. Press {{button:red|Confirm migrate and delete source}}.

Everything real moves to the target: costs, labor, schedule, reports, notes, and the job total. The source card is then deleted.

:::example The combined job keeps the target's status
Combining never changes the target's status or % done. If a tech had marked the source further along, that mark doesn't transfer — which is exactly why the warning shows first, so you can move the target forward yourself if the work really is done.
:::

## The activity note

After a combine, the target's **Job activity** gets a note like *Combined "Johnny Ingram" (Job #877) into this job — source was Ready to bill at 100%*, posted under your name. The office and the crew both see the same explanation of where the extra history came from — and the note preserves the source's last status and % done, which otherwise disappear with the card.

The same note is posted when you delete a job via {{button:outline|Reassign to another job…}} in the Delete flow.
