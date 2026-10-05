---
title: send a bid for signature
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: bid room, signature, sign bid, proposal link, publish, GC signs, send bid, room link, revisions, alternates
order: 95
---
Every GC on a bid can have a **bid room**, one permanent link that always shows your current letter. The GC signs, or declines with a reason, right on that page.

The letter shows the base bid and any offered alternates as choices. An alternate is another priced option the GC can pick. The letter shows your inclusions, exclusions and terms. The Google Docs letter rides along. You revise and **publish**, and their link never changes.

## Open the room

On **Bids → Cover Letter**, a GC with no room yet has a {{button:blue|✍ Setup bid room}} button. The button sits right beside {{button:blue|Mark sent today}}. You press it and the room panel opens under the row. The link comes first. Emailing is optional:

- {{button:blue|✍ Get the link}} creates the room. Get the link also saves a copy of the current letter as **rev 1**, the first revision. Nothing is emailed. The link is copied for you. The link also shows in the panel, with {{button:gray|Copy link}} and {{button:gray|Open ↗}} beside it. You paste it into your own email, a text, or the GC's portal. Open ↗ is your own view, and never counts as the GC opening the room.
- {{button:gray|Send to GC}} emails the link from the app. The GC's contact email is pre-filled, and you can change it for each send. If you press it first, it publishes rev 1 on the way. The email is a letter on your letterhead. The subject names the trade, project, proposed amount and company. Inside are the project and address, and every option's price in a table. Yours is marked *Our recommendation*. There is a sign button, and your name, phone and email at the bottom. Replies come straight to you. The first send from the app also marks the packet sent, exactly like Mark sent today. Getting the link alone does not. You mark it sent yourself when your own email goes out.
- The **revision note** is the line the GC sees on the page, like *"per addendum 2"*.
- The **Google Docs letter link** field attaches your full letter to the room. The Docs method isn't replaced. The Docs letter rides along with the room.

:::example The estimator who emails from Outlook
Press {{button:blue|✍ Get the link}}, paste the copied link into the email you were already writing, send it, then press {{button:blue|Mark sent today}}. The room chip reads {{chip:gray|rev 1 · not sent}} — "not sent" means *not sent from the app*; it flips to {{chip:yellow|rev 1 · opened 1×}} the first time the GC opens your link.
:::

## Where you see it

Once a GC has a room, the Setup button goes away. The **✍ Bid room** panel stays in its place under Mark sent. The panel shows the room's state chip, with a {{button:gray|Manage}} button for the controls.

The room's state follows you as a chip. The chip shows on the **Send to** strip's GC groups and on the Bid Board's per-GC lines. The chip also shows on **Followup → Waiting to hear**, right beside Last contact. The chip reads {{chip:yellow|rev 2 · opened 3×}} while the room is out. The chip reads {{chip:green|✍ signed — Base bid $249,971}} when they commit, and {{chip:red|✍ declined}} when they pass. Once signed, the Cover Letter panel links straight to the signed record. Until then the panel can **Copy link**, **Open ↗**, **Email the link again** or **Close the room**. A closed room's link shows a polite withdrawn page.

## Revising

You change the bid, then press {{button:blue|Publish update}}. The room shows the new revision with your note. Nothing is withdrawn and there are no dead links. The GC's bookmark keeps working. Nothing is emailed unless you also press {{button:gray|Email link again}}. The chip on the panel tells you where things stand: {{chip:yellow|rev 2 live · opened 3×}}.

## What the GC sees

The GC sees a clean proposal page. The page shows your brand, the project, and a line like *Rev 2 · published Aug 28 — "per addendum 2"*. The options show as cards. {{chip:yellow|Proposed}} is pre-selected, with the alternates beside it. The *What's included* fixture lists are one tap away. The page shows the scope table and total for whatever they select. The page also shows your inclusions, exclusions and terms, and the letter document. Every open and every option they weigh shows up for your follow-up calls.

## Signing — and saying no

Under the document, the GC types their full name and signs it. {{button:outline|Type}} shows the name on a signature line. {{button:outline|Draw}} opens a box to sign with a finger or mouse. Then the GC checks the agreement. A quiet line above the name says approving here is an electronic signature, with the same effect as ink. The line also says a paper copy is theirs for the asking. **How electronic signing works ▸** opens the ESIGN and Texas UETA detail. ESIGN and Texas UETA are the laws on electronic signatures. Then the GC presses {{button:blue|Approve "Base bid" — $249,971.29}}. The button always names the option they selected. The signature applies to the **current revision only**. Say you publish an update while their page is open. The GC is then shown the new version instead of signing a stale number.

**When they sign**, that packet marks itself {{chip:green|Won}}. Other sent, unanswered packets go Lost. The same rule applies when you mark a win by hand. You get an email naming the option and amount. The signed record files into the Estimates **Ledger**, with a {{chip:purple|Bid ✍}} chip linking back to the bid. The record holds the name, time, IP address and chosen option.

**When they pass**, *Not moving forward? Tell us why* offers three reasons: Price, Went with another sub, or Project died. The GC can add a note. The GC's answer marks the packet Lost with that reason. The answer lands in **Why we lost**, in their own words.

## From signature to job

When the job is ready, you open the signed record in the Estimates **Ledger**. You press {{button:blue|Create job}}. If the job already exists, you press **Link existing job** instead. The job is tied to the bid automatically. **Jobs → Stages** shows {{chip:green|Signed · Bid room proposal}} on its contract chip, and opens the GC's signature. Edit job shows the bid. The **Bid Board**'s Links column gets a {{chip:green|J1234}} chip that opens the job. Assistants, leaders, controllers and devs see that chip. Estimators don't see jobs.

## Change orders, same link

Once the job is moving, change orders join the room. A change order, or CO, is a priced change to the agreed work. You draft a CO from **Bids → Change Order** as usual and add its cost lines. Then you press {{button:gray|Publish to bid room}} instead of emailing a fresh link. The CO appears in the GC's room under the signed proposal. The CO shows its cost, reason and schedule impact, and its own **Review & sign**. The GC types or draws a signature. The GC ticks *I agree to sign electronically* and the change order's own agree box. Then the GC presses **Approve**. The room chip stays amber, as {{chip:yellow|✍ signed · CO awaiting}}, until every document is answered. Each CO keeps its own signature record. Six weeks in, the GC is still using the one link they bookmarked on bid day.
