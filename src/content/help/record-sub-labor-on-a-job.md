---
title: record sub labor on a job
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub labor, subcontractor, sub sheet, labor book, job picker, stage, inspection, waiting on customer
order: 62
---
Sub labor is work you pay an outside contractor for. You record it on the Pay tab under Jobs → Subs, and every entry belongs to a job.

Sub labor lives on **Jobs → Subs → Pay**. The New Sub Labor form starts with the standard job search. Everything downstream rolls the cost up to that job automatically. That means the job's profit band, Crew P&L and sub sheets. Crew P&L is the profit and loss by crew.

## New entry: three quick steps

You press {{button:blue|New Sub Labor}}. It opens a short three-step form with a progress bar up top. It is built for phones and is the same on desktop. Enter moves you forward. {{button:outline|Back}} never loses what you typed.

1. **Job**. Tap the field to open the same job search Schedule uses. Type a number, name, address, or customer. Every result shows its trade pill, the small tag naming the trade. It also shows what stage the job is in, like {{chip:yellow|Working}} or {{chip:blue|Billed}}. Finished jobs sit under their own divider. Picking the job shows its **address right under the name**. The address comes from the job and isn't edited here. If it's wrong, you fix it in Edit Job. The pick also pre-selects the job's crew for the next step. **Date of Labor** and service type live here too. The date opens on today. It is a picker, not a printed value. The small calendar mark on its right edge is the tell. Tapping anywhere in the box opens the calendar. Set it to the day the work happened. That is usually the date on the sub's invoice, not the day you are typing it in. That date files the cost in the right week on Job Summary, Crew P&L and the team's board. So it is worth a second's attention when an invoice arrived a few days late.
2. **Crew**. The job's team arrives pre-selected as tappable chips. Tap to add or remove people from External Subs, Internal Subs, or Office Team. Or search across all three. {{button:blue|Add Sub}} creates a new external sub on the spot.
3. **Work and cost**. Describe the work and its cost. Or flip on **Itemize hours and rate**. Itemizing shows one card per line item. The work description sits up top. Then come labeled Count × Hrs each and Rate fields. The line's hours and cost are computed on the right. Tap **Fixed hrs** on a line to enter total hours directly instead of count × hours. The bar under the cards totals items, hours, and dollars. The **Labor book** section is your list of set prices for each kind of work. It fills line items from your book prices for the picked service type. {{button:blue|Save}} shows what's still missing right on the button until everything's in.

:::example Where did Distance go?
New entries no longer ask for miles — the drive-cost math simply isn't applied to them. Older entries keep their saved distance, keep paying out drive cost, and still show the field when edited.
:::

## Editing an entry

You press {{button:outline|Edit}}. It opens the same form on one page, with no steps. The same **Job** field sits at the top. The sheet's job shows as {{chip:blue|J977 · Hospital-415 Springtown Way}} with its address underneath. **change** opens the same search to move the sheet to a different job. Under the title, one line tells you which sheet you're in. It reads contractor, then total, then what's due.

- Moving a sheet to another job never touches the crew. The crew is already right. Only the job and its address change.
- Some sheets are from before the picker. They have a typed number that matches no job, or no number at all. They read {{chip:yellow|#H-2291 No job with this number}} and keep their typed **Address** box. Nothing re-links on its own. You tap **link** to attach a job.

{{button:outline|Delete}} sits alone on the left, away from {{button:blue|Save}}.

## Where the sheet stands

Every ledger row, one line in the pay list, carries the same spine as **Jobs → Subs → Work**. The spine is **Agreed**, **Paid** and **Due**, then **Where it stands**. **Where it stands** is the rail the sub sees on their portal. Four big dots are the sub's steps: **Work**, **Pre-inspection**, **Post-inspection: Trigger draw** and **Paid**. The three small dots in front are the office's agreement steps: **Drafted**, **Sent** and **Signed**. The filled terracotta dot is where the sheet is today. A **dashed red run** through the small dots means work is happening with nothing signed. Then the Due figure turns the same red.

**Next** names the office's move. The moves are *Get it in writing*, *Price it and send*, *Waiting on ‹sub›*, *Wait for "done"*, *Call it in for inspection*, *Bill and collect*, *Pay ‹sub›* and *Nothing — done*. On *Get it in writing*, {{button:blue|Draft a work order…}} opens the assembler, the work order builder, on the sheet.

**The story**: you click the rail anywhere but the current dot to open the sheet's story. It has one row per dot. Each row holds the dates, people, notes and payments behind it. It shows what the sub sees at that step, and the office's move. A move reads like *Move to Pre-inspection*, *Passed → Trigger draw* or *Set payable after…*. Beside each *The sub sees* line, **Show me on their portal ›** opens the sub's portal in a new tab. The tab is scrolled to that very part, with a copper halo around it for a few seconds. That is handy when you are on the phone with them. Your look is a preview. It is not counted as the sub opening their page. On the Signed row, **Binds under** is a door too. It reads *MSA signed …* or *no COI on file*. The MSA is the master service agreement. The COI is the sub's certificate of insurance. You click it to open the sub's Person Desk on Paperwork. There you file the COI or send the MSA. The line updates when you close the drawer. **Moving the stage**: you click the rail's current dot to pick any of the three stages. Stepping back is fine. Or you tap **→** beside the rail to advance one. The sub can move a sheet to *Pre-inspection* themselves by telling you the work is done. The rail then reads *· sub* with their note behind ✎. The job's Activity feed keeps the history. Details are in [share a sub their portal](/help/share-a-sub-their-portal). Paid sets itself once the balance is $0.

**Who the sheet is for**: a sheet is named for its subcontractor. Say teammates are on the same sheet, like *Malachi | Abraham | Behar Kraja*. Then the row reads **Behar Kraja** with a muted *with Malachi, Abraham* beneath. **Outstanding by contractor** rolls that money up under Behar. The sub is the contractor. The teammates rode along. Sheets with no sub at all keep every name. They wear the {{chip:purple|Crew pay}} tag in the rollup.

**Crew pay** sheets have no roster sub on the sheet. They wear a {{chip:purple|Crew pay}} label and pay through payroll. Any sheet with a teammate on it draws only the four sub dots. It never needs a work order. The ledger groups sheets under their sub, payable first. The chips over it filter by **Pay when**. The choices are *Ready now*, *Queued*, *Waiting on customer*, *No agreement*, *Crew pay* and *Paid*. The whole pay-run read is in [see what I still owe each sub contractor](/help/sub-labor-outstanding).

## Sending the sub a work order

Editing a sheet also shows a **Work order** box under {{chip:blue|Shown on the sub's portal}}. You tick the trade's scope. You freeze the sheet total as the price. Then you send it for the sub to sign on their portal. See *send a sub a work order from a sheet*.
