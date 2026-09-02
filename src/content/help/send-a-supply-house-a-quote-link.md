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

## Or let ClickTooling send the emails

Next to the copy buttons, **Send by email…** opens the request composer. Each house shows its **contacts as chips** — tap one to CC it, tap again to make it the To (exactly one To per house; tapping the To un-sets it so a typed address can take over). A typed address offers to be **remembered as that house's contact**, and contacts are managed on the supply house form itself. Set needed-by, add a one-line note, optionally **include the job plans link** (cut sheets sell fixtures) — and **preview every email exactly as it will send** before anything goes out. Each house gets one email, one link; CCs ride the same message; replies come straight to your inbox.

{{gif:rfq-desk-and-compose.gif|The desk sorts by what needs you — then a new request: tick the house, the contact chip is already To, preview the exact email}}

The **RFQs chip** by Share then becomes your desk: every request as a trail — {{chip:green|Sent}} → {{chip:green|Delivered}} → {{chip:yellow|Viewed}} → {{chip:gray|Quoted}} — with bounced addresses in red (fix them right on the row and resend), a one-tap **Nudge** that rests 24 hours between sends and shows you the reminder before it goes, a coverage bar for "which items does nobody have priced yet?", and **Close link** when you're done asking.

{{gif:send-a-supply-house-a-quote-link.gif|Pick the house, set needed-by, Copy with quote link — the toast confirms and an RFQ sent chip appears by Share}}

## What the vendor sees

A plain page, no login, built for a phone at the counter:

{{gif:supply-house-quote-page.gif|The vendor types prices, taps can't supply where they don't carry it, and hits Send quote}}

- Every part with its count. A price box, a **can't supply** button, and a note field per line — plus the job plans link when you included one.
- If they've priced these parts for us before, the page offers **"Fill with last time's prices"** — one tap, then they change what moved. A repeat quote takes about ninety seconds.
- Their entries **save on their phone as they type** — getting interrupted ten lines in loses nothing.
- Partial answers are fine. They add their name, how long prices are good, freight if any, and hit **Send quote**.
- They only ever see names and counts — **no prices of yours are on that page**.

:::example The counter guy quotes between customers
Wendi texts Moore Supply the pipe scope with a quote link. Danny at the counter opens it, prices nine lines, gets pulled away, and comes back after lunch — everything's still there. He marks the carriers "can't supply", hits Send, and Wendi's Quotes chip turns green.
:::

## Watching for the answer

- While a link is out with nothing back yet, an amber {{chip:yellow|RFQs · 1 waiting}} chip sits by Share.
- The desk sorts by **what needs you**: bounced addresses first (fix them right on the row and resend), then requests whose needed-by is closing in, then ones nobody has opened in two days — each with a plain-words reason chip. A coverage bar answers "which items does nobody have priced yet?".
- The moment a vendor submits, the {{chip:blue|Quotes (1)}} chip turns **green** — open it to compare (see *get supply house prices on a bid* for the compare view).
- Vendors can reopen the link to send a **revised quote** — the newest one is what compare shows.

## When links die

Mark the bid lost and every quote link on it shows "this request has been closed" — a stale text in someone's phone can't collect prices for a job that's gone.
