---
title: send a bill to more than one person
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: second email, copy, cc, bills also go to, contacts, AP clerk, spouse, GC copy, send to, extra recipient, two emails, another email, show it on their statement, share this bill
order: 13
---
A bill goes to the job's customer, or to the GC when **Bills go to** says so. Often someone else needs a copy too.

The copy might go to the accounts-payable clerk at a builder, a spouse or the property manager. You name these people once. Then every bill on that customer's jobs starts with them ticked. The copy might also go to the GC on a homeowner's job.

## Set it on the job

1. You open the job in **Edit Job**. There is a **Bills also go to** row under the customer's Email. When the job has a GC, it sits under **Bills go to** too. Collapsed, it names who is copied, or says *nobody else*.
2. You click it. You see the people on file for whoever pays this job, each with a tick:

:::example the row, opened
☑ **DRF** ap@drfbuilders.com · contact on Josh Peterson
☐ **Lisa Peterson** lisa.p@gmail.com · contact on Josh Peterson
{{button:outline|+ Add a person}}
:::

3. You tick who should get every bill. The tick saves on its own, straight onto the customer's record. So the next job for this customer already has them.
4. Nobody on file yet? {{button:outline|+ Add a person}} takes a name and an email. The person is added as a contact of the customer, already ticked.

## Copy the GC, or copy the customer

Some jobs have a GC who is not the customer. There, the row also offers the party who is **not** being billed:

- Customer pays → *Copy Done Right Foundation · the GC, not billed*
- GC pays → *Copy Laura Shearer · the customer, not billed*

You tick that line, and every bill on this job copies them. The tick is a setting on the job, not on the customer. The reason is that it depends on who pays this one. On a **Split by line** job, the row does not offer it. Each draft picks its own payer there.

A copy is the email, once. Sometimes the other party should also **see the bill on their portal statement**. An example is a builder keeping an eye on which homeowners still owe for repairs. For that, you use the line right under *Copy* in Bill Customer: **Show it on Done Right Foundation's statement**. Showing it is a separate tick, with its own memory row on the job: **Show Done Right**. The reason is that an email and a standing statement are different promises. See *choose who gets the bill on a job* → Show the other party a bill they don't pay.

## What Bill Customer does with it

You open {{button:blue|Send bill…}} on the job. The **Send to** list starts with those people ticked under the primary address. The list starts that way on the Stripe tab and the PDF tab alike. You untick anyone to skip them on this one bill. Or you type a one-off address underneath. The setting on the job is untouched. The next bill starts ticked again.

## Set it from the customer instead

**Customers → click the customer → Contacts** shows the same people. You edit a contact and tick **Gets a copy of every bill**. The contact needs an email. The contact wears a {{chip:green|gets every bill}} chip, so anyone can see who is copied.

## Good to know

- Copies never repeat the address the bill is sent to. A bill can go to a typed one-off recipient, like a tenant, through *Bill to ▾ → Someone else…*. That bill never carries the customer's people. That bill carries only an address you type on it.
- Up to ten copies per bill.
- **Stripe bills**: the bill email goes only to the billing address. The others get a copy from Click Plumbing and Electrical the moment you press {{button:blue|Send Email invoice}}. The copy has the amount, the due date and the same **Pay or view the bill** link. The copy also has a line saying who was billed. Each person gets their own email, so nobody sees the other addresses. Each email ends with that person's own statement: its short address beside a QR code. The bill email carries the same card. The customer's people see the customer's statement, and a GC sees theirs. A one-off address has no statement, so its copy has no code. The confirm step lists who will be copied. The toast afterward names who was. The confirm step's send history shows, under each past send, who got a copy that time.
- A **test-mode** Stripe bill copies nobody on the list. One copy comes to whoever pressed Send, marked as a test. That copy has a line naming the addresses it did not go to. The confirm step and the toast say the same.
- Sharing a Stripe bill by text or copied link emails nobody, so it copies nobody either.
- **PDF invoices** go out as one email with everyone on it.
