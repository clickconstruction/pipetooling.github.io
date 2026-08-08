---
title: know when someone deletes a lot at once
category: Getting Started
roles: dev
keywords: bulk delete, deletion, alert, notice, dashboard, threshold, watch, monitor, recently deleted, security
order: 43
---
Deleted jobs, bids, customers, payroll and more are all archived and can be put back — but that only helps if someone notices. This notice watches for **bursts** of deletions and puts a red **Bulk deletion detected** card on your Dashboard, next to the other notices.

Only devs see it. **Your own deletions never trigger it** — you know what you did.

## What counts as a burst

The alert counts **things**, not rows. Deleting one job archives around twenty rows behind the scenes, so counting rows would flag every ordinary delete. One job, one bid, one customer — each counts as one *thing*.

You get a notice when one person, within the time window, deletes either:

- **5 or more things**, or
- **200 or more rows** — a second trigger that catches a single enormous deletion, like a customer that takes fifty projects with it.

:::example What you see
{{chip:red|3}} **Bulk deletion detected** — *Trace deleted 12 things (240 rows) around 2:05 PM. Everything deleted can be put back from Recently deleted.*
:::

## Deal with it

- **Review deletions** opens Settings → Data & migration with **Recently deleted** already expanded and loaded, scrolled into view. While the alert is active, the section leads with an **Active bulk-deletion alert** box carrying the same Snooze/Dismiss buttons — review, restore if needed, and clear the notice without going back to the Dashboard.
- While the alert is active, the deletions from that burst **sort to the top** with an amber stripe and an {{chip:yellow|in alert window}} tag — you land on exactly what the notice is about.
- Each deletion is labeled by what it was — a job by its number and name, a clock session by whose it was, a partial delete by the job or customer it was under — with count chips for everything that went with it (money records like invoices and payments highlighted) and the first few contents lines shown right on the card. **What's inside?** expands the complete archived rows in plain words (fixture names, payment amounts, dates), with the full raw record one more click down. Use the search box or the type / deleted-by filters to cut straight to what you're checking.
- **Snooze 24h** hides the notice for a day.
- **Dismiss until count increases** hides it until a *new* burst happens — so it stays quiet, but speaks up again if it continues.

## Change the thresholds

Settings → **Data & migration** → **Bulk-deletion alert (dev)**. You can turn it off, change how many things or rows trigger it, how tightly clustered they must be, and how far back the notice looks. Leave a box blank to use the default shown.

## Good to know

- Nobody is blocked or interrupted — this only watches and tells you.
- If someone is deleting things they shouldn't, you can freeze them immediately: see *put someone in read-only training mode*.
- Snooze and dismiss are per-device, so a dismissal on your laptop won't follow you to your phone.

## Related

- To put deleted work back, see *recover a deleted job*.
- To stop someone changing anything, see *put someone in read-only training mode*.
