---
title: set a job's progress from the Stages board
category: Office
roles: dev, master_technician, assistant, primary
keywords: percent done, progress, pct complete, stages slider, job progress, drag slider, unbilled, value created, set percent
order: 62
---
On the **Jobs → Stages** board, each job has a progress percent (the "% done" on its Progress & payment bar) that drives how much value is counted as created-but-unbilled. You can set it with a slider right from the job's activity panel.

## Set the progress

1. On **Jobs → Stages**, click a job's notes icon to expand its **Job activity / notes** panel.
2. In the action row (next to {{button:green|Schedule}} and {{button:outline|Week dispatch}}), click {{button:outline|Set % complete}}. If the job already has a percent, you'll see **N% complete** shown right there.
3. The **Add a note** area turns into the slider. Drag it to the progress you want — tick marks, whole percents — or type an exact number in the box.
4. Add a note in the field on the left. **A note is required for anything under 100%** (100% can be set without one). Then click {{button:blue|Set to N%}}, or {{button:outline|Cancel}} to back out.
5. Setting it saves the percent **and** posts the note to the activity feed as "**N% complete — your note**", so the change shows up in the job's history.

:::example What it affects
The percent feeds the Progress & payment bar — "value created" = the job's amount × percent done, minus what's already been paid. Setting it higher moves more of the job into the unbilled total. The same percent can also be captured on a field report and in the job's detail window.
:::

## Who can change it

Only office roles (dev, master technician, assistant, primary) see the **Set % complete** button — the same people who can edit the job. Everyone else sees the current percent as read-only.

Note: this is the **Stages progress** percent. The separate "how complete is a job" mark with who/when — set from the job's Detail window — is a different field; see [[job-completeness]].
