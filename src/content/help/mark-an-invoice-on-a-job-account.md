---
title: mark an invoice as on a job account
category: Billing & Money
roles: assistant, controller, master_technician
keywords: job account, supply house, invoice, on job account, owner, homeowner, lien, secured, reece, ferguson, morrison
---
Some supply houses put a job's materials on a **job account** — an account opened against the property owner. You still pay the house like normal, but if the bill ever goes unpaid, the house's recourse is the **owner**, not you. Flagging those invoices keeps your payables picture honest: it separates debt that's truly yours from debt the house would chase the owner for.

## Flag it when you enter the invoice

1. **Materials → Supply Houses** → open the house → {{button:blue|Add Invoice}} (or edit an existing one).
2. Fill the invoice as usual and allocate the **J#** under Job allocations.
3. Check **On job account** — it sits right under the job allocations and reads "*{house} bills the property owner if this invoice goes unpaid — not you.*"

The checkbox needs **exactly one job** on the invoice — job accounts belong to one property. With no job allocated (or the amount split across jobs) it stays off and tells you why.

## The app checks the paperwork for you

When you check the box, it looks up whether that job's account packet was ever [shared with a supply house](?g=share-job-with-supply-house):

- {{chip:green|Job account on file}} — the packet went out; you'll see the desk, the date, and who sent it.
- {{chip:yellow|No job-account setup on record}} — nothing was shared through the app. If the house opened the account by phone or in person, keep the flag — it's a nudge, not a block. Otherwise send the packet from **Job Detail → Share with supply house** (the storefront icon).

## Where the flag shows up

- The house's invoice list and the **Make Payment** picker show a teal **Job acct** chip on flagged invoices.
- **Materials → Job Accounts** splits every owed number: a teal **On job accounts** tile and filter chip, a *Your account* vs *Job accounts* split on the Holding tile, and teal-striped bar slices that stay out of the past-due reds — collecting that money is the house's problem. See [see which paid jobs still owe my supply houses](?g=see-which-paid-jobs-still-owe-supply-houses).

:::example What it changes — and what it doesn't
An unpaid $3,240.50 Reece invoice on J804's job account still shows in Reece's balance and still gets paid from **Make Payment**. But on Job Accounts it reads teal instead of red, and the summary tells you that $3,240.50 of what you're "holding for suppliers" is secured by the owner's account.
:::

Already have invoices sitting on job accounts? Open each one with the **Edit** pencil and check the box — the flag can be set any time.
