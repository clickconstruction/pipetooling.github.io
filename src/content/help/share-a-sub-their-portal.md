---
title: share a sub their portal
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub portal, subcontractor portal, work and pay, portal link, globe, sign to accept, work order, backcharge memo, pay run, paperwork, spanish, español, print statement, stage, walk-through, work done, waiting on customer
---
Every subcontractor can have a private, no-login **Work & pay portal**: their jobs with the agreed line items, what's been paid (memos included), when the open money becomes payable, open **work offers they can sign to accept**, and the status of their paperwork on file — W-9, insurance, and their signed agreements. It reads in **English or Español**, and the {{button:gray|🖨 Print statement}} button turns it into a paper packet for subs who'd rather hold it.

## Turn it on

Click the **globe icon** 🌐 next to any sub's name on **People → Subs**. A sub who has never had a portal opens to **No portal link yet** — looking creates nothing; click {{button:blue|Create their link}} and their private link is minted (a "Portal link created" toast confirms it). From then on the top of the modal is their **portal address**, something like `my.clickplumbing.com/dv-mechanical`:

- {{button:blue|Copy link}} saves the address and copies it — text it to the sub.
- **Preview as them** opens exactly what they'll see.
- The {{icon:gear}} holds the **direct link**, an address changer (with a {{button:outline|🎲}} random tail for guess-proofing), **Rotate link** and {{button:red|Turn off portal}}, and the link's **history**.

A red globe means the portal is turned off — nobody can open their page until you turn it back on (which mints a brand-new link).

:::example Texting the link
"Here's your page with us — it always shows your jobs, your pay, and your paperwork: my.clickplumbing.com/dv-mechanical"
:::

## What feeds it

The portal is a window onto work you already do — it adds no new chores:

- **Jobs & line items** come from their Sub Labor sheets.
- **Payments and backcharges** come from the payment modals. **Memos are shown to the sub**, so write them like they'll read them; the Edit Payment modal has a *hide this memo* checkbox for the rare office-internal note (the amount always shows).
- **"When do I get paid"** comes from the sheet's **stage** (below) plus the {{chip:blue|Shown on the sub's portal}} box in the sheet editor — a *payable after* date and a plain-words reason ("Builder's walk-through — scheduled Sep 9"). Leave those blank and the stage sentence speaks for itself.
- The company-wide **pay-run day** and the "How pay works here" wording live at **Settings → Jobs & billing → Sub portal · pay schedule**.
- **Paperwork status** comes from People → Contracts — signed dates, expirations, and a {{button:amber|Sign now}} button that opens the same signing page your contracts use.

## Sign to accept work

When you send a sub a work order offer (from a project step's **Offer to…**, or a Sub Labor sheet's **Work order** box), it appears on their portal with the frozen scope and price. They accept by **signing** — typed or drawn, the same signature form as contracts — under their Master Subcontract Agreement, and the office inbox gets a dispatch note the moment they do. Offers can carry an expiry date; a passed offer asks for a quick reason so you know how to fix it.

A work order sent from a sheet shows more on the card: anything **not included**, and a collapsed **Also part of this work order** list naming General Conditions and the other documents by version date. Before the signature button lights up the sub ticks each **Please confirm** sentence; what they ticked is stored with the signature. Once signed, the sheet card grows a **✍ What you agreed to** line the sub can reopen any time — the scope, the documents, and the boxes they ticked.

## Walk a sheet through its stages

Every sub sheet sits at one of three stages, and the portal draws them as a four-dot tracker under the job — **Work · Walk-through · Customer pays · You're paid** — with one plain sentence saying what stands between the sub and the money.

| On Sub Labor | What the sub reads |
| --- | --- |
| {{chip:yellow|Waiting on work}} | "Finish up, then tell us below and we'll come walk it." |
| {{chip:purple|Waiting on walk-through}} | "You told us the work's done Sep 4. We'll schedule the walk-through and let you know." |
| {{chip:blue|Waiting on customer}} | "Passed the walk-through Sep 6. The customer's payment is the last thing between you and this money…" |
| {{chip:green|Paid}} | The card leaves *Your jobs* — Paid sets itself when the balance hits $0. |

Move a sheet from the **Stage** column on **Jobs → Sub Labor**: the **→** on the chip advances one stage, and clicking the chip opens all three so you can jump or step back. The same control sits in the sheet editor's *Shown on the sub's portal* box.

:::example The sub tells you first
While a sheet is *Waiting on work*, the sub sees {{button:green|✓ My work here is done}} on that job. Pressing it (with an optional note — "Cleanout is behind the water heater — gate code 4471") moves the sheet to *Waiting on walk-through* by itself. You'll see **Ready to walk — Danny Vasquez · 1004 162 Forest Drive** in the dispatch inbox, and the chip on Sub Labor reads *Waiting on walk-through · sub* with their note behind ✎.
:::

Every move, yours or the sub's, writes a **Sub labor** line on the job's Activity feed — who moved it, from what to what, and the note — so the history is always on the job.
