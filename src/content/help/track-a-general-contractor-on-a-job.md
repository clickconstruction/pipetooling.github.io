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

:::example Linked to a bid? Mostly automatic.
Jobs **created from a bid** inherit the bid's GC/Builder automatically, and linking a bid to an existing job fills the GC if it's empty. For anything else, the {{chip:blue|Use bid's GC}} button copies it over in one click.
:::

## Where the GC shows up

- **Jobs → Pipeline**: under the customer name in the Job column, marked with a hard-hat icon.
- **Job Detail**: under the customer name in the Customer block.
- **Pipeline search**: typing a GC's name surfaces every job under that GC.
- **Pipeline GC filter**: once any job has a GC, open the **⋯** menu at the right end of the search bar — a **Filters** group at the top holds the hard-hat GC dropdown. Pick a GC to see only their jobs (every section and total follows), or **No GC set** to see the jobs still needing one. While a filter is on, a blue chip with the GC's name sits in the search bar — tap its × to clear it.

## GC Review — outstanding money by GC

On **Jobs → Pipeline**, the **Billed Awaiting Payment** section header has a {{button:outline|GC Review}} button (next to Accounts Receivable). It groups everything awaiting payment by GC: each General Contractor's customers, when each was billed out, how many days ago, and the GC's outstanding total. Jobs without a GC gather in a **No GC set** bucket at the bottom, so the grand total always matches the section header — and that bucket doubles as your list of jobs to go set GCs on.

- Tick **Include Collections** to fold hard-to-collect jobs into the view (marked with a red chip).
- Hit the {{button:outline|🖨}} print button on any GC row for that GC's **statement** — their customers, bill-out dates, days outstanding, and amounts. **Print all** makes one report of every section.

## Send a statement to a GC

Each GC row also has {{button:outline|Copy}} — one click copies a **GC-facing statement** (job address, the date the bill was sent, and the amount owed, with a total). Paste it into Gmail, Outlook, or Apple Mail and it lands as a clean formatted table; a suggested subject line rides at the top of the copy so you can cut it into the subject field. This version is written for the GC's eyes — no internal chips or days-past-due language.

Prefer the app to send it? Click {{button:outline|Email…}} on the same row. The dialog pre-fills the **To** address from the GC's customer record (editable — statements often go to an AP inbox) and the subject line; hit {{button:blue|Send statement}} and the app emails the same table from **team@noreply.pipetooling.com** with *your* email as the reply-to, so responses land in your inbox. After a send, the row shows a small **last sent** date so the office can see at a glance which GCs have already been statemented.
- When any job has a **development** set, a **Group by** toggle appears — flip to **By Development** to see the same rollup per development instead.

## Share the whole report

The {{button:outline|⇪ Share all}} button at the top of GC Review handles the entire report at once:

- **Print / save as PDF** opens the same one-report print that **Print all** makes — choose *Save as PDF* in the print window to download a copy.
- **Email it from the app** sends every section as one email — each GC with its jobs, bill-sent dates and amounts owed, plus the grand total — to **any address, inside or outside the company**. Same clean table styling and GC-safe wording as the per-GC statement, sent from **team@noreply.pipetooling.com** with your email as the reply-to.

## What the GC does *not* change

Billing. Invoices still go to the job's customer. If the GC is actually who pays a particular invoice, use **Bill to** on that invoice in Bill Customer — that's a per-invoice choice and works with or without a GC set here.
