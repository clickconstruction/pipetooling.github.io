---
title: send a bill to more than one person
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: second email, copy, cc, bills also go to, contacts, AP clerk, spouse, GC copy, send to, extra recipient, two emails, another email
order: 13
---
A bill is addressed to one party — the job customer, or the GC when **Bills go to** says so. Often someone else needs a copy: the accounts-payable clerk at a builder, a spouse, the property manager, or the GC on a homeowner's job. Say it once and every bill on that customer's jobs starts with them ticked.

## Set it on the job

1. Open the job in **Edit Job**. Under the customer's Email (and under **Bills go to** when the job has a GC) there is a **Bills also go to** row. Collapsed, it names who is copied — or *nobody else*.
2. Click it. You see the people on file for whoever pays this job, each with a tick:

:::example the row, opened
☑ **DRF** ap@drfbuilders.com · contact on Josh Peterson
☐ **Lisa Peterson** lisa.p@gmail.com · contact on Josh Peterson
{{button:outline|+ Add a person}}
:::

3. Tick who should get every bill. The tick saves on its own, straight onto the customer's record — so the next job for this customer already has them.
4. Nobody on file yet? {{button:outline|+ Add a person}} takes a name and an email and adds them as a contact of the customer, already ticked.

## Copy the GC, or copy the customer

On a job with a GC who is not the customer, the row also offers the party who is **not** being billed:

- Customer pays → *Copy Done Right Foundation · the GC, not billed*
- GC pays → *Copy Laura Shearer · the customer, not billed*

Tick it and every bill on this job copies them. It is a setting on the job, not on the customer, because it depends on who pays this one. On a **Split by line** job the row does not offer it — each draft picks its own payer there.

## What Bill Customer does with it

Open {{button:blue|Send bill…}} on the job and the **Send to** list starts with those people ticked under the primary address. Untick anyone to skip them on this one bill, or type a one-off address underneath. The setting on the job is untouched — the next bill starts ticked again.

## Set it from the customer instead

**Customers → click the customer → Contacts** shows the same people. Edit one and tick **Gets a copy of every bill** (it needs an email). The contact wears a {{chip:green|gets every bill}} chip so anyone can see who is copied.

## Good to know

- Copies never repeat the address the bill is sent to, and a bill to a typed one-off recipient (a tenant, via *Bill to ▾ → Someone else…*) never carries the customer's people — only an address you type on that bill.
- Up to ten copies per bill.
- Right now the copies ride the **emailed PDF invoice**. A **Stripe** bill still goes to its one address; copies on Stripe bills are coming next.
