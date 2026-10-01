---
title: bill a customer and get paid
category: Billing & Money
roles: assistant, master_technician, primary
keywords: billing, ready to bill, invoice, stripe, bill customer, paid, accounts receivable, record payment, cash, check, paid outside stripe
order: 10
---
Every job moves through one pipeline. This guide covers the billing half, how a working job becomes money in the bank.

:::example The job pipeline
{{chip:gray|Waiting}} → {{chip:blue|Working}} → {{chip:yellow|Ready to bill}} → {{chip:red|Billed}} → {{chip:green|Paid}}
:::

The money you read along the way is the same number everywhere. The Dashboard's **Accounts Receivable** card and **Billed** pin count the same bills and totals. So do the Pipeline money strip, Quickfill's **Billed Awaiting Payment** and a customer's page. A bill sitting on a job that is already {{chip:green|Paid}} is left out and noted as *excluded*. The same goes for a bill on a job that no longer exists. A bill that was paid but never marked Paid shows at $0 with a *not yet marked Paid* note. It stays that way until someone clicks {{button:green|Mark Paid}}.

New jobs land straight in {{chip:blue|Working}}. They come from **New Job** or from an accepted estimate. {{chip:gray|Waiting}} is a parking stage you send a job back to. When you create a job with **New Job** on the Pipeline, the board clears any search you had typed. It scrolls to the new job and flashes its row so you can see exactly where it landed.

## Reading the Progress & payment bar

Every stage on the Jobs Pipeline board shows one **Progress & payment** cell instead of separate money columns. That runs from Waiting through Paid in Full. The cell is one bar with **two channels**. The **top** is the work: how far along the job is, filled left to right. The thin **bottom edge** is the money, poured across the job in order. **Green** is paid. **Blue** is billed but not yet paid. **Amber** is work done but on no bill yet. Grey is nothing yet. The two never mean the same thing. So a full top over a grey edge reads done, not billed. A blue edge past the fill reads billed ahead of the work. Under the bar the same money is spelled out, each part with its share of the bid. The parts are **Paid**, **Billed**, **Done, not billed**, and **Not done**. They add up to the bid. Then comes **Left on Job**, the bid minus payments. In Waiting and Working, the **% done** box sits at the top. It is where the office records how complete the job is. You type a number and press Enter. Later stages show the % read-only. Every change made here is also recorded in **Job activity / notes**, like *62% complete*, with your name on it. That is the same trail the field's Set % complete flow leaves.

**Under the bar, one line of words says where the job is.** It says when the crew last worked, like *Worked Sat*, *Worked today*, *On the sheet, no clock-ins* or *No hours*. It says the percent with its date, like *80% Sep 3* or *no % yet*. It leaves out what the row already shows. The names are in **Crew & Dates**. The stage is the lit chip above. The money is in the rows right beneath. You hover the bar to read the whole sentence with all of it. That includes where the percent came from: typed, reported by the field, or set when percent history began. The line turns **amber** when money is owed for work done or a bill is out unpaid. It turns **green** when the job is paid in full. It turns **red** when a crew clocked in on a job that has no line items at all. That means nothing to bill against.

:::example One glance at a Working job
80 % done · $40,000 bid
{{chip:green|Paid $13,412}} {{chip:blue|Billed $11,770}} {{chip:yellow|Done, not billed $6,818}} {{chip:gray|Not done $8,000}} → **Left on Job $26,588**
*On the sheet, no clock-ins · 80% Sep 3*
:::

On most screens, about 1100px and up, each job row also carries a **Job activity box**. It fills the whole middle of the row. The green **Next** appointment is pinned on top. Then come the job's notes and reports in a small scrolling list, newest at the bottom. Each wears a **circled number** where **1 is the oldest**. So the numbers never shift, and check note 3 means the same thing next week. Each line reads **time first, then who**. It looks like *Fri 9:25 AM (today) Abraham | Arrived at job*. Arrive and leave stamps show just the action, since the line already says who and when. A strip under the box holds its buttons, so nothing covers a note. The {{button:blue|+ Add}} button opens a note bar in the strip. You type and press Enter. Your note lands on the job's activity thread instantly with your name on it. Beside it, the small **report** pill opens **New report** already on that job. On a job split into stages it asks which stage you worked on. On the left of the strip, **See all** opens the whole trail as a **full-page view**. It counts the notes and names the reports, like *See all 9 · 1 report*. A report's number is blue in the box. See *open a job's activity full screen*. Jobs with nothing yet show *No activity yet — post the first note*. On smaller windows the box does not appear. The row's **See all** button opens the same view instead. No % and no bid value yet shows an empty dashed bar. A job can have **more than one bill out**. On each of its billed rows, a small line under the numbers shows what **this row's bill** covers. For example, *This bill: $0 paid · $3,850 left*. With a single bill the Paid and Billed rows already say it, so the line stays away. Rows also note any amount **unallocated**, money on the job that is not on any bill yet.

