---
title: bill a customer and get paid
category: Billing & Money
roles: assistant, master_technician, primary
keywords: billing, ready to bill, invoice, stripe, bill customer, paid, accounts receivable
order: 10
---
Every job moves through one pipeline. This guide covers the billing half — how a working job becomes money in the bank.

:::example The job pipeline
{{chip:gray|Waiting}} → {{chip:blue|Working}} → {{chip:yellow|Ready to bill}} → {{chip:red|Billed}} → {{chip:green|Paid}}
:::

The money you read along the way is the same number everywhere: the Dashboard's **Accounts Receivable** card and **Billed** pin, the Pipeline money strip, Quickfill's **Billed Awaiting Payment** and a customer's page all count the same bills and the same totals — a bill sitting on a job that is already {{chip:green|Paid}} (or on a job that no longer exists) is left out and noted as "excluded", and a bill that was paid but never marked Paid shows at $0 with a *not yet marked Paid* note until someone clicks {{button:green|Mark Paid}}.

New jobs — from **New Job** or from an accepted estimate — land straight in {{chip:blue|Working}}. {{chip:gray|Waiting}} is a parking stage you send a job back to. When you create a job with **New Job** on the Pipeline, the board clears any search you had typed, scrolls to the new job, and flashes its row so you can see exactly where it landed.

## Reading the Progress & payment bar

Every stage on the Jobs Pipeline board — Waiting through Paid in Full — shows one **Progress & payment** cell instead of separate money columns. The bar is the job's whole bid, filled in order: the green part is **paid**, the blue part is **billed but not yet paid** (an invoice has gone out and you're waiting on the money), the amber part is work **done but not yet billed** (unbilled), and the empty part is work not done yet. Under the bar the same numbers are spelled out — **Paid**, **Billed** (shown only when an invoice is out and unpaid), **Unbilled**, and **Left on Job** (bid minus payments). In Waiting and Working, the **% done** box at the top is where the office records how complete the job is — type a number and press Enter (later stages show the % read-only). Every change made here is also recorded in **Job activity / notes** ("62% complete", with your name on it), the same trail the field's Set % complete flow leaves — so the activity feed shows every % change no matter where it was made.

On most screens (about 1100px and up), each job row also carries a **Job activity box** filling the whole middle of the row: the green **Next** appointment pinned on top, then the job's notes and reports in a small scrolling list — newest first, each wearing a **circled number** where **1 is the oldest**, so the numbers never shift and "check note 3" means the same thing next week. Each line reads **time first, then who**: `Fri 9:25 AM (today) Abraham | Arrived at job` — and arrive/leave stamps show just the action, since the line already says who and when. The floating {{button:blue|Post}} button in the box's corner slides open a note bar — type, press Enter, and your note lands on the job's activity thread instantly with your name on it. The small expand arrows in the box's top-right corner (and the **N Reports** button on any row) open the whole trail as a **full-page view** — see *open a job's activity full screen*. Jobs with nothing yet show "No activity yet — post the first note". On smaller windows the box simply doesn't appear and the board looks exactly as before. No % and no bid value yet shows an empty dashed bar. On billed rows, a small line under the numbers shows what **this row's bill** covers (e.g. `This bill: $0 paid · $3,850 left`) and any amount **unallocated** — money on the job that isn't on any bill yet.

:::example One glance at a Working job
70 % done · $41,550 bid
{{chip:green|Paid $16,620}} {{chip:yellow|Unbilled $12,465}} → **Left on Job $24,930**
:::

:::example A billed job waiting on payment
$3,850 bid
{{chip:blue|Billed $3,850}} → **Left on Job $3,850**
:::

