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

A name can be a proxy: Tristen's pay goes to Taunya's account with "Tristen" in the note, and Malachi's to Jessica Whites. Those rules live on the alias and are applied on every import.

## Read the summary

The third step files every send to staff into a lane:

- {{chip:green|Recorded}} — matched to a payment already on a pay report: the Cash App ID was in the memo, or the same person and amount within a week, or one send equalling two or three recorded splits.
- {{chip:yellow|To review}} — no recorded payment found. This is the "did I forget?" list, grouped by person, with the note and the Cash App ID on every row.
- {{chip:gray|Before records began}} — sent before that person had any pay report in the app. Real money, but nothing here to reconcile against.
- {{chip:gray|Not pay}} — the note says gas, reimbursement, Home Depot and the like.
- {{chip:gray|Not staff}} — names you marked as not staff.

Recording and filing from the list itself (Record on a report, Advance, Skip) is the next step of this tool; until then, record a reviewed send with {{button:green|Record payment}} on its report and paste the Cash App ID into the memo — the next import will match it exactly.

## Working with an agent

{{button:outline|Copy summary}} puts the whole state on the clipboard as plain text: lane counts, unknown names, and the to-review list with IDs. Paste it to an agent and it can work the list without a screenshot; the same text is under **Summary as text** on the page.
