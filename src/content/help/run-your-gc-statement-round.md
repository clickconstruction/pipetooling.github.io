---
title: run your weekly GC statement round
category: Office
roles: dev, master_technician, assistant, controller
keywords: gc statement, round, certify, sent it, mark sent, text, call, note, send history, personal email, outstanding, weekly, sender, gc review, sign off, email me my round, morning email, dashboard, needs you, send from the app, sender card, as they see it, reassign, undo, spoke with them, contacted, temperature, hot, warm, cool, cold, temperature board, pays by, account man
---
Every GC that owes **$10,000 or more** joins the weekly **statement round**: a to-do for one person to email that GC their outstanding statement — personally, from their own inbox. The app never emails a GC on its own. Two gates keep it honest: a manager **certifies** each GC's numbers first, and the sender marks **Sent it** so the app knows it happened.

## The two Pipeline cards

On **Jobs → Pipeline**, Today's Money Opportunities shows the round's two stages:

:::example Before certification (managers)
🔏 **5 statement rounds wait on sign-off — $154,166** — certify each GC and their statement lands in the sender's round. {{button:outline|Certify in GC Review}}
:::

:::example After certification (the sender)
📬 **Your statement round — 3 GCs, $103,450** — certified and ready · a personal email from you, not the system. {{button:blue|Start round →}}
:::

The 🔏 card shows to certifying roles while anything waits on sign-off; the 📬 card shows only to you, only for GCs assigned to you that are certified and unsent.

## Certifying and assigning

Open **GC Review** (the Billed Awaiting Payment section tools). The **Weekly statement rounds** panel lists every qualifying GC with its amount, its sender, and where it stands:

