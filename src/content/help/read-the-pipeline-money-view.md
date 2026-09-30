---
title: read the Pipeline's money view
category: Office
roles: dev, master_technician, assistant, controller
keywords: pipeline, money story, money opportunities, money moves, aging, capable, collected, billed, 90 days, burn, burning, margin at risk
order: 96
---
The **Jobs → Pipeline** tab opens with the money story: four answer cards and a to-do queue at the very top, above the New Job · Follow-ups · Forecast · search row and the map, so the money questions are answered before you scroll. Start typing in the search box and the whole money story steps aside until you clear it — the jobs you're looking for land right under the query. On a phone the cards, the map and the queue fold together into the Overview at the bottom of the board.

## The four answer cards

- **Ready to ask for** — finished work you haven't asked to be paid for yet: what's capable of being billed in Working plus what's staged in Ready to Bill. Work already covered by a sent bill or a queued draft doesn't count — the moment you bill a job, that money moves from here to **Waiting on customers**. A job split into stages on its Bill tab (Order rows) counts the way that tab does: the stages that passed inspection with nothing unbilled ahead of them, plus any-time rows whose work is done; every other job counts its percent complete less what's paid or asked for. Click it to open the Capable of Being Billed list — a staged job says under its name which stages make up its amount.
- **Waiting on customers** — everything open in Billed Awaiting Payment, with an age bar: fresh on the left, 30–90 days in amber, **90+ in red**. Click it for **Who owes what**: every customer with open bills ranked by total owed, each with a bill count and an oldest-bill age chip. Click a customer and each bill opens as its own card — job name, job number, **the job site address**, and **the line items that bill covers** (from the job's Specific Work lines, scoped to that bill) with the amount and age at the top right; {{button:outline-blue|View on board}} jumps straight to that bill on the board, and the small PDF button beside it opens the bill as a freshly generated invoice PDF in a new tab — ready to print or send along. Each card also says how the bill went out and offers the matching re-send: Stripe bills show when the invoice email was sent and a {{button:outline|Never got it? Resend}} button (same confirm-then-send flow as the Payment Chase call card — it logs the same chase touch); emailed-PDF bills get {{button:outline|Email again — PDF attached}}, which re-sends a freshly generated copy without changing anything about the bill; HouseCall Pro bills show a note instead — HCP mails its own invoice. A bill that covers only part of a job and has no lines carved out for it shows no line list — the card never lists more work than the bill asks for. The aging chart and a 90+-only view are one click away in the footer. Every age on this board counts from the bill's date — the day the line was billed, or the **est. bill date** when someone set one by hand (a correction always wins; those chips carry a small dot, {{chip:red|156d ·}}). Only a billed job with no bill line at all reads "no bill line".
- **In collections** — the difficult money. Click to jump to Collections.
- **Collected · last 8 wks** — payments recorded each week, with a trend line. Devs and leaders only; other roles see three cards.

## Does the money land before the lien dies?

Every row in **Billed** and **Collections** ends with the bill's dates in one block under the money legend, drawn the way the legend is: a bar, then rows with a dot, the words and *how far from today* on the right, then one bold line under a hairline.

- **The time bar** is the money bar's twin. It runs from the day we billed to the last deadline, one stretch per gap between the dates, sized by days; the line over it says what is left — *77 days left to file the lien*, or *16 days left to send the notice* while one is owed. Grey fill is time used, and the stretch today falls in wears the blue outline.
- **Billed Sep 23 · 7 d ago** — the day the bill went out. Every clock below starts here.
- **Expected Oct 4 · in 4 d** — when the money is expected: a date the customer named (*They said Oct 3*), else the bill date plus their usual pay speed. Amber and *1 d past* once it is behind. Click it to record what they said; the pay history (*usually pays in 2–8 d · kept 3 of 4 dates*) sits under it, in the same grey.
- **Send the notice by Oct 15 · 16 d** — on a sub job (a GC on the job) with no § 53.056 notice recorded for the work month: amber, red inside a week, and its stretch of the bar is amber too. Click it and the Lien window opens on the notice.
- **Lien by Nov 16 · 48 d** — the last day a lien affidavit can be filed for the job's last work month; a ring while it is still ahead. It reads *File the lien* when the window is inside three weeks with no pay date.
- **The bold line** is the verdict. *Room after they pay · 72 d* in green when the money lands before the window closes — the stretch between the two is green on the bar. *File the lien first · 5 d short* in red when it lands after — a red hatch past the lien. *Send the notice · 16 d* while a notice is owed. *Ask for a date · 12 d past* when the expected date has gone by with nothing in — click it to record what they say.
- **Lien gone** — the window closed with nothing filed, or the notice window did: the row says which and when, the bar is all grey, and the verdict is red. The money is still owed.

*Lien by* is the last day the affidavit can be filed with the county clerk, not a day to send anything. Every deadline row and the verdict open the job's **Lien window** on its timeline, where the last work month, the property kind and the statute are spelled out; hover a row for the same in a line.

:::example A house with no property kind set
The lien row shows the **residential** date — a month earlier than commercial — and the hover says *Property kind is not set, so the earlier (residential) date is shown*. That is the safe reading: a house read as commercial is a lien lost a month late. Open the job's Edit tab → **Property record** and pick {{button:outline|Residential}} or {{button:outline|Non-residential}} to confirm it.
:::

On a phone the row's one chip carries the verdict — {{chip:red|file first}}, {{chip:red|lien gone}}, {{chip:yellow|notice in 17 d}}, {{chip:yellow|lien in 17 d}}, {{chip:green|12 d of room}} — once the flag is inside three weeks or the money is due after it; a tap opens the Lien window.

## Today's Money Opportunities

Below the cards, the system writes your to-do list from the live numbers — each row says what, why, and has a button that jumps to the right spot:

:::example A typical morning
**Bill the finished work — $102,384** → {{button:outline-blue|Capable list}}
**Chase the 90+ tail — $44,587** → {{button:outline-blue|Show 90+}} (opens Billed with only those rows)
**Allocate 1 bank deposit** → {{button:outline-blue|Accounts Receivable}}
**65 billed jobs have no bill line** → {{button:outline-blue|Show them}} (opens Billed filtered to just those rows) — money on no bill line can't age, be chased, or be forecast
:::

The no-bill-line rows are also always reachable from the Billed header's {{chip:gray|No line · 65 · $48k}} chip, next to the 30+/90+ aging chips. Each filtered row wears a {{chip:yellow|No bill line}} tag — the fix is creating the job's bill line, not just setting a date.

While that filter is on, {{button:outline-blue|Fix bill lines…}} opens the one-sitting repair (same idea as the customer classifier): every job listed biggest dollars first, each with a date input for when the bill *actually* went out. {{button:blue|Create line}} puts the full open amount on a backdated bill line, and the job immediately starts aging, chasing, and showing up in the payment forecast. Work down the list; the counter tracks "N of M fixed."

:::example Why the date matters
A job billed in May that gets its line created today with a May date shows up instantly in the 90+ chip where it belongs — backdating keeps the aging honest instead of making 64 old bills look brand new.
:::

When there's nothing to do, the queue says so — an empty list means the pipeline is clean.

### The Fix-ups strip

When jobs are missing the data billing needs, a slim **Fix-ups** strip appears at the bottom of the card: {{chip:red|No customer · 1}} (a job with no linked customer can't be billed at all), {{chip:red|No customer pictures · 3}}, {{chip:yellow|No email · 2}} (Stripe and emailed invoices need one), and {{chip:yellow|Owner of record to confirm · 35}} (GC jobs with approved hours whose property record has no confirmed owner — the lien notice cannot be mailed without one). Each chip opens its fix-it list — the owner chip's list looks every property up on the appraisal roll and confirms them with one **Use** each, or **Use all found** (see *file a lien and never miss its deadlines*) — and when everything's clean, the strip disappears entirely.

### Jobs burning ahead of progress

For owners, controllers and master techs, a red-edged card appears a few seconds after the board when any open job has spent a bigger share of its budget than it has finished: **🔥 3 jobs burning · $41,300 margin at risk**, with *Worst first →* at the right end of the line (it lands on that job's **Costs** tab). Under it, the worst three as chips — {{chip:red|◆ J927 Mike Holub · 133% spent at 70% done}} — each opening its own Costs tab; hover one for what it was measured against (◆ the bid · ✎ a typed budget · ≈ an assumption), and {{chip:gray|+N more}} opens Job Summary on In progress, sorted worst projected margin first. The "% done" is the newest number on the job — the crew's latest report with a percent, or the % typed on the job when that came later. Nothing hot, no card.

### Lien notices due

For the office, the Lien desk's own count sits on the strip the moment a notice is due: **⏱ 5 lien notices due · $28,987**, with *Lien desk →* at the right end of the line (the desk on its Notices tab — see *send lien notices from the Lien desk*). Under it the piles as chips — {{chip:gray|2 to draft}} {{chip:gray|1 needs an owner}} {{chip:gray|2 awaiting approval}} — each opening the desk on that pile, and the earliest window as the one colored chip: {{chip:yellow|by Oct 3 · in 9 days}}, red inside a week of the window closing, amber inside two, {{chip:red|closed Sep 15 · Loberg Contracting}} once it has passed (that notice goes out as information). Hover the chip for the sentence behind it. The same door is the first row of the jump strip's ☰ Section tools menu, *⏱ Lien desk · N*. Nothing due, no card.

## The board you last saw comes back first

Open Pipeline cold — a new browser tab, a reload, a phone that closed the app — and the board this device saw last is on screen at once, with *Updating jobs…* and a {{chip:yellow|board from 6 h ago}} chip under the tabs. The live board replaces it about a second later. Until then every dollar reads greyed and the rows' buttons wait, so nothing can act on a remembered row. A remembered board older than 24 hours is not shown; the page then loads the way it always did. The remembered board stays on the device, per account, and is dropped when you sign out.

## The board is still the board

Everything below the cards — the jump strip with the stage counts, and every section from Waiting to Paid in Full — is identical in both views. New only adds the layer on top; nothing about how you work rows changes.
