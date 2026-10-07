---
title: track a general contractor on a job
category: Office
roles: dev, master_technician, assistant, controller
keywords: GC, general contractor, replies go to, reply-to, on behalf, check and send, builder, gc/builder, second customer, manage by gc, hard hat, stages, job customer, statement, draft message, pay online, nothing owed, portal card, email template, print unpaid invoices, print invoices, all invoices, invoice pdf
order: 73
---
A job's **customer** is the party the work is for. On commercial work, a second party often matters day to day: the **General Contractor** running the site.

You can link a GC to any job. The job's **Bills go to** row then decides whether the bills go to the customer or the GC. See [Who gets the bills](#who-gets-the-bills).

## Set a GC on a job

1. Open the job and go to its **Edit** tab.
2. Click the **GC/Builder** row, the one with the hard hat.
3. Search and pick the GC. A GC is just a customer row. The list of GCs is the one Bids uses for GC/Builder.
4. The GC saves automatically. Use {{button:outline|Clear GC}} in the same row to remove it.

On **New Job**, the same pick sits in the Customer section, under ***GC/Builder (customer)***. That GC saves when you press **Create Job**.

:::example Linked to a bid? Mostly automatic.
Jobs **created from a bid** inherit the bid's GC/Builder automatically, and **Bills go to** is set to the GC. A bid sent to several GCs asks *Which GC gave you this job?* first. Linking a bid to an existing job fills the GC if it's empty. For anything else, the {{chip:blue|Use bid's GC: Knight Homes}} button copies it over in one click.
:::

## Where the GC shows up

- **Jobs → Pipeline**: under the customer name in the Job column, marked with a hard-hat icon.
- **Job Detail**: under the customer name in the Customer block.
- **Pipeline search**: typing a GC's name surfaces every job under that GC.
- **Pipeline GC filter**: the filter is there once any job has a GC. You open the **⋯** menu at the right end of the search bar. A **Filters** group, under **Sort**, holds the hard-hat GC dropdown. You pick a GC to see only their jobs. Every section and total follows. Or you pick **No GC set** to see the jobs still needing one. While a filter is on, a blue chip with the GC's name sits in the search bar. You tap its × to clear it.

## GC Review — outstanding money by GC

On **Jobs → Pipeline**, the **Billed Awaiting Payment** section header has a {{button:outline|GC Review}} button. The button sits next to Accounts Receivable. GC Review groups everything awaiting payment by the GC that **pays** it. The payer comes from the job's **Bills go to** setting, or the bill's own *Bill to* pick. GC Review shows when each bill went out, how many days ago, and the GC's outstanding total. Each GC is **one row**. The row holds its balance, its three steps for the week and the next thing to do. You **click the row** to open its bills.

Jobs without a GC gather in a **Not billed to a GC** bucket, under *Nothing to check this week* at the bottom. Jobs whose GC is on the job but the owner pays gather there too. **Total outstanding** is pinned at the bottom of the window. The total matches the section header when Include Collections is unticked and no search or filter is on. That bucket doubles as your list of jobs to go set GCs on, or Bills go to. You open the bucket and **click any job** to open Edit Job right on top. You set the GC or fix anything else. The report refreshes itself when you save.

- **Include Collections** sits at the bottom, beside **Total outstanding**. The box is ticked by default. Hard-to-collect jobs then ride along in the view and in Share all and Print all. On screen they wear a red Collections chip. You untick it to see active billing only. Certification and the weekly statement rounds always look at active jobs only, whichever way the box is set.

## Certify each GC — the Wednesday ritual

Every week, the office certifies each GC's group before sending statements. Certification is due Wednesday. Certifying means you confirm each bill belongs to this GC and the amount is right. Certifying is the office's own sign-off, not the GC's. The week's list, its stage track and the word are in [run your weekly GC statement round](/help/run-your-gc-statement-round). Each unchecked GC's row has a {{button:blue|Check bills}} button. The opened row has a {{button:blue|Certify}} button inside it:

1. Clicking the button opens a **per-bill checklist**. Check off each bill as you confirm it belongs to this GC and the amount is right.
2. Not sure about one? The **▾ chevron** drops down the job's recent activity right in the list. Clicking the **job link** opens Job Detail on top. You dig in and close it, and your checkmarks are still there.
3. When every bill is checked, {{button:outline|Check only}} records the attestation. The attestation is the record of who signed off, when, and exactly what. {{button:blue|Check & send…}} signs off and opens the statement email as a draft. The GC is already on the **To** line. The subject reads **Click Plumbing open balances: Aug 22, 2026**. Nothing sends until you click {{button:blue|Send statement}}. The statement's footer tells the GC to reply or **call the office at** a number. The number comes from **Settings → Jobs & billing**, in the company block for the printed invoice. A dev sets the phone there once. Every statement carries the number, whether sent now, scheduled, or pasted.

The opened row then shows {{chip:green|✓ Certified · Taunya · 7:02 AM}}. A bill may land or a payment may post **after** sign-off. Then the chip flips to {{chip:yellow|Changed since certified · +$2,700.00}} with a Re-certify button. So a sent statement never silently drifts from what was reviewed. Certifications reset each week.

**The Dashboard reminds you**: starting Wednesday, office staff see an amber item in the **Needs you** card. The item reads *GC review is due today*, or *GC review is still due this week* from Thursday. Under the title, a line says how far along you are, like *3 of 9 GCs certified · 2 statements sent*. **Open GC Review** opens it in one click. The item turns green for the rest of Wednesday once every GC is certified and sent. Sent can mean by **Draft Message** or by a scheduled send to that GC. Sent can also mean a statement marked sent on the **This week** tab. A "Spoke with them" mark doesn't count. Nor does an "All GCs" office copy. Then the card stays away until the next week's ritual.
- You open a GC's row. Every sharing action for that GC lives behind its {{button:outline|Share}} dropdown. The actions are **Draft Message**, **Copy**, **Print**, **Print unpaid invoices**, **Find a check…** and **Mark sent / spoke with them…**. **Copy portal link** sits under *Portal*. The {{icon:help|globe}} next to the GC's name is their portal, same as everywhere else. A portal is the GC's own web page of open bills and payments.

## Send a statement to a GC

You open the GC's row and pick **Copy** from its {{button:outline|Share}} menu. One click copies a **GC-facing statement**. A statement lists the GC's open bills and what is owed. The statement opens with what is owed. Then the statement reads one property at a time. Each property shows the street once, with that property's own subtotal. Under the street is a line for each open bill. The line has the job number, the day the bill was sent, and what is still owed. You paste it into Gmail, Outlook, or Apple Mail and it lands as a clean formatted table. A suggested subject line rides at the top of the copy. You can cut it into the subject field. This version is written for the GC's eyes, with no internal chips or days-past-due language. **Print** in the same menu makes that GC's printable statement.

:::example What the GC reads
**Owed now $23,650.00** — 3 open bills at 2 properties. $28,650.00 billed, $5,000.00 paid so far.
**4400 Sample Pkwy** Kyle · 2 open bills — **$21,650.00**
Job 1042 · Bldg 2 rough-in · Aug 27 · $15,200.00 — *$5,000.00 paid by #4417 on Sep 8, of $20,200.00 billed*
Job 1051 · Bldg 3 top-out · Sep 24 · $6,450.00
**212 Example Ln** Buda · 1 open bill — **$2,000.00**
Job 1058 · Service Visit · Sep 21 · $2,000.00
**Total owed $23,650.00**
:::

- **What counts as one property.** Jobs linked to the same property record share a block, however each job's address was typed. A job with no property record joins the block its cleaned-up address matches. If one place shows as two blocks, you set the property on the job in Edit Job → Property record.
- **The job's name** shows only when it says something. *Trip Charges* stays. A repeat of the GC's own name is left off. A repeat of the address that heads the block is left off too.
- **A payment shows under the bill it was recorded against**, with the check number and the day. A bill with nothing paid is one plain line.
- **Payments we have received.** Under the total is every payment the GC sent in the last 30 days, newest first. Each payment has the check number, the day, and the property and job it went to. A check that paid a job off says *now paid in full*. When none came, the statement says so and asks the GC to reply if they sent one. The list is read as you open the GC's row, so Copy carries it too.
- **Paid on the job, not on a bill.** A job may carry a payment that was never put on a bill. The Draft Message dialog says so before you send. The warning reads *Paid on the job, not on a bill: Job 1042 $3,000.00.* The statement still shows that job's bills as owed in full. If the money was for those bills, you match it in Edit Job → Payments, then send.

## Print a GC's unpaid invoices

The statement lists what is owed. Sometimes the GC wants the bills themselves. You pick **Print unpaid invoices** from the GC's {{button:outline|Share}} menu. A new tab opens with **every unpaid invoice on that GC's statement as one PDF**. Each invoice is the same one you get from View bill, one after another, in the statement's order. You print it or save it from the PDF's own toolbar.

- The PDF prints what the statement shows. With **Include Collections** ticked, the hard-to-collect bills are in the stack. Unticked, those bills are left out.
- Each job is re-read as the PDF builds. So a bill paid or sent back since you opened GC Review is left out. A part-paid bill still prints, with its payments and the balance due.
- A row that is a job balance with no bill behind it has no invoice to print. The message that follows says how many invoices printed and names anything left out.

:::example After the PDF opens
19 unpaid invoices for RMC- Dudley Mason.
:::

If the tab does not open, you allow pop-ups for the app and pick it again.

Prefer the app to send it? You choose **Draft Message** from the same Share menu. The top of the dialog reads like the email it becomes: **From**, **To**, **Cc**, **Reply to**, **Subject**. From is the company name the GC sees and cannot be changed. To is the GC's address from their customer record. The To line shows their name with the address beside it. You press **Change** to pick someone else.

One menu serves To and Cc. The GC's own contact people come first, then the office. The contacts come from Customers → contacts. The ones ticked *Gets a copy of every bill* wear a *gets bill copies* mark here. You type a name to find one. Or you type a whole address and pick **Use …** to send anywhere. A sentence under the header says the send back before it goes. The sentence reads *Goes to RMC- Dudley Mason. Their reply goes to Malachi. You get a copy*. You hit {{button:blue|Send statement}} and the app emails the same table from the company's address.

To read it first, you press {{button:outline|Preview}}. Preview lays the exact email over the dialog, full size. **← Back** returns you to the dialog with everything you typed still there. Esc does the same. Nothing has been sent. After a send, the opened row shows a blue **Sent Oct 7** pill. A send from an earlier week reads *last sent* with its date instead. So the office sees at a glance which GCs already got their statement this week.

**Reply to** is the fourth line. The line shows when more than one office person can take replies. Every GC has an account man, the teammate who knows that GC. An account man with an office role and an email is already picked, so the GC's "Reply" reaches them. Your copy shows on the Cc line, marked *copied, since replies go to Malachi*, so the thread reaches the office too. You pick yourself to take the replies, and the copy goes away. After sending, the message says where replies went. A scheduled send replies to whoever scheduled it. The line greys with that reason.

Need someone else on the thread? You press **+ Add** on the **Cc** line. You tick as many as ten from the same menu, or type an address. You press × on a name to take it off. Whoever is on To is greyed in the menu. The Cc applies to Send now and to scheduled sends. A weekly schedule keeps its list.

If the GC has a portal, the dialog's **Include portal link** box is checked. The email then ends with a *Your account, any time* card. The card has a **QR code** the GC can scan with a phone camera. The GC's address is in words beside the code: **my.clickplumbing.com/their-name**. The card also has one sentence: *Pay online and see every open bill and payment, with no login.* You untick the box to send the plain statement. Scheduled sends include the card automatically while the portal is active. **Copy** pastes the card with the address and without the code. A picture pasted into a personal mail program does not always arrive.

:::example Nothing owed? Nothing goes out
Open Draft Message on a GC whose total is $0.00 and the dialog says **Nothing owed — no statement goes out.** with {{button:blue|Send statement}} greyed out — the app will not email anyone a "Total owed $0.00". (Schedule… is still allowed: a scheduled send rebuilds the statement that morning and skips itself if the balance is still zero.)
:::

Want the statement to open with a line of your own? A dev sets it in {{icon:gear}} ***Settings → Email templates & testing → GC statement (Draft Message + scheduled)***. The template holds the subject and an intro paragraph. Saved once, both Draft Message and the scheduled sends carry it. The subject prefills in the dialog. You can still edit it for a send now. A scheduled send uses the standard subject. {{button:outline|Preview}} shows the intro in place.

Don't want to remember to send it? You flip **When** to **Schedule…** and pick a date and time, in Central time. You can also tick **Repeat weekly**. The app then sends the statement by itself. The statement is rebuilt fresh at send time, so it always shows that morning's numbers. A GC with nothing outstanding is skipped, never emailed an empty statement. Draft Message applies the same rule before you click. Every office scheduled send appears in the **Scheduled statement sends** list on GC Review's **Scheduled** tab. Only whoever scheduled a send, or a dev, sees its **Cancel**. Cancelling ends a weekly repeat. The **Share all** dialog's email can be scheduled the same way.
- When any job has a **development** set, two pills appear, **By GC** and **By Development**. A development is a group of properties built as one project. You press **By Development** to see the same rollup per development instead.

## Share the whole report

Two buttons beside the tabs at the top of GC Review handle the entire report at once. {{button:blue|⇪ Share all}} opens the whole-report dialog. {{button:outline|🖨 Print all}} prints every section as one report. The dialog holds:

- **Print / save as PDF** opens the same one-report print that **Print all** makes. You choose *Save as PDF* in the print window to download a copy.
- **Email once** sends every section as one email to **any address, inside or outside the company**. Its button reads **Send report**, or **Schedule send**. The email holds each GC with its jobs, bill-sent dates and amounts owed, plus the grand total. You tap one of the **teammate chips** above the To field to fill an office teammate's email in one tap. Or you just type any address. The email has the same clean table styling and GC-safe wording as the per-GC statement. The email is sent from **team@noreply.clicktooling.com** with your email as the reply-to.

Devs also get a **Standing copies** section in the same dialog. You pick a teammate or type an outside email. You toggle the **weekdays**, say Mon and Wed for a Leader. You set the time and hit {{button:blue|Add}}. The report emails itself on those days, rebuilt fresh each send. The standing copy runs forever until you **Remove** it. Each standing copy shows as one line with Edit / Remove. The list on GC Review's **Scheduled** tab shows it grouped the same way.

## Who gets the bills

Setting a GC does not move the bills by itself. The job's **Bills go to** row on the Edit tab decides that. It reads *This customer*, the GC by name, or *Split by line*. A job made from a won bid bills the GC. So does a GC job with no customer. You may pick the job's customer as its GC. Then the customer link clears and Bills go to becomes the GC.

For one bill, use {{button:outline|Bill to ▾}} on its draft row in the job window's **Bill** tab. It offers the customer, the GC when the job has its own GC, and *Someone else…*. Bill Customer follows that choice. GC Review lists a job under its GC only when the GC pays.
