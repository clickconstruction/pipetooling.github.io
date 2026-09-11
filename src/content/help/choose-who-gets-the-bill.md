---
title: choose who gets the bill on a job
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: bills go to, GC pays, general contractor, homeowner, who pays, billing email, bill to, split, payer
order: 11
---
Some jobs bill the homeowner. Some bill the GC. Some bill each of them for different work. Since v2.3345 the job says which, in one place, and every bill follows it — you never have to type the GC's address into the customer's email again.

## Tell the job who pays

1. Open the job in **Edit Job**. Make sure the **Customer** is the site owner and **GC/Builder** is the contractor (use **Use bid's GC** when the job came from a bid).
2. A **Bills go to** row appears under the customer's Email. Pick one:

:::example the three choices
{{chip:blue|This customer}} — bills, the statement and the portal address the job customer. This is the default.
{{chip:yellow|GC · Loberg Contracting}} — bills address the GC at its billing email. The customer is not billed.
{{chip:gray|Split by line}} — each draft invoice on the Bill tab picks its own payer.
:::

3. The row saves by itself, like every other fact on the Edit tab.

## Give the GC a billing email

A GC usually has two addresses: the estimator you bid to, and the accounts-payable inbox that pays. Under the GC's rows in Edit Job, open **Billing email** and enter the AP address — it is saved on the GC's customer record, so every job billed to that GC uses it. Blank means "same as their email". You can also set it on **Edit customer**.

## What Bill Customer does with it

Open {{button:blue|Send bill…}} on a GC-pays job and the window says so at the top: *Billing Loberg Contracting, the GC on this job — not ATI Schertz*. The **Send to** address is the GC's billing email, the contact list is the GC's people, and the PDF's *Bill to* line and the Stripe invoice name the GC. Tick **Copy ATI Schertz** to send the customer a copy of the emailed PDF.

If the GC has no billing email yet, the window asks for it right there and saves it on the GC.

## One bill to a different party

On a **Split by line** job, or as a one-off on any job, use {{button:outline|Bill to ▾}} on the draft's row in **Edit Job → Bill**. Pick the customer, the GC, or **Someone else…** for a tenant or property manager (that one still asks for a name and email — see *bill part of a job to someone else*). The row wears a {{chip:yellow|→ Loberg Contracting}} chip so anyone can see where that bill goes.

## Good to know

- The GC choice only appears when the job's GC is a different customer than the job customer. If you entered the GC as the customer too, the bills already go to the GC — nothing to change.
- Changing **Bills go to** never touches a bill that has already been sent.
- **GC Review and the weekly statement** list only what each GC pays. A job whose GC is not the payer sits in the **Not billed to a GC** bucket.
- **The portals** follow it too: a GC's balance is what the GC owes, and bills on their jobs that went to the owner show under *On your jobs, billed to someone else* with no Pay button. Owners see the same the other way round.
