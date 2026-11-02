---
title: say whether a job is a service call or a project
category: Jobs & Scheduling
roles: dev, master_technician, assistant, controller
keywords: job kind, kind, service call, project, priced job, time and materials, T&M, new job, edit job, chip, pipeline filter, kind not set, bid, change order
where: /jobs
order: 61
---
Every job has a kind. A service call is priced by the work and billed at the end. A project is priced before it starts and moves only by change orders.

The kind is the job's own, not the customer's. A restaurant's clogged drain is a service call. A custom home's rough-in is a project.

## Read the kind

The job window shows the kind as a chip beside the job's name. {{chip:blue|Project}} is a project. {{chip:green|Service call}} is a service call. {{chip:yellow|Kind not set}} means nobody has said yet.

On the Pipeline the same chip sits on every row. On a phone it sits under the job's name.

Hover the chip to read why the job reads that way. The app reads the kind from the job's own facts until you press one.

:::example What the app reads
A job with a bid behind it reads *Project · priced $112,000 from bid B917*. A job with an HCP number and nothing else reads *Service call · priced when done*. A job with a price typed in before any work reads *Project · priced $4,200 before the work*.
:::

## Say the kind on a new job

1. Open **New Job** and fill in the job's name.
2. Find **Kind** under the job's name. The app has already pressed one side when the facts settle it. The line under the two presses says why.
3. Press {{button:blue|Service call}} or {{button:blue|Project}} if the app's pick is wrong.
4. Press {{button:blue|Create Job}}. Your press is saved with the job.

If you press nothing, the app keeps reading the job's facts. A bid linked later still moves the chip. A price typed in before any work is kept as a project when nothing else says so.

When the facts settle nothing, neither side is pressed. The line reads *No price before the work, no bid, no stages: your call.* Press the right one. You can also leave it. The job then reads {{chip:yellow|Kind not set}} until you press one on the Edit tab.

## Change the kind on a job

1. Open the job and press the **Edit** tab.
2. Find **Kind** under the job's name.
3. Press the other side. The kind saves at once, and the chip beside the name changes.

Your press wins from then on. A later import or a new bid link never changes it back.

## Clear the working jobs with no kind

The Needs You card counts the jobs working with no kind. The line reads *7 jobs working have no kind*. On Quickfill it opens **Fill them in**.

1. Open Quickfill's **Today's lines** station.
2. Read the card. The card shows the job's money and what the app read. The card also shows the clock time and the bills.
3. Press {{button:blue|Project}} or {{button:outline|Service call}}. That one press saves the kind and shows the next job.
4. Press {{button:outline|Skip}} if you are not sure. The job waits at the back of the deck.

A press you got wrong has **Undo** under the card. The hours may lean one way. A blue press is the app's lean, and the choice is still yours.

## Find the jobs with no kind

1. On the Pipeline, open the {{button:outline|⋯}} tools menu.
2. Under **Filters**, pick **Kind not set** from the kind list. The list shows how many jobs each kind holds.
3. Open each job and press its kind on the Edit tab.

Pick **Projects** or **Service calls** in the same list to see one kind alone. A chip in the search bar names the filter. Tap the chip to clear it.

## Good to know

- A job opened from a bid is a project. A job with Stage Plan rows, such as Rough In and Top Out, is a project.
- A job that only carries a GC project's bills is a project.
- An HCP number alone reads as a service call. A bid, stages or a price before the work comes first.
- A job already billed with no clock time reads from its other facts. The price may have come at billing.
- See [know when Edit Job saves my changes](/help/edit-job-autosave) for how the rest of the Edit tab saves.
