---
title: see where a bid is in the estimating flow
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator, primary, superintendent
keywords: bid flow, fold, unfold, compact, poster, steps, progress, next step, hairline, bid board, counts, takeoffs, pricing, cover letter, RFQ, plans, drive, clicktooling, review, sent
order: 69
---
Every bid carries the office's estimating list of ten steps. The app checks each step off from what the bid already has.

## The ten steps

1. **Plans in Drive** is done when the bid has a project folder or a plans link.
2. **Send RFQ** is done when a price request exists on the bid. An RFQ is a request for quote, a price request. It may be sent from the app or logged by hand.
3. **Plans in Tooling** is done when the bid has a CountTooling link.
4. **Count & import** is done when the bid has count rows. Counting happens in CountTooling. The app only sees the rows once they are imported. So the poster's two steps are one here.
5. **Takeoffs** is done when the bid has takeoff part lines. A takeoff is the list of parts pulled from the plans.
6. **Price** is done when the bid has a value, or price-book assignments on its rows.
7. **Review** is done when someone pressed {{button:blue|Mark reviewed}} on the bid. See [mark a bid reviewed](?g=mark-a-bid-reviewed). The strip says who and when.
8. **Cover letter** is done when a bid room has been published, or the bid was sent.
9. **PDF filed** is done when the bid has a submission link.
10. **Sent** is done when the bid's sent date is set. Sending, follow-up and marking sent all read this one date.

You hover any step to see exactly what the app read to decide it.

## On the Bid Board

Look under the five jump icons on each row. A thin bar of ten equal ticks sits there, one per step, evenly spaced. Green is done. Blue is the next move. Grey is not yet. A dashed outline means the app keeps no record of that step. You hover the bar for the summary, for example *7 of 10 done · next: Cover letter*. The icons still work exactly as before.

**Click a row** and the full strip appears above the bid's project, GC and address. GC means the general contractor. Each step is a door. The door lands you on the exact spot. The page or form opens as before. It scrolls to the field the step is about and puts the cursor in it. It rings the field in blue for a few seconds so you know where it is.

- **Plans in Drive** opens Edit Bid on the **Job Plans** link. **Plans in Tooling** opens it on the **CountTooling Plans** link.
- **Send RFQ** opens Pricing on the price-request chip. Before any request exists, it opens on the bid's title and tools row. **Price** opens Pricing on that same row.
- **Count & import** opens Counts with the **Import Counts** box already open and the cursor in it, ready to paste. Cancel closes it if you only wanted to look. **Takeoffs** opens Takeoffs on the part-lines table.
- **Cover letter** opens Cover Letter on {{button:blue|Copy & open in Google Docs}}. **PDF filed** lands on the submission link box beside it. **Sent** lands on {{button:blue|Mark sent today}}.
- **Review** opens the Mark reviewed prompt right there. There is nothing to scroll to.

:::example a bid that just came in
Its bar is one green tick and one blue. Hover: *1 of 10 done · next: Send RFQ*. Open the row and the strip rings **Send RFQ**, so the estimator knows the price request is the next move before anyone counts.
:::

## On the workflow tabs

Since v2.3241 the strip is folded by default. It shows one line beside the bid's name. The line holds the ten ticks, *7 of 10 done · decided*, and the review stamp. You tap it to unfold the full strip with its phase labels and doors. You tap again to fold. Your device remembers which you prefer. While a bid is unreviewed, {{button:blue|Mark reviewed}} sits right beside the line.

You pick a bid on **Counts, Takeoffs, Labor, Pricing** or **Cover Letter**. The same strip sits above the bid's title. So you can see what is left without leaving the tab. Its steps are the same doors. Click **Plans in Drive** from Counts and Edit Bid opens on the Job Plans link. Click **Sent** from Takeoffs and Cover Letter opens on Mark sent today.

## What "next" means

Next is the first unfinished step **after** the furthest finished one. A bid that was sent before the price-request desk existed reads *waiting on the GC*, not *next: Send RFQ*. The app does not nag about a step that no longer matters for that bid. Won, lost and started bids go quiet. Their strips show what got done and nothing is ringed.
