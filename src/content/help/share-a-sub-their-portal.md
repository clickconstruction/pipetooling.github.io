---
title: share a sub their portal
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub portal, subcontractor portal, work and pay, portal link, globe, sign to accept, work order, backcharge memo, pay run, paperwork, spanish, español, print statement, stage, inspection, work done, waiting on customer
---
Every subcontractor can have a private **Work & pay portal**, a page they open without signing in. The portal shows the sub's jobs, pay and paperwork.

On the portal a sub finds:

- Jobs, with the agreed line items.
- What's been paid, memos included.
- When the open money becomes payable.
- Open **work offers they can sign to accept**.
- The status of their paperwork on file: W-9, insurance, and their signed agreements.

The portal reads in **English or Español**. The {{button:gray|🖨 Print statement}} button turns it into a paper packet, for subs who'd rather hold it.

## Turn it on

Click the **globe icon** next to any sub's name on **People → Subs**. **The globe's colour is its state**. A **faint grey** globe means no link has ever been created. A **blue** globe means their portal is live. A **red** globe means it was turned off. The customer globe uses the same colours. So you can see at a glance who has a portal.

A sub who has never had a portal opens to **No portal link yet**. Looking creates nothing. Click {{button:blue|Create their link}} and their private link is made. A "Portal link created" message pops up to confirm it. From then on, the top of the globe's pop-up shows their **portal address**. The address looks something like `my.clickplumbing.com/dv-mechanical-k4tp`:

- The address starts as their name **plus a short random tail**. The tail stops anyone opening their pay page by guessing our short address and their company name. The 🎲 beside it rolls a new tail. The meter under it says ⚠ easy or ✓ hard to guess, **and why**. A bare company name is graded easy on purpose. Edit it until the first share.
- {{button:blue|Copy link}} saves the address and copies it. Text it to the sub.
- **Preview as them** opens exactly what they'll see.
- The {{icon:gear}} holds the **direct link** and an address changer. The changer has a {{button:outline|🎲}} that adds a random tail, so the address is hard to guess. The gear also holds **Rotate link**. Rotating stops the old direct link and makes a new one. The custom address follows to the new link. {{button:red|Turn off portal}} and the link's **history** are there too.

A red globe means the portal is turned off. Nobody can open their page until you turn it back on. Turning it back on makes a brand-new link. Blue means it's live. Faint grey means it was never created.

:::example Texting the link
"Here's your page with us — it always shows your jobs, your pay, and your paperwork: my.clickplumbing.com/dv-mechanical"
:::

## What feeds it

The portal shows work you already do, and adds no new chores:

- **Jobs & line items** come from their Sub Labor sheets.
- **Payments and backcharges** come from the payment modals, the pop-ups where you record them. A backcharge is money taken off a sub's pay. **Memos are shown to the sub**, so write them like they'll read them. The Edit Payment modal has a *hide this memo* checkbox for the rare office-internal note. The amount always shows.
- **"When do I get paid"** comes from the sheet's **stage**, described below. The answer also comes from the {{chip:blue|Shown on the sub's portal}} box in the sheet editor. That box holds a *payable after* date and a plain-words reason, like *Builder's inspection — scheduled Sep 9*. Leave those blank and the stage sentence speaks for itself.
- The company-wide **pay-run day**, the weekday we pay subs, lives at ***Settings → Jobs & billing → Sub portal · pay schedule***. So does the "How pay works here" wording.
- **Paperwork status** comes from People → Contracts. The status shows signed dates and expirations. A {{button:amber|Sign now}} button opens the same signing page your contracts use.

## "How do I get paid?" — the guide at the bottom

The very bottom of the sub's page carries a copper-edged card, ***How do I get paid? · How this page works · 2 min***. On a phone the card opens a bottom sheet, a panel that slides up from the bottom. On a desktop the card opens a dialog. The guide answers that question first, in one paragraph. Then the guide walks the four steps with the same dots the job cards use: ***Work · Pre-inspection · Post-inspection: Trigger draw · You're paid***. Each step carries the sentence the card shows at that step. Each step also has a You / Us split, saying what the sub does and what we do. On Pre-inspection the split covers punch lists, the small fixes left at the end. On Post-inspection the split covers the occasional advance. On You're paid the split says "documents current = same day it hits us, it hits you".

