---
title: read the Pipeline's money view
category: Office
roles: dev, master_technician, assistant, controller
keywords: pipeline, money story, money opportunities, money moves, aging, capable, collected, billed, 90 days, burn, burning, margin at risk
order: 96
---
The Jobs → Pipeline tab opens with the money story. Four answer cards and a to-do queue sit at the very top.

They sit above the New Job, Follow-ups, Forecast and search row and the map. So the money questions are answered before you scroll. You start typing in the search box and the whole money story steps aside until you clear it. The jobs you are looking for land right under the query. On a phone the cards, the map and the queue fold together. They become the Overview at the bottom of the board.

## The four answer cards

- **Ready to ask for**: finished work you have not asked to be paid for yet. That is what is capable of being billed in Working plus what is staged in Ready to Bill. Work already covered by a sent bill or a queued draft does not count. The moment you bill a job, that money moves from here to **Waiting on customers**. A job split into stages on its Bill tab, the Order rows, counts the way that tab does. It counts the stages that passed inspection with nothing unbilled ahead of them. It counts any-time rows whose work is done. Every other job counts its percent complete less what is paid or asked for. You click it to open the Capable of Being Billed list. A staged job says under its name which stages make up its amount.
- **Waiting on customers**: everything open in Billed Awaiting Payment, with an age bar. Fresh is on the left, 30–90 days in amber, **90+ in red**. You click it for **Who owes what**. That is every customer with open bills ranked by total owed. Each has a bill count and an oldest-bill age chip. You click a customer and each bill opens as its own card. The card shows the job name, job number, **the job site address**, and **the line items that bill covers**. The line items come from the job's Specific Work lines, scoped to that bill. The amount and age sit at the top right. {{button:outline-blue|View on board}} jumps straight to that bill on the board. The small PDF button beside it opens the bill as a freshly generated invoice PDF in a new tab. It is ready to print or send along. Each card also says how the bill went out and offers the matching re-send. Stripe bills show when the invoice email was sent and a {{button:outline|Never got it? Resend}} button. That is the same confirm-then-send flow as the Payment Chase call card. It logs the same chase touch. Emailed-PDF bills get {{button:outline|Email again — PDF attached}}. It re-sends a freshly generated copy without changing anything about the bill. HouseCall Pro bills show a note instead. HCP mails its own invoice. A bill may cover only part of a job with no lines carved out for it. Such a bill shows no line list. The card never lists more work than the bill asks for. The aging chart and a 90+-only view are one click away in the footer. Every age on this board counts from the bill's date. That is the day the line was billed, or the **est. bill date** when someone set one by hand. A correction always wins. Those chips carry a small dot, {{chip:red|156d ·}}. Only a billed job with no bill line at all reads *no bill line*.
- **In collections**: the difficult money. You click to jump to Collections.
- ***Collected · last 8 wks***: payments recorded each week, with a trend line. Devs and leaders only. Other roles see three cards.

## Does the money land before the lien dies?

A lien is a legal claim on the property for unpaid work. Every row in **Billed** and **Collections** ends with the bill's dates in one block under the money legend. It is drawn the way the legend is. There are rows with a dot, the words, and how far from today on the right. Then, only when it has something to add, one bold line under a hairline.

- ***Billed Sep 23 · 7d ago***: the day the bill went out. Every clock below starts here.
- ***Expected Oct 4 · in 4d***: when the money is expected. That is a date the customer named, like *They said Oct 3*. Else it is the bill date plus the payer's usual pay speed. The payer is whoever the bill went to, so a job billed to a GC uses the GC's pace. It turns amber and reads *1d past* once it is behind. You click it to record what they said. The pay history sits under it in the same grey, like *Pays in 2–8d · keeps 3 of 4*.
- **One deadline row.** On a job under a GC, the general contractor, it starts as ***Lien notice by Oct 15 · 16d***. A notice is owed for each month the crew worked. The row shows the deadline of the earliest month still owed. It stays a notice row until each of those notices is recorded in the Lien window. Nothing can be filed before they go, so the lien date waits. Once they are recorded the row becomes ***Lien by Nov 16 · 48d*** with *notice sent* under it. A job we contracted with the owner directly shows *Lien by* from the start. A ring means the deadline is still ahead and the money is due before it. The row turns bold and amber when the money is not landing first. It turns red inside a week. Not landing first means expected after it, already past, or never named. A notice asks at any distance, because it is cheap and it is what keeps the lien alive. The lien asks as *File the lien* inside three weeks.
- **The bold line** appears only when it says something the rows do not. *Can run late · 72d* in green means how much later than expected the money can land before the deadline. *Notice first* or *File the lien first · 5d short* in red means the money is expected after the deadline, so act before it. *Ask for a date · 12d past* in amber means the expected date has gone by with nothing in and no deadline is pressing. You click it to record what they say. *Lien gone* in red sits under a *Lien window closed* or *Notice window closed* row. It means the window shut with nothing filed. When the deadline row is itself the thing to do, it is bold and no line repeats it.

*Lien by* is the last day the affidavit can be filed with the county clerk, not a day to send anything. An affidavit is the sworn lien paper. *Lien notice by* is the last day to send the § 53.056 notice to the owner and the GC. The deadline row and the bold line open the job's **Lien window** on its timeline. There the last work month, the property kind and the statute are spelled out. You hover a row for the same in a line.

:::example A house with no property kind set
The lien row shows the **residential** date — a month earlier than commercial — and the hover says *Property kind is not set, so the earlier (residential) date is shown*. That is the safe reading: a house read as commercial is a lien lost a month late. Open the job's Edit tab → **Property record** and pick {{button:outline|Residential}} or {{button:outline|Non-residential}} to confirm it.
:::

