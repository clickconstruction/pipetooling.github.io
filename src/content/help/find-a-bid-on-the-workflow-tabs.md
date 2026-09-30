---
title: find a bid on the workflow tabs
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: bids, sort, order, bid number, due date, sent, value, search, counts, takeoffs, labor, pricing, cover letter, RFI, change order, lien release, picker
order: 97
---
When no bid is selected on a workflow tab, the bid list is sorted, bid number first by default. The buttons next to the search bar switch the order.

Once you pick a bid it stays selected across Counts → Takeoffs → Labor → Pricing → Cover Letter. A **refresh brings it back**. This browser tab remembers your bid until you close the bid or the tab. Only a shared link needs the `bidId` in the URL. The picker adds it for you. Above the bid's title on each of those tabs sits its **flow strip**. That is the estimating steps with the next one ringed. See [see where a bid is in the estimating flow](?g=see-where-a-bid-is-in-the-flow).

## Pick the order

1. Open any bid workflow page without a bid selected. That is **Counts, Takeoffs, Labor, Pricing, Cover Letter, RFI, Change Order,** or **Lien Release**. RFI is a request for information.
2. Next to the search bar, pick a view:
   - {{button:blue|Bid # ↓}} puts the highest bid number first. It is the default, best for "I know it's B3-something".
   - {{button:outline|Due date}} puts the soonest due first. Bids with no due date drop to the bottom.
   - {{button:outline|Sent}} puts the most recently sent first. Unsent bids come last.
   - {{button:outline|Value}} puts the largest bid value first. Unpriced bids come last.
3. Your choice sticks. Every workflow tab uses it. It is still set next time you sign in on the same device.

:::example Looking for last week's sends?
Tap **Sent** — the bids you sent most recently rise to the top, and everything still waiting to go out sits together at the bottom.
:::

## Narrow it down

- Type in the search bar to filter by **bid #, project name, or GC/Builder**. GC means the general contractor. The matches keep the order you picked.
- {{button:blue|Only my bids}} is on when you arrive. It keeps just the bids where you are the estimator or account manager. It sits next to the sort buttons on every workflow tab, RFI, Change Order, and Lien Release included. Tap it to see everyone's bids. It switches back on next time you open Bids.
