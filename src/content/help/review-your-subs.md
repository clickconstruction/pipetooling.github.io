---
title: review your subs in one place
category: Office
roles: dev, master_technician, assistant, controller
keywords: subs, subcontractor, balance, compliance, coi, w9, agreement, work orders, track record, general conditions, sheet work order
order: 80
---
People → Subs shows one row per subcontractor, an outside crew you hire. The row shows their work, what you owe them, whether their paperwork is current, and how they have performed.

## The columns

- **Sub** shows the name, whether they have an app login, and their documents.
- **Open work orders** lists every offered or accepted step commitment with its amount and project.
- **Balance due** is the open money across their sub sheets. These are the same numbers as Jobs → Subs → Pay.
- **Compliance** shows a badge per document type:
  - {{chip:green|Agreement signed}} {{chip:green|COI ✓}} means in order. A COI is a certificate of insurance.
  - {{chip:yellow|COI expiring}} means it lapses within 30 days.
  - {{chip:red|COI expired}} means it has lapsed.
  - {{chip:gray|W-9 missing}} means nothing is on file. A W-9 is the tax form a sub signs.
- **Track record** shows sheets settled and total backcharges, costs charged back to the sub.

## Add or classify documents

You click **▶ Documents** under a sub's name to see their documents. You tap {{button:outline|+ Add document}} to file a COI, W-9, license, or paper-signed agreement right there. You pick the type. You give a COI its expiration. You paste an optional link to the file. You tap {{button:blue|Save}}. The badge updates as soon as it lands. Each existing row also has a **type** and **expiry date** picker. A row may be named like a W-9 or COI but still typed as the Agreement. It shows an amber *Looks like a W-9 — set type* pill. One click fixes it. Sending documents for signature stays on the Contracts tab. The full walkthrough is [keep a sub's paperwork current](?g=keep-a-subs-paperwork-current).

:::example Getting a sub compliant
Open Subs → ▶ Documents → + Add document → COI → expires next March → Save → the badge flips green until 30 days before it lapses.
:::

## Unattributed sheets

An amber panel at the **top** of the tab lists sheets that could not be tied to one sub. Their money is missing from every sub's balance until they are fixed. Each row shows the job and the raw name written on the sheet. It also shows why it did not link, and the open balance:

- {{chip:red|No roster match}} means the name on the sheet does not match anyone. It is usually a misspelling.
- {{chip:blue|Multiple subs}} means the sheet names several people. So no single sub can own its balance.

You fix a row without leaving the tab:

- You tap {{button:outline-amber|✨ Link to Jesse Ramos}} when the sheet's name is clearly one roster sub, like "J Ramos". It shows only when there is exactly one safe match.
- You tap {{button:outline|Assign…}} to pick the right sub from the roster. On a **Multiple subs** sheet this replaces the multi-name assignment with the one sub you pick.
- You tap {{button:outline|Open →}} to jump to the sheet in Jobs → Subs → Pay and edit it directly.

:::example Cleaning up a misspelled sheet
The panel shows **#892** assigned to "MIke Rodrigez" with $1,240 open → tap {{button:outline-amber|✨ Link to Mike Rodriguez}} → the sheet folds into Mike's row and his Balance due grows by $1,240.
:::

The panel shows the three biggest balances first. **Show all N sheets** expands the rest. It disappears entirely once every sheet is linked.

## Sheet work orders and General Conditions

- **Open work orders** now include work orders sent from a Sub Labor sheet. They read as the sheet's job, like *J977 · 415 Springtown Way · sheet*, instead of a step at a project.
- A fourth compliance pill, {{chip:green|Gen. Cond. ✓}}, appears once the Contract library holds a document for subs. That document is the General Conditions, the standard terms every sub signs. {{chip:yellow|Gen. Cond. behind}} means they signed an older version than the library's current one. {{chip:gray|Gen. Cond. unsigned}} means they never have. You send the update from **Contract library → Scope → Documents for subs**.
- You open a sub's **Person desk** to see a **Work orders** section. It lists every offer and signed agreement for that person, sheet or step, with a door to where it lives.
