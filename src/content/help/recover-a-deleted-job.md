---
title: recover a deleted job or bid
category: Office
roles: dev
keywords: deleted, delete, recover, restore, undo, trash, archive, recently deleted, mistake, removed, gone, data loss
order: 71
---
When a job or bid is deleted, everything that went with it goes too. That used to be permanent, but now you can put the whole thing back.

Everything means its invoices, payments, materials, crew, reports and tally parts. Now every deleted row is archived for **90 days**.

This is dev-only. It lives in **Settings → Data & recovery → Recently deleted**.

## Put a deleted job or bid back

1. You open **Settings → Data & recovery** and expand ***Recently deleted (dev)***.
2. You find the entry. The filters above the list narrow it by type, by who deleted it, or by a word in its label. The types are **Job**, **Bid**, **Pay report**, **Bid rooms**, **Part of a job or bid** and more. Each entry shows what it was, like *J-1042 · Smith Remodel*. It shows who deleted it and when. It shows count chips for everything that went with it. Money records like {{chip:yellow|3 invoices}} stand out from quieter ones like {{chip:gray|12 line items}}. It shows the first few lines of what was inside. **What's inside?** still expands the complete contents. The full raw record is one more click down.
3. You click {{button:outline|Preview restore}}. Nothing is changed yet. This reports exactly what would come back.
4. You read the preview, then click {{button:blue|Restore}}.

:::example The preview is real, not a guess
The preview actually performs the restore and then rolls it back, so the counts it shows you are the true ones. That is also why **Restore** stays greyed out until you have previewed — you can't commit a restore you haven't looked at.
:::

## Reading the preview

**A normal preview** lists each table and how many rows would return. Restore is enabled.

**A warning** {{chip:yellow|⚠️}} means the row comes back, but with a small gap. The usual case is that something it pointed at was itself deleted later. The job's customer is one example. The job returns with the customer field cleared. You re-link it by hand. Everything else is intact.

**A blocker** {{chip:red|Cannot restore}} means it can't come back yet, and **nothing was changed**. The most common reason is that the job's leader account was deleted. A job must belong to a leader, so there is nothing valid to attach it to. You restore the account first, in Settings → People & teams → Archived users. Then you try again.

## Things worth knowing

- **It's all-or-nothing.** A restore either brings the whole bundle back or changes nothing at all. You will never end up with half a job.
- **90 days.** Archived rows are purged after that, so recover sooner rather than later.
- **Job numbers can collide.** Someone may have created a replacement job reusing the old number. The restore still succeeds and warns you. You'll have two jobs with that number until you fix one.
- **If a row was recreated in the meantime**, the newer row wins. The stale archived copy is skipped and the preview says so in a warning. The rest of the bundle still comes back.
- Once restored, the entry disappears from the list.

## Deleted price options

A price option deleted from a bid's Pricing tab shows up as its own **price option** entry, like *Scenario B · Bid 398*. Restoring it brings back the whole set. That is the price option, its price entries, custom prices, fixture assignments, and hidden rows. Some of those pieces are also listed under the bid's own "Under bid …" entry. Either entry restores the complete set. Whichever you use, both clear from the list together.

## Sweep ZZ test jobs

Live passes and robot runs are the automated test drives of the app. They leave jobs whose name or customer starts with **ZZ** on the Pipeline. The office has to scroll past them. ***Settings → Data & recovery → ZZ test jobs (dev)*** lists them. You press {{button:outline|Check now}}. You set how old a row must be. The default is 7 days, so a pass still in progress keeps its rows. Then you sweep one row or press {{button:outline|Sweep all N into J…}}. Each sweep zeroes the job's total and removes its Specific Work lines. It moves the job's costs, hours, notes and reports into the **sink**. The sink is the one ZZ job kept on purpose, a job named **ZZ TEST sink**. The sweep goes through the same door as Edit Job → Delete → *Reassign to another job…*. So the swept job lands in **Recently deleted** like any other, for 90 days. The sink is found by its name, never by number. It is a ZZ job with the word *sink* in it. The oldest wins if there are two. So a customer's job can never be the sink. If there is none, the section says so and sweeps nothing. You make one with New Job, named `ZZ TEST sink`, on the ZZ test customer.

## If it isn't in the list

The list only covers what the archive captures. That is jobs, bids, invoices, reports and everything that cascades from them, the rows that hang off them. It also only goes back 90 days. If something is missing and it matters, stop and ask before making further changes. The underlying rows may still be recoverable from a database backup. That gets harder the longer you wait.
