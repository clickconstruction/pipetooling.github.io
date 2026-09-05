---
title: review your subs in one place
category: Office
roles: dev, master_technician, assistant, controller
keywords: subs, subcontractor, balance, compliance, coi, w9, agreement, work orders, track record, general conditions, sheet work order
order: 80
---
**People → Subs** is one row per subcontractor: what they're working on, what you owe them, whether their paperwork is current, and how they've performed.

## The columns

- **Sub** — name, whether they have an app login, and their documents.
- **Open work orders** — every offered/accepted step commitment with its amount and project.
- **Balance due** — open money across their sub sheets (same numbers as Jobs → Sub Labor).
- **Compliance** — badge per document type:
  - {{chip:green|Agreement signed}} {{chip:green|COI ✓}} — in order
  - {{chip:yellow|COI expiring}} — lapses within 30 days
  - {{chip:red|COI expired}} — lapsed
  - {{chip:gray|W-9 missing}} — nothing on file
- **Track record** — sheets settled and total backcharges.

## Add or classify documents

Click **▶ Documents** under a sub's name to see their documents. {{button:outline|+ Add document}} files a COI, W-9, license, or paper-signed agreement right there — pick the type, give a COI its expiration, paste an optional link to the file, {{button:blue|Save}} — and the badge updates as soon as it lands. Each existing row also has a **type** and **expiry date** picker. A row named like a W-9 or COI but still typed as the Agreement shows an amber *Looks like a W-9 — set type* pill; one click fixes it. Sending documents for signature stays on the Contracts tab. Full walkthrough: [keep a sub's paperwork current](?g=keep-a-subs-paperwork-current).

:::example Getting a sub compliant
Open Subs → ▶ Documents → + Add document → COI → expires next March → Save → the badge flips green until 30 days before it lapses.
:::

## Unattributed sheets

An amber panel at the **top** of the tab lists sheets that couldn't be tied to one sub — their money is missing from every sub's balance until they're fixed. Each row shows the job, the raw name written on the sheet, why it didn't link, and the open balance:

- {{chip:red|No roster match}} — the name on the sheet doesn't match anyone (usually a misspelling).
- {{chip:blue|Multiple subs}} — the sheet names several people, so no single sub can own its balance.

Fix a row without leaving the tab:

- {{button:outline-amber|✨ Link to Jesse Ramos}} — one tap when the sheet's name is clearly one roster sub (e.g. "J Ramos"). Shown only when there's exactly one safe match.
- {{button:outline|Assign…}} — pick the right sub from the roster. For a **Multiple subs** sheet this replaces the multi-name assignment with the one sub you pick.
- {{button:outline|Open →}} — jump to the sheet in Jobs → Sub Labor to edit it directly.

:::example Cleaning up a misspelled sheet
The panel shows **#892** assigned to "MIke Rodrigez" with $1,240 open → tap {{button:outline-amber|✨ Link to Mike Rodriguez}} → the sheet folds into Mike's row and his Balance due grows by $1,240.
:::

The panel shows the three biggest balances first — **Show all N sheets** expands the rest. It disappears entirely once every sheet is linked.

## Sheet work orders and General Conditions

- **Open work orders** now include work orders sent from a Sub Labor sheet — they read as the sheet's job (`J977 · 415 Springtown Way · sheet`) instead of a step at a project.
- A fourth compliance pill, {{chip:green|Gen. Cond. ✓}}, appears once the Contract library holds a document for subs (General Conditions). {{chip:yellow|Gen. Cond. behind}} means they signed an older version than the library's current one; {{chip:gray|Gen. Cond. unsigned}} means they never have. Send the update from **Contract library → Scope → Documents for subs**.
- Opening a sub's **Person desk** shows a **Work orders** section: every offer and signed agreement for that person, sheet or step, with a door to where it lives.
