---
title: send a sub a work order from a sheet
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub, subcontractor, work order, sub labor, sheet, scope, scope library, general conditions, sign, signature, portal, fixed price, exclusions, acknowledgements
order: 63
---
A **work order** is the short document a sub signs before they start. The work order says what they're doing, for how much, in what window and under which standing rules.

Project steps have had one for a while. Any **Sub Labor sheet** can carry one too. So a plain service job gets the same signed scope as a project. The scope is the list of work they agree to do.

Most work orders now start on **Jobs → Subs → Work**, where signing creates the sheet for you. See *assemble a sub work order*. The sheet's own box, below, is the door for a sheet that already exists.

## Write it on the sheet

1. Open the sheet from **Jobs → Subs → Pay** with {{button:outline|Edit}}. Scroll to the **Work order** box, just below {{chip:blue|Shown on the sub's portal}}.
2. {{button:blue|Write a work order for …}} opens the **assembler**, the same one as Jobs → Subs → Work. The job, the sub, and the sheet total as the price are already filled. Tick the scope and send. Some sheets keep the older inline editor described here. Those sheets have more than one assignee, or a job that isn't loaded.
   - **Scope** comes from the scope library for the job's trade. You change the list with the dropdown. You tick what applies. You type lines for this job underneath, one per line. Whatever is ticked is what the sub signs, word for word.
   - **Exclusions** are the library's standing exclusions, ticked the same way.
   - **Terms**: the **amount is the sheet total and it's fixed at send**. So you add the work and cost first. You set the work window, how long the offer is good for, retainage, and whether a bond is furnished. Retainage is a share of the amount the office holds back for a while. Special provisions is a free line.
   - **Attached by reference** lists the Contract library documents for subs, like General Conditions, with their version dates. The section also lists the pay-schedule wording from Settings. The section lists the insurance requirement too, with the expiry of their COI, their certificate of insurance.
   - **They confirm at signing** are the sentences the sub must tick before the signature button lights up.
3. {{button:blue|Send for signature}} sends the offer and emails the sub. The link opens the offer on their portal. {{button:outline|Save draft}} keeps it on the sheet without sending.

:::example The two-click case
A routine plumbing sheet: open the editor, the library defaults are already ticked, the amount is the sheet total, the window comes from the job. Send.
:::

## Reading the rail

The box draws the same seven-dot rail as **Jobs → Subs → Work** and **Sub Labor**. A rail is a row of dots, one per step. The rail shows ***Drafted · Sent · Signed***, then the sheet's own ***Work · Pre-inspection · Post-inspection: Trigger draw · Paid***. A dashed red run shows while work is under way and nothing is signed. The filled dot is where the sheet stands today.

While an offer waits, you have three buttons. {{button:outline|Nudge}} resends the notification. {{button:outline|Mark accepted}} records an answer the sub gave you by phone. {{button:outline|Withdraw}} takes it back to a draft. A decline shows its reason, with {{button:blue|Re-offer…}} ready.

## After it's signed

The signed box shows who signed, when, and every acknowledgement they ticked. **The signed amount stands.** If the sheet's items change afterwards, the box shows an amber note with the difference. Then you write a change order rather than editing the signed number away.

## Keep the library current

Scope lines, exclusions, and acknowledgements live at **People → Contracts → Contract library → Scope**. There is one list per trade, plus an all-trades list. Editing an item changes future work orders only. Signed ones keep their frozen wording. General Conditions is an ordinary library document with its audience set to **Subs**.
