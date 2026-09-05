---
title: see a customer's full history and lifetime value
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: customer page, customer hub, lifetime value, LCV, customer profile, open balance, customer history, customer detail
order: 41
---
Every customer now has their own page. Click a customer's name on the **Customers** page and you land on their hub — who they are, what they're worth, and everything in motion for them.

## Open a customer's page

1. Go to **Customers**.
2. Click anywhere on the customer's row. (The small ✎ pencil next to the name still opens the quick edit form without leaving the list.)

## Rank your top customers

On the **Customers** list, every customer's lifetime value shows in green on their row. Click {{button:outline|$ Top customers}} in the filter row to sort the whole list by value, highest first — search and the Commercial/Residential filters still apply.

## Work the list with the stat band and filters

The band at the top of the **Customers** page shows your totals: customer count, how many were active in the last 90 days, the **total open balance** across everyone, and how many customers still need a type. Below it:

- {{button:amber|Owes money (34)}} filters to customers with an open balance — the list becomes your receivables view.
- {{button:outline-blue|Active 90d}} hides customers with nothing happening.
- {{button:outline-blue|Recent first}} sorts by the latest job or payment, newest activity on top.

Filters, sorts, and search all combine, and they live in the page address — bookmark or share any view.

## Read a customer's row at a glance

Every row ends in the **money rail**: three lifetime figures — {{chip:green|paid}} (collected), {{chip:yellow|billed}} (everything ever invoiced), {{chip:blue|unbilled}} (work on the books not yet invoiced) — with a small color bar underneath showing the mix. Customers with no money history show dashes and no bar.

Before the rail, chips only appear when there's something to say:

- {{chip:blue|3 open jobs}} — jobs not yet paid; click to open their Jobs tab.
- {{chip:yellow|owes $1,883}} — their open balance (turns red past $5,000); click for their invoices.
- **job · Aug 8** or **payment · Aug 14** — the last thing that happened; a customer with nothing in 90+ days fades to *quiet since…*.
- {{chip:blue|possible duplicate}} — this customer shares a name, address, phone, or email with another; click to review and merge.
- The **notes** chip opens their notes right on the list, like before.

:::example What you'll see
The customer's name and type at the top, their phone / email / address as tap-to-call and tap-to-email links, and the money strip right below.
:::

## Read the money strip

- **Lifetime value** — everything ever billed to this customer, with the amount actually collected underneath. This is the same "how much has this customer been worth" number HouseCall Pro showed.
- **Open balance** — what they still owe, with an aging chip when anything has been waiting 30+ or 90+ days.
- **Pays in** — the median number of days between billing this customer and getting paid, from their last 12 months of payments.
- **Estimates won** — how many of their decided estimates were accepted.

## Work from the Profile tab

The **Open jobs** panel lists every job that isn't paid yet — click a job number to open its detail card, or use {{button:outline-blue|View all in Pipeline →}} to see the customer's rows on the Jobs Pipeline.

## Check their estimates

The **Estimates** tab lists every estimate for this customer — status ({{chip:gray|Draft}} {{chip:blue|Sent}} {{chip:green|Accepted}} {{chip:red|Declined}}), total, and when it was sent and last updated. Click the estimate number to open it.

## See every job they've ever had

The **Jobs** tab is the customer's complete job history — including paid jobs the Pipeline normally hides. Each row shows the job's status and a payment progress bar ({{chip:green|Paid}} jobs show what was collected). Click a job number for its detail card, or {{button:outline-blue|Open in Pipeline →}} to work their rows on the board.

## Audit their invoices

The **Invoices** tab lists every invoice across all the customer's jobs — channel (Stripe / HCP / Physical), status ({{chip:gray|Draft}} {{chip:yellow|Billed}} {{chip:blue|Partial}} {{chip:green|Paid}}), amount, and billed / last-paid dates. Billed invoices waiting 30+ days show their age on the chip; Stripe invoices link straight to the hosted invoice. The **Lifetime** row at the bottom is the same number as the money strip up top — including jobs that were billed before the app kept invoice rows — and its *collected* figure counts every payment on the customer's jobs, just like the strip.

## Follow the Activity feed

The **Activity** panel is one timeline of everything happening for this customer, across all their jobs — stage moves (with who moved them), invoices billed, payments received, job notes, estimates created and accepted, dispatch tasks, and customer notes.

- Use the {{chip:blue|All}} {{chip:green|Money}} {{chip:blue|Jobs}} {{chip:gray|Notes}} chips to narrow the feed.
- Click any job-linked entry to open that job's detail card.
- {{button:outline|Show older}} pages further back in time.

Use {{button:outline|✎ Edit customer}} in the header to change their info, archive them, or merge duplicates — same form as before, just moved onto the page.

## Track more than one property

A customer with several properties can have **additional addresses**, each with its own note. In {{button:outline|✎ Edit customer}}, open **Additional addresses**, add each address with a note ("rental on Oak St", "shop — deliveries in back"), and they appear on the customer's page next to the primary address as tap-to-map links with the note beside them. The main Address field stays the primary — jobs and estimates keep using it as before.
