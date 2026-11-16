---
title: review your subs in one place
category: Office
roles: dev, master_technician, assistant, controller
keywords: subs, subcontractor, ledger, statement, payments, balance, compliance, coi, w9, agreement, work orders, track record, general conditions, sheet work order, multiple subs, teammates, crew sheet, counted twice, double count, take teammates off, clean up names, what we owe, sheets behind the balance, bonus, team sub labor, export, search, sort
order: 80
---
People → Subs shows one row per subcontractor, an outside crew you hire. The row shows their work, what you owe them, whether their paperwork is current, and how they have performed.

## Roster and Ledger

Two chips sit at the top. {{chip:gray|Roster}} is the list of subs this guide describes. {{chip:gray|Ledger}} shows what was paid to each sub and when.

Press a name on the Ledger to open that sub's statement. Its last row is checked against their Balance due here. See [every payment made to subs by date](/help/see-every-sub-payment-by-date#the-statement-for-one-sub).

## The columns

- **Sub** shows the name, whether they have an app login, and their documents.
- **Open work orders** lists every offered or accepted step commitment with its amount and project.
- **Balance due** is the open money across their sub sheets. These are the same numbers as Jobs → Subs → Pay. Press the figure to see [the sheets behind it](#see-what-is-behind-a-balance-due).
- **Compliance** shows a badge per document type:
  - {{chip:green|Agreement signed}} {{chip:green|COI ✓}} means in order. A COI is a certificate of insurance.
  - {{chip:yellow|COI expiring}} means it lapses within 30 days.
  - {{chip:red|COI expired}} means it has lapsed.
  - {{chip:gray|W-9 missing}} means nothing is on file. A W-9 is the tax form a sub signs.
- **Track record** shows sheets settled and total backcharges, costs charged back to the sub.

## See what is behind a Balance due

Press a sub's **Balance due**. Their sheets open in a row under theirs, grouped by job.

- Each job shows what was agreed, what was paid and what is still open.
- Press a sheet to see its lines, its payments and its back-charges.
- **Open** shows the sheets with money open. **Paid** shows the sheets that are settled.
- A green check says the sheets add up to the figure in the column.

You can act from the same row. {{button:blue|Pay…}} opens the Record payment window for that sheet. {{button:outline|Back-charge…}} opens the back-charge window. **By date ›** opens their statement on the Ledger.

:::example Checking one sub's balance
Harlan Mechanical shows $3,800 due → press the figure → two jobs open under the row → the Cedar Hollow job shows $2,600 open on two sheets → the check reads **✓ the figure in the column**.
:::

## Find a sub and export

Four tiles sit over the roster. The first two show what is owed for sub labor and what is ready to pay now. The others show what is on nobody's row and whether it all adds up.

- {{chip:gray|Owed}} keeps only the subs you owe money.
- **Search a sub or a job…** finds a sub by name, or by a job they have a sheet on.
- The sort offers **Most owed**, **Name**, **Ready to pay** and **Last worked**.
- {{button:outline|Export CSV}} saves one row for each open sheet of the subs shown.

On a phone each sub is a card. Press **Show the full table, with the bench and the documents** for the six columns.

## Add or classify documents

You click **▶ Documents** under a sub's name to see their documents. You tap {{button:outline|+ Add document}} to file a COI, W-9, license, or paper-signed agreement right there. You pick the type. You give a COI its expiration. You paste an optional link to the file. You tap {{button:blue|Save}}. The badge updates as soon as it lands. Each existing row also has a **type** and **expiry date** picker. A row may be named like a W-9 or COI but still typed as the Agreement. It shows an amber *Looks like a W-9 — set type* pill. One click fixes it. Sending documents for signature stays on the Contracts tab. The full walkthrough is [keep a sub's paperwork current](?g=keep-a-subs-paperwork-current).

:::example Getting a sub compliant
Open Subs → ▶ Documents → + Add document → COI → expires next March → Save → the badge flips green until 30 days before it lapses.
:::

## Unattributed sheets

An amber panel at the **top** of the tab lists sheets that could not be tied to one sub. Its head counts them and their open money. That money is counted once, there, and is in no sub's Balance due until each sheet names one sub. Each row shows the job and the raw name written on the sheet. It also shows why it did not link, and the open balance:

- {{chip:red|No roster match}} means the name on the sheet does not match anyone. It is usually a misspelling.
- {{chip:blue|Multiple subs}} means the sheet names two or more subs. Its balance is on nobody's row, so it is never counted twice.

A sheet names only the one person it pays. A sheet with a sub on it is the sub's sheet. The whole balance is on the sub's row, once.

A sheet that names one teammate and no sub is owed to that teammate. It is sub labor paid on top of their wages, such as a bonus. The teammate's row wears a {{chip:purple|Team · sub labor}} chip. A teammate with no row on this roster is listed under **Teammates paid as sub labor**.

An older sheet may still name a teammate beside a sub. The teammate is named on it and not paid from it.

You fix a row without leaving the tab:

- You tap {{button:outline-amber|✨ Link to Jesse Ramos}} when the sheet's name is clearly one roster sub, like "J Ramos". It shows only when there is exactly one safe match.
- You tap {{button:outline|Whose is it…}} to say whose the sheet is. The window shows what your choice adds to each person's Balance due before anything is saved. **It is one sub's sheet** replaces every name on the sheet with the one sub you pick. **Leave it shared** changes nothing. Do not make a second sheet for the other sub with the same lines. That would owe the same money twice.
- You tap {{button:outline|Open →}} to jump to the sheet in Jobs → Subs → Pay and edit it directly.

:::example Cleaning up a misspelled sheet
The panel shows **#892** assigned to "MIke Rodrigez" with $1,240 open → tap {{button:outline-amber|✨ Link to Mike Rodriguez}} → the sheet folds into Mike's row and his Balance due grows by $1,240.
:::

The panel shows the three biggest balances first. **Show all N sheets** expands the rest. It disappears entirely once every sheet is linked.

## Take teammates off a sub's sheet

An older sheet may name a teammate beside the sub. The names came from the job's team when the sheet was made. The teammate is not paid from the sheet.

A line over the roster counts these sheets. Press **Take the teammates off…** to open the list.

- Each sheet shows who keeps it and who comes off. Every ready sheet starts ticked.
- A sheet that needs a look first is held with its reason. A hold never stops the rest.
- The press says its count, like {{button:blue|Take teammates off 8 sheets}}.

No amount, payment or date changes. One thing does move. People → Review and the Team Summary split a sheet's cost evenly between its names. After the press, each sheet's whole cost is its sub's.

## Sheet work orders and General Conditions

- **Open work orders** now include work orders sent from a Sub Labor sheet. They read as the sheet's job, like *J977 · 415 Stonewick Way · sheet*, instead of a step at a project.
- A fourth compliance pill, {{chip:green|Gen. Cond. ✓}}, appears once the Contract library holds a document for subs. That document is the General Conditions, the standard terms every sub signs. {{chip:yellow|Gen. Cond. behind}} means they signed an older version than the library's current one. {{chip:gray|Gen. Cond. unsigned}} means they never have. You send the update from **Contract library → Scope → Documents for subs**.
- You open a sub's **Person desk** to see a **Work orders** section. It lists every offer and signed agreement for that person, sheet or step, with a door to where it lives.
