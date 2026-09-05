---
title: send a sub a work order from a sheet
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub, subcontractor, work order, sub labor, sheet, scope, scope library, general conditions, sign, signature, portal, fixed price, exclusions, acknowledgements
order: 63
---
A **work order** is the short document a sub signs before they start: what they're doing, for how much, in what window, under which standing rules. Project steps have had one for a while; any **Sub Labor sheet** can carry one too, so a plain service job gets the same signed scope as a project.

Most work orders now start on **Jobs → Work Orders** (see *assemble a sub work order*), where signing creates the sheet for you. The sheet's own box, below, is the door for a sheet that already exists.

## Write it on the sheet

1. Open the sheet from **Jobs → Sub Labor** ({{button:outline|Edit}}) and scroll to the **Work order** box, just below {{chip:blue|Shown on the sub's portal}}.
2. {{button:blue|Write a work order for …}} opens the editor with the trade's scope already ticked.
   - **Scope** comes from the scope library for the job's trade (change the list with the dropdown). Tick what applies; type lines for this job underneath, one per line. Whatever is ticked is what the sub signs, word for word.
   - **Exclusions** are the library's standing exclusions, ticked the same way.
   - **Terms**: the **amount is the sheet total and it's fixed at send** — add the work and cost first. Set the work window, how long the offer is good for, retainage, and whether a bond is furnished. Special provisions is a free line.
   - **Attached by reference** lists the Contract library documents for subs (General Conditions and the like) with their version dates, plus the pay-schedule wording from Settings and the insurance requirement with their COI expiry.
   - **They confirm at signing** are the sentences the sub must tick before the signature button lights up.
3. {{button:blue|Send for signature}} pushes and emails the sub; the link opens the offer on their portal. {{button:outline|Save draft}} keeps it on the sheet without sending.

:::example The two-click case
A routine plumbing sheet: open the editor, the library defaults are already ticked, the amount is the sheet total, the window comes from the job. Send.
:::

## Reading the rail

The box shows **Draft → Awaiting signature → Signed**, then hands off to the sheet's own stages (Working → Walk-through → Customer pays → Paid). The ledger row shows a small chip under the stage — {{chip:yellow|Awaiting signature}}, {{chip:green|✍ Signed Sep 4}}, or {{chip:gray|Draft work order}}.

While an offer waits: {{button:outline|Nudge}} resends the notification, {{button:outline|Mark accepted}} records an answer the sub gave you by phone, {{button:outline|Withdraw}} takes it back to a draft. A decline shows its reason with {{button:blue|Re-offer…}} ready.

## After it's signed

The signed box shows who signed, when, and every acknowledgement they ticked. **The signed amount stands.** If the sheet's items change afterwards, the box shows an amber note with the difference — write a change order rather than editing the signed number away.

## Keep the library current

Scope lines, exclusions, and acknowledgements live at **People → Contracts → Contract library → Scope**, one list per trade plus an all-trades list. Editing an item changes future work orders only; signed ones keep their frozen wording. General Conditions is an ordinary library document with its audience set to **Subs**.
