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

On a phone the report form opens **full screen** with {{button:blue|Save report}} pinned at the bottom — no scrolling to find it. If you close the form with something typed, it asks before discarding your entries.

If your scheduled time on a job ended today and you haven't filed a report in the last 12 hours, the Dashboard nudges you: a yellow ⚠ badge appears over that job's {{button:blue|Leave Report}} button, and My Schedule shows the same note under **Today** — *"You haven't filed a report yet. File one."* Filing a report clears both.

:::example Picking a report type
Report type: &nbsp;{{button:outline-blue|Status}} &nbsp; {{button:outline|Walk}} &nbsp; {{button:outline|Note}}

How complete is the job? `100` %

{{button:outline|Cancel}} &nbsp; {{button:blue|Save report}}
:::

The most common type is the **Status Report** — a general progress update with "How complete is the job?" as a percentage. Reporting **100%** on a Working job triggers the prompt below, which is how finished work flows straight into billing (see the billing guide):

:::example After a 100%-complete report
**Move to Ready to Bill?**
☑ I have reported all the Job Parts I've used

{{button:outline|Not yet}} &nbsp; {{button:green|Move to Ready to Bill}}
:::

## Reviewing reports (office side)

Reports live at **Jobs → Reports** (`/jobs?tab=reports`). You can search, and toggle between grouping **by job** and **by person**. Click any report to read it in full.

Your own reports are available under **My Reports**, and you can edit a report within the edit window (two days by default).

## Getting notified

Don't poll the Reports tab — subscribe. In **Settings → Dashboard & alerts → Report notifications**, check the types you want and {{button:blue|Save report notification preferences}}. You'll get a push the moment one is filed (enable push notifications first — see Settings Basics).

## Special reports

Some reports are filed by dedicated buttons rather than the generic picker — for example, **Turnaway** reports come from {{button:amber|Turnaway — not ready / not home}} on the Job Mode card, because they also alert dispatch for a trip charge. They still appear in the Reports tab like any other report.
