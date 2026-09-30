---
title: track a general contractor on a job
category: Office
roles: dev, master_technician, assistant
keywords: GC, general contractor, replies go to, reply-to, on behalf, check and send, builder, gc/builder, second customer, manage by gc, hard hat, stages, job customer, statement, draft message, pay online, nothing owed, portal card, email template, print unpaid invoices, print invoices, all invoices, invoice pdf
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

On **Jobs → Pipeline**, the **Billed Awaiting Payment** section header has a {{button:outline|GC Review}} button (next to Accounts Receivable). It groups everything awaiting payment by the GC that **pays** it (the job's **Bills go to** setting, or the bill's own *Bill to* pick): when each was billed out, how many days ago, and the GC's outstanding total. Each GC is **one row** — its balance, its three steps for the week and the next thing to do; **click the row** to open its bills. Jobs without a GC — and jobs whose GC is on the job but the owner pays — gather in a **Not billed to a GC** bucket at the bottom, so **Total outstanding** — pinned at the bottom of the window — always matches the section header. That bucket doubles as your list of jobs to go set GCs (or Bills go to) on: open it and **click any job** to open Edit Job right on top, set the GC (or fix anything else), and the report refreshes itself when you save.

- **Include Collections** (at the bottom, beside **Total outstanding**) is ticked by default, so hard-to-collect jobs ride along in the view and in Share all / Print all, marked with a red chip. Untick it to see active billing only. Certification and the weekly statement rounds always look at active jobs only, whichever way the box is set.

## Certify each GC — the Wednesday ritual

Every week (due Wednesday), the office certifies each GC's group before sending statements. The **stage track** pinned at the top tracks the week — **Check → Send → Word → Done**, each with how many GCs are waiting there — and each unchecked GC's row has a {{button:blue|Check bills}} button (and a {{button:blue|Certify}} button inside the opened row):

1. Clicking it opens a **per-bill checklist**: check off each bill as you confirm it belongs to this GC and the amount is right.
2. Not sure about one? The **▾ chevron** drops down the job's recent activity right in the list, and clicking the **job link** opens Job Detail on top — dig in, close it, and your checkmarks are still there.
3. When every bill is checked, {{button:outline|Check only}} records the attestation (who, when, exactly what), and {{button:blue|Check & send…}} signs off and opens the statement email as a draft — the GC's email is already in the To line with their pill lit first (teammates follow), and the subject reads **Click Plumbing open balances: Aug 22, 2026**. Nothing sends until you click {{button:blue|Send statement}}. The statement's footer tells the GC to reply or **call the office at** the number from Settings → Company → invoice issuer — set the phone there once and every statement (sent now, scheduled, or pasted) carries it.

The opened row then shows {{chip:green|✓ Certified · Taunya · 7:02 AM}} — and if a bill lands or a payment posts **after** sign-off, it flips to {{chip:yellow|Changed since certified · +$2,700}} with a Re-certify button, so a sent statement never silently drifts from what was reviewed. Certifications reset each week.

**The Dashboard reminds you**: starting Wednesday, office staff see an amber card — "GC review is due today · 3 of 9 GCs certified" — that opens GC Review in one click. It turns green for the rest of Wednesday once every GC is certified and sent — by **Draft Message**, a scheduled send to that GC, or a statement marked sent in This week's GCs; a "Spoke with them" mark or an "All GCs" office copy doesn't count — and stays away until the next week's ritual.
- Open a GC's row: every sharing action for that GC lives behind its {{button:outline|Share}} dropdown — **Draft Message**, **Copy**, **Print**, **Print unpaid invoices**, and (under *Portal*) **Copy portal link**. The {{icon:help|globe}} next to the GC's name is their portal, same as everywhere else.

## Send a statement to a GC

Open the GC's row and pick **Copy** from its {{button:outline|Share}} menu — one click copies a **GC-facing statement**. It opens with what is owed, then reads one property at a time: the street once, with that property's own subtotal, and under it a line for each open bill — the job number, the day the bill was sent, what is still owed. Paste it into Gmail, Outlook, or Apple Mail and it lands as a clean formatted table; a suggested subject line rides at the top of the copy so you can cut it into the subject field. This version is written for the GC's eyes — no internal chips or days-past-due language. **Print** in the same menu makes that GC's printable statement.

:::example What the GC reads
**Owed now $23,650.00** — 3 open bills at 2 properties. $28,650.00 billed, $5,000.00 paid so far.
**4400 Sample Pkwy** Kyle · 2 open bills — **$21,650.00**
Job 1042 · Bldg 2 rough-in · Aug 27 · $15,200.00 — *$5,000.00 paid by #4417 on Sep 8, of $20,200.00 billed*
Job 1051 · Bldg 3 top-out · Sep 24 · $6,450.00
**212 Example Ln** Buda · 1 open bill — **$2,000.00**
Job 1058 · Service Visit · Sep 21 · $2,000.00
**Total owed $23,650.00**
:::

- **What counts as one property.** Jobs linked to the same property record share a block, however each job's address was typed; a job with no property record joins the block its cleaned-up address matches. If one place shows as two blocks, set the property on the job (Edit Job → Property record).
- **The job's name** shows only when it says something — *Trip Charges* stays; a repeat of the GC's own name, or of the address the block is already headed by, is left off.
- **A payment shows under the bill it was recorded against**, with the check number and the day. A bill with nothing paid is one plain line.
- **Payments we have received.** Under the total, every payment the GC sent in the last 30 days, newest first, each with the check number, the day and the property and job it went to — a check that paid a job off says *now paid in full*. When none came the statement says so and asks them to reply if they sent one. The list is read as you open the GC's row, so Copy carries it too.
- **Paid on the job, not on a bill.** When a job carries a payment that was never put on a bill, the Draft Message dialog says so before you send — *Paid on the job, not on a bill: Job 1042 $3,000.00.* The statement still shows that job's bills as owed in full. If the money was for those bills, match it in Edit Job → Payments, then send.