On a phone the row's one chip carries the verdict. It reads {{chip:red|file first}}, {{chip:red|lien gone}}, {{chip:yellow|notice in 17 d}}, {{chip:yellow|lien in 17 d}} or {{chip:green|12 d of room}}. It shows once the flag is inside three weeks or the money is due after it. A tap opens the Lien window.

### A job with more than one bill out

A job with two or more bills out shows one row for each bill. The money legend on each row is the whole job's. The dates block is that bill's own. Just above the dates, a line says what is paid and what is left on that bill. It reads like *This bill · $11,182 paid · $589 left*, or *This bill · nothing paid · $3,636 left*. A payment counts against a bill once it is linked to it. {{button:green|Mark Paid}} on a bill's row links the payment for you. A bill still waiting in Ready to Bill reads like *$250 draft*.

## Today's Money Opportunities

Below the cards, the system writes your to-do list from the live numbers. Each row says what and why. Each has a button that jumps to the right spot:

:::example A typical morning
**Bill the finished work — $102,384** → {{button:outline-blue|Capable list}}
**Chase the 90+ tail — $44,587** → {{button:outline-blue|Show 90+}} (opens Billed with only those rows)
**Allocate 1 bank deposit** → {{button:outline-blue|Accounts Receivable}}
**65 billed jobs have no bill line** → {{button:outline-blue|Show them}} (opens Billed filtered to just those rows) — money on no bill line can't age, be chased, or be forecast
:::

The no-bill-line rows are also always reachable from the Billed header's {{chip:gray|No line · 65 · $48k}} chip. It sits next to the 30+/90+ aging chips. Each filtered row wears a {{chip:yellow|No bill line}} tag. The fix is creating the job's bill line, not just setting a date.

While that filter is on, {{button:outline-blue|Fix bill lines…}} opens the one-sitting repair. It is the same idea as the customer classifier. Every job is listed biggest dollars first. Each has a date input for when the bill actually went out. {{button:blue|Create line}} puts the full open amount on a backdated bill line. The job immediately starts aging, chasing, and showing up in the payment forecast. You work down the list. The counter tracks *N of M fixed*.

:::example Why the date matters
A job billed in May that gets its line created today with a May date shows up instantly in the 90+ chip where it belongs — backdating keeps the aging honest instead of making 64 old bills look brand new.
:::

When there is nothing to do, the queue says so. An empty list means the pipeline is clean.

### The Fix-ups strip

When jobs are missing the data billing needs, a slim **Fix-ups** strip appears at the bottom of the card. {{chip:red|No customer · 1}} means a job with no linked customer, which cannot be billed at all. {{chip:red|No customer pictures · 3}} is next. {{chip:yellow|No email · 2}} matters because Stripe and emailed invoices need one. {{chip:yellow|Owner of record to confirm · 35}} is GC jobs with approved hours whose property record has no confirmed owner. The lien notice cannot be mailed without one. Each chip opens its fix-it list. The owner chip's list looks every property up on the appraisal roll. You confirm them with one **Use** each, or **Use all found**. See *file a lien and never miss its deadlines*. When everything is clean, the strip disappears entirely.

### Jobs burning ahead of progress

For owners, controllers and master techs, a red-edged card appears a few seconds after the board. It appears when any open job has spent a bigger share of its budget than it has finished. It reads ***🔥 3 jobs burning · $41,300 margin at risk***. *Worst first →* sits at the right end of the line and lands on that job's **Costs** tab. Under it sit the worst three as chips, like {{chip:red|◆ J927 Mike Holub · 133% spent at 70% done}}. Each opens its own Costs tab. You hover one for what it was measured against. ◆ is the bid, ✎ is a typed budget, and ≈ is an assumption. {{chip:gray|+N more}} opens Job Summary on In progress, sorted worst projected margin first. The % done is the newest number on the job. That is the crew's latest report with a percent, or the % typed on the job when that came later. Nothing hot, no card.

### Lien notices due

For the office, the Lien desk's own count sits on the strip the moment a notice is due. It reads ***⏱ 5 lien notices due · $28,987***. *Lien desk →* sits at the right end of the line. It opens the desk on its Notices tab. See *send lien notices from the Lien desk*. Under it sit the piles as chips: {{chip:gray|2 to draft}} {{chip:gray|1 needs an owner}} {{chip:gray|2 awaiting approval}}. Each opens the desk on that pile. The earliest window is the one colored chip, like {{chip:yellow|by Oct 3 · in 9 days}}. It is red inside a week of the window closing and amber inside two. It reads {{chip:red|closed Sep 15 · Loberg Contracting}} once it has passed. That notice goes out as information. You hover the chip for the sentence behind it. The same door is the first row of the jump strip's ☰ Section tools menu, *⏱ Lien desk · N*. Nothing due, no card.

## The board you last saw comes back first

You open Pipeline cold, in a new browser tab, after a reload, or on a phone that closed the app. The board this device saw last is on screen at once. It shows *Updating jobs…* and a {{chip:yellow|board from 6 h ago}} chip under the tabs. The live board replaces it about a second later. Until then every dollar reads greyed and the rows' buttons wait. So nothing can act on a remembered row. A remembered board older than 24 hours is not shown. The page then loads the way it always did. The remembered board stays on the device, per account. It is dropped when you sign out.

## The board is still the board

Everything below the cards is identical in both views. That is the jump strip with the stage counts, and every section from Waiting to Paid in Full. New only adds the layer on top. Nothing about how you work rows changes.