**A job with stages shows the stages as the segments.** The line items may be numbered **Order** stages. See *split a job into stages*. Or they may already read like a plan: **Rough In**, **Top Out**, **Trim Set** in order. That is the way the Multiple Segment Generator's preset writes them. The app recognizes the plumbing stages by name and nobody has to set Order. Either way the bar gains a chip strip, {{chip:green|✓ Rough}} → {{chip:blue|② Top Out}} → {{chip:gray|③ Trim}}. Each segment is one stage sized by its share of the job. **The live stage is where the crew is**, not where the money is. What the payments cover, in order, counts as done. The crew's last clock-in lands on the stage after it. So say a job's Rough In draw was paid and the crew clocked in this morning. It reads *Top Out* with no percent typed. A stage report from the field moves it too. See *reports*. A **percent older than the last clock-in is not drawn**. The live segment says *on site Sat*. The words carry the date the number was typed, reported or set. So a five-week-old 40% never paints over a crew's week. The chip reads *today* beside the stage name while the crew is clocked in there. Who they are is in Crew & Dates. Long names shorten by rule. Rough In becomes Rough. A deposit or down-payment line becomes Deposit. A short name like *1st Draw* is kept whole. A name that opens with a number keeps its next word. So *1st Draw- Removal of the old screen door…* reads *1st Draw*. Names collapse to their numbers when the cell is narrow. You hover a chip or a segment for the whole story. **You click any chip, or the bar itself, to open the job's Bill window at ① Line Items**. That is the place stages are named, ordered and priced. **Order** on a line there makes it a numbered stage. With stages, the money rows shrink to **Paid**, **Billed** and **Left on Job**. The bar already says which stage the money is on. A job with several line items that are not stages shows one segment per line the same way, without chips. An example is a change order beside the work. You click its bar to set Order on the lines that wait their turn.

:::example A staged job, stage 2 under way
Stage 2 of 3 · Top Out 60% · draw 1 paid
{{chip:green|✓ Rough}} → {{chip:blue|② Top Out 60%}} → {{chip:gray|③ Trim}}
{{chip:green|40% Paid $15,098}} → **Left on Job $22,647**
:::

The job window's **Bill tab** says the same money on its money card, so you get one picture there too. The tabs read Job, Edit and Bill across the top of Edit Job. Under it, three numbered steps make the flow obvious. **① Line Items** is the specific work & materials. Their sum is the Job Total. The dashed {{button:outline-blue|+ Add line item}} button under the list, next to the Job Total, adds a row. Every row carries its own trash icon. The name box holds a small pencil at its right edge for per-line scope notes. The **Stripe preview** link beside the ① title shows how every line will read on the Stripe invoice. **② Bills and payments** is the money card, **Make a bill** and the bills you send. **③ Other money on the job** is money that sits on no bill. **The whole money section saves itself**. Line items and payments auto-save a moment after you stop typing. A small **Saving…** note appears next to the Bill tab's title while it works. Silence means saved. Creating or sending an invoice saves right away. So you can enter work and break off a bill in one motion, with no Save button in between. The card adds a **Drafted** figure for a bill you have made but not sent yet. Done, Paid, Billed and Left to bill read straight across. Paid, Billed, Drafted and Left to bill add up to the Job Total.

**Move to Ready to Bill or Make a bill: the button says which.** {{button:blue|Move to Ready to Bill · $3,600}} under **Make a bill** bills everything left on a Working job. It moves the job instead of making a draft. On a Ready to Bill job the same button reads {{button:blue|Bill Customer · $3,600}}. **Bill part of it** holds the amount box and the slider for a smaller bill. Its button reads {{button:green|Make a $1,680 bill}}. You type more than is left. The amount is cut back to what is left as you leave the box. That may turn the button into {{button:blue|Move to Ready to Bill · $3,600}} just as you press it. Then nothing happens and a note says why. You press it again if moving the job is what you want. Or you type a smaller amount for a bill.

The Invoices list also handles the bill that should not have gone out. On every **sent bill with no payments on it**, the row's {{button:outline|⋯}} menu ends with a red **Send back**. Confirming removes the bill and returns its amount to unbilled. It voids the customer's Stripe payment link if one was emailed. It moves the job back to {{chip:yellow|Ready to bill}} when it was the only sent bill. That is the same send-back the Pipeline board offers, without leaving Edit Job. A bill with payments applied shows the item grayed with a note to unlink the payments first. When the would-bill-through-100% warning appears, it now points at this remedy too. Often the right fix is pulling back the stale unpaid bill and rebilling to match the field. That beats stacking a new invoice on top.

**Sending a Ready to bill job back to Working asks why, and the crew sees your answer.** The Send Job Back confirm has a required reason box. It is on the Pipeline board, the Dashboard pipeline, and the Edit-tab status strip. You write a few words on what still needs to happen, like *customer wants the trim redone* or *missing the parts list*. The reason lands on the job's activity thread as *Sent back to Working — …*. It shows on the crew's My Schedule card with your name. So the tech who marked the job 100% knows exactly why it is back on their plate. They do not wonder whether their report got lost.

**Billed a stage and the work continues? The confirm knows.** Say the job has a billed line and the only draft in play is the {{chip:gray|auto}} remainder. Then Send Job Back reads it as the routine move. The copy says your billed line stays billed and the remainder draft comes back on its own next time. The voiding-this-bill checkbox disappears, because nothing is being voided. One tap on the {{chip:blue|Stage billed — continuing work}} chip fills the crew-visible reason. The full attestation only appears when sending back would delete a draft bill you carved on purpose. When the rest of the work is finished, {{button:blue|Ready to Bill}} on the Working row moves the job forward. That stage bill stays exactly as it was, still billed, its payments still applied. Only a send-back from {{chip:red|Billed}} voids or removes bills. The move may be refused for a reason. That can be a bill that cannot be voided, or a permission the job's owner has not given. Then the reason appears as a message and the confirm stays open. You can Cancel, or fix it and try again.

