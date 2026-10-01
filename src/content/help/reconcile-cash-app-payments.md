---
title: reconcile Cash App payments against pay reports
category: Office
roles: dev, controller
keywords: cash app, cashapp, reconcile, import, export, csv, payments, recorded, forgot to record, pay run, aliases, advance
order: 60
---
Staff paid through Cash App get their payment recorded on the pay report by hand, and sometimes it is not. The Cash App reconcile finds the sends with no recorded payment.

The reconcile reads the Cash App activity export. It tells you which sends have no recorded payment.

## Get the export

In Cash App you open **Activity → Statements → Export CSV**. Any date range works. You upload the file as it comes. Every row is kept and keyed by Cash App's Transaction ID. So a bigger export later only adds what is new. Nothing double-counts.

## Upload it

You open **People → Pay → Payroll → Pay run**, then press {{button:outline|Cash App…}}. The first step reads the file. It says how many rows are new and how many are sends to staff.

:::example After choosing the file
cash_app_report.csv · 2,360 rows · **31 new** (28 sends to staff) · 2,329 already imported
:::

## Tie the names

Cash App names rarely match app names. Abe Whites in Cash App is Abraham in the app. The second step lists every Cash App name not yet tied to a person. You pick who it is, or tick **not staff**. The app remembers, so the next import already knows everyone. You can leave one blank to decide later.

A name can be a **proxy**, a person whose account receives someone else's pay. Tristen's pay goes to Taunya's account with Tristen in the note. You tick **proxy** on that name. You fill in the rule: when the note contains *tristen* it is for *Tristen*. The rule is applied on every import. Malachi's pay goes to Jessica Whites with no note rule. So Jessica's name simply maps to Malachi.

## Read the summary

The third step files every send to staff into a lane:

- {{chip:green|Recorded}}: matched to a payment already on a pay report. The match can be the Cash App ID in the memo. It can be the same person and amount within a week. It can be one send equalling two or three recorded splits. Or it can be the send's amount written in the payment's memo, like *Cashapp 500* or *CashApp in 300 and 100*. That is the way pay split with Less | Additional was noted.
- {{chip:yellow|To review}}: no recorded payment found. This is the did-I-forget list. It is grouped by person, with the note and the Cash App ID on every row.
- {{chip:gray|Before records began}}: sent before that person had any pay report in the app. Real money, but nothing here to reconcile against.
- {{chip:gray|Not pay}}: the note says gas, reimbursement, Home Depot and the like.
- {{chip:gray|Not staff}}: names you marked as not staff.

## Decide each send

Every send in **To review** has four buttons:

- {{button:green|Record}}: it was pay. The editor opens on the report the send most likely pays, the week that just ended. The amount is prefilled up to what that report can still take. You change either and press Save. The payment is written with the Cash App ID in its memo. So the next import matches it exactly. Paid to date and Balance update behind the modal. Sometimes the person has more than one open report. Then **Split oldest first** swaps the picker for a list of their open weeks. The send is filled in from the oldest. You edit any box, then Save writes one payment per week it reaches. The memo reads like *Cash App #D-… · 2 of 4 from $5,000.00*. The footer says what is left over when the send is bigger than the open weeks. You file that part as an advance.
- {{button:outline|Advance}}: pay sent ahead of a report. It becomes a pending offset for that person. The next time you generate their report, the Less step offers it as a line.
- {{button:outline|Already recorded}}: the money is on a report already, just under a different amount or date. For example, you recorded the report's net while sending something else. It counts the send as recorded without writing a second payment.
- {{button:outline|Not pay}}: gas, a reimbursement, a loan. Real money, not payroll.
- {{button:outline|Skip}}: leave it out for now.

:::example One row, decided
2026-08-22 · Darren · $500.00 · "Week" · #D-1RM77EV8J → Record → 8/16–22 · $500.00 left → Save
:::

A row whose Cash App name is not tied to a person yet has fewer choices. It can only be skipped or marked not pay. You tie the name first.

## Recording a Cash App payment by hand

{{button:green|Record payment}} on any report asks **How it was sent**. The choices are {{chip:gray|Cash App}}, {{chip:gray|Mercury}}, {{chip:gray|Apple Pay}}, {{chip:gray|Client direct}} and {{chip:gray|Other}}. You pick **Cash App** and a **Cash App transaction id** box opens. You paste the Transaction ID from the activity export or the app. It looks like *#D-3V3MVPKVP*. The # is added if you leave it off. The payment then carries the id and a memo written the way the reconcile reads it. So that send is matched exactly and drops off the review list on its own. You do this every time you record a Cash App payment. Then the next import has nothing to ask. Recording the same id on the same week twice is refused with a plain sentence. The method also fills the **Method** column on the Payroll tab's Payments view.

## Working with an agent

{{button:outline|Copy summary}} puts the whole state on the clipboard as plain text. It holds the lane counts, the unknown names, and the to-review list with IDs. You paste it to an agent and it can work the list without a screenshot. The same text is under **Summary as text** on the page.