- {{chip:yellow|certify to release}} — certify this GC (the {{button:blue|Certify}} button on its group) and it moves into its sender's round. A group that **changes after sign-off** drops back here.
- {{chip:blue|in Malachi's round}} — released, waiting on the sender.
- {{chip:green|sent ✓ Thu by Malachi · text}} — done for the week, with how it went out. Hover for the note.
- **needs a sender** — nobody is set. Click **assign** to pick one; the assignment sticks week to week. Unassigned GCs default to the Account Man on their jobs.

## See a round the way its sender sees it

Click any chip in the panel — {{chip:blue|in Malachi's round}}, a sent chip, a held one — or the **Malachi 0/2 sent** tally in the panel header. A card opens with **Malachi's round this week**: his GCs in the order Start round walks them, each with its state (ready · held, changed since certified · sent Wed · email), then how he's being prompted — whether his Dashboard row is showing, his round email schedule (or "not subscribed", with a link to set it up for him), and the last time he marked a statement sent. From the card you can {{button:outline|Preview Malachi's email}} (the round email exactly as it would land in his inbox right now), **reassign** a GC, or **undo** a mark. Nothing on the card sends or marks anything as him — that stays his.

:::example When a chip says "needs a sender"
Clicking it opens the assign picker instead, since there's no round to show yet.
:::

## Working your round

{{button:blue|Start round →}} walks your GCs one at a time. For each:

1. {{button:outline|Preview statement}} — see exactly what the GC will see.
2. {{button:outline|Copy for email}} — copies the statement as a real table. Paste it into your own Gmail or Outlook, add a personal line on top, and send from your own address. Or {{button:outline|Send from the app…}} — the Draft Message dialog opens for that GC, the app sends it, and the GC is marked sent for you the moment it goes out.
3. {{button:blue|Sent it ✓}} — tells the app it went out. A short form opens: pick **how** ({{chip:blue|Email}} {{chip:gray|Text}} {{chip:gray|Call}} {{chip:gray|In person}} {{chip:gray|Other}}) and add an optional note, then {{button:blue|Save mark}}. This counts as a statement sent everywhere the app keeps score — the GC's last-sent pill, the GC Review progress strip, the Dashboard's Wednesday "GC review is due" card and its badge, and your morning round email — exactly as if the app had sent it.
4. **Skip** defers that GC for the week.

## Where your round finds you

You don't have to go looking for it:

- **Dashboard.** While anything in your round is certified and waiting, the Needs you card shows {{chip:blue|2 GCs are waiting on your statement}} with a {{button:blue|Start round}} button that opens GC Review right on your first GC.
- **Email.** In GC Review's Weekly statement rounds panel, tap {{button:outline|Email me my round…}}, pick the weekday mornings you send (Mon–Fri chips) and a time, and {{button:blue|Save}}. Each morning you'll get your round as it stands at send time, written as **your account**: the standard up top (a GC should never be surprised by what they owe us — until you mark a statement sent, that's yours to fix), then one card per GC with the pressure visible — oldest bill, dollars over 90 days, the AP contact, your last statement date, the last word anyone wrote down and its temperature, a pay date if they gave one — three steps to do today, a {{button:blue|Send Knight their statement →}} button that opens the round on that GC, and a Friday deadline. GCs still waiting on certification are parked as "coming back to you"; your week and your book close it out. {{button:outline|Preview}} shows today's email; {{button:outline|Email me a test}} sends a [TEST] copy. It lists under {{icon:gear}} **Settings → Your account → My email schedule** with your other emails, and **Edit** / **Stop emailing** live in the same panel. A manager can set it up for another sender from the picker below it.

:::example Nothing waiting?
The email still comes, saying so — a quiet morning shouldn't look like a broken subscription.
:::

## Spoke with them, but no statement went out?

Sometimes the right move this week is a conversation, not another statement. Press {{button:blue|Sent it ✓}} (or **Share → Mark sent / spoke with them…** on any GC) and pick **Spoke with them · no statement**. The form asks how (call, text, in person), then the question that matters: **What's their temperature?**

- Pick one: {{chip:green|Hot · pay date in hand}} {{chip:yellow|Warm · fine, no date}} {{chip:blue|Cool · dodging the date}} {{chip:red|Cold · disputing or upset}}
- Then answer in a sentence — "Warm, Dave says the check run is the 10th" — not a word. The app won't save a blank or a one-worder; the sentence is the whole point.
- If they gave a date, put it in **They expect to pay by**.

:::example What it counts as
A "spoke with them" mark clears the GC from your round for the week and shows on the chip as {{chip:green|spoke Thu · call · warm}}. It never counts as a statement sent: the last-statement date keeps aging, and the office's "sent" count doesn't move.
:::

**The guardrail.** Talk to a GC two weeks running with no statement in between and the chip turns red — {{chip:red|⚠ spoke 2 wks running · no statement since Aug 11}}. Conversations are fine; a GC that never sees a written statement is exactly the surprise the standard exists to prevent.

## Where the temperature shows up

- On the GC's header in GC Review: {{chip:yellow|warm · Thu · Malachi}} with the sentence on hover, next to the last-statement date, and a green **pays by** chip when a date was given.
- On the rounds chip, the sender card, and the send history (a Temp column).
- In your morning round email, under each GC, as the last word.
- On the **Payment chase** list, which now puts cold GCs first.

## Review it: the Temperature board

Under Weekly statement rounds, the **Temperature board** lists every GC in the round, cold first: the account man, the current read, six weeks of dots (grey = nobody talked to them that week), the last word with who said it, and the pay date. Three things to look for: who is going cold, whose dots are drifting the wrong way, and the **no read** rows — GCs that have only ever had statements and nobody has written a word about. Click a GC's name for its full send history.

## Sent it another way? Mark it from the GC

Not every statement goes out in the round, or by email. If you texted a GC their statement, walked one over, or talked it through on a call, record it from the GC's group header: **Share → Mark sent…**. The same form opens (Text is preselected), and the mark counts everywhere a send counts — the last-sent pill, the week's progress, the Dashboard nudges. It works for any GC, including ones under $10,000 that never join a round.

:::example What gets kept
Every mark keeps **who** marked it, **when**, **how** it went out, and the **note** — for posterity. One mark per GC per week; marking again in the same week replaces that week's mark.
:::

## Seeing what was sent before

The **last sent Aug 27** pill on each GC's header names the channel when this week's mark is what it shows ("Sent Sep 4 · text"). Click it for the GC's **send history**: every mark on record, newest first — date, how, who, and the note. App-sent statement emails are noted at the bottom.

## Good to know

- Nothing is ever emailed uncertified, and nothing is emailed by the system at all — a person always sends.
- The per-sender tallies in the panel header ("Malachi 2/3 sent") are how you see Friday afternoon who still owes sends.
- Each GC row carries its portal globe; **Share → Copy portal link** and the Draft Message's portal card point the GC at their live statement with Pay online.
- The **Draft Message** dialog and scheduled sends still exist for the GCs where an app-sent statement is fine. Three things count as "that GC got their statement this week": {{button:blue|Sent it ✓}} (or **Share → Mark sent…**), **Send from the app…** / **Draft Message**, and a scheduled send addressed to that one GC. Two things never do: **Spoke with them · no statement**, and the office's own "All GCs" whole-report copies — those are for you, not the GC. The Dashboard card turns green only when every GC over the line is certified and sent one of the three ways.
