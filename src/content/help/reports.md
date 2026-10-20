---
title: file and review field reports
category: Office
roles: assistant, master_technician, primary, estimator
keywords: stage, stage progress, each line, how far along, mark each line, weighted percent, reports, job complete, status report, leave report, review, notifications
order: 20
---
Field reports turn what happened on site into something the office can act on. Techs file them in under a minute, and the office reviews them in one place.

The office can also subscribe to the report types they care about.

## Filing a report (field side)

You tap {{button:blue|Leave Report}} on the Job Mode card, or during clock-out. The **Reporting on** card pre-fills the job from your last report. It says so under the name. You tap {{button:outline|Change}} to search for a different job, project, or bid instead. You choose a report type, fill in the fields, and submit. Your location is attached automatically.

On a phone the report form opens **full screen** with {{button:blue|Save report}} pinned at the bottom. There is no scrolling to find it. If you close the form with something typed, it asks before discarding your entries. Switching report types keeps what you've typed. You can jump from Status to Note and back without losing anything. Only the fields of the type you save are submitted.

Say your scheduled time on a job ended today and you haven't filed a report in the last 12 hours. Then the Dashboard nudges you. A yellow ⚠ badge appears over that job's {{button:blue|Leave Report}} button. My Schedule shows the same note under **Today**: *"You haven't filed a report yet. File one."* Filing a report clears both.

:::example Picking a report type
Report type: &nbsp;{{button:outline-blue|Status}} &nbsp; {{button:outline|Walk}} &nbsp; {{button:outline|Note}}

How complete is the job? `100` %

{{button:outline|Cancel}} &nbsp; {{button:blue|Save report}}
:::

The most common type is the **Status Report**. It is a general progress update with "How complete is the job?" as a percentage. That percentage becomes the job's **% done** everywhere. The Jobs Pipeline progress bar and "% done" box update the moment the report saves. So do the dashboard cards and the job's activity feed. The feed gets a *N% complete — from field report* note. Reporting **100%** on a Working job also triggers the prompt below. That is how finished work flows straight into billing. See the billing guide.

The slider opens on the job's **current %**. The line under it says where that number came from. It reads *Currently 30% — move to update · crew report Aug 27*, or *· set by office*. If you leave it where it is, the report files that same number. The job's % doesn't move. If you drag it or tap a quick pick, the job follows. The line changes to *Was 30%*.

:::example After a 100%-complete report
**Move to Ready to Bill?**
☑ I have reported all the Job Parts I've used

{{button:outline|Not yet}} &nbsp; {{button:green|Move to Ready to Bill}}
:::

### On a job with more than one line

Many jobs have more than one priced line on the Bill tab. Those lines are often the stages, like **Rough In**, **Top Out** and **Trim Set**. On such a job the percent question becomes a list of the job's lines. The question reads **How far along is each line?**. You move the lines you worked on. The rest stay as they are. The first line not yet done is open when the form opens. Tap another line to open it. The open line shows four quick picks and a slider. The picks are {{button:outline|25}} {{button:outline|50}} {{button:outline|75}} {{button:outline|Done ✓}}. A line you moved shows the old number and the new one. A line whose draw is already paid reads {{chip:green|✓ Paid}} and cannot be moved. A stage set as **In order** on the Bill tab carries its number. Any other line carries a diamond.

The app works out the job's percent from the lines. Each line counts by its share of the job. The **Job** line under the list shows the job's new percent. Tap **how?** to see each line's share and points. No prices are shown. The job's percent is what the report saves as *How complete is the job?*. So the Pipeline, the Dashboard cards and the activity feed read the same number as before. The report also lists each line you moved under **Stage progress**. The office reads it on the report card.

{{button:outline-blue|Set the whole-job % instead}} brings back the plain slider. Use it when you would rather call the whole job. Jobs with one priced line never see the list. They report exactly as before. The **Additional report** window on a job's reports list asks the same way.

:::example Halfway through rough-in
Job: Underground ✓ Paid · Rough In 35% · Top Out — · Trim Set — · Water heater —. You tap **50** on Rough In. The Job line reads 32% → 38%. You set the water heater too, so you tap its line and **Done ✓**. The Job line reads 32% → 43%. Save. The office sees Rough In at 50% on the Bill tab and the job at 43% everywhere else. The report card reads *Rough In 35% → 50% · Water heater — → 100% · job 32% → 43%*.
:::

## Reviewing reports (office side)

Reports live at **Jobs → Reports**, at `/jobs?tab=reports`. The page opens on **Newest**, a feed of the latest reports. Each card shows what kind, which job, who wrote it, and the first lines. You tap a card, or **Read report ›**, to read it in full. The {{chip:blue|By job}} and {{chip:gray|By person}} chips group the same reports. Inside an open job you'll find labeled buttons: {{button:outline|Files}} {{button:outline|Pictures}} {{button:outline|Edit job}} {{button:outline|Preview}}. A button shown dashed means that link isn't set up yet. Search matches job, number, or person from any view.

Your own reports are available under **My Reports**. You can edit a report within the edit window, which is two days by default.

## Getting notified

Don't poll the Reports tab. Subscribe instead. In **Settings → Your dashboard → Report notifications**, you check the types you want and press {{button:blue|Save report notification preferences}}. You'll get a push the moment one is filed. Enable push notifications first. See Settings Basics.

## Special reports

Some reports are filed by dedicated buttons rather than the generic picker. For example, **Turnaway** reports come from {{button:amber|Turnaway — not ready / not home}} on the Job Mode card. A turnaway is a visit where the work could not be done. Those reports also alert dispatch for a trip charge. They still appear in the Reports tab like any other report.
