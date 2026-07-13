---
title: set when a bid is due, including the time of day
category: Office
roles: dev, master_technician, assistant, estimator
keywords: bid due date, due time, deadline, bid board order, new bid, edit bid
---
Every bid can carry a due date, and optionally the time of day it's due — useful when a GC wants numbers "by 2 PM Thursday."

## Set the due date and time

In the **New Bid** or **Edit Bid** modal:

1. Pick the **Bid Due Date**.
2. A {{button:outline-blue|+ Add due time}} link appears just below the date — click it and choose the time.
3. To remove the time later, click the **×** next to the time field. Clearing the date clears the time with it.

The time is optional; most bids only need the date.

## Where the time shows up

- **Bid Board** — the due-date column shows the time under the date.
- **Submission & Followup** — the bid date column includes the time.
- On a day with several bids due, the Bid Board orders them by time, earliest first; bids with no time sort after timed ones that day.

:::example a bid due at 2 PM
Due date `26/07/16` with due time `2:00 PM` sorts ahead of every untimed bid due the same day.
:::
