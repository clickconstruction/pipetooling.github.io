---
title: see how fast a change ships
category: Getting Started
roles: dev, master_technician, assistant, controller, estimator
keywords: ship pace, how long does a change take, feature request, pull request, merge, github, turnaround, how fast, merges are taking
order: 10
---
When you ask for a change, the first question is how long it will take. This page answers it with real numbers from the last three days.

To open it:

1. Open {{icon:gear}} **Settings**.
2. Pick the **How fast a change ships** tab.

The tab sits beside [Release notes](/help/release-notes), the list of what already shipped.

## What the headline says

The first line is the answer you can say out loud. The line reads like *A change asked for today has been taking about 4 hours to reach the app.* The second sentence says where nine in ten changes land. The two numbers come from every change that merged in the last 24 hours.

Under the headline, *As of 3:37 PM* says when GitHub was last read. The app reads GitHub every 15 minutes.

## What the chart shows

Each dot is one hour of the last three days. The dot's height is the typical hours from a change's pull request opening to its merge in that hour. A pull request is the bundle of code a change ships in. A gap is an hour with no merge. Hover a dot to see that hour's merges and openings.

## The number to say out loud

Beside the chart, **Merges are taking** shows one number, like *4.2 hours*. The number is the middle of the merges in the last 6 hours. The line under it says how many merges it stands on and when the oldest of them landed. A quiet night can leave it standing on two or three merges, so read that count. Under an hour, the number shows in minutes. The small line gives the mean and where nine in ten of those merges landed.

## What landed today

Four tiles follow the chart. **Opened today** and **Merged today** count the day's pull requests. **Open now** counts the ones still waiting, with the drafts named. **In the merge queue** counts the ones in line for their final check.

## Find your change in line

A change is a pull request. The title of a pull request says what it is in plain words. The card **In line now** lists the pull requests in the merge queue. The list is the order they go live in. The top one is next. Each line says its place, how long it has waited, and about how long is left. Find your change by its title.

A change still on its checks is not in line yet. The line under the list counts those changes. The same line counts the changes nobody has asked to merge yet. The list shows the first ten. *and 4 more* means four more wait behind them.

:::example When the card says the queue was not read
The reader could not see the queue. Ask a dev to check the GitHub token's permissions.
:::

## What the number means

The hours count from the pull request opening, not from when you asked. Writing the change comes first, and that time is not in the number. The app updates a few minutes after a merge.

:::example When the page says the reader may be stuck
The as-of line turns amber when the last read is more than an hour old. Ask a dev. A dev can press **Read GitHub now** on the same page.
:::

A dev sees one more press, {{button:outline|Read GitHub now}}. The press reads GitHub at once instead of waiting for the next quarter hour.
