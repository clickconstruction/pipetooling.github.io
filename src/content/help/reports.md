---
title: file and review field reports
category: Office
roles: assistant, master_technician, primary, estimator
keywords: reports, job complete, status report, leave report, review, notifications
order: 20
---
Field reports are how what happened on site becomes something the office can act on. Techs file them in under a minute; the office reviews them in one place and can subscribe to the types they care about.

## Filing a report (field side)

Tap {{button:blue|Leave Report}} — on the Job Mode card, or during clock-out. The **Reporting on** card pre-fills the job from your last report (it says so under the name) — tap {{button:outline|Change}} to search for a different job, project, or bid instead. Choose a report type, fill in the fields, and submit. Your location is attached automatically.

On a phone the report form opens **full screen** with {{button:blue|Save report}} pinned at the bottom — no scrolling to find it. If you close the form with something typed, it asks before discarding your entries. Switching report types keeps what you've typed — jump from Status to Note and back without losing anything; only the fields of the type you save are submitted.

If your scheduled time on a job ended today and you haven't filed a report in the last 12 hours, the Dashboard nudges you: a yellow ⚠ badge appears over that job's {{button:blue|Leave Report}} button, and My Schedule shows the same note under **Today** — *"You haven't filed a report yet. File one."* Filing a report clears both.

:::example Picking a report type
Report type: &nbsp;{{button:outline-blue|Status}} &nbsp; {{button:outline|Walk}} &nbsp; {{button:outline|Note}}

How complete is the job? `100` %

{{button:outline|Cancel}} &nbsp; {{button:blue|Save report}}
:::

The most common type is the **Status Report** — a general progress update with "How complete is the job?" as a percentage. That percentage becomes the job's **% done** everywhere: the Jobs Pipeline progress bar and "% done" box, the dashboard cards, and the job's activity feed (a "N% complete — from field report" note) all update the moment the report saves. Reporting **100%** on a Working job also triggers the prompt below, which is how finished work flows straight into billing (see the billing guide):

The slider opens on the job's **current %**, and the line under it says where that number came from — *Currently 30% — move to update · crew report Aug 27*, or *· set by office*. Leave it where it is and the report files that same number, so the job's % doesn't move; drag it or tap a quick pick and the job follows (the line changes to *Was 30%*).

:::example After a 100%-complete report
**Move to Ready to Bill?**
☑ I have reported all the Job Parts I've used

{{button:outline|Not yet}} &nbsp; {{button:green|Move to Ready to Bill}}
:::

## Reviewing reports (office side)

Reports live at **Jobs → Reports** (`/jobs?tab=reports`). The page opens on **Newest** — a feed of the latest reports, each card showing what kind, which job, who wrote it, and the first lines; tap a card (or **Read report ›**) to read it in full. The {{chip:blue|By job}} and {{chip:gray|By person}} chips group the same reports, and inside an open job you'll find labeled buttons — {{button:outline|Files}} {{button:outline|Pictures}} {{button:outline|Edit job}} {{button:outline|Preview}} (a button shown dashed means that link isn't set up yet). Search matches job, number, or person from any view.

Your own reports are available under **My Reports**, and you can edit a report within the edit window (two days by default).

## Getting notified

Don't poll the Reports tab — subscribe. In **Settings → Your dashboard → Report notifications**, check the types you want and {{button:blue|Save report notification preferences}}. You'll get a push the moment one is filed (enable push notifications first — see Settings Basics).

## Special reports

Some reports are filed by dedicated buttons rather than the generic picker — for example, **Turnaway** reports come from {{button:amber|Turnaway — not ready / not home}} on the Job Mode card, because they also alert dispatch for a trip charge. They still appear in the Reports tab like any other report.
