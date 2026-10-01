---
title: see a customer's full history and lifetime value
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: customer page, customer hub, lifetime value, LCV, customer profile, open balance, customer history, customer detail, property, additional addresses, county, legal description, owner of record, parcel, lien-ready, appraisal district, CAD
order: 41
---
Every customer has a page of their own. Click their name on the Customers page to see who they are, their worth and everything in motion.

## Open a customer's page

1. Go to **Customers**.
2. Click anywhere on the customer's row. The small ✎ pencil next to the name still opens the quick edit form. You stay on the list.

## Rank your top customers

On the **Customers** list, every customer's lifetime value shows in green on their row. Click {{button:outline|$ Top customers}} in the filter row. The whole list sorts by value, highest first. Search and the Commercial/Residential filters still apply.

## Work the list with the stat band and filters

The band at the top of the **Customers** page shows your totals. It shows the customer count and how many were active in the last 90 days. It shows the **total open balance** across everyone and how many customers still need a type. Below it:

- {{button:amber|Owes money (34)}} filters to customers with an open balance. The list becomes your receivables view, the list of who owes you.
- {{button:outline-blue|Active 90d}} hides customers with nothing happening.
- {{button:outline-blue|Recent first}} sorts by the latest job or payment, newest activity on top.

Filters, sorts and search all combine. They live in the page address, so you can bookmark or share any view.

## Read a customer's row at a glance

Every row ends in the **money rail**, three lifetime figures. {{chip:green|paid}} is what was collected. {{chip:yellow|billed}} is everything ever invoiced. {{chip:blue|unbilled}} is work on the books not yet invoiced. A small color bar underneath shows the mix. Customers with no money history show dashes and no bar.

Before the rail, chips only appear when there is something to say:

- {{chip:blue|3 open jobs}} means jobs not yet paid. Click it to open their Jobs tab.
- {{chip:yellow|owes $1,883}} is their open balance. It turns red past $5,000. Click it for their invoices.
- ***job · Aug 8*** or ***payment · Aug 14*** is the last thing that happened. A customer with nothing in 90+ days fades to *quiet since…*.
- {{chip:blue|possible duplicate}} means this customer shares a name, address, phone or email with another. Click it to review and merge.
- The **notes** chip opens their notes right on the list, like before.

:::example What you'll see
The customer's name and type at the top, their phone / email / address as tap-to-call and tap-to-email links, and the money strip right below.
:::

## Read the money strip

- **Lifetime value** is everything ever billed to this customer. The amount actually collected sits underneath. This is the same "how much has this customer been worth" number HouseCall Pro showed.
- **Open balance** is what they still owe. An aging chip appears when anything has been waiting 30+ or 90+ days. It is the same figure the Dashboard's Accounts Receivable card shows for this customer. The Pipeline money strip and the Customers list show it too. One rule counts the bills everywhere.
- **Pays in** is the median number of days between billing this customer and getting paid. The median is the middle value. It comes from their last 12 months of payments.
- **Estimates won** is how many of their decided estimates were accepted.

## Work from the Profile tab

The **Open jobs** panel lists every job that is not paid yet. Click a job number to open its detail card. Or use {{button:outline-blue|View all in Pipeline →}} to see the customer's rows on the Jobs Pipeline.

## Check their estimates

The **Estimates** tab lists every estimate for this customer. Each row shows the status: {{chip:gray|Draft}} {{chip:blue|Sent}} {{chip:green|Accepted}} {{chip:red|Declined}}. It also shows the total, when it was sent and when it was last updated. Click the estimate number to open it.

## See every job they've ever had

The **Jobs** tab is the customer's complete job history. It includes paid jobs the Pipeline normally hides. Each row shows the job's status and a payment progress bar. {{chip:green|Paid}} jobs show what was collected. Click a job number for its detail card. Or click {{button:outline-blue|Open in Pipeline →}} to work their rows on the board.

## Audit their invoices

The **Invoices** tab lists every invoice across all the customer's jobs. Each row shows the channel: Stripe, HCP or Physical. HCP is short for HouseCall Pro. It shows the status: {{chip:gray|Draft}} {{chip:yellow|Billed}} {{chip:blue|Partial}} {{chip:green|Paid}}. It shows the amount, the billed date and the last-paid date. Billed invoices waiting 30+ days show their age on the chip. Stripe invoices link straight to the hosted invoice. The **Lifetime** row at the bottom is the same number as the money strip up top. It includes jobs that were billed before the app kept invoice rows. Its *collected* figure counts every payment on the customer's jobs, just like the strip.

## Follow the Activity feed

The **Activity** panel is one timeline of everything happening for this customer, across all their jobs. It lists stage moves and who moved them. It lists invoices billed, payments received and job notes. It lists estimates created and accepted, dispatch tasks and customer notes.

