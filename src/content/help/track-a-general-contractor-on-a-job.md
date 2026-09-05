---
title: track a general contractor on a job
category: Office
roles: dev, master_technician, assistant
keywords: GC, general contractor, builder, gc/builder, second customer, manage by gc, hard hat, stages, job customer, statement, draft message, pay online, nothing owed, portal card, email template
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

On **Jobs → Pipeline**, the **Billed Awaiting Payment** section header has a {{button:outline|GC Review}} button (next to Accounts Receivable). It groups everything awaiting payment by GC: each General Contractor's customers, when each was billed out, how many days ago, and the GC's outstanding total. Jobs without a GC gather in a **No GC set** bucket at the bottom, so the grand total always matches the section header — and that bucket doubles as your list of jobs to go set GCs on: **click any job** in the report to open Edit Job right on top, set the GC (or fix anything else), and the report refreshes itself when you save.

- **Include Collections** (left of {{button:blue|Share all}}) is ticked by default, so hard-to-collect jobs ride along in the view and in Share all / Print all, marked with a red chip. Untick it to see active billing only. Certification and the weekly statement rounds always look at active jobs only, whichever way the box is set.

## Certify each GC — the Wednesday ritual

Every week (due Wednesday), the office certifies each GC's group before sending statements. An amber strip at the top tracks the week — **"3 of 9 certified · 2 sent"** — and each GC gets a {{button:blue|Certify…}} button:

1. Clicking it opens a **per-bill checklist**: check off each bill as you confirm it belongs to this GC and the amount is right.
2. Not sure about one? The **▾ chevron** drops down the job's recent activity right in the list, and clicking the **job link** opens Job Detail on top — dig in, close it, and your checkmarks are still there.
3. When every bill is checked, {{button:outline|Certify}} records the attestation (who, when, exactly what), and {{button:blue|Draft Message}} certifies and opens the statement email as a draft — the GC's email is already in the To line with their pill lit first (teammates follow), and the subject reads **Click Plumbing open balances: Aug 22, 2026**. Nothing sends until you click {{button:blue|Send statement}}. The statement's footer tells the GC to reply or **call the office at** the number from Settings → Company → invoice issuer — set the phone there once and every statement (sent now, scheduled, or pasted) carries it.

The group header then shows {{chip:green|✓ Certified · Taunya · 7:02 AM}} — and if a bill lands or a payment posts **after** sign-off, it flips to {{chip:yellow|Changed since certified · +$2,700}} with a Re-certify button, so a sent statement never silently drifts from what was reviewed. Certifications reset each week.

**The Dashboard reminds you**: starting Wednesday, office staff see an amber card — "GC review is due today · 3 of 9 GCs certified" — that opens GC Review in one click. It turns green for the rest of Wednesday once every GC is certified and sent — by **Draft Message**, a scheduled send to that GC, or a **Sent it ✓** mark from the statement round; a "Spoke with them" mark or an "All GCs" office copy doesn't count — and stays away until the next week's ritual.
- Every sharing action for one GC lives behind that row's {{button:outline|Share}} dropdown — **Draft Message**, **Copy**, **Print**, and (under *Portal*) **Copy portal link**. The {{icon:help|globe}} next to the GC's name is their portal, same as everywhere else.

## Send a statement to a GC

Pick **Copy** from a GC row's {{button:outline|Share}} menu — one click copies a **GC-facing statement** (job address, the date the bill was sent, and the amount owed, with a total). Paste it into Gmail, Outlook, or Apple Mail and it lands as a clean formatted table; a suggested subject line rides at the top of the copy so you can cut it into the subject field. This version is written for the GC's eyes — no internal chips or days-past-due language. **Print** in the same menu makes that GC's printable statement.

Prefer the app to send it? Choose **Draft Message** from the same Share menu. The dialog pre-fills the **To** address from the GC's customer record (editable — statements often go to an AP inbox) and the subject line. A row of **teammate chips** sits above the To field — tap a name to send to that office teammate instead of typing their email; tap it again to clear, and typing any other address just works; hit {{button:blue|Send statement}} and the app emails the same table from **team@noreply.clicktooling.com** with *your* email as the reply-to, so responses land in your inbox. After a send, the row shows a small **last sent** date so the office can see at a glance which GCs have already been statemented.

Need someone else on the thread? The **CC** row under To takes teammates (tap a chip to add, tap again to remove) or any typed addresses, comma-separated, up to ten — it applies to Send now and to scheduled sends, and a weekly schedule keeps its CC list.

If the GC has a portal, the dialog's **Include portal link** box is checked: the email ends with a small *Your account, any time* card that tells the GC how to pay — **"Pay online any time at my.clickplumbing.com/their-name — this statement stays current there."** Untick it to send the plain statement. Scheduled sends include the card automatically while the portal is active, and **Copy** pastes the same card, so what you preview is what they get.

:::example Nothing owed? Nothing goes out
Open Draft Message on a GC whose total is $0.00 and the dialog says **Nothing owed — no statement goes out.** with {{button:blue|Send statement}} greyed out — the app will not email anyone a "Total owed $0.00". (Schedule… is still allowed: a scheduled send rebuilds the statement that morning and skips itself if the balance is still zero.)
:::

Want the statement to open with a line of your own? {{icon:gear}} **Settings → Email templates → GC statement (Draft Message + scheduled)** holds the subject and an intro paragraph; save it once and both Draft Message and the scheduled sends carry it. The subject prefills in the dialog (still editable per send); {{button:outline|Preview}} shows the intro in place.

Don't want to remember to send it? Flip **When** to **Schedule…**, pick a date and time (Central), and optionally tick **Repeat weekly** — the app sends the statement by itself, rebuilt fresh at send time so it always shows that morning's numbers. A GC with nothing outstanding is skipped, never emailed an empty statement — the same rule Draft Message applies before you click. Your pending sends appear in a **Scheduled statement sends** list at the top of GC Review, each with a **Cancel** (cancelling ends a weekly repeat). The **Share all** dialog's email can be scheduled the same way.
- When any job has a **development** set, a **Group by** toggle appears — flip to **By Development** to see the same rollup per development instead.

## Share the whole report

Two centered buttons under the GC Review title handle the entire report at once. {{button:outline|🖨 Print all}} prints every section as one report, and {{button:outline|⇪ Share all}} opens the whole-report dialog:

- **Print / save as PDF** opens the same one-report print that **Print all** makes — choose *Save as PDF* in the print window to download a copy.
- **Email it from the app** sends every section as one email — each GC with its jobs, bill-sent dates and amounts owed, plus the grand total — to **any address, inside or outside the company**. Tap one of the **teammate chips** above the To field to fill an office teammate's email in one tap, or just type any address. Same clean table styling and GC-safe wording as the per-GC statement, sent from **team@noreply.clicktooling.com** with your email as the reply-to.

Devs also get a **Standing copies** section in the same dialog: pick a teammate (or type an outside email), toggle the **weekdays** — Mon and Wed for a Master, say — set the time, and hit {{button:blue|Add}}. The report emails itself on those days, rebuilt fresh each send, forever until you **Remove** it. Each standing copy shows as one line with Edit / Remove; the pending-sends list at the top of GC Review shows it grouped the same way.

## What the GC does *not* change

Billing. Invoices still go to the job's customer. If the GC is actually who pays a particular invoice, use **Bill to** on that invoice in Bill Customer — that's a per-invoice choice and works with or without a GC set here.
