---
title: share a sub their portal
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub portal, subcontractor portal, work and pay, portal link, globe, sign to accept, work order, backcharge memo, pay run, paperwork, spanish, español, print statement, stage, inspection, work done, waiting on customer
---
Every subcontractor can have a private, no-login **Work & pay portal**: their jobs with the agreed line items, what's been paid (memos included), when the open money becomes payable, open **work offers they can sign to accept**, and the status of their paperwork on file — W-9, insurance, and their signed agreements. It reads in **English or Español**, and the {{button:gray|🖨 Print statement}} button turns it into a paper packet for subs who'd rather hold it.

## Turn it on

Click the **globe icon** next to any sub's name on **People → Subs**. **Its colour is its state**: a **faint grey** globe means no link has ever been created, **blue** means their portal is live, **red** means it was turned off — the same colours as the customer globe, so you can see at a glance who has a portal. A sub who has never had a portal opens to **No portal link yet** — looking creates nothing; click {{button:blue|Create their link}} and their private link is minted (a "Portal link created" toast confirms it). From then on the top of the modal is their **portal address**, something like `my.clickplumbing.com/dv-mechanical-k4tp`:

- The address starts as their name **plus a short random tail**, so nobody opens their pay page by guessing our short address and their company name; the 🎲 beside it rolls a new tail, and the meter under it says ⚠ easy or ✓ hard to guess **and why** (a bare company name is graded easy on purpose). Edit it until the first share.
- {{button:blue|Copy link}} saves the address and copies it — text it to the sub.
- **Preview as them** opens exactly what they'll see.
- The {{icon:gear}} holds the **direct link**, an address changer (with a {{button:outline|🎲}} random tail for guess-proofing), **Rotate link** and {{button:red|Turn off portal}}, and the link's **history**.

A red globe means the portal is turned off — nobody can open their page until you turn it back on (which mints a brand-new link). Blue means it's live; faint grey means it was never created.

:::example Texting the link
"Here's your page with us — it always shows your jobs, your pay, and your paperwork: my.clickplumbing.com/dv-mechanical"
:::

## What feeds it

The portal is a window onto work you already do — it adds no new chores:

- **Jobs & line items** come from their Sub Labor sheets.
- **Payments and backcharges** come from the payment modals. **Memos are shown to the sub**, so write them like they'll read them; the Edit Payment modal has a *hide this memo* checkbox for the rare office-internal note (the amount always shows).
- **"When do I get paid"** comes from the sheet's **stage** (below) plus the {{chip:blue|Shown on the sub's portal}} box in the sheet editor — a *payable after* date and a plain-words reason ("Builder's inspection — scheduled Sep 9"). Leave those blank and the stage sentence speaks for itself.
- The company-wide **pay-run day** and the "How pay works here" wording live at **Settings → Jobs & billing → Sub portal · pay schedule**.
- **Paperwork status** comes from People → Contracts — signed dates, expirations, and a {{button:amber|Sign now}} button that opens the same signing page your contracts use.

## "How do I get paid?" — the guide at the bottom

