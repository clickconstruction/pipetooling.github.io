---
title: reconcile Cash App payments against pay reports
category: Office
roles: dev, controller
keywords: cash app, cashapp, reconcile, import, export, csv, payments, recorded, forgot to record, pay run, aliases, advance
order: 60
---
Staff paid through Cash App get their payment recorded on the pay report by hand — and sometimes it isn't. The Cash App reconcile reads the Cash App activity export and tells you which sends have no recorded payment.

## Get the export

In Cash App: **Activity → Statements → Export CSV**. Any date range works; upload the file as it comes. Every row is kept and keyed by Cash App's Transaction ID, so a bigger export later only adds what's new — nothing double-counts.

## Upload it

**People → Pay → Payroll → Pay run**, then {{button:outline|Cash App…}}. The first step reads the file and says how many rows are new and how many are sends to staff.

:::example After choosing the file
cash_app_report.csv · 2,360 rows · **31 new** (28 sends to staff) · 2,329 already imported
:::

## Tie the names

Cash App names rarely match app names ("Abe Whites" is Abraham). The second step lists every Cash App name not yet tied to a person: pick who it is, or tick **not staff**. The app remembers, so the next import already knows everyone. Leave one blank to decide later.

A name can be a **proxy**: Tristen's pay goes to Taunya's account with "Tristen" in the note. Tick **proxy** on that name and fill in "when the note contains *tristen* it's for *Tristen*"; the rule is applied on every import. Malachi's pay goes to Jessica Whites with no note rule, so Jessica's name simply maps to Malachi.

## Read the summary

The third step files every send to staff into a lane:

- {{chip:green|Recorded}} — matched to a payment already on a pay report: the Cash App ID was in the memo, or the same person and amount within a week, or one send equalling two or three recorded splits.
- {{chip:yellow|To review}} — no recorded payment found. This is the "did I forget?" list, grouped by person, with the note and the Cash App ID on every row.
- {{chip:gray|Before records began}} — sent before that person had any pay report in the app. Real money, but nothing here to reconcile against.
- {{chip:gray|Not pay}} — the note says gas, reimbursement, Home Depot and the like.
- {{chip:gray|Not staff}} — names you marked as not staff.

## Decide each send

Every send in **To review** has four buttons:

- {{button:green|Record}} — it was pay. The editor opens on the report the send most likely pays (the week that just ended), with the amount prefilled up to what that report can still take; change either and press Save. The payment is written with the Cash App ID in its memo, so the next import matches it exactly, and Paid to date / Balance update behind the modal.
- {{button:outline|Advance}} — pay sent ahead of a report. It becomes a pending offset for that person, and the next time you generate their report the Less step offers it as a line.
- {{button:outline|Already recorded}} — the money is on a report already, just under a different amount or date (you recorded the report's net while sending something else). Counts it as recorded without writing a second payment.
- {{button:outline|Not pay}} — gas, a reimbursement, a loan: real money, not payroll.
- {{button:outline|Skip}} — leave it out for now.

:::example One row, decided
2026-08-22 · Darren · $500.00 · "Week" · #D-1RM77EV8J → Record → 8/16–22 · $500.00 left → Save
:::

A row whose Cash App name is not tied to a person yet can only be skipped or marked not pay — tie the name first.

## Recording a Cash App payment by hand

{{button:green|Record payment}} on any report now has a **Cash App ID** field. Paste the Transaction ID (from the activity export or the app; it looks like `#D-3V3MVPKVP`) and the memo is written the way the reconcile reads it — that send is matched exactly and drops off the review list on its own. Do this every time you record a Cash App payment and the next import has nothing to ask.

## Working with an agent

{{button:outline|Copy summary}} puts the whole state on the clipboard as plain text: lane counts, unknown names, and the to-review list with IDs. Paste it to an agent and it can work the list without a screenshot; the same text is under **Summary as text** on the page.