The **Edit Job** window shows the same bar at the top of its billing section, so you get one picture there too. Under it, three numbered steps make the flow obvious: **① Line Items** (the specific work & materials — their sum is the Job Total; the dashed {{button:outline-blue|+ Add line item}} button under the list, next to the Job Total, adds a row, every row carries its own trash icon, the name box holds a small pencil at its right edge for per-line scope notes, and the **Stripe preview** link beside the ① title shows how every line will read on the Stripe invoice), **② Invoices** (the bills you break off and send), and **③ Payments received** (money collected). **The whole money section saves itself**: line items and payments auto-save a moment after you stop typing (a small **Saving…** note appears next to the Billing title while it works — silence means saved), and creating or sending an invoice saves right away — so you can enter work and break off a bill in one motion, no Save button in between. The bar adds a striped **Draft** slice for a bill you've carved off but haven't sent yet. Each legend row also leads with its slice's **own share** of the job total — **80% Paid · 20% Billed · 0% Unbilled** reads as "collected 80%, another 20% billed and waiting, nothing done-but-unbilled"; the slices (plus work not done yet) add up to 100%.

The ② Invoices table also handles the bill that shouldn't have gone out: every **sent bill with no payments on it** carries a {{button:outline|Send back}} action right in its row. Confirming removes the bill, returns its amount to unbilled, voids the customer's Stripe payment link if one was emailed, and moves the job back to {{chip:yellow|Ready to bill}} when it was the only sent bill — the same send-back the Pipeline board offers, without leaving Edit Job. A bill with payments applied shows the button grayed with a note to unlink the payments first. And when the "would bill through 100%" warning appears, it now points at this remedy too — often the right fix is pulling back the stale unpaid bill and rebilling to match the field, not stacking a new invoice on top.

**Sending a Ready to bill job back to Working asks why — and the crew sees your answer.** The Send Job Back confirm (on the Pipeline board, the Dashboard pipeline, and the Edit-tab status strip) has a required reason box: a few words on what still needs to happen ("customer wants the trim redone", "missing the parts list"). The reason lands on the job's activity thread as *Sent back to Working — …* and shows on the crew's My Schedule card with your name, so the tech who marked the job 100% knows exactly why it's back on their plate instead of wondering whether their report got lost.

**Billed a stage and the work continues? The confirm knows.** When the job has a billed line and the only draft in play is the {{chip:gray|auto}} remainder, Send Job Back reads it as the routine move: the copy says your billed line stays billed and the remainder draft comes back on its own next time, the "voiding this bill" checkbox disappears (nothing is being voided), and one tap on the {{chip:blue|Stage billed — continuing work}} chip fills the crew-visible reason. The full attestation only appears when sending back would delete a draft bill you carved on purpose.

The **Make Invoice** control in ② reads like the math it does: a chip row — **Paid + Billed + New invoice → Left to bill** — where the New invoice chip holds the amount box, its \"% of job\" share, and the {{button:green|+}} create button (which turns into a blue {{button:blue|Ready to Bill}} when the amount equals everything left, since that moves the whole job instead of carving a piece). The chips wear their bar colors, so they're the legend too. Below, the bar fills left-to-right in the same order as every other money bar — paid, then billed, then the new invoice you're sizing, then what's left — and the green triangle drags with a live **$ · %** badge. The yellow marker shows field progress with its own \"Job N% done\" label, and a quiet note appears if a bill would run well ahead of the field — fine for deposits and draws, it never blocks. The **ⓘ How invoices and jobs move** link next to the ② Invoices heading explains the whole flow in plain English. Because a dollar bill covers dollars rather than specific line items, the segment strip above still shows that money as **hatching** over the blocks (hover a block for the covered amount) — and selecting segments for a new invoice is capped at that same remainder, so the two paths can never double-bill a job.

