---
title: assemble a sub work order
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub, subcontractor, work order, work orders tab, assemble, scope, bid, price, draft, unpriced, sign, signature, portal, record number, WO, needs a work order, sub labor, rail, handshake, no agreement, link to a job, not in pipeline
order: 62
---
A **work order** is the short numbered document a sub signs before they start: what they're doing, for how much, in what window, under which standing rules. **Jobs → Work Orders** is where they're assembled — like a bid cover letter, with the document taking shape on the right as you tick.

## Start one

1. Open **Jobs → Work Orders**. Every row on the board is a **Sub Labor sheet** with the agreement behind it, and the first group — **Working with no agreement** — is the queue: sheets for roster subs with money still open (or never priced) and nothing signed, including sheets on jobs that are not in the Pipeline. Click {{button:blue|Draft a work order…}} on a row (the assembler opens on that sheet with its total as the price) or {{button:blue|+ New work order}} for a job with no sheet yet.
2. **Job**: pick the job. The document's project block, customer, and trade come from it.
3. **Sub**: pick the sub from the roster chips, or {{button:outline|Add sub}} for someone new — they get a roster row and a portal.
4. **Scope and terms**:
   - **Scope** starts with the trade's library defaults ticked. If the job has a bid, the bid's stages appear as lines to tick too. Type anything else for this job underneath, one per line. Whatever is ticked is what the sub signs, word for word.
   - **Price**: type the subcontract amount. If the job has a bid, the bid's sub-labor total shows as a hint. You can leave it blank and {{button:outline|Save draft}} — the draft shows {{chip:gray|Draft · needs a price}} on the board until someone fills it in.
   - **Window, expiry, retainage, bond, special provisions**, then the documents **attached by reference** and the sentences they **confirm at signing**.
5. {{button:blue|Send for signature}} gives the order its number (WO-977-01, WO-977-02, …), freezes the document, and notifies the sub. Their portal link opens the offer; when they sign, a **Sub Labor sheet is created for them from the agreed amount** — nothing to set up on the Sub Labor tab.

:::example An assistant taking a job in
The master says "Rudy's doing the rough-in". The assistant opens Work Orders, picks the job and Rudy, ticks the plumbing defaults, leaves the price blank, saves the draft. The master opens it from the Drafts filter, types the price, sends.
:::

## From the job window

Taking a job in and the master already knows who's doing it? Open the job, **Edit** tab: the **Sub work order** row sits right under Contract. {{button:blue|Draft a work order…}} opens the assembler with the job already picked — choose the sub, tick the scope, leave the price blank if that's the master's call, {{button:outline|Save draft}}. The row then shows {{chip:gray|Draft · needs a price}} with {{button:blue|Set a price…}}; once it's signed it shows {{chip:green|✍ Signed}} and {{button:outline|View record}}. The **Bill** tab shows the same line read-only above the invoice.

## The master's queue

Unpriced drafts show on the dashboard's **Needs You** card — *"2 sub work orders are waiting for a price"* — and {{button:blue|Price them}} opens **Jobs → Work Orders** on the Drafts filter. Open each draft, type the price, {{button:blue|Send for signature}}.

## Reading the board

Three tiles lead: **On a handshake** (open money on sheets with nothing signed — the number to drive to zero), **Offers out**, and **Signed this month**. The columns are the same on every row: **Job · Sub · Agreed · Paid · Open · Where it stands · Next**, and the same numbers the sub sees on their portal.

**Where it stands** is the rail — seven dots on one line. Three small dots are the office's steps (Drafted · Sent · Signed); four big ones are the sub's (Work · Walk-through · Customer pays · Paid — the same four on their portal). The filled terracotta dot is where the sheet is today. A **dashed red run** through the first three dots means work is happening with nothing signed — a declined or expired offer draws the same gap, so it lands back in the first group with {{button:blue|Re-offer…}} or {{button:blue|Re-send…}} ready.

**Next** names the office's move, and its button sits first in the row: *Get it in writing* → {{button:blue|Draft a work order…}}; *Price it and send* → {{button:blue|Price…}}; *Waiting on ‹sub› · 3 days* → {{button:blue|Nudge}} once three days have passed; then, once signed, *Wait for "done"* (the sub taps Done on their portal), *Schedule the walk-through*, *Bill and collect*, *Pay ‹sub›*, *Nothing — done*.

The groups follow the rail: **Working with no agreement**, **Drafted**, **Sent**, **Signed** (collapsed — {{button:outline|Show ▾}} opens the record). The filter chips are the same four groups with counts. Search by job number, sub, customer, or WO number. {{button:outline|Sheet ›}} on any row opens the Sub Labor sheet; a signed order's **WO-977-01 ›** opens the record.

:::example A sheet on a job that is not in the Pipeline
Springtown's $40,000 electrical sheet was written against job 977 before the job had a Pipeline row. It shows {{chip:yellow|Not in Pipeline}} with {{button:outline|Link to a job…}} — pick the job and the sheet's number follows it, so the work order, the bill and the Job Summary land on one job. {{button:outline|New job…}} opens the New Job form; give it number 977 and the sheet links itself.
:::

While an offer waits: {{button:outline|Nudge}} resends the notification, {{button:outline|Signed on paper}} records a signature they gave you on a printed copy, {{button:outline|Withdraw}} takes it back to a draft. Signed orders open read-only and {{button:outline|Print}} gives the paper copy.

Crew pay sheets (a teammate on the sheet) never need a work order and are never listed here — they keep their own label on **Jobs → Sub Labor**.

## Where the words come from

Scope lines, exclusions, and acknowledgements live at **People → Contracts → Contract library → Scope**, one list per trade plus an all-trades list. General Conditions is a Contract library document with its audience set to **Subs**. Editing either changes future work orders only — signed ones keep their frozen wording.
