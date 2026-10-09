---
title: see what I still owe each sub contractor
category: Billing & Money
roles: dev, master_technician, assistant, superintendent
keywords: sub labor, sub sheet ledger, outstanding, owed, contractor, backcharge, payment, due, pay run, ready, queued, payable after, friday, wrong job, move payment, remove payment, delete payment, undo
order: 31
---
Jobs → Subs → Pay shows who is owed what, and what you can pay right now. You press Pay beside a sub to pay their biggest ready sheet.

**Jobs → Subs → Pay** is the Sub Sheet Ledger. The ledger answers two questions: **who is owed what**, and **what happened on those sheets**.

The toolbar still shows one grand total, like {{chip:gray|Sub Labor Due: $47,050.00}}. The page reads the rest as a pay run, one round of paying subs. The page shows why each dollar isn't paid yet, and what you can pay right now.

## The four tiles

:::example The Friday question
| Owed to subs | Ready to pay now | Queued for Fri Sep 11 | Not payable yet |
| --- | --- | --- | --- |
| $47,050.00 · 5 subs · 7 sheets | $5,700.00 · 2 sheets | $1,000.00 · 1 sheet | $40,350.00 · $40,000.00 with no agreement · $350.00 waiting on customer |
:::

- **Owed to subs** is every sub sheet with money open. Crew sheets have no roster sub on them. Crew sheets show inside the tile, beside the counts, as *crew pay via payroll*. Crew sheets never count as owed here.
- **Ready to pay now** means the sheet is at *Post-inspection: Trigger draw*, with an agreement signed. Either every bill out on the job is paid, or the sheet's **payable-after** date has arrived. And there is no hold on it.
- **Queued** means a payable-after date is set and still ahead. The tile names the next pay-run day. A dev sets that day in **Settings → Jobs & billing**, under *Sub portal · pay schedule*. When no day is set, the tile says so.
- **Not payable yet** means the sheet is still in work or at the inspection. Or the sheet is waiting on the customer with nothing promised, or on hold. Or the sheet has {{chip:red|No agreement}}, meaning work under way with nothing signed. The reasons are spelled out under the figure.

## Who's owed

There is one row per sub, biggest owed first, named for the subcontractor. Teammates on the same sheets read as *with Malachi, Abraham*. Beside the owed figure, a bar shows where that money sits:

- **ready** is green
- **queued** is pale green
- **waiting on customer** is amber
- **still in work** is gray
- **on hold** is red
- **no agreement** is red stripes

The line under the bar says the same in words.

- {{button:green|Pay $1,500.00}} appears when part of the money is ready. The button opens Make Payment on the sub's biggest ready sheet, filled in. When more than one sheet is ready, the label says so. Then the button moves to the next one after you save.
- {{button:blue|Draft a work order…}} appears when everything owed is on a handshake, with nothing signed.
- Otherwise the slot says why, like *Pays Fri Sep 11*, *Nothing payable yet* or *Payroll*.
- Click a sub's name to jump to their sheets in the ledger. The 🌐 globe beside the name is their portal. The globe holds Copy link, **Preview as ‹sub›**, and the gear. The globe is the same as the one on People → Subs.

## The ledger

Sheets sit **under their sub**, the readiest first. The order is ready, queued, waiting, on hold, at inspection, in work, no agreement, then payroll. Each group has its owed total and the same Pay button. The chips over the ledger filter it, with counts. {{chip:gray|All due}} is the old *Only show due*. Then come {{chip:gray|Ready now}}, {{chip:gray|Queued}}, {{chip:gray|Waiting on customer}}, {{chip:gray|No agreement}} and {{chip:gray|Crew pay}}. The chip that is on turns dark. {{chip:gray|Paid}} shows the history. Search narrows the tiles, the rows and the ledger together.

Each row keeps ***Agreed · Paid · Due*** and the rail. See [where the sheet stands](/help/record-sub-labor-on-a-job). Each row also gains **Pay when**. The Pay when chip shows the rule the sheet is under and the fact behind it:

:::example Pay when
| Chip | Means |
| --- | --- |
| {{chip:green|Ready}} · customer paid · 2 of 2 bills | pay it |
| {{chip:blue|Queued · 09/11}} · payable after 2026-09-11 | promised for the pay run |
| {{chip:yellow|Waiting on customer}} · bill 2 of 2 open | nothing promised yet — **set payable after…** turns it Queued |
| {{chip:gray|After inspection}} · sub has not said "done" | still being earned |
| {{chip:red|On hold}} · the reason for the hold | stopped until the hold comes off |
| {{chip:red|Not payable}} · nothing signed | get it in writing first — the button is right there |
| {{chip:purple|Payroll}} | a crew sheet |
:::

**set payable after…** on a waiting row is the same move the sheet story offers. Pick the date and press {{button:green|Queue}}. The row reads Queued, and so does the sub's portal. *change payable after…* on a queued row lets you move or clear it.

## Paying it down

The ⋯ on a row holds **Payment…** while money is due, **Back-charge…**, **Edit sheet**, **Print**, **Story…** and **Lien waiver…**. Expanding a row shows Payment…, Back-charge…, **Edit**, Print and Lien waiver…. The expanded row also shows the sheet date, the invoice link, the line items and every payment and back-charge. The sheet date saves when it is finished. Pick it from the calendar, or type it and press Enter or leave the box. A date left half typed is not saved. The tiles and rows update the moment a payment or back-charge is saved.

When you record a payment, the **Date sent** field lets you backdate it. The date can go back to the day the money actually went out. The field starts on today. The ledger's Payments list shows that date. You can fix it later with **Edit** on the payment row, inside **Edit sheet**.

## More on paying subs

- [Fix a payment on the wrong sheet](/help/fix-a-payment-on-the-wrong-sheet): move it, remove it, or undo a removal.
- [Work the Subs tab on a phone](/help/work-the-subs-tab-on-a-phone): the Pay and Work views as rows.
