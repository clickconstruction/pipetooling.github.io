---
title: set a job's progress from the Pipeline board
category: Office
roles: dev, master_technician, assistant, primary
keywords: percent done, progress, pct complete, stages slider, job progress, drag slider, unbilled, value created, set percent
order: 62
---
On the **Jobs → Pipeline** board, each job has a progress percent (the "% done" on its Progress & payment bar) that drives how much value is counted as created-but-unbilled. You can set it with a slider right from the job's activity panel, or type it straight into the **% done** box on the Progress & payment column — the box is available in **every** section (Waiting, Working, Ready to Bill, Billed Awaiting Payment, Collections, and Paid). The box accepts 0–100; typing past the range snaps to the nearest end (110 saves as 100). The **Dashboard** shows the same percent as the **% Complete** column on both the **Not Billed Out** and **Accounts Receivable** cards.

## Set the progress

1. On **Jobs → Pipeline**, click a job's notes icon to expand its **Job activity / notes** panel.
2. In the action row (next to {{button:green|Schedule}} and {{button:outline|Week dispatch}}), click {{button:outline|Set % complete}}. If the job already has a percent, you'll see **N% complete** shown right there, with a small badge saying who set it — {{chip:gray|crew report Aug 27}} when the newest field report said the same number, {{chip:gray|set by office}} otherwise.
3. The **Add a note** area turns into the slider. Drag it to the progress you want — tick marks, whole percents — or type an exact number in the box.
4. Add a note in the field on the left. **A note is required for anything under 100%** (100% can be set without one). Then click {{button:blue|Set to N%}}, or {{button:outline|Cancel}} to back out.
5. Setting it saves the percent **and** posts the note to the activity feed as "**N% complete — your note**", so the change shows up in the job's history.

:::example What it affects
The percent is the **work channel** of the Progress & payment bar — the fill along the top of the bar (the thin bottom edge is the money). "Done, not billed" = the job's amount × percent done, minus what is paid or billed. On a job with stages the percent is poured down the stages by their share of the job (done stages full, the remainder on the stage the crew is on); on a plain job it fills the one segment. The words under the bar carry the number and its date — *80% Sep 3* — and hovering the bar says where it came from: *typed* (in this box), *reported* (a field report set it), or *set* (the number the job carried when percent history began). **A percent older than the crew's last clock-in is not drawn**: the bar shows *on site Fri* on the live stage and the words keep the date, because a stale number should not paint over a week of work — type a fresh one, or let a field report by stage set it. The same percent can also be captured on a field report and in the job's detail window. In the Edit job window's Billing bar, jobs with more than one line item also get small **notches where each line item's share ends** — hover a notch to see which item ends there.
:::

## When the box turns red

Once a bill has gone out on a job — it sits in **Billed Awaiting Payment** or **Collections**, or it is still in **Working** with a break-off bill already sent — a blank **% done** is a gap: the bar cannot show what is done but unbilled, and the Dashboard's **% Complete** reads empty. So the empty box wears a red outline, **% done** turns red, and one red line under it says when the first bill went out:

:::example A billed job with no percent
{{chip:red|Bill sent Sep 2 · set % done}}
:::

Type any number and it clears — **0** counts as an answer. A draft still sitting in **Ready to Bill** does not turn the box red, and **Paid** jobs never show it. People who can see the board but not edit the percent see the same red box, so the office and the field read the same thing.

## Who can change it

Only office roles (dev, leader, assistant, primary) see the **Set % complete** button — the same people who can edit the job. Everyone else sees the current percent as read-only.

Note: the same **Set % complete** flow is also available from the job's **Detail window** — the button sits in the action row next to {{button:green|Arrived}} and {{button:outline|Leaving}}, and works identically (slider + note, posted to the activity feed).
