---
title: send a supply house a quote link
category: Bids & Estimating
roles: dev, estimator, master_technician, assistant
keywords: quote link, rfq, supply house, vendor prices, price request, quote page, parts pricing, ferguson, moore supply
---

Texting a parts list works — but then the rep texts prices back and someone retypes them. A **quote link** skips the retyping: the vendor opens a page on their phone, types prices straight in, and the quote lands on your bid ready to compare.

## Send the link

1. On **Bids → Pricing**, open the {{button:green|▾}} menu and pick **Supply house list**.
2. Scope the list like always — {{chip:blue|Whole job}}, {{chip:blue|Pipe &amp; fittings}}, or hand-picked rows.
3. In the strip above the footer, **pick the supply house** the link is for, set a **needed by** date if there's a deadline, and tap {{button:blue|Copy with quote link}}.
   - Picking the house also shows what they've quoted before — "Moore Supply has last-quoted prices for 12 of these 63 items · newest 3 days ago" — so you know which vendor already knows this scope.
4. Paste into your text or email like always. The list now ends with a `Price it here:` link.

The link is addressed to that one house — send a separate link to each vendor you're pricing against.

## What the vendor sees

A plain page, no login, built for a phone at the counter:

- Every part with its count. A price box, a **can't supply** button, and a note field per line.
- Their entries **save on their phone as they type** — getting interrupted ten lines in loses nothing.
- Partial answers are fine. They add their name, how long prices are good, freight if any, and hit **Send quote**.
- They only ever see names and counts — **no prices of yours are on that page**.

:::example The counter guy quotes between customers
Wendi texts Moore Supply the pipe scope with a quote link. Danny at the counter opens it, prices nine lines, gets pulled away, and comes back after lunch — everything's still there. He marks the carriers "can't supply", hits Send, and Wendi's Quotes chip turns green.
:::

## Watching for the answer

- While a link is out with nothing back yet, an amber {{chip:yellow|RFQ sent}} chip sits by Share.
- The moment a vendor submits, the {{chip:blue|Quotes (1)}} chip turns **green** — open it to compare (see *send a bid's pricing package to the field* for the compare view).
- Vendors can reopen the link to send a **revised quote** — the newest one is what compare shows.

## When links die

Mark the bid lost and every quote link on it shows "this request has been closed" — a stale text in someone's phone can't collect prices for a job that's gone.
