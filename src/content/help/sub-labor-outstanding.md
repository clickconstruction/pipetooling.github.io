---
title: see what I still owe each sub contractor
category: Billing & Money
roles: dev, master_technician, assistant, superintendent
keywords: sub labor, sub sheet ledger, outstanding, owed, contractor, backcharge, payment, due
---
**Jobs → Sub Labor** (the Sub Sheet Ledger) lists one row per contractor per job, with what each job costs and how much is still **due**. The toolbar shows one grand total — {{chip:gray|Sub Labor Due: $20,551.52}} — but that doesn't tell you *who* the money is owed to. The summary at the top of the tab breaks it down by person.

## Outstanding by contractor

Above the ledger, a compact table ranks every contractor you still owe money to, biggest balance first:

:::example Outstanding by contractor
| Contractor | Total cost | Paid | Outstanding |
| --- | --- | --- | --- |
| Ryan (Garner HVAC) | $6,251.52 | $0.00 | $6,251.52 |
| Edgar | $8,500.00 | $4,500.00 | $4,000.00 |
| **Total** | | | **$20,551.52** |
:::

- **Total cost / Paid / Outstanding** are summed across only that contractor's **unpaid** jobs, so each row reads simply as *Total cost − Paid = Outstanding*. Fully paid jobs don't clutter the numbers.
- The **Total** row always equals the toolbar's **Sub Labor Due** — it's the same money, just grouped.
- A contractor with an over-paid job never has that credit quietly cancel out what they're owed on a different job; each job stands on its own.
- Money owed shows in red. A blank contractor name is grouped as **(No name)** so the dollars still show up.

## It follows your search

Type in the {{chip:gray|Search contractor, HCP, address…}} box and both the summary and the ledger below narrow together — so searching a contractor turns the summary into just their balance.

## Long lists

If more than eight contractors are owed money, the summary shows the top eight and a **Show all** toggle to expand the rest.

## Paying it down

Nothing here changes: use {{button:green|Payment}} and {{button:red|Backcharge}} on a ledger row as before. The summary and totals update the moment a payment or backcharge is saved.