**Make a bill** in ② shows only while money is left. Its big blue button bills all of it as one move. **Bill part of it** opens the amount box with its *% of job* share. {{button:outline|Up to % done · $1,680}} fills in what is done but not billed. Below it the bar fills left to right like every other money bar. That is paid, then billed, then the bill you are sizing, then what is left. You drag the green triangle, and a live ***$ · %*** badge rides with it. The yellow marker shows field progress with its own *Job N% done* label. A quiet note appears if a bill would run well ahead of the field. That is fine for deposits and draws, and it never blocks. The **ⓘ How invoices and jobs move** link sits next to the ② heading. It explains the whole flow in plain English. A bill made by amount covers dollars rather than specific line items. So the money card shows that money as **hatching** over the line blocks. A covered line says *covered* on its row and cannot be ticked. Ticking lines for a bill is capped at what is left. So the two paths can never double-bill a job.

Under **Make a bill**, **every bill on the job sits in one Invoices list**. That means drafts, sent bills, and paid bills too. So the list adds up to the Paid and Billed tiles above it. Each row reads the same three lines:

:::example One bill, three lines
{{chip:blue|Billed}} **$9,800.00** {{button:outline|Text}} {{button:outline|Copy link}} {{button:outline|Email}} {{button:outline|QR}} View {{button:outline|⋯}}
sent Sep 4 to RMC-Dudley Mason
**$9,800 open** · 21 d past expected · They said Sep 19
:::

The first line is the state chip, the amount, and the action that fits the state. The second says who the bill went to and when. The third is the money. It reads **$9,800 open** with the same *days past expected* the Pipeline card shows, or the customer's promise, *They said Sep 19*. A {{chip:green|Paid}} row reads ***$8,000 paid · Jun 4 · 22 days*** instead. A {{chip:yellow|Draft}} row reads **$17,800 to bill**. The action follows the money. A draft has {{button:blue|Send bill…}} and {{button:gray|Bill to ▾}}. A sent Stripe bill has the ***Text · Copy link · Email · QR*** cluster for chasing it, and **View**. Email is dimmed until the job has a customer email. The link you copy is renewed every night. That is because Stripe retires a pay link 30 days after the bill's due date. The app keeps the current one. **QR** opens the bill's pay code, described below. A paid bill has just **View**. Everything rare lives under the row's {{button:outline|⋯}}. That is Add discount, Make Stripe bill, See in Pipeline, and who else sees the bill. Also the memo & footer, Delete draft, and Send back. On a phone the chase cluster drops under the words as one full-width row of thumb-sized buttons. Nothing scrolls sideways. While a job sits in Ready to Bill, one draft reads *auto remainder* on its second line. That is the **auto-maintained remainder**, whatever part of the job is not on any other bill. It resizes itself whenever you create or delete other bills. So there is no Delete draft for it, since removing it would not stick. It shrinks to nothing once the rest of the job is billed another way. A row that reads ***marked paid · no payment on record*** is an old bill stamped paid before payments were tracked here. It counts for nothing in the sum line under the list. That is why that line always matches the tiles. A payment recorded on the job with no bill attached is counted **oldest bill first**. The earliest sent bill takes what it still needs, then the next. Any money left over reads as *+ $X on no bill* in the sum line. The bill's own paper, the demand letter and the customer's portal count it the same way.

## Scan to pay: the bill's QR code

Every sent Stripe bill has a **pay code**, a QR code that opens the bill's payment page. In **View bill** it is the fourth icon on the **Payment Links** row, after Copy, Text and Email. On the job window's Bills tab it is the word **QR** in the chase cluster. Either opens the code large enough to scan off a screen. That serves a customer standing at the counter, or a phone held up in the field. The bill, the job and what is still owed sit under it.

:::example The pay code, and its three doors
**Scan to pay** · Invoice #1025-2609180905
*(the code, with the hand-and-wrench in the middle)*
Lago Vista St · Still owed **$4,660.00**
`clicktooling.com/pay/8f3c2a1e-…`
{{button:blue|Copy image}} {{button:outline|Download PNG}} {{button:outline|Print}} {{button:outline|Close}}
:::

- {{button:blue|Copy image}} puts the code on the clipboard, ready to paste into a text or an email body.
- {{button:outline|Download PNG}} saves it for a flyer, a door hanger or a Google Doc.
- {{button:outline|Print}} opens a half-sheet to leave with a paper bill. It carries *Scan to pay*, the bill, the amount, the code and the address in words.

The code does not carry Stripe's link. It carries the bill's own address, `clicktooling.com/pay/…`. That address fetches Stripe's current link when it is scanned. So a printout stays good after Stripe's link rolls over. A bill that has since been paid says *Paid* instead of asking again. A bill with no Stripe invoice has no code, the same as it has no links.

A big amber slice is the signal to bill. Work is finished but the money has not been asked for. A blue bar means the bill is already out. You are waiting on the customer, not on the office.

