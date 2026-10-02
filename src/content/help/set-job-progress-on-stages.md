---
title: set a job's progress from the Pipeline board
category: Office
roles: dev, master_technician, assistant, primary
keywords: percent done, progress, pct complete, stages slider, job progress, drag slider, unbilled, value created, set percent
order: 62
---
On the Jobs → Pipeline board, each job has a progress percent. It drives how much value is counted as created but not billed.

That percent is the "% done" on the job's Progress & payment bar. You can set it with a slider right from the job's activity panel. Or type it straight into the **% done** box on the Progress & payment column. The box is available in **every** section. Those are Waiting, Working, Ready to Bill, Billed Awaiting Payment, Collections and Paid. The box accepts 0–100. Typing past the range snaps to the nearest end, so 110 saves as 100. The **Dashboard** shows the same percent as the **% Complete** column. It is on both the **Not Billed Out** and **Accounts Receivable** cards.

## Set the progress

1. On **Jobs → Pipeline**, click a job's notes icon to expand its **Job activity / notes** panel.
2. In the action row, click {{button:outline|Set % complete}}. It sits next to {{button:green|Schedule}} and {{button:outline|Week dispatch}}. If the job already has a percent, you will see **N% complete** shown right there. A small badge says who set it. It reads {{chip:gray|crew report Aug 27}} when the newest field report said the same number. It reads {{chip:gray|set by office}} otherwise.
3. The **Add a note** area turns into the slider. Drag it to the progress you want. The tick marks are whole percents. Or type an exact number in the box.
4. Add a note in the field on the left. **A note is required for anything under 100%**. 100% can be set without one. Then click {{button:blue|Set to N%}}, or {{button:outline|Cancel}} to back out.
5. Setting it saves the percent **and** posts the note to the activity feed. The feed line reads ***N% complete — your note***. So the change shows up in the job's history.

:::example What it affects
The percent is the dark **tick** on the Progress & payment bar. The blocks around it are the money: green paid, blue billed, amber done but not billed, grey not yet. "Done, not billed" = the job's amount × percent done, minus what is paid or billed. On a job with stages the tick lands inside the stage the crew is on, by each stage's share of the job; on a plain job it lands along the line items the same way. The day the percent was set sits beside the box — *80 % done · Sep 3* — and hovering it says where it came from: *typed* (in this box), *reported* (a field report set it), or *set* (the number the job carried when percent history began). **A percent older than the crew's last clock-in is drawn as a hollow tick** and its date turns amber: the crew has worked since, so type a fresh one, or let a field report by stage set it. The same percent can also be captured on a field report and in the job's detail window. On the Bill tab's money card each line item is its own block, sized by its share of the job, with the percent drawn as a marker across them — hover a block to see which item it is and where its money stands.
:::

## When the box turns red

Once a bill has gone out on a job, a blank **% done** is a gap. That means the job sits in **Billed Awaiting Payment** or **Collections**. Or it is still in **Working** with a break-off bill already sent. The bar cannot show what is done but unbilled, and the Dashboard's **% Complete** reads empty. So the empty box wears a red outline. **% done** turns red. One red line under it says when the first bill went out:

:::example A billed job with no percent
{{chip:red|Bill sent Sep 2 · set % done}}
:::

Type any number and it clears. **0** counts as an answer. A draft still sitting in **Ready to Bill** does not turn the box red. **Paid** jobs never show it. People who can see the board but not edit the percent see the same red box. So the office and the field read the same thing.

## Who can change it

Only office roles see the **Set % complete** button. Those are dev, leader, assistant and primary, the same people who can edit the job. Everyone else sees the current percent as read-only.

Note: the same **Set % complete** flow is also available from the job's **Detail window**. The button sits in the action row next to {{button:green|Arrived}} and {{button:outline|Leaving}}. It works identically: slider and note, posted to the activity feed.
