---
title: assemble a sub work order
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub, subcontractor, work order, work orders tab, assemble, scope, bid, price, draft, unpriced, sign, signature, portal, record number, WO, needs a work order, sub labor, rail, handshake, no agreement, link to a job, not in pipeline
order: 62
---
A work order is the short numbered document a sub signs before they start. You assemble it on Jobs → Subs → Work.

A sub is a subcontractor. The **work order** says what they're doing, for how much, in what window, and under which standing rules. **Jobs → Subs → Work** is where they're assembled. It works like a bid cover letter. The document takes shape on the right as you tick.

## Start one

1. Open **Jobs → Subs → Work**. Every row on the board is a **Sub Labor sheet** with the agreement behind it. The first group, **Working with no agreement**, is the queue. It holds sheets for roster subs with money still open or never priced, and nothing signed. It includes sheets on jobs that are not in the Pipeline. Click {{button:blue|Draft a work order…}} on a row. The assembler opens on that sheet with its total as the price. Or click {{button:blue|+ New work order}} for a job with no sheet yet.
2. **Job**: pick the job. The document's project block, customer, and trade come from it.
3. **Sub**: pick the sub from the roster chips. Or click {{button:outline|Add sub}} for someone new. They get a roster row and a portal.
4. **Scope and terms**:
   - **Scope** starts with the trade's library defaults ticked. If the job has a bid, the bid's stages appear as lines to tick too. Type anything else for this job underneath, one per line. Whatever is ticked is what the sub signs, word for word.
   - **Price**: type the subcontract amount. If the job has a bid, the bid's sub-labor total shows as a hint. You can leave it blank and click {{button:outline|Save draft}}. The draft shows *Drafted · no price yet* on the board until someone fills it in.
   - **Window, expiry, retainage, bond, special provisions** come next. Retainage is the part of the pay held back until the work is done. The bond is a bonding company's promise that the sub finishes the work and pays its suppliers. Then come the documents **attached by reference** and the sentences they **confirm at signing**.
5. {{button:blue|Send for signature}} gives the order its number, like WO-977-01, then WO-977-02. It freezes the document. It notifies the sub. Their portal link opens the offer. When they sign, a **Sub Labor sheet is created for them from the agreed amount**. There is nothing to set up on the Sub Labor tab.

:::example An assistant taking a job in
The leader says "Rudy's doing the rough-in". The assistant opens Work Orders, picks the job and Rudy, ticks the plumbing defaults, leaves the price blank, saves the draft. The leader opens it from the Drafts filter, types the price, sends.
:::

## From the job window

Taking a job in and the leader already knows who's doing it? Open the job's **Edit** tab. The **Sub work order** row sits right under Contract. {{button:blue|Draft a work order…}} opens the assembler with the job already picked. Choose the sub and tick the scope. Leave the price blank if that's the leader's call. Click {{button:outline|Save draft}}. The row then shows {{chip:gray|Drafted · no price yet}} with {{button:blue|Price…}}. Once it's signed it shows {{chip:green|✍ Signed}} and {{button:outline|View record}}. The **Bill** tab shows the same line read-only above the invoice.

## The leader's queue

Unpriced drafts show on the dashboard's **Needs You** card. The line reads *"2 sub work orders are waiting for a price"*. {{button:blue|Price them}} opens **Jobs → Subs → Work** on the Drafts filter. Open each draft. Type the price. Click {{button:blue|Send for signature}}.

## Sign to accept work

You can send a sub a work order offer. You also send the offer from a project step's **Offer to…**, or a Sub Labor sheet's **Work order** box. The offer appears on their portal with the scope and price locked in. The sub accepts by **signing**, typed or drawn. The signature form is the same one contracts use. Under the signature box, the same small grey sentence says a typed or drawn signature counts the same as ink. It also says the sub can ask the office for paper at no charge. The form also has the same **How electronic signing works ▸** dropdown and **I agree to sign electronically** box. The whole form is in Spanish when the portal is. The Spanish covers the name box, **Escribir** / **Dibujar**, **Borrar firma** and the form's reminders when something is missing. The sub signs under their Master Subcontract Agreement. The office inbox gets a dispatch note the moment they do. Offers can carry an expiry date. A sub who passes on an offer is asked for a quick reason, so you know how to fix it.