Know the job's number? The small **#** chip left of the Pipeline search bar is the fast lane. You click it, type a C# or HCP number, and press Enter. The board opens the right section and scrolls to the job with a highlight flash. Partial numbers land on the first match. The big search bar stays what it was. It is the broad filter for names, addresses, and notes.

## How long the field has been waiting

Each row in **Field: Waiting for Approval** shows how long the tech has been waiting on the office. The clock starts when they tapped {{button:blue|Collect Payment}}. Under two days it is a running clock, like `1:02:03`. After that it reads in whole days. It shows {{chip:yellow|Waiting 2 days}}, then {{chip:red|Waiting 3 days}} and up. So a stuck approval stands out instead of showing a number like `282:59:39`. The tech's own Collect Payment screen keeps the live clock, because they are standing there watching it.

## The Dashboard card explains itself

The Dashboard's **Billing Pipeline** card has a round **i** button next to its title. You tap it for a compact map of the whole flow. The map shows the upstream Waiting/Working stages and the card's three numbered stages. It shows who taps what at each one. At stage 1 that is the field crew's {{button:blue|Collect Payment}} → office {{button:green|Approve}} handshake. The field crew is a subcontractor, helper, or superintendent. It shows where paid jobs go. Its *Full guide in Help* link lands right here.

## Section tools in one dropdown

The stage headers down the board carry their own buttons. Working has Capable of Being Billed. Ready to Bill has Ready to Bill notifications. Billed Awaiting Payment has GC Review, Accounts Receivable, Share / Print and Paid notifications. GC means the general contractor. Paid in Full has Paid in Full notifications. The **hamburger menu icon just left of Waiting** sits in the stage strip. It collects all of them in one dropdown, grouped by section. So you can open any of these without scrolling the board.

:::example Section tools
**Working** &nbsp; Capable of Being Billed: $48,450
**Ready to Bill** &nbsp; Ready to Bill notifications
**Billed Awaiting Payment** &nbsp; GC Review &nbsp;·&nbsp; Accounts Receivable {{chip:yellow|16}} &nbsp;·&nbsp; Share / Print &nbsp;·&nbsp; Paid notifications
**Paid in Full** &nbsp; Paid in Full notifications
:::

The Capable of Being Billed figure reads each Working job's stage plan when the job has Order stages. A stage counts once it passed inspection with nothing unbilled ahead of it. A done any-time row counts too. Every other job uses the percent-complete formula.

The amber count on Accounts Receivable is the same unallocated-bank-deposits badge the header button wears. Every item follows the same permissions as the button it mirrors. If you cannot use it on the header, it is disabled or hidden here too.

The **Crew & Dates** cell names the people on the job whose accounts are live. Crew whose accounts have been archived fold into *and 3 archived*. So a long-running job does not stretch the line. You click the names to open **Everyone on the job**. It lists each person with their role, status, hours, days and last day on the job. Status reads {{chip:green|Active}} or *Archived Jul 12*. Live accounts come first, then archived, each by hours. Under a grey heading sits anyone with hours here who was never put on the crew list. A name opens their Person desk.

:::example Mission Hills
The cell reads *Malachi, Tristen, Trace, Michael A, and 5 archived*. Click it: Mario and Jesse, both archived in July, carried 300 of the job's 959 hours; Tristen's last day was yesterday.
:::

At the start of each row, next to **Crew & Dates**, a small stack of shortcuts covers the common jump-offs. The green calendar opens **Assign work**. That is the same sheet Dispatch mode uses, with the job already picked. You just choose the day, the people, and a time window. Whole crews go in one tap. The row's green **Next** line updates in place without losing your spot on the board. The blue grid opens its **week dispatch**. The red pin opens the address in **Google Maps**. The phone icon **calls the customer**. It only appears when the job has a phone number on file. The purple send arrow **sends the job to someone as a task**. It opens the New task form with the job attached as a link. You add your note and pick who it is for. When they open the task, clicking the job's name takes them straight to its **Job Detail**. The same purple send arrow also sits in the **Job Detail** header. So you can send a job to someone while you are already looking at it.

On the **mobile cards** view, the card's foot keeps just the **phone icon** and the **⋯** menu. Everything else moved into the ⋯ sheet. The sheet opens headed by the job and its crew. It holds View job, Edit, **Crew and hours**, Activity, Calendar, Share, Test report and Google Maps. It also holds **Assign work**, **Send to Dispatch**, **Send as task**, Week dispatch, and Send back. Crew and hours is the same Everyone-on-the-job list.

## Getting to Ready to bill

A job usually reaches Ready to bill one of two ways:

- A tech files a **Job Complete** report at 100%. The app offers the move right there:

:::example After a 100% Job Complete report
**Move to Ready to Bill?**
☑ I have reported all the Job Parts I've used

{{button:outline|Not yet}} &nbsp; {{button:green|Move to Ready to Bill}}
:::

- Or the office moves it manually from the Jobs Pipeline board.

Trip charges from Turnaways also land in Ready to Bill as their own standalone lines. They are independent of the job's status. The job total rises by the same amount. So the job's own remainder bill is not shrunk to pay for the trip.

## The Ready to Bill queue

**Assistants cannot miss it**. Whenever anything is waiting in Ready to Bill, a slim orange bar sits just under the header on every page. It reads {{chip:yellow|3 ready to bill — send them}}. You tap anywhere on it and you land on Jobs. The Ready to Bill section is already open and scrolled into view. The bar disappears the moment the queue is empty.