Under the break-off control, **all of the job's bills sit in one Invoices list** — a **Status / Date / Amount / Actions** table where each row is tagged {{chip:yellow|Draft}} (carved off, not sent) or {{chip:blue|Billed}} (sent). A draft's row has a {{button:blue|Send bill…}} button right there, so you bill the customer straight from the list; once sent it flips to Billed and keeps its **Bill** (view), share, and **Add discount** actions. While a job sits in Ready to Bill, one draft wears a small {{chip:gray|auto}} tag: that's the **auto-maintained remainder** — whatever part of the job isn't on any other bill. It resizes itself whenever you create or delete other bills (so no delete ✕: removing it wouldn't stick), and it shrinks to nothing once the rest of the job is billed another way.

A big amber slice is the signal to bill: work is finished but the money hasn't been asked for. A blue bar means the bill is already out — you're waiting on the customer, not on the office.

Know the job's number? The small **#** chip left of the Pipeline search bar is the fast lane: click it, type a C# or HCP number, press Enter — the board opens the right section and scrolls to the job with a highlight flash. Partial numbers land on the first match. The big search bar stays what it was: the broad filter for names, addresses, and notes.

## The Dashboard card explains itself

The Dashboard's **Billing Pipeline** card has a round **i** button next to its title — tap it for a compact map of the whole flow: the upstream Waiting/Working stages, the card's three numbered stages, who taps what at each one (including the field crew's — subcontractor, helper, or superintendent — {{button:blue|Collect Payment}} → office {{button:green|Approve}} handshake at stage 1), and where paid jobs go. Its "Full guide in Help" link lands right here.

## Section tools in one dropdown

The stage headers down the board carry their own buttons — Capable of Being Billed on Working, Ready to Bill notifications on Ready to Bill, GC Review / Accounts Receivable / Share / Print / Paid notifications on Billed Awaiting Payment, Paid in Full notifications on Paid in Full. The **hamburger menu icon just left of Waiting** in the stage strip (Waiting → Working → …) collects all of them in one dropdown, grouped by section, so you can open any of these without scrolling the board.

:::example Section tools
**Working** &nbsp; Capable of Being Billed: $48,450
**Ready to Bill** &nbsp; Ready to Bill notifications
**Billed Awaiting Payment** &nbsp; GC Review &nbsp;·&nbsp; Accounts Receivable {{chip:yellow|16}} &nbsp;·&nbsp; Share / Print &nbsp;·&nbsp; Paid notifications
**Paid in Full** &nbsp; Paid in Full notifications
:::

The amber count on Accounts Receivable is the same unallocated-bank-deposits badge the header button wears, and every item follows the same permissions as the button it mirrors — if you can't use it on the header, it's disabled or hidden here too.

At the start of each row, next to **Crew & Dates**, a small stack of shortcuts covers the common jump-offs: the green calendar opens **Assign work** — the same sheet Dispatch mode uses, with the job already picked, so you just choose the day, the people (whole crews in one tap), and a time window, and the row's green **Next** line updates in place without losing your spot on the board — the blue grid opens its **week dispatch**, the red pin opens the address in **Google Maps**, the phone icon **calls the customer** (it only appears when the job has a phone number on file), and the purple send arrow **sends the job to someone as a task** — it opens the New task form with the job attached as a link, you add your note and pick who it's for, and when they open the task, clicking the job's name takes them straight to its **Job Detail**. The same purple send arrow also sits in the **Job Detail** header, so you can send a job to someone while you're already looking at it.

On the **mobile cards** view, the card's foot keeps just the **phone icon** and the **⋯** menu — everything else moved into the ⋯ sheet, which opens headed by the job and its crew and holds View job, Edit, Activity, Calendar, Share, Plumbing Tooling, Google Maps, **Assign work**, **Send to Dispatch**, **Send as task**, Week dispatch, and Send back.

## Getting to Ready to bill

A job usually reaches Ready to bill one of two ways:

- A tech files a **Job Complete** report at 100% — the app offers the move right there:

:::example After a 100% Job Complete report
**Move to Ready to Bill?**
☑ I have reported all the Job Parts I've used

{{button:outline|Not yet}} &nbsp; {{button:green|Move to Ready to Bill}}
:::

- Or the office moves it manually from the Jobs Pipeline board.

Trip charges from Turnaways also land in Ready to Bill as their own standalone lines, independent of the job's status.

## The Ready to Bill queue

**Assistants can't miss it**: whenever anything is waiting in Ready to Bill, a slim orange bar sits just under the header on every page — {{chip:yellow|3 ready to bill — send them}}. Tap anywhere on it and you land on Jobs with the Ready to Bill section already open and scrolled into view. The bar disappears the moment the queue is empty.

On the Dashboard, office roles see **Ready to Bill (N)** — every job and invoice line waiting to be billed, each with its own billing button:

:::example A Ready to Bill card
**J512** · Smith House Repipe
123 Main St &nbsp;·&nbsp; Remaining: $4,250.00

{{button:blue|Bill Customer}} &nbsp; {{button:outline|Delete draft bill}}
:::

A paid-up job never sits in Ready to Bill (or in Billed Waiting for Payment): once a job is {{chip:green|Paid}}, any old draft bill on it drops out of these queues, and the Dashboard counts match the Pipeline board. If you remember an old draft there, it has been retired.

The **Not Billed Out** card in Dashboard Financials shows the total revenue that hasn't reached a customer invoice yet, so nothing slips.

## Breaking off a partial invoice

To bill part of a job now and the rest later, open the job's **Bill** tab and use the **Break off invoice** slider (or select segments) — that's the main path on a computer. On the **mobile cards** view, the **⋯** menu's **Partial invoice** item opens a small modal instead:

:::example Create partial invoice
**J512** · Smith House Repipe
Remaining: $1,500.00

Amount ($) &nbsp; `500`

{{button:outline|Cancel}} &nbsp; {{button:green|Create invoice}}
:::

**Remaining** is what's still unallocated — the job total minus payments already made *and* minus every invoice line that already exists on the job (partial drafts and billed alike). The automatic remainder draft a Ready to Bill job carries doesn't count against it — that draft just resizes to whatever you don't break off. An amount above Remaining is clamped down automatically. Entering the full remaining amount on a Ready to Bill job simply opens Bill Customer instead. Both paths share the same Remaining math.

## Billing a customer

Press {{button:blue|Bill Customer}}. The modal opens on **Stripe bill** and shows the job and the RTB amount, with two method tabs plus a **▾** for the rest:

{{gif:ready-to-bill-pipeline.gif|Bill Customer from the Ready to Bill queue: the method tabs and the physical-invoice preview}}

:::example Bill Customer — method tabs
{{button:blue|Stripe bill}} &nbsp; {{button:outline|Physical invoice}} &nbsp; {{button:outline|▾}}
:::

- **Stripe bill** — creates and sends a hosted Stripe invoice by email. This is the standard path; payment status syncs back automatically.
- **Physical invoice** — a mailed paper invoice, with a date and optional memo. Next to the on-screen invoice preview sit two check-before-you-send buttons: {{button:outline|Preview}} opens the PDF in a new tab, and {{button:outline|Preview email}} opens the exact email the customer will receive — subject, body, and the payment-history card — without sending anything.
- **▾** — reveals **HouseCall Pro**, which records a bill you sent through HCP. It's tucked away on purpose; most billing should go through Stripe.

A job needs a linked customer (with an email, for Stripe) before it can be billed — the modal guides you if something's missing.

**Opening Bill Customer changes nothing.** The RTB amount you see is worked out on the spot from the job total, payments made and the invoices already on the job; the bill row itself is written only when you press {{button:blue|Send Stripe invoice}}, {{button:blue|Save}} on HouseCall Pro, or {{button:blue|Send invoice}} on Physical. Press {{button:outline|Cancel}} and the job is exactly as you found it — no draft appears, no draft resizes.

:::example If the remainder moved while the modal was open
Someone records a $500 payment while you're looking at a $2,630 bill. When you press Send, the modal stops, shows the new **$2,130**, and asks you to look it over and send again — it never bills the new number silently.
:::

Until the bill row exists, the **Stripe bill** tab shows the draft line the customer will see; Stripe's exact layout appears once the bill exists.

If the job is already {{chip:green|Paid}}, Bill Customer says so instead of showing a preview — **"This job is already paid in full — nothing to bill."** — and all three send buttons stay off. The safe move is Cancel. Only when the customer really does owe more on that job, tick **Bill this job again anyway** to unlock the buttons; the same check runs on the server, so an old browser tab can't slip a bill past it.

:::example Bill Customer on a paid job
**This job is already paid in full — nothing to bill.**
{{chip:gray|☐ Bill this job again anyway}} &nbsp; {{button:outline|Cancel}} &nbsp; {{button:gray|Create Stripe invoice}}
:::

## Billed → Paid

Once billed, the job shows under **Billed Waiting for Payment** on the Dashboard and on the Accounts Receivable page (in the {{icon:gear}} gear menu, next to Banking). Stripe payments mark themselves; outside payments (cash, check, ACH) you record yourself. In the Edit Job window's **③ Payments received** section, click {{button:outline|+ Record non-Stripe payment received}} — the section stays folded until you need it — and fill in the date and amount (Type, Ref, and Memo are optional; a new row opens with those boxes showing, and once the payment is saved they fold into a one-line note under the row — the pencil on the row reopens them). Need another payment line? The blue {{button:blue|+}} sits centered below the lines and adds one. To apply it against a specific bill, set the row's **Applies to** dropdown to that billed invoice — the payment then pays *that* bill down; leave it on **Job (unassigned)** for a general job payment. When everything is collected, the job moves to {{chip:green|Paid}}.

:::example Bank deposit for a payment you already recorded?
In **Accounts Receivable**, each allocation line has a **Billed line / Payment received** switch. Pick **Payment received** to link the deposit to a payment already sitting in Edit Job → Payments received — the amount locks to that row and no duplicate payment is created; the deposit's remaining balance drops just the same.
:::

### Customer paid a Stripe invoice by check?

Sometimes you email a Stripe invoice and the customer mails a check anyway. Those bills show in the Accounts Receivable picker marked **· Stripe** — you can allocate the deposit straight to one, but an amber confirmation appears first: check the box acknowledging the customer paid **outside** Stripe. Until the box is checked, {{button:blue|Apply}} stays disabled.

**When the allocation matches the bill's full balance, the app finishes the Stripe side for you**: applying also marks the Stripe invoice paid (out-of-band), so the emailed payment link can't be paid a second time — the confirmation text tells you this is about to happen. If Stripe can't be reached, the allocation still applies and the modal stays open with a **Retry Stripe close** button (plus instructions for doing it by hand in Stripe). Only a **partial** allocation leaves the Stripe side to you: the confirmation reverts to the reminder to void or mark the invoice paid out-of-band in Stripe yourself.

**Mark Paid** on a billed row opens the Record payment window with the job's balance. If the job still has a balance you record the payment there; if it's already fully paid (say the payment landed through a bank-deposit allocation but the stage never moved), the window says so and offers a one-click {{button:blue|Move to Paid}} — no payment gets invented.

Jobs that are billed but proving hard to collect can be flagged for **Collections** — they get their own section so the AR picture stays honest. The flag takes care of itself on the way out: the moment the job is paid in full — by Stripe, a bank-deposit allocation, or Mark Paid — it leaves Collections and lands in {{chip:green|Paid}} with the flag cleared, and the job's activity thread notes it was removed from Collections. Use **Send back to Billed** on a Collections row only when the job should return to plain Billed Awaiting Payment *before* it's paid.

## The "paid in full" email

The moment a job lands in {{chip:green|Paid}}, the app can email the good news automatically. Devs and masters on the list get the **detailed review** — a {{chip:green|PAID IN FULL}} banner, job start and last-work dates, then the full scoreboard: revenue, every payment with its date, team labor person by person (hours × wage), sub labor, parts, and the profit line, plus a month-by-month timeline. Everyone else on the list gets the **summary** — same banner and dates, the payment amount and time but no cost or profit figures anywhere.

Who gets it lives behind the {{icon:gear}} **Paid in Full notifications** button across from the **Paid in Full** section header on Jobs → Pipeline (devs and masters can open it; only devs can change the list — each person shows a Detailed or Summary badge so there are no surprises). The same window has a **Preview & test** block: search for any job, then

:::example Preview & test
Selected: **J512** · Smith House Repipe

{{button:outline|Preview detailed}} &nbsp; {{button:outline|Preview summary}} &nbsp; {{button:outline|Email me a test}}
:::

The previews open the exact email in a new tab; **Email me a test** sends the detailed version to your own address with a `[TEST]` subject, so you can check it in a real inbox before anyone else ever sees one.

## The "payment made" email

There's a second stream for jobs that aren't finished yet: whenever **any** payment lands on a job — the office marks a payment, a bank deposit is allocated in Accounts Receivable, or a Stripe payment comes in — the app can email a progress version of the same report. Instead of the green banner it leads with an amber **$X (Y%) OF $Z PAID** banner and the payment that just arrived, then the job's **Invoices** table exactly as the office sees it in Edit Job — each bill with its {{chip:yellow|Draft}} / {{chip:blue|Billed}} / {{chip:green|Paid}} status, sent date, amount, and how much of it is paid vs still open — followed by the line items. Detailed and Summary versions work like the paid-in-full email.

Its recipient list is separate, behind the {{icon:gear}} **Paid notifications** button next to the **Billed Awaiting Payment** section header (same rules: devs and masters open it, devs edit it). When a payment finishes the job, only the paid-in-full email goes out — you never get both for the same payment.

## Ready to Bill notifications

The third stream watches the **front** of the billing pipeline: the moment any job moves to {{chip:yellow|Ready to Bill}} — a crew finishing up, the office moving it by hand, or a job coming **back** from Billed after an invoice is deleted or reverted — the people on its list are notified so billing can start right away.

This stream is the first that can reach people **two ways — set per person**. Behind the {{icon:gear}} **Ready to Bill notifications** button on the Ready to Bill section header (same rules: devs and masters open it, devs edit it), every person in the list has their own **📧 email** and **🔔 push** checkboxes, at the right end of their row:

- **📧 Email** — sent within ~15 minutes, batched with the other notification emails. Devs and masters get the detailed version (the billable amount, draft bills, payments so far); everyone else gets a summary with no dollar figures.
- **🔔 Push notification** — a short alert straight to that person's phone or computer, once they've enabled push notifications on a device (Settings → Your account). Checking 🔔 for someone who hasn't enabled push yet shows a red **no push device** warning — the checkbox is still fine to leave on, and pushes start the moment they enable it. Push follows the same detailed/summary rule: dollar amounts only for devs and masters.

Check either box, or both; someone with nothing checked isn't notified at all. Changes save the moment you click — there's no Save button on this list.

:::example Recipients
Taunya · taunya@clickplumbing.com &nbsp; {{chip:gray|Summary}} &nbsp; ☑ 📧 &nbsp; ☑ 🔔
Robert · robert@douglasmining.com &nbsp; {{chip:yellow|Detailed}} &nbsp; ☐ 📧 &nbsp; ☑ 🔔
:::

Below the list, **Preview & test** stays tucked behind a collapsed toggle until you need it. Open it, pick a job, and you can preview the detailed or summary email — or send a real test **to yourself or any teammate**: choose a name in "Send test to", then **Email a test** or **Push a test**. Tests carry a `[TEST]` subject, and a test email to a teammate follows *their* role — summary-tier people get the summary even in tests.

:::example Preview & test
Selected: **J512** · Smith House Repipe

Send test to: **Taunya** &nbsp; {{button:outline|Email a test}} &nbsp; {{button:outline|Push a test}}
:::

If several moves happen back-to-back on the same job, they collapse into one notification.

## The aging chart

The **📊 Chart** button on the Billed Awaiting Payment header (devs and controllers) turns the whole section into one picture: every open bill is a bubble — the further **right**, the longer it's been waiting (same clock as the 30+/90+ chips, with matching shaded bands); the **higher**, the more money is still open on it; and the **bigger the bubble**, the more the job cost *us* — so a big bubble far right is your own cash tied up, not just revenue on paper. Bills where our cost has already passed the job's revenue show as red dashed bubbles ("underwater" — waiting on those hurts twice). A stat strip on top gives the totals, median age, the 90+ figure, and the underwater sum; hover any bubble for the job's numbers, and **click it to jump straight to that bill on the board**.

The Paid in Full header has its own **📊 Chart** (same devs-and-controllers rule): every paid job as a bubble — **profit** up the side (jobs that lost money sit below a bold $0 line, tinted red), **clocked hours** along the bottom, bubble size = the job's revenue. The dashed guide lines through the corner read as profit per hour of our time — a bubble under the $50/hr line earned less than that for every clocked hour. Hover for revenue / cost / profit / $-per-hour; click to open the job.

## Sharing the Billed report

The **Share / Print** button in the same header (devs, masters, controllers, and assistants) emails the Billed Awaiting Payment report to an office teammate — the same customer-grouped report the old Print button made, upgraded for email: phone numbers and emails are tap-to-call / tap-to-write, and **clicking any job opens its Job Detail right in the app**.

:::example Share Billed Awaiting Payment
Send to: **Taunya** · When: {{button:blue|Send now}} or **Schedule…** a date and time (Central)

{{button:blue|Send email}} &nbsp; {{button:outline|Preview}} &nbsp; {{button:outline|Email me a test}} &nbsp; {{button:outline|🖨 Print instead}}
:::

Scheduled sends build the report **fresh at send time** — a Monday 7 AM email shows Monday's numbers, not Friday's — and arrive within about five minutes of the chosen time. Your pending sends are listed in the window with a **Cancel** next to each. **Preview** opens the exact email in a new tab; **Email me a test** sends it to your own address with a `[TEST]` subject; **Print instead** is the old print path, unchanged. Recipients can only be office roles — the report carries amounts due.

There's also a per-job version: on **Job Detail**, the envelope icon in the header (devs and masters only) opens the same email with the preview showing right in the window — a **Detailed | Summary** toggle to flip between the two versions, and the send actions at the top:

:::example Paid-in-full email window
{{button:blue|Send to me}} &nbsp; {{button:outline|Send to someone…}}
:::

**Send to me** emails you the `[TEST]` copy; **Send to someone…** opens the people list with the same Detailed or Summary badge per person — picking someone flips the preview so you see exactly what they'll receive before you send it.

The email tells the truth about where the money stands, so you can send it for **any** job, not just finished ones:

- Fully paid → the green {{chip:green|PAID IN FULL}} banner, as always.
- Partially paid → an amber banner like **$4,812.50 (26%) of $18,450.00 paid**, and the subject reads "Payment progress" instead of "Paid in full".
- Nothing paid yet → a gray **NOT PAID** banner.

Just under the banner, both versions list the job's **line items** with a chip per item — {{chip:green|Paid}}, {{chip:blue|Billed}}, {{chip:yellow|Draft}}, or {{chip:gray|Unbilled}} — so the reader sees exactly which parts of the job the money covers. The detailed version shows each item's amount; the summary shows names and status only.

The detailed version ends with a **Cost & payment timeline** — the same story as the Cost Timeline in Edit Job, told month by month. Each month's shaded row has a bar showing the running total (payments in minus costs out; a bar to the right of the center line means the job had collected more than it cost by then), and beneath it the charges and payments that moved the money that month: team labor by the week, card charges, sub labor, supply-house invoices, tally parts. Busy months keep their biggest lines and fold the rest into one "…and N smaller charges" row — the bars stay exact either way. Charges without a date sit in a "No date" group at the bottom, and the **Job end** line is the job's final in-minus-out. The cost totals above it now count all six streams (supply-house invoices, tally parts, and other job charges included), matching Edit Job's numbers.

## Where to watch it all

- **Dashboard** — Ready to Bill and Billed Waiting for Payment queues, plus the Financials cards (Accounts Receivable / Accounts Payable / Not Billed Out).
- **Jobs → Pipeline** — the full board, every status.
- **Quickfill** — the **Jobs Billing** and **Billed Awaiting Payment** sections put billing review into the office's daily loop.

## Sending to more than one person

Commercial customers are usually several people — the PM, the AP clerk, the owner. Open the customer (Customers → click their name) and expand **Contacts**: add each person with their own name, email, phone, and a role note like "AP clerk". Then, when emailing a **physical invoice** from Bill Customer, a **Send to** list shows the primary email plus a checkbox for every contact — tick who should get a copy, or type a one-off address. One email goes out with everyone on it.

The primary **Email** field stays the billing identity: **Stripe hosted invoices always go to that one address** — contacts get copies only on the emails the app sends itself.

## When there's no customer email

Stripe and emailed invoices need a customer email, and the app now flags the gap early:

- On **Jobs → Pipeline**, an amber {{chip:yellow|No email (N)}} chip appears by the section chips whenever Ready to Bill jobs are missing one — click it for the list, then open Edit Job to fix.
- Marking a job **Ready to Bill** without an email shows a heads-up toast right then.
- If you reach **Bill Customer** anyway, an amber banner at the top lets you **type the email right there** — it saves to the job (and optionally to the customer's record if that's blank too) and Stripe billing unlocks immediately, no reopening.