A work order sent from a sheet shows more on the card. The card shows anything **not included**. The card also has a collapsed **Also part of this work order** list. The list names General Conditions and the other documents by version date. General Conditions are the standard terms for the work. Before signing, the sub ticks each **Please confirm** sentence. What they ticked is stored with the signature. Once signed, the sheet card grows a **✍ What you agreed to** line. The sub can reopen the line any time. The line shows the scope, the documents, and the boxes they ticked.

## Reading the board

Three tiles lead. **On a handshake** is open money on sheets with nothing signed. That is the number to drive to zero. **Offers out** and **Signed this month** follow. Four columns sit on every row. *Sub · stage* names the sub and the stage. **Window** shows the dates as text with the GC chip beside them. Click the dates for the calendar. *Agreed · Paid · Open* stacks the three amounts, paid in green and open in red. **Where it stands → next** shows the rail, an arrow, and the move as a button. A **⋯** menu holds the rest. These are the same numbers the sub sees on their portal.

**Where it stands** is the rail, seven dots on one line. Three small dots are the office's steps: *Drafted · Sent · Signed*. Four big ones are the sub's: *Work · Pre-inspection · Post-inspection: Trigger draw · Paid*. Those are the same four on their portal. The filled terracotta dot is where the sheet is today. A **dashed red run** through the first three dots means work is happening with nothing signed. A declined or expired offer draws the same gap. So it lands back in the first group with {{button:blue|Re-offer…}} or {{button:blue|Re-send…}} ready.

**Next** names the office's move, and its button sits first in the row. *Get it in writing* pairs with {{button:blue|Draft a work order…}}. *Price it and send* pairs with {{button:blue|Price…}}. *Waiting on ‹sub› · 3 days* pairs with {{button:blue|Nudge}} once three days have passed. Once signed, the moves are *Wait for "done"*, *Call it in for inspection*, *Bill and collect*, *Pay ‹sub›* and *Nothing — done*. For *Wait for "done"*, the sub taps Done on their portal.

**Click the rail** anywhere but the current dot for the sheet's **story**. It shows one row per dot with the facts behind it. Who drafted it and when. When it went out and until when. How it was signed and the paperwork it binds under. When the sub said "done" and what they wrote. The job's bill. Every payment. It also shows what the sub sees on their portal at that step. For the live dot it shows the office's move.

The groups follow the rail: **Working with no agreement**, **Drafted**, **Sent**, **Signed**. Signed is collapsed. {{button:outline|Show ▾}} opens the record. The filter chips are the same four groups with counts. Search by job number, sub, customer, or WO number. {{button:outline|Sheet ›}} on any row opens the Sub Labor sheet. A signed order's **WO-977-01 ›** opens the record.

:::example A sheet on a job that is not in the Pipeline
Springtown's $40,000 electrical sheet was written against job 977 before the job had a Pipeline row. It shows {{chip:yellow|Not in Pipeline}} with {{button:outline|Link to a job…}} — pick the job and the sheet's number follows it, so the work order, the bill and the Job Summary land on one job. {{button:outline|New job…}} opens the New Job form; give it number 977 and the sheet links itself.
:::

While an offer waits, you have three buttons. {{button:outline|Nudge}} resends the notification. {{button:outline|Signed on paper}} records a signature they gave you on a printed copy. {{button:outline|Withdraw}} takes it back to a draft. Signed orders open read-only. {{button:outline|Print}} gives the paper copy.

Crew pay sheets never need a work order and are never listed here. A crew pay sheet is one with a teammate on the sheet. They keep their own label on **Jobs → Subs → Pay**.

## Where the words come from

Scope lines, exclusions, and acknowledgements live at **People → Contracts → Contract library → Scope**. There is one list per trade plus an all-trades list. General Conditions is a Contract library document with its audience set to **Subs**. Editing either changes future work orders only. Signed ones keep their frozen wording.