On the Dashboard, office roles see ***Ready to Bill (N)***. It lists every job and invoice line waiting to be billed, each with its own billing button:

:::example A Ready to Bill card
**J512** · Smith House Repipe
123 Main St &nbsp;·&nbsp; Remaining: $4,250.00

{{button:blue|Bill Customer}} &nbsp; {{button:outline|Delete draft bill}}
:::

A paid-up job never sits in Ready to Bill or in Billed Waiting for Payment. Once a job is {{chip:green|Paid}}, any old draft bill on it drops out of these queues. The Dashboard counts match the Pipeline board. If you remember an old draft there, it has been retired.

The **Not Billed Out** card in Dashboard Financials shows the total revenue that has not reached a customer invoice yet. So nothing slips.

## Breaking off a partial invoice

To bill part of a job now and the rest later, you open the job's **Bill** tab. You use **Bill part of it** under **Make a bill**, or tick lines on the money card. That is the main path on a computer. On the **mobile cards** view, the **⋯** menu's **Partial invoice** item opens a small modal instead:

:::example Create partial invoice
**J512** · Smith House Repipe
Remaining: $1,500.00

Amount ($) &nbsp; `500`

{{button:outline|Cancel}} &nbsp; {{button:green|Create invoice}}
:::

**Remaining** is what is still unallocated. It is the job total minus payments already made. It is also minus what is still unpaid on every invoice line that already exists on the job. That counts partial drafts and billed alike. A bill the customer has partly paid counts for its unpaid part only. The paid part is already in payments. The automatic remainder draft a Ready to Bill job carries does not count against it. That draft just resizes to whatever you do not break off. An amount above Remaining is clamped down automatically. Entering the full remaining amount on a Ready to Bill job simply opens Bill Customer instead. Both paths share the same Remaining math.

## Billing a customer

You press {{button:blue|Bill Customer}}. The modal opens on **Stripe bill**. It shows the job and the RTB amount, with two method tabs plus a **▾** for the rest. RTB means ready to bill.

{{gif:ready-to-bill-pipeline.gif|Bill Customer from the Ready to Bill queue: the method tabs and the physical-invoice preview}}

:::example Bill Customer — method tabs
{{button:blue|Stripe bill}} &nbsp; {{button:outline|Physical invoice}} &nbsp; {{button:outline|▾}}
:::

- **Stripe bill**: creates and sends a hosted Stripe invoice by email. This is the standard path. Payment status syncs back automatically.
- **Physical invoice**: a mailed paper invoice, with a date and optional memo. Next to the on-screen invoice preview sit two check-before-you-send buttons. {{button:outline|Preview}} opens the PDF in a new tab. {{button:outline|Preview email}} opens the exact email the customer will receive, without sending anything. That is the subject, body, and the payment-history card.
- **▾**: reveals **HouseCall Pro**, which records a bill you sent through HCP. The form says so on its face. It reads *Records the bill as sent through HouseCall Pro — ClickTooling emails nobody*. Nothing leaves the app on this channel. The job moves to Billed Awaiting Payment and the customer sees nothing from here. It is tucked away on purpose. Most billing should go through Stripe.

A job needs a linked customer before it can be billed. For Stripe the customer needs an email. The modal guides you if something is missing.

Sometimes checks from the payer came back this past year. Then the modal says so. It reads {{chip:yellow|2 checks came back · Apr}} and suggests a card or a bank transfer. It never stops the bill.

**Opening Bill Customer changes nothing.** The RTB amount you see is worked out on the spot. It comes from the job total, payments made and the invoices already on the job. The bill row itself is written only when you press a send button. Those are {{button:blue|Create Stripe invoice}}, {{button:blue|Save}} on HouseCall Pro, or {{button:blue|Send invoice}} on Physical. You press {{button:outline|Cancel}} and the job is exactly as you found it. No draft appears and no draft resizes.

:::example If the remainder moved while the modal was open
Someone records a $500 payment while you're looking at a $2,630 bill. When you press Send, the modal stops, shows the new **$2,130**, and asks you to look it over and send again — it never bills the new number silently.
:::

**What the customer will see** is filled in the moment the modal opens. It lists every line the bill will list, a discount as its negative line, and the total. It is built from the job's own line items. Stripe's exact rendering replaces it once it can run. Until then the small tag reads *from the job's lines*. The note above it says what Stripe is waiting on. That is the customer's email, or the bill row that is written when you send.

If the job is already {{chip:green|Paid}}, Bill Customer says so instead of showing a preview. It reads ***This job is already paid in full — nothing to bill.*** All three send buttons stay off. The safe move is Cancel. Sometimes the customer really does owe more on that job. Only then, you tick **Bill this job again anyway** to unlock the buttons. The same check runs on the server, so an old browser tab cannot slip a bill past it.

:::example Bill Customer on a paid job
**This job is already paid in full — nothing to bill.**
{{chip:gray|☐ Bill this job again anyway}} &nbsp; {{button:outline|Cancel}} &nbsp; {{button:gray|Create Stripe invoice}}
:::

## Billed → Paid

