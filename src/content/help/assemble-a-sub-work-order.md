---
title: assemble a sub work order
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub, subcontractor, work order, work orders tab, assemble, scope, bid, price, draft, unpriced, sign, signature, portal, record number, WO, needs a work order, sub labor
order: 62
---
A **work order** is the short numbered document a sub signs before they start: what they're doing, for how much, in what window, under which standing rules. **Jobs → Work Orders** is where they're assembled — like a bid cover letter, with the document taking shape on the right as you tick.

## Start one

1. Open **Jobs → Work Orders** and click {{button:blue|+ New work order}} — or use {{button:blue|Draft a work order…}} on a job in the **Needs a work order** list at the top (jobs with an unpaid Sub Labor sheet and nothing signed).
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

Filter chips count what's where: {{chip:gray|Drafts}}, {{chip:yellow|Awaiting signature}}, {{chip:green|✍ Signed}}, {{chip:red|Declined}}, {{chip:red|Expired}}. Search by job number, sub, or WO number.

While an offer waits: {{button:outline|Nudge}} resends the notification, {{button:outline|Signed on paper}} records a signature they gave you on a printed copy, {{button:outline|Withdraw}} takes it back to a draft. A decline shows its reason with {{button:blue|Re-offer…}} ready. Signed orders open read-only and {{button:outline|Print}} gives the paper copy.

## Where the words come from

Scope lines, exclusions, and acknowledgements live at **People → Contracts → Contract library → Scope**, one list per trade plus an all-trades list. General Conditions is a Contract library document with its audience set to **Subs**. Editing either changes future work orders only — signed ones keep their frozen wording.
