---
title: see where someone stands and share a pay statement
category: Office
roles: dev, master_technician, assistant, controller
keywords: offsets, balance, settle up, backcharge, damage, credit, ledger, pay statement, payments, unpaid, unreported, jobs worked, share
---

**People → Offsets** opens with the **Settle up** table: one row per person, with the whole pay picture priced into columns —

- **Unpaid reports** — what's still owed on pay reports (gross minus recorded payments)
- **No report yet** — weeks of approved hours that never became a pay report, priced at their hourly wage (`3 wk · 79.16 h · ~$1,187`)
- **Credits** and **Charges** — pending offsets, split by direction
- **Settle up** — the answer: {{chip:green|pay $1,499.82}} or {{chip:red|owes $3,082.49}}, everything above netted together

Everything is **all-time** — old charges can't hide behind a date filter. Rows needing the most attention sort first; settled people sink to the bottom. A `*` means the person has unreported hours but no wage on file, so those hours aren't priced in. People who've been archived fold into a collapsed **Archived users** section below the table — out of the way, but their balances don't vanish.

## The person ledger

Click any row. The ledger leads with the equation in plain words:

:::example The settle-up banner
Unpaid reports $620.06 + unreported ~$2,914.95 + credits $0.00 − charges $6,617.50 = **Tristen owes the company $3,082.49**
:::

Below it, **Needs action** lists every open item with its verb:

- {{chip:yellow|Unpaid}} reports → {{button:outline|Record payment}} (jumps to Payroll)
- {{chip:red|No report}} weeks → {{button:outline|Draft reports}}
- {{chip:red|Charge}} offsets → {{button:outline|Apply to report}} (opens the apply dialog)
- {{chip:green|Credit}} offsets — counted toward the next payment automatically

**History** folds away until you want it: one block per week showing the report, each recorded payment with its date and memo, and any offsets from that week — so a report and its companion weekly credit read as one story with one status ({{chip:green|paid}} or {{chip:yellow|$840.00 still owed}}). **Jobs worked** folds too: hours and billing credit per job (Crew P&L attribution), with its own date range.

## Sharing a pay statement

{{button:outline|Pay statement}} builds a printable statement of every recorded payment — its paid date and amount, the period's job hours that earned it, and offsets applied to that report ("Less: windshield damage"). It shows **hours and job names only** — never company revenue — so it's safe to hand to the person. Print or save as PDF from the dialog.
