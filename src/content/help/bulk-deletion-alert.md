---
title: know when someone deletes a lot at once
category: Getting Started
roles: dev
keywords: bulk delete, deletion, alert, notice, dashboard, threshold, watch, monitor, recently deleted, security
order: 43
---
Deleted jobs, bids, customers and payroll are archived, and you can put them back. This notice tells a dev when someone deletes a lot at once.

That only helps if someone notices. The notice watches for **bursts** of deletions. A burst is many deletions in a short time. It puts a red **Bulk deletion detected** card on your Dashboard, next to the other notices.

Only devs see it. **Your own deletions never trigger it.** You know what you did.

## What counts as a burst

The alert counts **records**, not rows. Deleting one job archives around twenty rows behind the scenes. Counting rows would flag every ordinary delete. One job, one bid or one customer each counts as one *record*.

You get a notice when one person, within the time window, deletes either:

- **5 or more records**, or
- **200 or more rows**. This second trigger catches a single enormous deletion, like a customer that takes fifty projects with it.

:::example What you see
{{chip:red|1}} **Bulk deletion detected** — *Trace — 12 records · Tue 7/14, 2:05 PM (today)*
:::

Each burst gets its own line. The line says who, how many records, and when. With several bursts the title carries the running totals. It reads *· 2 bursts · 26 records · 2 people*. Hover a record count to see the row count under it. Everything deleted can be put back from Recently deleted.

## Deal with it

- **Review deletions** opens Settings → Data & recovery. **Recently deleted** is already expanded, loaded and scrolled into view. While the alert is active, the section leads with an **Active bulk-deletion alert** box. The box carries the same Snooze and Dismiss buttons. So you review, restore if needed, and clear the notice without going back to the Dashboard.
- While the alert is active, the deletions from that burst **group under an amber burst header**. The header says who, when, and how many. Each card gets an amber stripe and an {{chip:yellow|in alert window}} tag. So you review one burst at a time. Anything older sits below under "Outside the active alert windows".
- Every card describes itself in plain words. A clock session shows whose it was, the hours, the note, and its approval state. Each card also carries **warning chips** for what deserves a second look. {{chip:red|$4,520 in invoices}} means money was removed. {{chip:red|created 4h before deletion}} marks a short-lived record. For erased history the chip reads "existed 4 months" instead. {{chip:red|approved session deleted}} marks an approved clock session. {{chip:blue|belonged to Paige}} means someone deleted a record that was not theirs.
- Each deletion is labeled by what it was. A job shows its number and name. A clock session shows whose it was. A partial delete shows the job or customer it was under. Count chips list everything that went with it. Money records like invoices and payments are highlighted. The first few contents lines show right on the card. **What's inside?** expands the complete archived rows in plain words, like fixture names, payment amounts and dates. The full raw record is one more click down. Use the search box to cut straight to what you're checking. The type and deleted-by filters narrow the list the same way.
- **Snooze 24h** hides the notice for a day.
- **Dismiss until count increases** hides it until a *new* burst happens. So it stays quiet, but speaks up again if it continues.

## Change the thresholds

Open Settings → **Data & recovery** → *Bulk-deletion alert (dev)*. You can turn it off. You can change how many records or rows trigger it. You can change how tightly clustered they must be. You can change how far back the notice looks. Leave a box blank to use the default shown.

## Good to know

- Nobody is blocked or interrupted. This only watches and tells you.
- If someone is deleting things they shouldn't, you can freeze them immediately. See *put someone in read-only training mode*.
- Snooze and dismiss are per-device. A dismissal on your laptop won't follow you to your phone.

## Related

- To put deleted work back, see *recover a deleted job*.
- To stop someone changing anything, see *put someone in read-only training mode*.
