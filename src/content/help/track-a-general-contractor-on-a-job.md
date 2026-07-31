---
title: track a general contractor on a job
category: Office
roles: dev, master_technician, assistant
keywords: GC, general contractor, builder, gc/builder, second customer, manage by gc, hard hat, stages, job customer
order: 73
---
A job's **customer** is who you bill. But on commercial work there's often a second party that matters day to day — the **General Contractor** running the site. You can now link a GC to any job and manage work by GC without touching billing.

## Set a GC on a job

1. Open the job and click {{button:outline|Edit}}.
2. Expand the **Customer** section.
3. Under **GC/Builder (customer)**, search and pick the GC. A GC is just a customer row — the same list Bids uses for GC/Builder.
4. It saves automatically. Use {{button:outline|Clear GC}} to remove it.

:::example Linked to a bid? One click.
If the job is linked to a bid, a {{chip:blue|Use bid's GC}} button appears with the bid's GC/Builder name — one click copies it onto the job.
:::

## Where the GC shows up

- **Jobs → Stages**: under the customer name in the Job column, marked with a hard-hat icon.
- **Job Detail**: under the customer name in the Customer block.
- **Stages search**: typing a GC's name surfaces every job under that GC — that's the "manage by GC" view.

## GC Review — outstanding money by GC

On **Jobs → Stages**, the **Billed Awaiting Payment** section header has a {{button:outline|GC Review}} button (next to Accounts Receivable). It groups everything awaiting payment by GC: each General Contractor's customers, when each was billed out, how many days ago, and the GC's outstanding total. Jobs without a GC gather in a **No GC set** bucket at the bottom, so the grand total always matches the section header — and that bucket doubles as your list of jobs to go set GCs on.

- Tick **Include Collections** to fold hard-to-collect jobs into the view (marked with a red chip).
- Hit {{button:outline|Print}} on any GC row for that GC's **statement** — their customers, bill-out dates, days outstanding, and amounts. **Print all** makes one report of every section.

## What the GC does *not* change

Billing. Invoices still go to the job's customer. If the GC is actually who pays a particular invoice, use **Bill to** on that invoice in Bill Customer — that's a per-invoice choice and works with or without a GC set here.
