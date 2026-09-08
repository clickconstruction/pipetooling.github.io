---
title: flip between a bid's view and its edit form
category: Office
roles: dev, master_technician, assistant, controller, estimator, superintendent
keywords: bid window, tabs, bid preview, edit bid, flip, one window, esc to close, autosave, saves as you go, saved, create bid
order: 90
---
Editing a bid on the **Bids** page now opens **one window with two tabs** — no more separate Preview and Edit modals bouncing you between each other. One **✕** (or **Escape**) closes the whole thing. Clicking a **bid's name or number** anywhere on the Bids page opens this same window on its **Bid** tab; Edit-bid buttons land on **Edit**.

## The two tabs

- {{chip:blue|Bid}} — the read view: the bid's name and address up top, the facts strip (due date with its countdown, bid value, GC/Builder, estimator), file-link chips, details, the Open-in-Bids shortcuts, and notes. {{button:gray|Copy for text}} lives here too.
- {{chip:blue|Edit}} — the full edit form: status and dates, location, files and links, people, money, notes. Every Edit-bid button on the boards lands here. **It saves as you go** — there is no Save button on this tab (see below).

## Nothing is lost on a flip

Both tabs stay live behind the scenes — type half an address, flip to **Bid** to check the GC or copy the bid for a text, flip back, and your typing is exactly where you left it. The Bid tab always shows the **saved** bid, and since the Edit tab saves on its own, an edit shows up there a moment after you make it.

## Edit saves as you go

The Edit tab writes each change to the bid by itself, the way the Job window does — pick {{chip:green|Won}}, change a date, paste a link, type a note, and it is on the bid a moment later. The line at the bottom says where things stand: *Changes save as you make them* → *Saving…* → *Saved*.

:::example The footer while you work
Type a note, pause: **Saving…** then **Saved**. Blank the Project Name: *Required: Project Name — changes save once it's filled in* — nothing writes until a name is back. {{button:gray|Open Counts}} saves anything still pending, closes the window, and lands on Counts.
:::

- **Closing saves first.** Press **✕** (or Escape) a second after typing and the window saves that last change before it closes. If that save fails, the window stays open and says so — {{button:blue|Retry}}, {{button:outline|Keep editing}}, or **Close without saving** — so nothing is dropped quietly.
- **A new Bid Date Sent still asks.** Changing the sent date opens the confirm-sent checklist as before; the rest of the form keeps saving while you decide, and the date is written once you confirm.
- **New Bid is different.** A bid has to exist before it can save itself, so the New Bid form keeps its own button: {{button:blue|Create bid}} (or {{button:gray|Create and open counts}}). Its **✕** still discards.

:::example Where the window opens
The window lives on the Bids page. Opening a bid preview from the Dashboard or global search still shows the standalone preview — its {{button:blue|Edit bid}} button jumps you into the window, landing on the Edit tab.
:::
