---
title: see a customer's full profile from the Pipeline board
category: Office
roles: assistant, master_technician
keywords: customer, profile, modal, pipeline, stages, balance, days to pay, contact
order: 45
---
Every job row on Jobs → Pipeline shows the customer's name with a small contact-card icon. Click the icon or the name to open the customer's profile without leaving the board.

## What's in the profile

The profile is everything the app knows about the customer.

:::example Done Right Foundation
{{chip:blue|Commercial}} · Customer since Mar 2024

**Open balance $11,040** {{chip:green|none 30+ days}} · **Lifetime collected $86,410** · **Pays in ~9 days**
:::

- **Header** shows chips for Commercial/Residential. A {{chip:gray|GC on 7 jobs}} chip shows when they are a General Contractor on jobs. A GC, the general contractor, runs the whole build. The subline says when a statement was last sent.
- **Contact band** shows the phone, which you tap to call. It shows the email, which you tap to write, and the address, which opens Maps. Any contact persons on file are listed too.
- **Money strip** shows their **open balance** with an aging chip. The chip is green when nothing is 30+ days old, then amber and red as bills age. It shows **lifetime collected** across all their jobs. It shows **"Pays in ~N days"**, the median time from bill sent to payment received over the last year. The median is the middle value. Glance at it before a collections call. A customer who normally pays in 9 days with a fresh balance needs a different conversation than one at 45.
- **Jobs list** puts money first. Each job row shows its status dot and the job as a link. The link opens Job Detail *on top* of the profile. The row shows what is billed and how old it is. {{chip:red|170d}} turns red at 90+ days. The open dollars sit on the right. The visible rows plus the *+N more · $X open* line always add up to the open balance. **show all** expands the full list.
- **Projects** shows full names with the current step and who is on it, like *step 4/9 · Top Out · Malachi*. A flag shows when the step is stuck: waiting, unassigned or no schedule. Click to open the workflow.
- **Bids** starts with a summary line, like *44 total · 9 won · 11 lost · 24 undecided*. Then come two-line rows sorted chase-first, the ones to chase at the top. The top line has the bid number, the project and the **bid value**. The bid number opens Bid Preview. The line below has the **address** and a **clock**. The clock reads {{chip:yellow|due in 3d}} for live bids. It reads *sent 22d ago · undecided* for submitted ones. It reads *won · Jun 12* once decided. The rest sit behind **show all**.
- **Estimates** shows the number, title, status and the **dollar amount**. Click to open the estimate.
- **Recent activity** shows the latest notes and events across their newest jobs. It answers "what is happening with this customer lately" without opening anything.
- **Footer** has {{button:outline|✎ Edit customer}}, which opens the normal customer editor. **Their projects** filters the Projects page to them. A **Public page** button is reserved here for a coming feature.

## Jobs without a linked customer

A job may only have a customer *name* typed on it, with no linked customer record. Then the same icon opens the **link-or-create flow** instead. You can fix the link right there. The "Not in Customers" badge next to the name is the tell.
