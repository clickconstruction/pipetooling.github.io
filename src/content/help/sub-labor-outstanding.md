---
title: see what I still owe each sub contractor
category: Billing & Money
roles: dev, master_technician, assistant, superintendent
keywords: sub labor, sub sheet ledger, outstanding, owed, contractor, backcharge, payment, due, pay run, ready, queued, payable after, friday
order: 31
---
**Jobs → Sub Labor** (the Sub Sheet Ledger) answers two questions: **who is owed what**, and **what happened on those sheets**. The toolbar still shows one grand total — {{chip:gray|Sub Labor Due: $47,050.00}} — and the page reads the rest as a pay run: why each dollar isn't paid yet, and what you can pay right now.

## The four tiles

:::example The Friday question
| Owed to subs | Ready to pay now | Queued for Fri Sep 11 | Not payable yet |
| --- | --- | --- | --- |
| $47,050.00 · 5 subs · 7 sheets | $5,700.00 · 2 sheets | $1,000.00 · 1 sheet | $40,350.00 · $40,000 with no agreement · $350 waiting on customer |
:::

- **Owed to subs** is every sub sheet with money open. Crew sheets (no roster sub on them) are shown beside it as *crew pay via payroll* — they never count as owed here.
- **Ready to pay now** — the sheet is at *Post-inspection: Trigger draw* and either the job's bill is paid or the sheet's **payable-after** date has arrived, with no hold on it.
- **Queued** — a payable-after date is set and still ahead. The tile names the next pay-run day from Settings → Sub portal; when no day is set it says so.
- **Not payable yet** — still in work or at the inspection, waiting on the customer with nothing promised, on hold, or {{chip:red|No agreement}} (work under way with nothing signed). The reasons are spelled out under the figure.

## Who's owed

One row per sub, biggest owed first, named for the subcontractor — teammates on the same sheets read as *with Malachi, Abraham*. Beside the owed figure a bar shows where that money sits: **ready** (green) · **queued** (pale green) · **waiting on customer** (amber) · **still in work** (gray) · **on hold** (red) · **no agreement** (red stripes), and the line under it says the same in words.

- {{button:green|Pay $1,500.00}} appears when part of the money is ready. It opens Make Payment on the sub's biggest ready sheet, prefilled; when more than one sheet is ready the label says so and the button moves to the next one after you save.
- {{button:blue|Draft a work order…}} appears when everything owed is on a handshake.
- Otherwise the slot says why — *Pays Fri Sep 11*, *Nothing payable yet*, *Payroll*.
- Click a sub's name to jump to their sheets in the ledger. The 🌐 globe beside the name is their portal — Copy link, **Preview as ‹sub›**, and the gear — the same globe as People → Subs.

## The ledger

Sheets sit **under their sub**, each group with its owed total and the same Pay button, ordered ready → queued → waiting → in work. The chips over it filter with counts: {{chip:gray|All due}} (the old *Only show due*), {{chip:green|Ready now}}, {{chip:blue|Queued}}, {{chip:yellow|Waiting on customer}}, {{chip:red|No agreement}}, {{chip:purple|Crew pay}}, and {{chip:gray|Paid}} for the history. Search narrows the tiles, the rows and the ledger together.

Each row keeps **Agreed · Paid · Due** and the rail ([where the sheet stands](/help/record-sub-labor-on-a-job)), and gains **Pay when** — the rule the sheet is under and the fact behind it:

:::example Pay when
| Chip | Means |
| --- | --- |
| {{chip:green|Ready}} · customer paid Sep 3 | pay it |
| {{chip:blue|Queued · 09/11}} · payable after 2026-09-11 | promised for the pay run |
| {{chip:yellow|Waiting on customer}} · bill 2 of 2 open | nothing promised yet — **set payable after…** turns it Queued |
| {{chip:gray|After the inspection}} · sub has not said "done" | still being earned |
| {{chip:red|Not payable}} · nothing signed | get it in writing first — the button is right there |
| {{chip:purple|Payroll}} | a crew sheet |
:::

**set payable after…** on a waiting row is the same move the sheet story offers: pick the date, {{button:green|Queue}}, and the row (and the sub's portal) reads Queued. *change payable after…* on a queued row lets you move or clear it.

## Paying it down

The ⋯ on a row holds **Payment…**, **Back-charge…**, **Edit sheet**, **Print** and **Story…**; expanding a row shows the same buttons with the sheet date, the invoice link, the line items and every payment and back-charge. The tiles and rows update the moment a payment or back-charge is saved.

When you record a payment, the **Date sent** field lets you backdate it to the day the money actually went out (it starts on today). The ledger's Payments list shows that date, and you can fix it later with **Edit** on the payment row.