Once billed, the job shows under **Billed Waiting for Payment** on the Dashboard. It also shows in the Pipeline's **Accounts Receivable** window, the button on the *Billed Waiting for Payment* header. Card payments through Stripe mark themselves. Cash, a check or a wire you record yourself. The quickest way is on the bill. In the Edit Job window's **Bill** tab, every open bill has {{button:blue|Record payment}}. It is also under its ⋯ menu. It opens **Record a cash or check payment** with the bill's open balance filled in. You set the date, pick Cash or Check, add the check number if you have it, and confirm. The payment lands under **③ Payments received**, applied to that bill. When everything is collected the job moves to {{chip:green|Paid}}.

:::example A bill that went out through Stripe, paid in cash
Record it the same way, on the bill. For the whole balance, Stripe is told the bill was paid outside Stripe, so the emailed pay link stops working and no reminder goes out. For **part** of it, type the amount you were handed: the window says *Part payment. Stripe lowers the bill to $500.00 due* and the button reads {{button:blue|Record $1,000.00 · $500.00 stays due}}. Stripe puts a credit line on the invoice in your words — *Cash received Sep 21 · $1,000.00* — so the pay link asks only for the rest; the customer can pay that online, or you record it here later. Recorded it wrong? The payment's row under **③ Payments received** has **Undo part payment**: it voids that credit line and takes the payment off the job.
:::

Some money is not for one bill, like a deposit before billing or a tip. For that you use {{button:outline|+ Record a cash or check payment}} under **③ Payments received**. A line opens with today's date. You fill in the amount. Type, Ref, and Memo are optional. They fold into a one-line note once saved, and the pencil reopens them. The blue {{button:blue|+}} below the lines adds another. The **Applies to** dropdown on the line lists the job's open bills that take a hand-entered payment. You leave it on ***Job (unassigned)*** for a general job payment. A Stripe bill is never in that list. Say you type a payment on a job whose open bill is a Stripe bill. An amber note under the line says so. It offers {{button:outline|Record on the $1,500 bill →}}. That opens the same window with the amount you typed. It drops the typed line once Stripe has recorded the payment.

:::example Bank deposit for a payment you already recorded?
In **Accounts Receivable**, each allocation line has a **Billed line / Payment received** switch. Pick **Payment received** to link the deposit to a payment already sitting in Edit Job → Payments received — the amount locks to that row and no duplicate payment is created; the deposit's remaining balance drops just the same.
:::

### Customer paid a Stripe invoice by check?

Sometimes you email a Stripe invoice and the customer mails a check anyway. Those bills show in the Accounts Receivable picker marked ***· Stripe***. You can allocate the deposit straight to one, but an amber confirmation appears first. You check the box acknowledging the customer paid **outside** Stripe. Until the box is checked, {{button:blue|Apply}} stays disabled.

**When the allocation matches the bill's full balance, the app finishes the Stripe side for you**. Applying also marks the Stripe invoice paid, out-of-band. So the emailed payment link cannot be paid a second time. The confirmation text tells you this is about to happen. If Stripe cannot be reached, the allocation still applies. The modal stays open with a **Retry Stripe close** button, plus instructions for doing it by hand in Stripe. Only a **partial** allocation leaves the Stripe side to you. Then the confirmation reverts to the reminder to void or mark the invoice paid out-of-band in Stripe yourself.

**Mark Paid** on a billed row opens the Record payment window with the job's balance. If the job still has a balance you record the payment there. If it is already fully paid, the window says so and offers a one-click {{button:blue|Move to Paid}}. That happens when, say, the payment landed through a bank-deposit allocation but the stage never moved. No payment gets invented.

Jobs that are billed but proving hard to collect can be flagged for **Collections**. They get their own section so the AR picture stays honest. AR means accounts receivable, the money customers owe. The flag takes care of itself on the way out. The moment the job is paid in full, it leaves Collections and lands in {{chip:green|Paid}} with the flag cleared. That works by Stripe, a bank-deposit allocation, or Mark Paid. The job's activity thread notes it was removed from Collections. **Send back to Billed** on a Collections row is for one case only. That is when the job should return to plain Billed Awaiting Payment before it is paid.

### The check didn't clear?

A bill marked paid by check is closed in Stripe as paid *out of band*. Stripe holds no money, only the mark. So when the check fails at the bank the bill cannot simply be re-sent. Stripe never reopens a paid invoice and its pay link now reads Paid. The way back is to reverse the mark and bill again. Both doors do it in one press:

