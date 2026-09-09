---
title: see where a bid is in the estimating flow
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator, primary, superintendent
keywords: bid flow, poster, steps, progress, next step, hairline, bid board, counts, takeoffs, pricing, cover letter, RFQ, plans, drive, clicktooling, review, sent
order: 69
---
The one sentence: **every bid carries the office's estimating list — plans filed, RFQ sent, counted, taken off, priced, reviewed, letter, PDF filed, sent — and the app checks the steps off from what the bid already has.**

## The ten steps

1. **Plans in Drive** — the bid has a project folder or plans link.
2. **Send RFQ** — a price request exists on the bid, sent from the app or logged by hand.
3. **Plans in Tooling** — the bid has a CountTooling link.
4. **Count & import** — the bid has count rows. (Counting happens in CountTooling; the app only sees the rows once they are imported, so the poster's two steps are one here.)
5. **Takeoffs** — the bid has takeoff part lines.
6. **Price** — the bid has a value, or price-book assignments on its rows.
7. **Review** — someone pressed {{button:blue|Mark reviewed}} on the bid (see [mark a bid reviewed](?g=mark-a-bid-reviewed)); the strip says who and when.
8. **Cover letter** — a bid room has been published, or the bid was sent.
9. **PDF filed** — the bid has a submission link.
10. **Sent** — the bid's sent date is set. Sending, follow-up and marking sent all read this one date.

Hover any step to see exactly what the app read to decide it.

## On the Bid Board

Under the five jump icons on each row sits a thin bar of ten equal ticks, one per step, with a wider gap where a phase changes: green is done, blue is the next move, grey is not yet, and a dashed outline means the app keeps no record of that step. Hover the bar for the summary, for example *7 of 10 done · next: Cover letter*. The icons still work exactly as before.

**Click a row** and the full strip appears above the bid's project, GC and address. Each step is a door: **Plans in Drive** opens Edit Bid, **Count & import** opens Counts, **Price** opens Pricing, and so on.

:::example a bid that just came in
Its bar is one green tick and one blue. Hover: *1 of 10 done · next: Send RFQ*. Open the row and the strip rings **Send RFQ**, so the estimator knows the price request is the next move before anyone counts.
:::

## On the workflow tabs

Pick a bid on **Counts, Takeoffs, Labor, Pricing** or **Cover Letter** and the same strip sits above the bid's title, so you can see what's left without leaving the tab.

## What "next" means

Next is the first unfinished step **after** the furthest finished one. A bid that was sent before the price-request desk existed reads *waiting on the GC*, not *next: Send RFQ* — the app does not nag about a step that no longer matters for that bid. Won, lost and started bids go quiet: their strips show what got done and nothing is ringed.