The very bottom of the sub's page carries a copper-edged card, **How do I get paid? · How this page works · 2 min**. It opens a bottom sheet on a phone (a dialog on a desktop) that answers that question first, in one paragraph, then walks the four steps with the same dots the job cards use — **Work · Pre-inspection · Post-inspection: Trigger draw · You're paid** — each with the sentence the card shows at that step and a You / Us split (punch lists on Pre-inspection, the occasional advance on Post-inspection, "documents current = same day it hits us, it hits you" on You're paid). Below that: the one button, new work offers, the four documents that keep a sub payable, deductions, and two *Coming soon* cards. English and Spanish follow the page's own toggle. A job card whose Pipeline job has a plans link (Edit Job → Files & Plans, or the bid's CountTooling set) wears a **📐 Plans** pill in its header; the guide points subs to it. A CountTooling plans link opens for the sub **without CountTooling's email prompt**: the portal signs a short-lived pass into the link that says who they are, and CountTooling's access log for that view link shows their name with *via PipeTooling portal*.

## Did they look?

Every visit to a sub's page is written down — the sub (or whoever they forwarded the link to) as **outside**, a signed-in teammate opening the real link as **team**, and your own previews as previews, which are kept off every count. You see it in three places:

- **Jobs → Subs → Pay → Who's owed**: one line under the sub's name — {{chip:green|Opened their page Sep 4 · 6 times}} or {{chip:yellow|Never opened}}, with the last team look beside it (*Taunya looked Sep 5*). Tap or click the line, or long-press it on a phone, for the whole trail.
- **The sheet story** header's **Portal** cell reads *🌐 link open · opened Sep 4*, with the team look under it; click it for the trail.
- **The globe's gear** has **Opened** (matching the customer globe), **Team**, and **Trail → All visits ›**.

The trail is a modal: outside opens and team looks as two tiles, an **All · Outside · Team** switch, every visit grouped by day with who and how they arrived (direct link or short address), and {{button:blue|Copy link}} / **Preview as ‹sub›** at the bottom. The first outside open is marked, so "they opened it the same evening I shared it" is one glance. A page with no live link reads *Link not shared yet* rather than *Never opened*.

## Sign to accept work

When you send a sub a work order offer (from a project step's **Offer to…**, or a Sub Labor sheet's **Work order** box), it appears on their portal with the frozen scope and price. They accept by **signing** — typed or drawn, the same signature form as contracts — under their Master Subcontract Agreement, and the office inbox gets a dispatch note the moment they do. Offers can carry an expiry date; a passed offer asks for a quick reason so you know how to fix it.

A work order sent from a sheet shows more on the card: anything **not included**, and a collapsed **Also part of this work order** list naming General Conditions and the other documents by version date. Before the signature button lights up the sub ticks each **Please confirm** sentence; what they ticked is stored with the signature. Once signed, the sheet card grows a **✍ What you agreed to** line the sub can reopen any time — the scope, the documents, and the boxes they ticked.

## Walk a sheet through its stages

Every sub sheet sits at one of three stages, and the portal draws them as a four-dot tracker under the job — **Work · Pre-inspection · Post-inspection: Trigger draw · You're paid** — with one plain sentence saying what stands between the sub and the money.

| On Sub Labor | What the sub reads |
| --- | --- |
| {{chip:yellow|Waiting on work}} | "Finish up, then tell us below and we'll come walk it." |
| {{chip:purple|Waiting on inspection}} | "You told us the work's done Sep 4. We'll call it in for inspection and let you know." |
| {{chip:blue|Waiting on customer}} | "Passed the inspection Sep 6. The customer's payment is the last thing between you and this money…" |
| {{chip:blue|Waiting on customer}} + a *payable after* date | The fourth dot lights with a green {{chip:green|Queued for Friday}} chip: "Queued for the pay run — the date is right below." |
| {{chip:green|Paid}} | The card leaves *Your jobs* — Paid sets itself when the balance hits $0. |

Move a sheet from the **Where it stands** rail on **Jobs → Subs → Pay**: the **→** beside the rail advances one stage, and clicking the rail's current dot opens all three so you can jump or step back. The same control sits in the sheet editor's *Shown on the sub's portal* box.

:::example The sub tells you first
While a sheet is *Waiting on work*, the sub sees {{button:green|✓ My work here is done}} on that job. Pressing it (with an optional note — "Cleanout is behind the water heater — gate code 4471") moves the sheet to *Waiting on inspection* by itself. You'll see **Ready to walk — Danny Vasquez · 1004 162 Forest Drive** in the dispatch inbox, and the chip on Sub Labor reads *Waiting on inspection · sub* with their note behind ✎.
:::

Every move, yours or the sub's, writes a **Sub labor** line on the job's Activity feed — who moved it, from what to what, and the note — so the history is always on the job.