Below the steps come the one button, *✓ My work here is done*, and new work offers. After those come the four documents that keep a sub payable, deductions, and two *Coming soon* cards. English and Spanish follow the page's own toggle.

A job card wears a **📐 Plans** pill in its header when its Pipeline job has a plans link. The link is set in Edit Job → Files & Plans. Or the link is the bid's set in CountTooling, the app where we count from the plans. The guide points subs to the pill. A CountTooling plans link opens for the sub **without CountTooling's email prompt**. The portal signs a short-lived pass into the link that says who they are. CountTooling's access log for that view link shows their name with *via PipeTooling portal*.

## Did they look?

Every visit to a sub's page is written down. A visit by the sub counts as **outside**. So does a visit by anyone they forwarded the link to. A signed-in teammate opening the real link counts as **team**. Your own previews count as previews, and they are kept off every count. You see the visits in three places:

- **Jobs → Subs → Pay → Who's owed** has one line under the sub's name. The line reads {{chip:green|Opened their page Sep 4 · 6 times}} or {{chip:yellow|Never opened}}. The last team look sits beside it, like *Taunya looked Sep 5*. Tap or click the line, or long-press it on a phone, for the whole trail.
- **The sheet story** header's **Portal** cell reads *🌐 link open · opened Sep 4*. The team look sits under it. Click it for the trail.
- **The globe's gear** has **Opened**, **Team**, and **Trail → All visits ›**. The Opened line matches the customer globe.

The trail opens in a pop-up. Outside opens and team looks show as two tiles. There is an ***All · Outside · Team*** switch. Every visit is grouped by day, with who came and how. A visit comes by the direct link or by the short address. {{button:blue|Copy link}} and **Preview as ‹sub›** sit at the bottom. The first outside open is marked. So you can tell at a glance whether they opened it the same evening you shared it. A page with no live link reads *Link not shared yet* rather than *Never opened*.

## Sign to accept work

You can send a sub a work order offer. You send the offer from a project step's **Offer to…**, or a Sub Labor sheet's **Work order** box. The offer appears on their portal with the scope and price locked in. The sub accepts by **signing**, typed or drawn. The signature form is the same one contracts use. The form has the same quiet electronic-signature line. The form also has the same **How electronic signing works ▸** dropdown and **I agree to sign electronically** box. The whole form is in Spanish when the portal is. The Spanish covers the name box, **Escribir** / **Dibujar**, **Borrar firma** and the reminders it shows when something is missing. The sub signs under their Master Subcontract Agreement. The office inbox gets a dispatch note the moment they do. Offers can carry an expiry date. A sub who passes on an offer is asked for a quick reason, so you know how to fix it.

A work order sent from a sheet shows more on the card. The card shows anything **not included**. The card also has a collapsed **Also part of this work order** list. The list names General Conditions and the other documents by version date. General Conditions are the standard terms for the work. Before the signature button lights up, the sub ticks each **Please confirm** sentence. What they ticked is stored with the signature. Once signed, the sheet card grows a **✍ What you agreed to** line. The sub can reopen the line any time. The line shows the scope, the documents, and the boxes they ticked.

## Walk a sheet through its stages

Every sub sheet sits at one of three stages. The portal draws them as a four-dot tracker under the job: ***Work · Pre-inspection · Post-inspection: Trigger draw · You're paid***. One plain sentence says what stands between the sub and the money.

| On Sub Labor | What the sub reads |
| --- | --- |
| {{chip:yellow|Waiting on work}} | "Finish up, then tell us below and we'll come walk it." |
| {{chip:purple|Waiting on inspection}} | "You told us the work's done Sep 4. We'll call it in for inspection and let you know." |
| {{chip:blue|Waiting on customer}} | "Passed the inspection Sep 6. The customer's payment is the last thing between you and this money…" |
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
