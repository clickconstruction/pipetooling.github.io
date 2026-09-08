---
title: send a bid for signature
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: bid room, signature, sign bid, proposal link, publish, GC signs, send bid, room link, revisions, alternates
order: 95
---
Every GC on a bid can have a **bid room** — one permanent link that always shows your current letter: the base bid and any offered alternates as choices, your inclusions, exclusions and terms, and the Google Docs letter riding along. You revise and **publish**; their link never changes. The GC signs — or declines, with a reason — right on that page.

## Open the room

On **Bids → Cover Letter**, while a GC has no room yet, a {{button:blue|✍ Setup bid room}} button sits right beside {{button:blue|Mark sent today}}. Press it and the room panel opens under the row. The link comes first — emailing is optional:

- {{button:blue|✍ Get the link}} mints the room and pins the current letter as **rev 1**. Nothing is emailed. The link is copied for you and shown in the panel with {{button:gray|Copy link}} and {{button:gray|Open ↗}} beside it — paste it into your own email, a text, or the GC's portal. (Open ↗ is your own view: it never counts as the GC opening the room.)
- {{button:gray|Send to GC}} emails the link from the app — the GC's contact email is pre-filled; change it per send. Press it first and it publishes rev 1 on the way. The email is a letter on your letterhead: the subject names the trade, project, proposed amount and company; inside are the project and address, every option's price in a table with yours marked *Our recommendation*, a sign button, and your name, phone and email at the bottom — replies come straight to you. The first send from the app also stamps the packet sent, exactly like Mark sent today (getting the link alone does not — mark it sent yourself when your own email goes out).
- The **revision note** is the line the GC sees on the page — *"per addendum 2"*.
- The **Google Docs letter link** field attaches your full letter to the room; the Docs method isn't replaced, it rides along.

:::example The estimator who emails from Outlook
Press {{button:blue|✍ Get the link}}, paste the copied link into the email you were already writing, send it, then press {{button:blue|Mark sent today}}. The room chip reads {{chip:gray|rev 1 · not sent}} — "not sent" means *not sent from the app*; it flips to {{chip:yellow|rev 1 · opened 1×}} the first time the GC opens your link.
:::

## Where you see it

Once a GC has a room, the Setup button goes away and the **✍ Bid room** panel stays in its place under Mark sent, showing the room's state chip with a {{button:gray|Manage}} button for the controls.

The room's state follows you: a chip on the **Send to** strip's GC groups, on the Bid Board's per-GC lines, and on **Followup → Waiting to hear** right beside Last contact — {{chip:yellow|rev 2 · opened 3×}} while it's out, {{chip:green|✍ signed — Base bid $249,971}} when they commit, {{chip:red|✍ declined}} when they pass. Once signed, the Cover Letter panel links straight to the signed record; until then it can **Copy link**, **Open ↗**, **Email the link again** or **Close the room** (their link shows a polite withdrawn page).

## Revising

Change the bid, then press {{button:blue|Publish update}}. The room shows the new revision with your note — nothing is withdrawn, no dead links, and the GC's bookmark keeps working. Nothing is emailed unless you also press {{button:gray|Email link again}}. The chip on the panel tells you where things stand: {{chip:yellow|rev 2 live · opened 3×}}.

## What the GC sees

A clean proposal page: your brand, the project, *Rev 2 · published Aug 28 — "per addendum 2"*, the options as cards ({{chip:yellow|Proposed}} pre-selected, alternates beside it, *What's included* fixture lists one tap away), the scope table and total for whatever they select, your inclusions / exclusions / terms, and the letter document. Every open and every option they weigh shows up for your follow-up calls.

## Signing — and saying no

Under the document, the GC types their full name and signs it — {{button:outline|Type}} shows the name on a signature line, {{button:outline|Draw}} opens a box to sign with a finger or mouse — then checks the agreement (a quiet line above the name says approving here is an electronic signature with the same effect as ink and that a paper copy is theirs for the asking; **How electronic signing works ▸** opens the ESIGN / Texas UETA detail), and presses {{button:blue|Approve "Base bid" — $249,971.29}} — the button always names the option they selected. The signature applies to the **current revision only**: if you published an update while their page was open, they're shown the new version instead of signing a stale number.

**When they sign**: that packet marks itself {{chip:green|Won}} (other sent, unanswered packets go Lost — the same rule as marking a win by hand), you get an email naming the option and amount, and the signed record — name, time, IP, chosen option — files into the Estimates **Ledger** with a {{chip:purple|Bid ✍}} chip linking back to the bid.

**When they pass**: *Not moving forward? Tell us why* offers Price / Went with another sub / Project died, plus a note — their answer marks the packet Lost with that reason and lands in **Why we lost**, in their own words.

## From signature to job

When the job is ready, open the signed record in the Estimates **Ledger** and press {{button:blue|Create job}} (or **Link existing job** if the job already exists). The job is tied to the bid automatically: **Jobs → Stages** shows {{chip:green|Signed · Bid room proposal}} on its contract chip and opens the GC's signature, Edit job shows the bid, and the **Bid Board**'s Links column gets a {{chip:green|J1234}} chip that opens the job (assistants, leaders, controllers and devs — estimators don't see jobs).

## Change orders, same link

Once the job is moving, change orders join the room. Draft a CO from **Bids → Change Order** as usual, add its cost lines, and press {{button:gray|Publish to bid room}} instead of emailing a fresh link — the CO appears in the GC's room under the signed proposal, with its cost, reason, and schedule impact, and its own **Review & sign**. The room chip stays amber ({{chip:yellow|✍ signed · CO awaiting}}) until every document is answered, and each CO keeps its own signature record. Six weeks in, the GC is still using the one link they bookmarked on bid day.

