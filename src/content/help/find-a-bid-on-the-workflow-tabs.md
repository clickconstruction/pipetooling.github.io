---
title: find a bid on the workflow tabs
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: bids, sort, order, group, stage, unsent, pending, won, lost, archived, bid number, due date, sent, value, search, counts, takeoffs, labor, pricing, cover letter, RFI, change order, lien release, picker, mark, marked, hold, highlight, flag
order: 97
---
When no bid is selected on a workflow tab, the bid list sits under the Bid Board's headings. Inside each group the bids are sorted, bid number first by default. The buttons next to the search bar switch the order.

Once you pick a bid it stays selected across Counts → Takeoffs → Labor → Pricing → Cover Letter. A **refresh brings it back**. This browser tab remembers your bid until you close the bid or the tab. Only a shared link needs the `bidId` in the URL. The picker adds it for you. Above the bid's title on each of those tabs sits its **flow strip**. That is the estimating steps with the next one ringed. See [see where a bid is in the estimating flow](?g=see-where-a-bid-is-in-the-flow).

## Grouped by stage

The list uses the same headings as the Bid Board, in the same order. Each heading shows its count. The groups are **Unsent / Working Bids**, **Not yet won or lost**, **Won**, **Started or Complete** and **Lost**. Bids put away from the working board sit last, under *Archived (Unsent/Working)*. A group with nothing in it is not drawn.

- Tap a heading to fold or open its group. **Lost** and **Archived** start folded. The working groups start open.
- Your folds stick on this device. Every workflow tab shares them. Fold Lost on Counts and it is folded on Pricing too.

:::example Looking for a bid you lost?
Type part of its name in the search bar. Every group opens while you search, so the match shows under **Lost** right away. Clear the box and the folds come back.
:::

## Pick the order

1. Open any bid workflow page without a bid selected. That is **Counts, Takeoffs, Labor, Pricing, Cover Letter, RFI, Change Order,** or **Lien Release**. RFI is a request for information.
2. Next to the search bar, pick a view:
   - {{button:blue|Bid # ↓}} puts the highest bid number first. It is the default, best for "I know it's B3-something".
   - {{button:outline|Due date}} puts the soonest due first. Bids with no due date drop to the bottom.
   - {{button:outline|Sent}} puts the most recently sent first. Unsent bids come last.
   - {{button:outline|Value}} puts the largest bid value first. Unpriced bids come last.
3. Your choice sticks. Every workflow tab uses it. It is still set next time you sign in on the same device. The order applies inside each group. The headings never move.

:::example Looking for last week's sends?
Tap **Sent** — the bids you sent most recently rise to the top, and everything still waiting to go out sits together at the bottom.
:::

## Narrow it down

- Type in the search bar to filter by **bid #, project name, or GC/Builder**. GC means the general contractor. The matches keep the order you picked.
- {{button:blue|Only my bids}} is on when you arrive. It keeps just the bids where you are the estimator or account manager. It sits next to the sort buttons on every workflow tab, RFI, Change Order, and Lien Release included. Tap it to see everyone's bids. It switches back on next time you open Bids.

## Mark a bid to find it again

You press and hold a row for half a second. The row turns violet with a bar at its left edge. That is a mark. You let go early and nothing happens. A tap still opens the bid. With a mouse, you hover the row and click the circle at its left instead. You hold the row again, or click the circle again, to clear the mark.

A mark is yours alone. It stays on the bid on every workflow tab and shows lighter on the Bid Board. It also shows on the open bid as {{button:outline|Marked}} after the title. It follows you to any device you sign in on. Each marked row says when you marked it, like *marked Fri*.

- {{button:outline|Marked}} next to {{button:blue|Only my bids}} shows only the bids you marked. You press it again to see every bid.
- Search keeps the marks. A marked match stands out of the results.
- {{button:outline|Clear marks}} under the list clears every mark in the list.
- A mark on a bid that is won, lost or archived wears a dashed bar. {{button:outline|Clear finished marks}} takes just those.
- With a row focused, you press H to mark or clear it.

:::example Working three bids out of two hundred?
Hold each row on Counts. Open Pricing and the three are still marked. Press Marked and the list is just those three.
:::