- Use the {{chip:blue|All}} {{chip:green|Money}} {{chip:blue|Jobs}} {{chip:gray|Notes}} chips to narrow the feed.
- Click any job-linked entry to open that job's detail card.
- {{button:outline|Show older}} pages further back in time.

Use {{button:outline|✎ Edit customer}} in the header to change their info, archive them or merge duplicates. It is the same form as before, just moved onto the page.

## Track more than one property

{{button:outline|✎ Edit customer}} keeps the customer's details on the left and two working lists on the right. **Contacts** holds the people, such as a spouse, a PM or an AP clerk. A PM is the project manager. An AP clerk is the accounts payable clerk, the person who pays the bills. Each contact has their own phone, email and role. **Properties** holds every address the customer owns.

:::example The Properties list
{{chip:gray|Primary}} ★ 412 Gruene Rd, New Braunfels {{chip:green|✓ lien-ready}} Comal · 4 jobs {{button:outline-blue|Edit}}
☆ 55 Pecan Ct, San Marcos {{chip:gray|Rental}} {{chip:yellow|not looked up yet}} county unknown · no jobs yet {{button:outline-blue|Edit}}
3311 Loop 337, New Braunfels — *from this customer's jobs · 2 jobs · not saved as a property* {{button:outline|Add as property}}
:::

- The **★ primary** is the customer's address everywhere: the header, the map link and the pickers. Click ☆ on any other property to make it the primary. The old one stays in the list.
- Each row shows the **county**, whether the property is **lien-ready** and **how many jobs** sit there. A lien is a legal claim on a property for unpaid work. Lien-ready means the record a lien filing needs is complete. {{button:outline|Edit}} opens the property in place. You can edit the address, with suggestions as you type, a note and its legal record. The legal record is in the next section.
- **From this customer's jobs**: a job address that is not saved as a property yet appears as a dashed row. {{button:outline|Add as property}} opens it pre-filled and looks the legal record up for you.
- {{button:outline|+ Add property}} adds a new one. The first property a customer gets becomes the primary automatically. A property with jobs at it cannot be removed until they are moved.
- Contacts and properties **save as you go**. {{button:blue|Save}} at the bottom covers the details on the left.

## Find the property's legal record for lien paperwork

Each additional address also carries the property's **legal identity**. That is the county the lien files in. It is the legal description from the appraisal district, the county office that values property for tax. And it is the owner of record with their mailing address. You no longer type those from the appraisal district's website. Open **▶ Property legal info** under the address. The app looks the property up on the Texas parcel roll, the appraisal districts' own data.

:::example What the lookup fills in
{{button:outline|Look up the property record}} {{chip:green|✓ lien-ready}} Comal CAD ↗

**County** Comal — from the parcel under the map pin
**Legal description** GRUENE CROSSING 2, BLOCK 4, LOT 17 · `Comal Appraisal District · 2025 · Prop ID 178402`
**Owner of record** WHITFIELD DANA & MARCUS · {{chip:blue|Homeowner}}
**Owner mailing address** 412 GRUENE RD, NEW BRAUNFELS, TX 78130
:::

- **The lookup runs by itself** the first time you open the panel. That happens on an address that has never been looked up. {{button:outline|Look up again}} re-runs it after you fix the address.
- **It fills blanks only.** Anything you typed stays. A field that differs from the record shows a small *use the record's: …* link. Click it to take the record's value.
- **County comes from the map, not a guess.** The parcel, the map pin and the city table can disagree. Schertz sits in Bexar, Guadalupe and Comal. Then the panel shows each answer as a pill with where it came from. The parcel wins unless you know better.
- **Homestead is still your call.** A homestead is the owner's own home. The roll has no exemption data. The panel suggests homestead when the owner gets mail at the property, and says so. Confirm the HS exemption on the CAD page before a homestead job starts. HS is short for homestead. CAD is the county appraisal district.
- **The roll lags sales.** The source and tax year print beside every value. The **CAD ↗** link opens the district's own search for the day-of-filing check.
- Nothing may sit under the pin, in a new subdivision or when the pin landed on the street. The county still resolves. The checklist shows what is left to find on the CAD. Open the district's page for the property, select all and copy. Then click {{button:outline|Paste the CAD page…}}. The legal description, owner, mailing address and exemptions are picked out. {{button:blue|Use these}} fills them in.
- Once a property has its Prop ID, the CAD link reads **this parcel on Comal CAD ↗**. It opens that exact parcel page on the district site. That works for Comal, Hays, Guadalupe and the other esearch counties, plus Bexar. It is the fastest day-of-filing check there is.

The checklist under the fields is {{chip:green|✓ county}} {{chip:green|✓ legal description}} {{chip:yellow|○ owner of record}} {{chip:yellow|○ owner mailing address}}. It turns fully green when the property is lien-ready. The {{chip:green|✓ lien-ready}} chip then shows on the address row and on any job linked to it.
