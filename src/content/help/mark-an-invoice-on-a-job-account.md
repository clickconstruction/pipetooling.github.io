---
title: mark an invoice as on a job account
category: Billing & Money
roles: assistant, controller, master_technician
keywords: job account, supply house, invoice, on job account, owner, homeowner, lien, secured, reece, ferguson, morrison
---
Some supply houses put a job's materials on a **job account** — an account opened against the property owner. You still pay the house like normal, but if the bill ever goes unpaid, the house's recourse is the **owner**, not you. Flagging those invoices keeps your payables picture honest: it separates debt that's truly yours from debt the house would chase the owner for.

## Flag it when you enter the invoice

1. **Materials → Supply Houses** → open the house → {{button:blue|Add Invoice}} (or edit an existing one).
2. Fill the invoice as usual — Invoice Number on its own line, then **Purchase Order #**, **Invoice Date** and **Amount** side by side (they stack on a phone) — and allocate the **J#** under Job allocations. The form scrolls inside its own panel on a short screen; the title bar and its × stay put, and **Due Date** and **Link** sit together just above {{button:blue|Save}}.
3. Check **On job account** — it sits right under the job allocations and reads "*{house} bills the property owner if this invoice goes unpaid — not you.*"

The checkbox needs **exactly one job** on the invoice — job accounts belong to one property. With no job allocated (or the amount split across jobs) it stays off and tells you why.

## The box checks itself

Once the job is allocated, the form looks up that job's **account at this house**:

- {{chip:green|Job account open at Reece · ref R-88214}} — the box is already checked on a new invoice. Untick it only if this invoice is not on the account.
- {{chip:yellow|No job account at Reece on record for this job}} — with {{button:green|Mark opened…}} right there: if the house opened one, record it (how, the reference, a note) and the box checks itself from then on. Not marked, the flag stays a nudge — never a block.
- {{chip:gray|Marked not needed}} — the office decided this job does not need one there, and why.

How an account gets opened and recorded — the tech's ask at the counter, the office's call to the rep, the PO code moment — is in [open a job account before buying parts](?g=open-a-job-account-before-buying-parts).

## Where the flag shows up

- The house's invoice list and the **Make Payment** picker show a teal **Job acct** chip on flagged invoices.
- The **job window** shows it too: the storefront icon in the header turns teal once the job's account packet is on file, and **Parts Cost → Supply house invoices** chips each flagged invoice and sums how much of the unpaid balance is on the account. On the **Bill** tab, a teal note above the Invoices list names the house, dates the packet, and adds the flagged dollars — right where you're about to bill the customer.
- **Materials → Job Accounts** splits every owed number: a teal **On job accounts** tile and filter chip, a *Your account* vs *Job accounts* split on the Holding tile, and teal-striped bar slices that stay out of the past-due reds — collecting that money is the house's problem. See [see which paid jobs still owe my supply houses](?g=see-which-paid-jobs-still-owe-supply-houses).

:::example What it changes — and what it doesn't
An unpaid $3,240.50 Reece invoice on J804's job account still shows in Reece's balance and still gets paid from **Make Payment**. But on Job Accounts it reads teal instead of red, and the summary tells you that $3,240.50 of what you're "holding for suppliers" is secured by the owner's account.
:::

Already have invoices sitting on job accounts? Open each one with the **Edit** pencil and check the box — the flag can be set any time.

## The account itself lives on the house

Whether a job **has** an account at a house is its own record, separate from this invoice flag: **Materials → Supply houses** → expand the house → **Job accounts** lists every job with an account there ({{chip:green|open}} with the house's reference, {{chip:purple|requested}}, {{chip:gray|not needed}}) and every job that bought there with none on record. {{button:green|Mark opened…}} records it in two taps after the call. See [find a supply house and its rep](?g=find-a-supply-house-and-its-rep).

## The Dashboard keeps an eye on it

One **Needs You** card appears only when there's a gap, and clears itself as you fix it: **N jobs bought parts at a house with no job account** — a supplier invoice landed (or a PO code was minted) in the last 180 days at a house that expects a job account, and nothing is on record for that job there. It names the dollars and the houses. {{button:outline|Review them}} opens **Materials → Job Accounts** on the **Bought, no account** filter; the same count sits in the Pipeline's Fix-ups strip as {{chip:yellow|No job account · N}}. Clear a job by marking the account opened (or not needed) on the house's roster under **Supply houses**.

The older **Packet on file, unflagged** and **Flagged, no packet** filters are still on the Job Accounts tab for the packet bookkeeping; they no longer raise Dashboard cards.
