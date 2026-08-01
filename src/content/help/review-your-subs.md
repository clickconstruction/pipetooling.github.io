---
title: review your subs in one place
category: Office
roles: dev, master_technician, assistant, controller
keywords: subs, subcontractor, balance, compliance, coi, w9, agreement, work orders, track record
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

## Classify documents

Click **▶ Documents** under a sub's name to see their contract documents. Set each one's **type** (agreement, COI, W-9, license) and **expiry date** right there — the badges update immediately. Sending documents for signature stays on the Contracts tab.

:::example Getting a sub compliant
Send the COI request from Contracts → when it's on file, open Subs → Documents → set type "coi" and its expiration → the badge flips green until 30 days before it lapses.
:::

## Unattributed sheets

A note at the bottom lists sheets that couldn't be tied to one sub — usually a misspelled name or a sheet naming several people. Fix the crew names in Jobs → Sub Labor and they'll fold into the right rows.
