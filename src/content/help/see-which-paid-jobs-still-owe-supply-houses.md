---
title: see which paid jobs still owe my supply houses
category: Billing & Money
roles: assistant, controller, master_technician
keywords: held for suppliers, job accounts, supply house, invoices, owed, held, paid, materials, payables, float, allocate, make payment, on job account, owner, lien, secured
---
**Materials → Held for suppliers** (called *Job Accounts* until September 2026 — a *job account* now means only the account a supply house opens for a job) lines up every job's money in both directions: what the customer has paid you, and what you've paid (or still owe) your supply houses for that job's materials. Jobs where the customer's money already arrived but a house is still owed sort to the top — that's money you're holding that belongs onward.

## Read the top row of tiles

- {{chip:yellow|Holding for suppliers}} — unpaid supplier balances on jobs the customer has paid, counted only up to what actually came in. This is the number to drive to zero.
- {{chip:blue|Floating out of pocket}} — the reverse: you already paid houses on jobs the customer hasn't paid yet.
- {{chip:green|Settled}} — paid both ways, nothing held.
- {{chip:gray|Unallocated invoices}} — unpaid invoices not tied to any job or bid. They're missing from every job's numbers, so allocate them: each invoice's **Jobs** field lives on the Supply Houses tab.
- **On job accounts** (teal, appears once any invoice is flagged) — owed dollars riding on a house's **job account**: if they go unpaid, the house bills the property owner, not you. The Holding tile also splits into *Your account* vs *Job accounts* so you can see how much of what you're holding is really your exposure. Flag invoices when you enter them — see [mark an invoice as on a job account](?g=mark-an-invoice-on-a-job-account). Three more chips appear only when there's something to fix: {{chip:yellow|Bought, no account}} (the job bought from a house that expects a job account — an invoice landed or a PO code was minted in the last 180 days — and no account is on record there; the same jobs the Dashboard's *jobs bought parts at a house with no job account* card counts), {{chip:gray|Packet on file, unflagged}} (a job-account packet went out for the job, but it still has unpaid invoices that aren't flagged) and {{chip:gray|Flagged, no packet}} (invoices flagged on a job account for a job never shared from the app). Expanded rows name the houses missing an account in amber, show a teal **Job account packet on file** chip when one went out, and a one-line hint about what to do. Mark accounts opened from the house's roster on **Supply houses** — see [find a supply house and its rep](?g=find-a-supply-house-and-its-rep).

## Read a job row

Every row has two bars on the same scale:

- **In** — the blue fill is what the customer has paid, against the full bar of what you billed.
- **Out** — gray is what you've already paid houses; the colored part is what's still owed, shaded from green (not due yet) through amber and red (past due), matching the aging table on Supply Houses. A **teal-striped** slice is owed money on a job account — it stays out of the past-due colors because collecting it is the house's problem, not yours. Rows with any show a teal "$X on job acct" note, and the expanded statement badges each house's share.

The chip tells you where the job stands: {{chip:yellow|Owe suppliers}}, {{chip:blue|Floating}}, {{chip:gray|Awaiting customer}}, or {{chip:green|Settled}}. Use the filter chips above the list to see one group at a time.

:::example Reading a row
**J804 · Summit GC — Auto Zone** shows In $23,472 / $32,600 and Out $8,921.73 owed — the customer is 72% paid, and $8,921.73 of supplier invoices are waiting. It sorts near the top under {{chip:yellow|Owe suppliers}}.
:::

## Pay a house from here

1. Click a job row to expand its statement — each supply house with its invoice count, oldest due date, and paid vs. owed totals.
2. Click {{button:outline|Open house}} on the house you want to pay. That jumps to the **Supply Houses** tab with the house already open — its invoices and {{button:green|Make Payment}} are right there.
3. If the customer side is the problem, click the **job's name** on any row (or **Open job** on the expanded statement) — the full job window opens right there with its **Job**, **Edit**, and **Bill** tabs, and the numbers refresh when you save.
