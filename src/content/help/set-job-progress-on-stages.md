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
2. At the top of that panel you'll see **% complete: N%**. Click {{button:outline|Set % complete}}.
3. Drag the slider to the progress you want. It has tick marks and snaps to whole percents; you can also type an exact number in the box.
4. Once you move it, {{button:blue|Set to N%}} and a Cancel button appear. Click **Set to N%** to save, or {{button:outline|Cancel}} to leave it unchanged.

:::example What it affects
The percent feeds the Progress & payment bar — "value created" = the job's amount × percent done, minus what's already been paid. Setting it higher moves more of the job into the unbilled total.
:::

## Who can change it

Only office roles (dev, master technician, assistant, primary) see the **Set % complete** button — the same people who can edit the job. Everyone else sees the current percent as read-only.

Note: this is the **Stages progress** percent. The separate "how complete is a job" mark with who/when — set from the job's Detail window — is a different field; see [[job-completeness]].
