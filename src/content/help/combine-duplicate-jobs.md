---
title: combine two duplicate jobs into one
category: Office
roles: dev, master_technician, assistant, controller
keywords: combine, duplicate, jobs, merge, separate, migrate, delete, two cards, same address, status, percent, activity note, stays behind, work order, materials on site, box photos, drive folder, held file, plans, promise, lien, agreement, pay application, legal matter, texts, messages, sub sheet, certified mail, statement of charges
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

Everything real moves to the target: costs, labor, schedule, reports, stage checklists, notes, and the job total. The source's job history, photos, materials on site, test reports, share links, hours statements and plan sets move too. So do its Messages links, its Drive links, its work orders and its supply-house accounts. Its texts, calls, emails and team notes move too, and stay on their contacts. So do its sub labor sheets, the certified letters sent for it and its statements of charges. A moved sub sheet shows the target's job number. Its payment promises, lien paper, agreements and pay applications move too. A stage's checklist keeps every answer, added check and skip. A stage's window goes with its line. The source card is then deleted.

The source's HCP number and C# are not lost. They stay on the target as prior numbers. The job window and the Pipeline row read them as *also JP550*. Search the Pipeline by an old number and the combined job comes up.

A job made from an estimate carries that estimate with it. The exception is when the target was made from an estimate of its own. A job can hold one estimate. In that case the source's estimate stays on the **Estimates** page on its own, no longer linked to a job. The success message says so.

:::example The combined job keeps the target's status
Combining never changes the target's status or % done. If a tech had marked the source further along, that mark doesn't transfer — which is exactly why the warning shows first, so you can move the target forward yourself if the work really is done.
:::

## Box photos follow in Drive

A photo of a cage or box is a file in the job's Drive folder. After a combine the source's photo files move into the target's Drive folder.

They start by themselves and finish in a minute or two. The success message says how many are moving. You can keep working.

Open the target on **Jobs → Materials** to watch the count go down. A file that cannot move is named there with its reason. Press {{button:blue|Try 1 held file again}} once it is put right. A held file is also tried again by itself a day later.

## When the target already has one

Some things a job has once. The target keeps its own, and the source's copy goes. Those once-only things are the labor baseline, the budget and the property owner.

A place with the same name on both jobs becomes one place. The source's Unsorted pile folds into the target's Unsorted pile. A cage or box with the same label keeps its own row and its printed code. The cage or box gets a number after its name, like *Cage A (2)*.

A watcher the target lacks is added with their picks. A contact link, an open skip, an open hold or an open call the target already has stands once. A hold keeps the later of the two days. A supply-house account the source opened opens the target's. The later word from a supply house stands. The target's hours target stands. The source's open hours target comes over closed.

A job has one set of plans. A target with none takes the source's. A target with its own keeps it, and the source's sets join it as older sets.

:::example Both jobs hold a work order for the same sub
Say both cards hold a live work order for Rivera Mechanical. The combine holds and says so by name. Cancel one of the two orders, then press Combine again.
:::

## Money and legal paper

Payment promises and chase calls go to the target. So does the trace of a payment moved off or onto the source. The promised pay date marked last stands. A claim correction on both jobs keeps the target's.

Lien notices, affidavits, lien releases and demand letters move too. They are the record of what went out. Lien desk items, agreements and pay applications move as well. A legal matter that named the source now names the target once. An owner's records request names the target too. A dispute or a returned check on the source's payment goes with it.

:::example Both jobs hold a live Lien desk item of the same kind
Say both cards hold a drafted lien notice. The target's draft stands. The source's draft is set aside, and the Lien desk no longer lists it. The target's **Job activity** gets a line that names the draft and its months. No month goes missing, because the desk works out what is due from the job's bills. A dev can bring the draft back if you need it.
:::

The combine holds in two more cases and says which. Both jobs hold an open agreement, a draft or one sent for signing. Void one of them, then press Combine again. Both jobs hold pay applications. Their numbers are on paper the GC holds, so the combine never renumbers them. Delete one job's applications, then press Combine again.

## What stays behind

The **Combine** tab refuses a source that has bills or payments. Clear or move them first. The Delete flow's {{button:outline|Reassign to another job…}} lets a source's bills and payments go with it on purpose.

Three things go on purpose, because the target rebuilds them. The note count, the drive time between two jobs, and the paid-job email queue.

## The activity note

After a combine, the target's **Job activity** gets a note posted under your name. It reads like *Combined "Johnny Inglow" (Job #877) into this job — source was Ready to bill at 100%*. The office and the crew both see the same explanation of where the extra history came from. The note preserves the source's last status and % done. Those otherwise disappear with the card.

The same note is posted when you delete a job via {{button:outline|Reassign to another job…}} in the Delete flow.
