---
title: record an inspection on the schedule
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: gc mode, schedule, inspection, passed, failed, re-inspection, rough-in, final inspection, gantt
order: 106
---
Inspections sit on a GC job's schedule as bars of their own. When one passes or fails, record it on its bar. A failure moves the inspection and the work that waits on it.

The office and estimators can open the schedule. Superintendents get it later.

## Find the inspection

1. Open [GC projects](/gc).
2. Press {{button:outline|Schedule}} on the project's card.
3. Press **Open all** so every bar shows.
4. Press the inspection's bar.

The bar's form opens below the chart. The inspection's buttons sit at the bottom of the form.

## It passed

Press {{button:blue|It passed today}}. A date to meet with the same name is met that day too.

## It failed

1. Press **It failed**.
2. Write what failed.
3. Tick whose work it was.
4. Pick a re-inspection day after today.
5. Press {{button:blue|Record the failure}}.

The inspection moves to the re-inspection day and keeps its length. The work that waits on it moves out. Each wait keeps its gap, and finished work stays put.

## When someone saved first

Someone else may change the schedule while you write. Then nothing is saved, and the form says what they changed. Your words stay in the form. Press {{button:blue|Record the failure}} again to save it on the new dates.