- On the job's **③ Payments received**, the check payment wears {{button:outline|Check didn't clear…}}. It opens **Undo out-of-band payment** with the reason filled in. **Send the bill back to Ready to Bill** is already ticked. You confirm. ClickTooling issues a credit note in Stripe that reverses the mark. It takes the payment off the job, removes the billed line and moves the job back to {{chip:blue|Ready to Bill}}.
- If the payment was already removed, you open **View Bill** on the Billed row. The footer reads {{button:outline|Check didn't clear · send back…}}. The confirm says what it will do: credit note, billed line removed, job back to Ready to Bill.

Then you press {{button:blue|Bill Customer}} as usual. A fresh Stripe invoice goes out with a new number and a new pay link. The old invoice stays in Stripe as paid and reversed. The reversal is kept on the job's payment record with who did it and why.

:::example the check could not be deposited
Iannotti PRV: a $600 Stripe bill was marked paid by check on Sep 24; the mobile deposit failed the next morning. View Bill → *Check didn't clear · send back…* → Send back puts the job at Ready to Bill; Bill Customer sends a new $600 bill and the customer pays online.
:::

A bill the customer paid by **card or bank transfer** through Stripe is different. That money is real. The send-back says to refund it in the Stripe Dashboard first.

## The "paid in full" email

The moment a job lands in {{chip:green|Paid}}, the app can email the good news automatically. Devs and leaders on the list get the **detailed review**. It has a {{chip:green|PAID IN FULL}} banner, and the job start and last-work dates. Then comes the full scoreboard. That is revenue, every payment with its date, and team labor person by person, hours × wage. Then sub labor, parts, and the profit line, plus a month-by-month timeline. Everyone else on the list gets the **summary**. It has the same banner and dates, and the payment amount and time. It has no cost or profit figures anywhere.

Who gets it lives behind the {{icon:gear}} **Paid in Full notifications** button. It sits across from the **Paid in Full** section header on Jobs → Pipeline. Devs and leaders can open it. Only devs can change the list. Each person shows a Detailed or Summary badge so there are no surprises. The same window has a **Preview & test** block. You search for any job, then

:::example Preview & test
Selected: **J512** · Smith House Repipe

{{button:outline|Preview detailed}} &nbsp; {{button:outline|Preview summary}} &nbsp; {{button:outline|Email me a test}}
:::

The previews open the exact email in a new tab. **Email me a test** sends the detailed version to your own address with a `[TEST]` subject. So you can check it in a real inbox before anyone else ever sees one.

## The "payment made" email

There is a second stream for jobs that are not finished yet. Whenever **any** payment lands on a job, the app can email a progress version of the same report. A payment lands when the office marks a payment. It lands when a bank deposit is allocated in Accounts Receivable. It lands when a Stripe payment comes in. Instead of the green banner it leads with an amber ***$X (Y%) OF $Z PAID*** banner and the payment that just arrived. Then comes the job's **Invoices** table exactly as the office sees it in Edit Job. Each bill shows its {{chip:yellow|Draft}} / {{chip:blue|Billed}} / {{chip:green|Paid}} status, sent date, and amount. It shows how much of it is paid and how much is still open. The line items follow. Detailed and Summary versions work like the paid-in-full email.

Its recipient list is separate. It sits behind the {{icon:gear}} **Paid notifications** button next to the **Billed Awaiting Payment** section header. The same rules apply: devs and leaders open it, devs edit it. When a payment finishes the job, only the paid-in-full email goes out. You never get both for the same payment.

## Ready to Bill notifications

The third stream watches the **front** of the billing pipeline. It fires the moment any job moves to {{chip:yellow|Ready to Bill}}. That can be a crew finishing up, or the office moving it by hand. It can be a job coming **back** from Billed after an invoice is deleted or reverted. The people on its list are notified so billing can start right away.

This stream is the first that can reach people **two ways, set per person**. The list sits behind the {{icon:gear}} **Ready to Bill notifications** button on the Ready to Bill section header. The same rules apply: devs and leaders open it, devs edit it. Every person in the list has their own **📧 email** and **🔔 push** checkboxes. They sit at the right end of their row:

- **📧 Email**: sent within about 15 minutes, batched with the other notification emails. Devs and leaders get the detailed version. That is the billable amount, draft bills, and payments so far. Everyone else gets a summary with no dollar figures.
- **🔔 Push notification**: a short alert straight to that person's phone or computer. It works once they have enabled push notifications on a device, at Settings → Your account. Checking 🔔 for someone who has not enabled push yet shows a red **no push device** warning. The checkbox is still fine to leave on. Pushes start the moment they enable it. Push follows the same detailed/summary rule. Dollar amounts go only to devs and leaders.

You check either box, or both. Someone with nothing checked is not notified at all. Changes save the moment you click. There is no Save button on this list.

:::example Recipients
Taunya · taunya@clickplumbing.com &nbsp; {{chip:gray|Summary}} &nbsp; ☑ 📧 &nbsp; ☑ 🔔
Robert · robert@douglasmining.com &nbsp; {{chip:yellow|Detailed}} &nbsp; ☐ 📧 &nbsp; ☑ 🔔
:::

Below the list, **Preview & test** stays tucked behind a collapsed toggle until you need it. You open it and pick a job. Then you can preview the detailed or summary email. Or you send a real test **to yourself or any teammate**. You choose a name in *Send test to*, then **Email a test** or **Push a test**. Tests carry a `[TEST]` subject. A test email to a teammate follows their role. Summary-tier people get the summary even in tests.

:::example Preview & test
Selected: **J512** · Smith House Repipe

Send test to: **Taunya** &nbsp; {{button:outline|Email a test}} &nbsp; {{button:outline|Push a test}}
:::

If several moves happen back-to-back on the same job, they collapse into one notification.

## The aging chart

The **📊 Chart** button on the Billed Awaiting Payment header turns the whole section into one picture. Devs and controllers see it. Every open bill is a bubble. The further **right**, the longer it has been waiting. That is the same clock as the 30+/90+ chips, with matching shaded bands. The **higher**, the more money is still open on it. The **bigger the bubble**, the more the job cost us. So a big bubble far right is your own cash tied up, not just revenue on paper. Bills where our cost has already passed the job's revenue show as red dashed bubbles. Those are underwater, and waiting on those hurts twice. A stat strip on top gives the totals, median age, the 90+ figure, and the underwater sum. You hover any bubble for the job's numbers. **You click it to jump straight to that bill on the board**.

The Paid in Full header has its own **📊 Chart**, with the same devs-and-controllers rule. Every paid job is a bubble. **Profit** runs up the side. Jobs that lost money sit below a bold $0 line, tinted red. **Clocked hours** run along the bottom. Bubble size = the job's revenue. The dashed guide lines through the corner read as profit per hour of our time. A bubble under the $50/hr line earned less than that for every clocked hour. You hover for revenue / cost / profit / $-per-hour. You click to open the job.

## Sharing the Billed report

The **Share / Print** button in the same header emails the Billed Awaiting Payment report to an office teammate. Devs, leaders, controllers, and assistants see it. It is the same customer-grouped report the old Print button made, upgraded for email. Phone numbers and emails are tap-to-call and tap-to-write. **Clicking any job opens its Job Detail right in the app**.

:::example Share Billed Awaiting Payment
Send to: **Taunya** · When: {{button:blue|Send now}} or **Schedule…** a date and time (Central)

{{button:blue|Send email}} &nbsp; {{button:outline|Preview}} &nbsp; {{button:outline|Email me a test}} &nbsp; {{button:outline|🖨 Print instead}}
:::

Scheduled sends build the report **fresh at send time**. A Monday 7 AM email shows Monday's numbers, not Friday's. They arrive within about five minutes of the chosen time. Your pending sends are listed in the window with a **Cancel** next to each. **Preview** opens the exact email in a new tab. **Email me a test** sends it to your own address with a `[TEST]` subject. **Print instead** is the old print path, unchanged. Recipients can only be office roles, because the report carries amounts due.

There is also a per-job version. On **Job Detail**, the envelope icon in the header opens the same email. The preview shows right in the window. Devs and leaders only see it. A **Detailed | Summary** toggle flips between the two versions. The send actions sit at the top:

:::example Paid-in-full email window
{{button:blue|Send to me}} &nbsp; {{button:outline|Send to someone…}}
:::

**Send to me** emails you the `[TEST]` copy. **Send to someone…** opens the people list with the same Detailed or Summary badge per person. Picking someone flips the preview so you see exactly what they will receive before you send it.

The email tells the truth about where the money stands. So you can send it for **any** job, not just finished ones:

- Fully paid → the green {{chip:green|PAID IN FULL}} banner, as always.
- Partially paid → an amber banner like ***$4,812.50 (26%) of $18,450.00 paid***. The subject reads *Payment progress* instead of *Paid in full*.
- Nothing paid yet → a gray **NOT PAID** banner.

Just under the banner, both versions list the job's **line items** with a chip per item. The chip is {{chip:green|Paid}}, {{chip:blue|Billed}}, {{chip:yellow|Draft}}, or {{chip:gray|Unbilled}}. So the reader sees exactly which parts of the job the money covers. The detailed version shows each item's amount. The summary shows names and status only.

The detailed version ends with a **Cost & payment timeline**. It is the same story as the Cost Timeline in Edit Job, told month by month. Each month's shaded row has a bar showing the running total, payments in minus costs out. A bar to the right of the center line means the job had collected more than it cost by then. Beneath it sit the charges and payments that moved the money that month. Those are team labor by the week, card charges, sub labor, supply-house invoices, and tally parts. Busy months keep their biggest lines and fold the rest into one *…and N smaller charges* row. The bars stay exact either way. Charges without a date sit in a *No date* group at the bottom. The **Job end** line is the job's final in-minus-out. The cost totals above it now count all six streams, matching Edit Job's numbers. That includes supply-house invoices, tally parts, and other job charges.

## Where to watch it all

- **Dashboard**: Ready to Bill and Billed Waiting for Payment queues, plus the Financials cards. Those are Accounts Receivable, Accounts Payable and Not Billed Out.
- **Jobs → Pipeline**: the full board, every status.
- **Quickfill**: the **Jobs Billing** and **Billed Awaiting Payment** sections put billing review into the office's daily loop.

## Sending to more than one person

Commercial customers are usually several people: the PM, the AP clerk, the owner. The PM is the project manager. The AP clerk handles accounts payable, the bills they owe. You open the job in Edit Job and click **Bills also go to** under the customer's Email. You tick the people at the customer who should get every bill, or add one with a name and email. It saves on the customer, so their next job already has them. Bill Customer's **Send to** list starts with them ticked. You untick to skip someone on one bill, or type a one-off address. The full walk-through is in *send a bill to more than one person*.

The primary **Email** field stays the billing identity. Stripe itself emails that one address. You press **Send Email invoice**. Everyone else on the Send to list gets a copy from Click Plumbing and Electrical with the same Pay link.

## When there's no customer email

Stripe and emailed invoices need a customer email. The app now flags the gap early:

- On **Jobs → Pipeline**, an amber {{chip:yellow|No email (N)}} chip appears by the section chips. It shows whenever Ready to Bill jobs are missing one. You click it for the list, then open Edit Job to fix.
- Marking a job **Ready to Bill** without an email shows a heads-up toast right then.
- If you reach **Bill Customer** anyway, an amber banner at the top lets you **type the email right there**. It saves to the job, and optionally to the customer's record if that is blank too. Stripe billing unlocks immediately, with no reopening.
