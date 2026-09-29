---
title: recover a deleted job or bid
category: Office
roles: dev
keywords: deleted, delete, recover, restore, undo, trash, archive, recently deleted, mistake, removed, gone, data loss
order: 71
---
When a job or bid is deleted, everything that went with it goes too — its invoices, payments, materials, crew, reports, tally parts. That used to be permanent. Now every deleted row is archived for **90 days**, and you can put the whole thing back.

This is dev-only, and it lives in **Settings → Data & recovery → Recently deleted**.

## Put a deleted job or bid back

1. Open **Settings → Data & recovery** and expand **Recently deleted (dev)**.
2. Find the entry. The filters above the list narrow it by type (**Job**, **Bid**, **Pay report**, **Bid rooms**, **Part of a job or bid**…), by who deleted it, or by a word in its label. Each one shows what it was (e.g. `J-1042 · Smith Remodel`), who deleted it when, count chips for everything that went with it — money records like {{chip:yellow|3 invoices}} stand out from quieter ones like {{chip:gray|12 line items}} — and the first few lines of what was inside. **What's inside?** still expands the complete contents, with the full raw record one more click down.
3. Click {{button:outline|Preview restore}}. Nothing is changed yet — this reports exactly what would come back.
4. Read the preview, then click {{button:blue|Restore}}.

:::example The preview is real, not a guess
The preview actually performs the restore and then rolls it back, so the counts it shows you are the true ones. That is also why **Restore** stays greyed out until you have previewed — you can't commit a restore you haven't looked at.
:::

## Reading the preview

**A normal preview** lists each table and how many rows would return. Restore is enabled.

**A warning** {{chip:yellow|⚠️}} means the row comes back, but with a small gap. The usual case is that something it pointed at was itself deleted later — for example the job's customer. The job returns with the customer field cleared, and you re-link it by hand. Everything else is intact.

**A blocker** {{chip:red|Cannot restore}} means it can't come back yet, and **nothing was changed**. The most common reason is that the job's leader account was deleted — a job must belong to a leader, so there is nothing valid to attach it to. Restore the account first (Settings → People & teams → Archived users), then try again.

## Things worth knowing

- **It's all-or-nothing.** A restore either brings the whole bundle back or changes nothing at all. You will never end up with half a job.
- **90 days.** Archived rows are purged after that, so recover sooner rather than later.
- **Job numbers can collide.** If someone created a replacement job reusing the old number, the restore still succeeds and warns you — you'll have two jobs with that number until you fix one.
- **If a row was recreated in the meantime**, the newer row wins: the stale archived copy is skipped and the preview says so in a warning. The rest of the bundle still comes back.
- Once restored, the entry disappears from the list.

## Deleted price options

A price option deleted from a bid's Pricing tab shows up as its own **price option** entry (e.g. `Scenario B · Bid 398`). Restoring it brings back the whole set — the price option, its price entries, custom prices, fixture assignments, and hidden rows — even though some of those pieces are listed under the bid's own "Under bid …" entry. Either entry restores the complete set; whichever you use, both clear from the list together.

## Sweep ZZ test jobs

Live passes and robot runs leave jobs whose name or customer starts with **ZZ** on the Pipeline, where the office has to scroll past them. **Settings → Data & recovery → ZZ test jobs (dev)** lists them: press {{button:outline|Check now}}, set how old a row must be (7 days by default, so a pass still in progress keeps its rows), then sweep one row or {{button:outline|Sweep all N into J…}}. Each sweep zeroes the job's total, removes its Specific Work lines, and moves its costs, hours, notes and reports into the **sink** — the one ZZ job kept on purpose, a job named **ZZ TEST sink** — through the same door as Edit Job → Delete → *Reassign to another job…*, so the swept job lands in **Recently deleted** like any other, for 90 days. The sink is found by its name (a ZZ job with the word *sink* in it; the oldest wins if there are two), never by number, so a customer's job can never be the sink. If there is none, the section says so and sweeps nothing: make one with New Job, named `ZZ TEST sink`, on the ZZ test customer.

## If it isn't in the list

The list only covers what the archive captures — jobs, bids, invoices, reports and everything that cascades from them. It also only goes back 90 days. If something is missing and it matters, stop and ask before making further changes: the underlying rows may still be recoverable from a database backup, but that gets harder the longer you wait.
