---
title: read the Pipeline's new money view
category: Office
roles: dev, master_technician, assistant, controller
keywords: pipeline, money story, money moves, aging, capable, collected, old new, billed, 90 days
order: 96
---
The **Jobs → Pipeline** tab has two views, switched with the {{chip:gray|Old}} / {{chip:gray|New}} pills at the top. Old is the classic board alone; **New** puts the money story above the same board. Your choice sticks on this device.

## The four answer cards

- **Ready to ask for** — finished work you haven't asked to be paid for yet: what's capable of being billed in Working plus what's staged in Ready to Bill. Work already covered by a sent bill or a queued draft doesn't count — the moment you bill a job, that money moves from here to **Waiting on customers**. Click it to open the Capable of Being Billed list.
- **Waiting on customers** — everything open in Billed Awaiting Payment, with an age bar: fresh on the left, 30–90 days in amber, **90+ in red**. Click it for **Who owes what**: every customer with open bills ranked by total owed, each with a bill count and an oldest-bill age chip. Click a customer to see their bills (oldest first) and {{button:outline-blue|View}} jumps straight to that bill on the board; the aging chart and a 90+-only view are one click away in the footer.
- **In collections** — the difficult money. Click to jump to Collections.
- **Collected · last 8 wks** — payments recorded each week, with a trend line. Devs and master technicians only; other roles see three cards.

## Today's money moves

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

## The board is still the board

Everything below the cards — the jump strip with the stage counts, and every section from Waiting to Paid in Full — is identical in both views. New only adds the layer on top; nothing about how you work rows changes.
