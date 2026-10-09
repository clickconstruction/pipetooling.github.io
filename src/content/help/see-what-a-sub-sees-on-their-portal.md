---
title: see what a sub sees on their portal
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub portal, subcontractor portal, work and pay, what the sub sees, how do i get paid, backcharge memo, pay run, paperwork, plans, stage, inspection, work done, waiting on customer, queued, window, pick a start day, days off, progress, percent
---
A sub's portal shows their jobs, their pay and their paperwork. Each job card says in one sentence what stands between them and the money.

## What feeds it

The portal shows work you already do, and adds no new chores:

- **Jobs & line items** come from their Sub Labor sheets.
- **Payments and backcharges** come from the payment modals, the pop-ups where you record them. A backcharge is money taken off a sub's pay. **Memos are shown to the sub**, so write them like they'll read them. The Edit Payment modal has a *hide this memo* checkbox for the rare office-internal note. The amount always shows.
- **"When do I get paid"** comes from the sheet's **stage**, described below. The answer also comes from the {{chip:blue|Shown on the sub's portal}} box in the sheet editor. That box holds a *payable after* date and a plain-words reason, like *Builder's inspection — scheduled Sep 9*. Leave those blank and the stage sentence speaks for itself.
- The company-wide **pay-run day**, the weekday we pay subs, lives at ***Settings → Jobs & billing → Sub portal · pay schedule***. So does the "How pay works here" wording.
- **Paperwork status** comes from People → Contracts. The status shows signed dates and expirations. A {{button:amber|Sign now}} button opens the same signing page your contracts use.

## "How do I get paid?" — the guide at the bottom

The very bottom of the sub's page carries a copper-edged card, ***How do I get paid? · How this page works · 2 min***. On a phone the card opens a bottom sheet, a panel that slides up from the bottom. On a desktop the card opens a dialog. The guide answers that question first, in one paragraph. Then the guide walks the four steps with the same dots the job cards use: ***Work · Pre-inspection · Post-inspection: Trigger draw · You're paid***. Each step carries the sentence the job card shows at that step. Each step also has a You / Us split, saying what the sub does and what we do. On Pre-inspection the split covers punch lists, the small fixes left at the end. On Post-inspection the split covers the occasional advance. On You're paid the split says "documents current = same day it hits us, it hits you".

Below the steps come the one button, *✓ My work here is done*, and new work offers. After those come the four documents that keep a sub payable, deductions, and two *Coming soon* cards. English and Spanish follow the page's own toggle.

A job card wears a **📐 Plans** pill in its header when its Pipeline job has a plans link. The link is set in Edit Job → Files & Plans. Or the link is the bid's set in CountTooling, the app where we count from the plans. The guide points subs to the pill. A CountTooling plans link opens for the sub **without CountTooling's email prompt**. The portal signs a short-lived pass into the link that says who they are. CountTooling's access log for that view link shows their name with *via PipeTooling portal*.

## Walk a sheet through its stages

Every sub sheet sits at one of three stages. The portal draws them as a four-dot tracker under the job: ***Work · Pre-inspection · Post-inspection: Trigger draw · You're paid***. One plain sentence says what stands between the sub and the money.

| On Sub Labor | What the sub reads |
| --- | --- |
| {{chip:yellow|Waiting on work}} | "Finish the work, so we can call it in for inspection." |
| {{chip:purple|Waiting on inspection}} | *"You told us the work's done Sep 4. We've called it in for inspection — a short punch list may come first."* |
| {{chip:blue|Waiting on customer}} | *"Passed inspection Sep 6. Draw requested from the customer — their payment is the last thing between you and this money…"* |
| {{chip:blue|Waiting on customer}} + a *payable after* date | The fourth dot lights with a green {{chip:green|Queued for Friday}} chip: *"Queued for the pay run — the date is right below."* |
| {{chip:green|Paid}} | The card leaves *Your jobs*. Paid sets itself when the balance hits $0. |

Move a sheet from the **Where it stands** rail on **Jobs → Subs → Pay**. The **→** beside the rail advances one stage. Clicking the rail's current dot opens all three, so you can jump or step back. The same control sits in the sheet editor's *Shown on the sub's portal* box.

:::example The sub tells you first
While a sheet is *Waiting on work*, the sub sees {{button:green|✓ My work here is done}} on that job. Pressing it (with an optional note — "Cleanout is behind the water heater — gate code 4471") moves the sheet to *Waiting on inspection* by itself. You'll see **Ready to walk — Danny Vasquez · 1004 162 Forest Drive** in the dispatch inbox, and the chip on Sub Labor reads *Waiting on inspection · sub* with their note behind ✎.
:::

**A sheet moves itself when the facts do.** The sub may report **100%** from the portal. Or the signed work order's last day may pass. Either way, the rail shows {{chip:purple|Waiting on inspection}} on its own, with a small ***· auto*** mark. Nobody has to click. If you move it back to *Waiting on work* by hand after that, your call stays. *Waiting on customer* is still yours to set once the inspection passes.

Every move, yours or the sub's, writes a **Sub labor** line on the job's Activity feed. The line says who moved the sheet, from what to what, and the note. So the history is always on the job.

## What they see when an offer has a window

A work order drafted from a stage reaches the portal with the window drawn as a calendar. A window is the span of days you want the work done in. The guide *set a window for a sub's stage* covers it. The sub taps a start day. The job's working days fill to the end. Signing carries the pick. You get a dispatch line, like *Behar picked Sep 22 → Sep 23 for #1004 · Top-out*. The Subs → Work row reads *picked Sep 22 – Sep 23 by the sub*. The sub can move the dates inside the window until the day before the start. After that the card tells them to call.

## Their days off

Subs mark days off on the portal's **Your days**. Those days show as stripes on their lane on **Projects → Forecast → Subs**. A booking over one of those days gets the red outline. The days also show hatched, shaded with lines, on their row on **Schedule → Dispatch → People → Subs**. If a sub marks off a day their pick already covers, a dispatch line says so. Move the window or call them.

## How far along they say they are

A sub can report 25, 50 or 75 percent from the job card, with a note. Each report is a **Sub progress** line on the job's Activity feed. A note also lands in the dispatch inbox. A bare percent never does. You see the percent beside their name on **Jobs → Subs → Work** and on the sheet story's Work row. A 100% report is the same "my work here is done" as before, and moves the sheet to Pre-inspection.

## More on the portal

- The link, the address and whether they have looked are in [share a sub their portal](/help/share-a-sub-their-portal).
- How a sub signs to accept work is in [assemble a sub work order](/help/assemble-a-sub-work-order#sign-to-accept-work).