## Print a GC's unpaid invoices

The statement lists what is owed; sometimes the GC wants the bills themselves. Pick **Print unpaid invoices** from the GC's {{button:outline|Share}} menu and a new tab opens with **every unpaid invoice on that GC's statement as one PDF** — the same invoice you get from View bill, one after another, in the statement's order. Print it or save it from the PDF's own toolbar.

- It prints what the statement shows: with **Include Collections** ticked, the hard-to-collect bills are in the stack; unticked, they are not.
- Each job is re-read as the PDF builds, so a bill paid or sent back since you opened GC Review is left out. A part-paid bill still prints, with its payments and the balance due.
- A row that is a job balance with no bill behind it has no invoice to print. The message that follows says how many invoices printed and names anything left out.

:::example After the PDF opens
19 unpaid invoices for RMC- Dudley Mason.
:::

If the tab does not open, allow pop-ups for the app and pick it again.

Prefer the app to send it? Choose **Draft Message** from the same Share menu. The dialog pre-fills the **To** address from the GC's customer record (editable — statements often go to an AP inbox) and the subject line. A row of **teammate chips** sits above the To field — tap a name to send to that office teammate instead of typing their email; tap it again to clear, and typing any other address just works; hit {{button:blue|Send statement}} and the app emails the same table from **team@noreply.clicktooling.com** with *your* email as the reply-to, so responses land in your inbox. To read it first, {{button:outline|Preview}} lays the exact email over the dialog, full size; **← Back** (or Esc) returns you to the dialog with everything you typed still there, and nothing has been sent. After a send, the opened row shows a small **last sent** date so the office can see at a glance which GCs have already been statemented.

**Replies go to** sits above the send time. When the GC has an account man, he is already picked — *Malachi · account man — copy me*: the GC's "Reply" reaches him, and you are copied on the statement so the thread reaches the office too. Pick **Me** to take the replies yourself. After sending, the message says where replies went. A scheduled send replies to whoever scheduled it.

Need someone else on the thread? The **CC** row under To takes teammates (tap a chip to add, tap again to remove) or any typed addresses, comma-separated, up to ten — it applies to Send now and to scheduled sends, and a weekly schedule keeps its CC list.

If the GC has a portal, the dialog's **Include portal link** box is checked: the email ends with a *Your account, any time* card: a **QR code** the GC can scan with a phone camera, their address in words beside it (**my.clickplumbing.com/their-name**), and one sentence — *Pay online and see every open bill and payment, with no login.* Untick it to send the plain statement. Scheduled sends include the card automatically while the portal is active. **Copy** pastes the card with the address and without the code — a picture pasted into a personal mail program does not always arrive.

:::example Nothing owed? Nothing goes out
Open Draft Message on a GC whose total is $0.00 and the dialog says **Nothing owed — no statement goes out.** with {{button:blue|Send statement}} greyed out — the app will not email anyone a "Total owed $0.00". (Schedule… is still allowed: a scheduled send rebuilds the statement that morning and skips itself if the balance is still zero.)
:::

Want the statement to open with a line of your own? {{icon:gear}} **Settings → Email templates → GC statement (Draft Message + scheduled)** holds the subject and an intro paragraph; save it once and both Draft Message and the scheduled sends carry it. The subject prefills in the dialog (still editable per send); {{button:outline|Preview}} shows the intro in place.

Don't want to remember to send it? Flip **When** to **Schedule…**, pick a date and time (Central), and optionally tick **Repeat weekly** — the app sends the statement by itself, rebuilt fresh at send time so it always shows that morning's numbers. A GC with nothing outstanding is skipped, never emailed an empty statement — the same rule Draft Message applies before you click. Your pending sends appear in a **Scheduled statement sends** list on GC Review's **Scheduled** tab, each with a **Cancel** (cancelling ends a weekly repeat). The **Share all** dialog's email can be scheduled the same way.
- When any job has a **development** set, a **Group by** toggle appears — flip to **By Development** to see the same rollup per development instead.

## Share the whole report

Two buttons beside the tabs at the top of GC Review handle the entire report at once. {{button:outline|🖨 Print all}} prints every section as one report, and {{button:outline|⇪ Share all}} opens the whole-report dialog:

- **Print / save as PDF** opens the same one-report print that **Print all** makes — choose *Save as PDF* in the print window to download a copy.
- **Email it from the app** sends every section as one email — each GC with its jobs, bill-sent dates and amounts owed, plus the grand total — to **any address, inside or outside the company**. Tap one of the **teammate chips** above the To field to fill an office teammate's email in one tap, or just type any address. Same clean table styling and GC-safe wording as the per-GC statement, sent from **team@noreply.clicktooling.com** with your email as the reply-to.

Devs also get a **Standing copies** section in the same dialog: pick a teammate (or type an outside email), toggle the **weekdays** — Mon and Wed for a Leader, say — set the time, and hit {{button:blue|Add}}. The report emails itself on those days, rebuilt fresh each send, forever until you **Remove** it. Each standing copy shows as one line with Edit / Remove; the list on GC Review's **Scheduled** tab shows it grouped the same way.

## What the GC does *not* change

Billing. Invoices still go to the job's customer. If the GC is actually who pays a particular invoice, use **Bill to** on that invoice in Bill Customer — that's a per-invoice choice and works with or without a GC set here.
