---
title: read the Pipeline's money view
category: Office
roles: dev, master_technician, assistant, controller
keywords: pipeline, money story, money opportunities, money moves, aging, capable, collected, billed, 90 days
order: 96
---
The **Jobs → Pipeline** tab opens with the money story: four answer cards and a to-do queue above the board, so the money questions are answered before you scroll.

## The four answer cards

- **Ready to ask for** — finished work you haven't asked to be paid for yet: what's capable of being billed in Working plus what's staged in Ready to Bill. Work already covered by a sent bill or a queued draft doesn't count — the moment you bill a job, that money moves from here to **Waiting on customers**. Click it to open the Capable of Being Billed list.
- **Waiting on customers** — everything open in Billed Awaiting Payment, with an age bar: fresh on the left, 30–90 days in amber, **90+ in red**. Click it for **Who owes what**: every customer with open bills ranked by total owed, each with a bill count and an oldest-bill age chip. Click a customer and each bill opens as its own card — job name, job number, **the job site address**, and **the line items that bill covers** (from the job's Specific Work lines, scoped to that bill) with the amount and age at the top right; {{button:outline-blue|View on board}} jumps straight to that bill on the board, and the small PDF button beside it opens the bill as a freshly generated invoice PDF in a new tab — ready to print or send along. A bill that covers only part of a job and has no lines carved out for it shows no line list — the card never lists more work than the bill asks for. The aging chart and a 90+-only view are one click away in the footer. Every age on this board counts from the bill's date — the day the line was billed, or the **est. bill date** when someone set one by hand (a correction always wins; those chips carry a small dot, {{chip:red|156d ·}}). Only a billed job with no bill line at all reads "no bill line".
- **In collections** — the difficult money. Click to jump to Collections.
- **Collected · last 8 wks** — payments recorded each week, with a trend line. Devs and master technicians only; other roles see three cards.

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

When jobs are missing the data billing needs, a slim **Fix-ups** strip appears at the bottom of the card: {{chip:red|No customer · 1}} (a job with no linked customer can't be billed at all), {{chip:red|No customer pictures · 3}}, and {{chip:yellow|No email · 2}} (Stripe and emailed invoices need one). Each chip opens the same fix-it job list as before — and when everything's clean, the strip disappears entirely.

## The board is still the board

Everything below the cards — the jump strip with the stage counts, and every section from Waiting to Paid in Full — is identical in both views. New only adds the layer on top; nothing about how you work rows changes.
