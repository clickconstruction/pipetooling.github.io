---
title: bill part of a job to someone else
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: bill to, tenant, alternate payer, split invoice, hazmat fee, third party, property manager, recipient
order: 12
---
Sometimes one bill on a job needs to go to a different payer than the job's customer — the classic case is a **hazmat fee the customer's tenant is responsible for**, while the customer pays everything else. Any draft invoice can be given its own recipient.

## The fast path: a hazmat fee the tenant pays

1. Open the job in **Edit Job**. In ① Line Items, find the fee's red **RIDERS** row.
2. Click {{button:secondary|Bill separately…}}. The fee moves onto its own draft invoice (the customer's bill shrinks by the same amount automatically) and the **Bill this invoice to…** window opens.
3. Enter the tenant's **name and email** (phone optional) and {{button:primary|Save}}.
4. Send both bills from the **Invoices** table as usual — {{button:primary|Send bill…}} on each. The customer's invoice goes to the customer; the fee invoice goes to the tenant.

:::example what the tenant receives
The tenant gets their own invoice — Stripe payment page or PDF email, whichever channel you choose — for exactly the fee amount, addressed to them. The Biohazard Fee Notice email can go to them too (they are the payer). Their payment lands on the job like any other payment.
:::

## Billing any draft invoice to someone else

The same works for any split, not just hazmat fees:

1. In **Edit Job → ② Invoices**, create the draft you want (break one off with **Make Invoice**, or select segments in the strip).
2. On the draft's row, click {{button:secondary|Bill to…}} and enter the recipient. The row shows an amber {{chip:warning|→ name}} chip so anyone can see this invoice bills someone else.
3. **Send bill…** as usual. The Bill Customer window shows a banner naming the alternate recipient so there are no surprises before you press send.

## Good to know

- **The rest of the job is untouched.** Only the invoice you mark bills the other person; every other invoice still goes to the job's customer.
- **Change your mind any time before sending**: open {{button:secondary|Bill to…}} again and edit the details, or press **Bill the job customer** to remove the override.
- **A fee billed to a tenant never folds back into the customer's bill.** The "include hazmat fee" roll-in checkbox skips invoices that have their own recipient.
- Billing an alternate payer through Stripe creates a separate Stripe customer for them — the job customer's saved Stripe details are never modified.
- Once an invoice has been sent, its recipient can't be changed — send it back first if you need to redo it.
