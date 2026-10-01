---
title: mark an invoice as on a job account
category: Billing & Money
roles: assistant, controller, master_technician
keywords: job account, supply house, invoice, on job account, owner, homeowner, lien, secured, reece, ferguson, morrison
---
Some supply houses put a job's materials on a job account, an account opened against the property owner. You flag those invoices so your payables picture stays honest.

You still pay the house like normal. But if the bill ever goes unpaid, the house collects from the **owner**, not you. The flag separates debt that is truly yours from debt the house would chase the owner for.

## Flag it when you enter the invoice

1. Open **Materials → Supply Houses** and open the house. Press {{button:blue|Add Invoice}}, or the pencil on an existing one.
2. The form reads in the order the paper does. **From the invoice** holds Invoice #, Invoice date and Amount across the top. Then comes the Purchase order #, the PO number. A five-digit PO Generator code is checked against the house's ledger as you type. You see {{chip:green|PO 39089 is on the PO Generator ledger}} or {{chip:red|not on the ledger — check the number}}. A hand PO just says so.
3. **Which job**: type the J#, name or address into the search box and pick the job. It becomes a card with its address. One job is the whole invoice. Add a second job, and each card grows a **%** box that keeps the split at 100.
4. On the job's card, check **On {house}'s job account**. It reads "*If this goes unpaid the house bills the property owner, not you.*" The card's edge turns teal.

The checkbox lives on the card only when the invoice is on **exactly one job**. Job accounts belong to one property. Split across jobs, the cards say so and the box is gone.

Below that come two more sections. **Paying it** holds the due date, prefilled from the house's payment day and saying so. It also holds **Not paid yet** or **Paid on** with the day it cleared. **Paperwork** holds the invoice PDF's Drive link, with {{button:outline|Open ↗}} to glance at it. The title bar and the {{button:blue|Save invoice}} footer stay pinned while the middle scrolls. That holds on a phone too.

## The box checks itself

Once the job is allocated, the form looks up that job's **account at this house**:

- {{chip:green|Job account open at Reece · ref R-88214}} means the box is already checked on a new invoice. Untick it only if this invoice is not on the account.
- {{chip:yellow|No job account at Reece on record for this job}} comes with {{button:green|Mark opened…}} right there. If the house opened one, record it. You record how, the reference, and a note. Then the box checks itself from then on. Not marked, the flag stays a nudge, never a block.
- {{chip:gray|Marked not needed}} means the office decided this job does not need one there, and why.

How an account gets opened and recorded is in [open a job account before buying parts](?g=open-a-job-account-before-buying-parts). That covers the tech's ask at the counter, the office's call to the rep, and the PO code moment.

## Where the flag shows up

- The house's invoice list and the **Make Payment** picker show a teal **Job acct** chip on flagged invoices.
- The **job window** shows it too. The storefront icon in the header turns teal once the job's account packet is on file. **Parts Cost → Supply house invoices** chips each flagged invoice. It also sums how much of the unpaid balance is on the account. On the **Bill** tab, a teal note sits above the Invoices list. It names the house, dates the packet, and adds the flagged dollars. That is right where you are about to bill the customer.
- **Materials → Held for suppliers** splits every owed number. It has a teal **On job accounts** tile and filter chip. The Holding tile splits *Your account* from *Job accounts*. Teal-striped bar slices stay out of the past-due reds. Collecting that money is the house's problem. See [see which paid jobs still owe my supply houses](?g=see-which-paid-jobs-still-owe-supply-houses).
- **The aging heat map** on Accounts payable keeps the house's totals. To the house, an aged job-account invoice is past due. But a teal line sits under each cell and the Owed column. It says how much is on a job account: {{chip:green|$2,759.01 job acct}}. A **Mark job-account invoices** box on the bar hides the lines. It only appears while a job-account invoice is unpaid. That box, *Show paid invoices* and *Show last payment* are remembered on your device.

:::example What it changes — and what it doesn't
An unpaid $3,240.50 Reece invoice on J804's job account still shows in Reece's balance and still gets paid from **Make Payment**. But on Held for suppliers it reads teal instead of red, and the summary tells you that $3,240.50 of what you're "holding for suppliers" is secured by the owner's account.
:::

Already have invoices sitting on job accounts? Open each one with the **Edit** pencil and check the box. The flag can be set any time.

## The account itself lives on the house

Whether a job **has** an account at a house is its own record, separate from this invoice flag. Open **Materials → Supply houses** and expand the house. **Job accounts** lists every job with an account there. Each shows {{chip:green|open}} with the house's reference, {{chip:purple|requested}}, or {{chip:gray|not needed}}. It also lists every job that bought there with none on record. {{button:green|Mark opened…}} records it in two taps after the call. See [find a supply house and its rep](?g=find-a-supply-house-and-its-rep).

## The Dashboard keeps an eye on it

One **Needs You** card appears only when there is a gap. It clears itself as you fix it. The card reads **N jobs bought parts at a house with no job account**. That means a supplier invoice landed in the last 180 days at a house that expects a job account. A minted PO code counts the same way. And nothing is on record for that job there. It names the dollars and the houses. {{button:outline|Review them}} opens **Materials → Held for suppliers** on the **Bought, no account** filter. The same count sits in the Pipeline's Fix-ups strip as {{chip:yellow|No job account · N}}. Clear a job by marking the account opened, or not needed, on the house's roster under **Supply houses**.

The older **Packet on file, unflagged** and **Flagged, no packet** filters stay on the Held for suppliers tab. They serve the packet bookkeeping. They no longer raise Dashboard cards.
