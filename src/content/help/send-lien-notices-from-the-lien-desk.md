---
title: send lien notices from the Lien desk
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien desk, lien notice, 53.056, work month, GC, subcontractor, approve, standing rule, on his word, owner of record, deadline, notice due
---
Texas counts lien deadlines from the **month the work was done**, not from the bill. On a job with a GC, every unpaid month needs its own § 53.056 notice by the 15th of the third month after it (the second month on a residential property). The **Lien desk** keeps that queue so nothing closes quietly: the office readies and drafts, the leader approves, and the notice goes out on paper.

## Where it opens

- **Dashboard → Needs you** — {{chip:red|N lien notices to draft}} for the office, {{chip:blue|Approve N lien notices the office drafted}} for the master. Both open the desk in place. Quickfill shows the same cards on a phone.
- **Jobs → Pipeline → Collections header** — the {{button:outline|⏱ Lien desk}} button beside {{button:outline|⚖ Legal}}, with the count.
- **Jobs → Pipeline → ⋯ Pipeline tools**, and the section hamburger's **Collections** group.
- A forecast row's **Send notice…** opens the desk on that job.

## The piles

Every job with a GC, money open, and an unpaid work month closing within 30 days is one row. The pills at the top are the piles:

- {{chip:yellow|Needs the owner}} — no owner of record with a mailing address is on file. The statute sends the notice to the owner, so this comes first: {{button:outline|Find the owner ›}} opens Edit Job → Property record, where the county appraisal link lives. Once it is saved, the row moves on its own.
- {{chip:gray|To draft}} — ready for the office.
- {{chip:blue|Awaiting approval}} — with the master.
- {{chip:green|Ready to send}} — approved; go out from the Lien window.
- {{chip:gray|Held}} — the master is waiting on a promise or a call; the desk asks again three days before the deadline.
- {{chip:gray|Sent · 30d}} and {{chip:red|Missed}} — the record, kept in sight.

## Drafting a notice

Pick the row. The pane shows what has to be true before it can go out, the **months this notice names** (every open month is ticked; one notice may carry several, and the earliest sets the deadline), the crew's hours behind each month, and the notice itself — the same document the Lien window prints, filled from the same job. **Send** lists who gets it (the owner of record and the GC, certified mail, with a courtesy PDF by email when the GC has one) and the optional cover note that says this is routine paper, not a claim of default.

- {{button:blue|Send for approval ▸}} sends it to the master. The footer says why it goes to him: no standing rule yet, the first notice we have ever sent this GC, they promised a payment date, or he held this GC before.
- {{button:amber|The leader said to send it ▸}} is for when he already told you in the truck: type who said it and when, pick phone, in person or text, and it goes straight to Ready to send. He sees it in his **Sent on your word** list with a *Not what I said* that pulls it back while it has not gone out.
- **Skip these months…** gives the lien right on those months up, on purpose, with a reason kept on the record.

:::example One call, one rule
Robert opens J650 in Awaiting approval: $33,500 open with Loberg Contracting, first notice we have sent them, no promise on file, June closes tomorrow. He ticks **Send notices without asking** under *Standing rule for Loberg Contracting* and clicks {{button:green|Approve & next ▸}}. From now on Loberg's months go to Ready to send by themselves; he still sees every send in his list, and a live promise always comes back to him.
:::

## The master's decisions

The desk shows him only what needs a decision: what is open with that GC, their word, the months and hours, and what a hold costs — *June's lien right ends September 15*. He can {{button:green|Approve & next}}, **Hold — they promised…** (asks again on the promise date), **Hold — I'll call first** (asks again three days before the deadline), or send it **Back to the office**.

## Sending the run

Approved notices go out together. {{button:blue|Send the run · N}} in the desk's header opens the run: one row per recipient — the owner of record and the original contractor for each notice — with the delivery method (certified mail by default; courier, hand, or a courtesy email where an address is on file) and a box for the tracking number.

1. {{button:outline|Print the packet}} — one document: a cover sheet listing every envelope with a blank for its tracking number, then each notice twice, *Copy for: Owner of record* and *Copy for: Original contractor*, with the cover note on its own page when the draft asked for it.
2. Mail them. Type the tracking numbers when you are back, or leave them for later.
3. {{button:blue|Record the run ▸}} — each notice is written to its job naming **every month it covered**, the courtesy emails go out, and the desk rows move to **Sent**. The forecast's month lines read *notice sent* the moment it saves.

:::example One notice on its own
A ready item's footer also offers **Just this one, from the Lien window ›** — the § 53.056 tab with the desk's months filled in, for a single notice you want to print or email by hand. Recording it there moves the desk row too.
:::

## Who can do what

- **Draft, send for approval, send on the leader's word, skip:** dev, assistant, controller (a master can draft and approve his own).
- **Approve, hold, set a standing rule:** dev, master technician. The database refuses an approval from anyone else, and a spoken-word send without a note.
