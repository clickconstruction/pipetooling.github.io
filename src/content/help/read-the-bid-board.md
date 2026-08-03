---
title: read the bid board
category: Office
roles: dev, master_technician, assistant, estimator
keywords: bid board, jump strip, sections, pending, lost, show all, bid dropdown, notes, due date, last contact, days late, google maps, phone cards
order: 68
---
The Bid Board (Bids → Bid Board) shows every bid in five sections — **Unsent / Working**, **Not yet won or lost**, **Won**, **Started or Complete**, and **Lost** — plus **Estimating Health** at the bottom.

## Jump between sections

A pill row stays pinned at the top of the board:

{{chip:gray|Unsent 17}} {{chip:yellow|Pending 102}} {{chip:gray|Won 26}} {{chip:gray|Started 10}} {{chip:gray|Lost 99}} {{chip:gray|Health}}

Tap a pill to jump straight to that section — it opens automatically if it was collapsed. **Health** takes you to the win-rate gauges and Scoreboard at the bottom. Each pill shows the live bid count; **Pending** is highlighted because it's usually where the action is.

The two biggest sections (**Not yet won or lost** and **Lost**) start with their first 25 bids showing. Use {{button:outline-blue|Show all N ▾}} at the bottom of the list to see the rest; search always looks through every bid either way.

## Read a row

Each row leads with the bid number: the **Counts** button sits on its left, the **Edit** gear on its right, and a red badge next to the number means unread notes. Then:

- **Due Date** — a colored chip: the weekday + date on top, and a signed day count under it. **(+4)** means four days past due (red chip); **(-2)** means due in two days (amber when it's within three days). Not sure what a color means? Tap the little red/yellow/grey key beside the **Due Date** header for the legend. 
- **Last Contact** — same two-line pattern: the date on top, **(+6)** = six days since you last touched the bid. Tap it to log a contact.
- **Links** — icons for only the artifacts the bid actually has: project folder, job plans, CountTooling plans, bid submission.
- **Dist** — miles from the office. Tap it to open the bid's address in Google Maps.

## Click a row for the full story

Click anywhere on a row (not a link or button) and it expands in place:

- the full **address** (tap to open Google Maps), **due date + time**, **bid value**, and the **account manager and estimator**,
- and below that, the same **notes panel** as always — All / Bid / Customer / Reports tabs with {{button:outline-blue|+ bid note}} and {{button:outline-blue|+ customer note}}.

Opening a row marks its notes read, so the red badge clears. Press **Escape** or click the row again to close it.

:::example find why a pending bid stalled
Tap **Pending** in the jump strip, scan the Due chips for red **(+N)** counts, then click the worst row — the dropdown shows when it was due, the last contact, and every note in one place.
:::

## Deciding whether to bid at all

The go/no-go evaluation checklist (location, payment terms, bid documents, competition…) lives in the bid form: open **New Bid** or a bid's **Edit** form and tap the {{button:outline-blue|Go/no-go}} pill beside the title. It used to be the "Checklist" button on this board.

## On a phone

Below tablet width each row becomes a card — bid number and due chip on top, project name, then GC · estimator · bid value · last contact, and the artifact links. Nothing scrolls sideways. Tap a card to expand the same details and notes panel.
