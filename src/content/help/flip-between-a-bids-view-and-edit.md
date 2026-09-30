---
title: flip between a bid's view and its edit form
category: Office
roles: dev, master_technician, assistant, controller, estimator, superintendent
keywords: bid window, tabs, bid preview, edit bid, flip, one window, esc to close, autosave, saves as you go, saved, create bid
order: 90
---
Editing a bid on the Bids page now opens one window with two tabs. You no longer bounce between separate Preview and Edit pop-ups.

One **✕** closes the whole thing. **Escape** closes it too. Click a **bid's name or number** anywhere on the Bids page. It opens this same window on its **Bid** tab. Edit-bid buttons land on **Edit**.

## The two tabs

- {{chip:blue|Bid}} is the read view. The bid's name and address sit up top. Under them is the facts strip. It shows the due date with its countdown, the bid value, the GC or Builder, and the estimator. GC means the general contractor. Then come file-link chips, details, the Open-in-Bids shortcuts, and notes. {{button:gray|Copy for text}} lives here too.
- {{chip:blue|Edit}} is the full edit form: status and dates, location, files and links, people, money and notes. Every Edit-bid button on the boards lands here. **It saves as you go**. There is no Save button on this tab. See below.

## Nothing is lost on a flip

Both tabs stay live behind the scenes. Type half an address. Flip to **Bid** to check the GC or copy the bid for a text. Flip back. Your typing is exactly where you left it. The Bid tab always shows the **saved** bid. The Edit tab saves on its own. So an edit shows up on the Bid tab a moment after you make it.

## Edit saves as you go

The Edit tab writes each change to the bid by itself, the way the Job window does. Pick {{chip:green|Won}}, change a date, paste a link or type a note. It is on the bid a moment later. The line at the bottom says where things stand. It reads *Changes save as you make them*, then *Saving…*, then *Saved*.

:::example The footer while you work
Type a note, pause: **Saving…** then **Saved**. Blank the Project Name: *Required: Project Name — changes save once it's filled in* — nothing writes until a name is back. {{button:gray|Open Counts}} saves anything still pending, closes the window, and lands on Counts.
:::

- **Closing saves first.** Press **✕** or Escape a second after typing. The window saves that last change before it closes. If that save fails, the window stays open and says so. It offers {{button:blue|Retry}}, {{button:outline|Keep editing}} or **Close without saving**. Nothing is dropped quietly.
- **A date saves when it is finished.** A due, estimated-start or plan date with its year half typed is not written. Half typed means `26` for 2026, or a pause part way through. The rest of the form saves. A line says the date was not saved. The bid keeps the date it had until you type the year in full.
- **A new Bid Date Sent still asks.** Changing the sent date opens the confirm-sent checklist as before. The rest of the form keeps saving while you decide. The date is written once you confirm.
- **New Bid is different.** A bid has to exist before it can save itself. So the New Bid form keeps its own button: {{button:blue|Create bid}} or {{button:gray|Create and open counts}}. Its **✕** still discards.

:::example Where the window opens
The window lives on the Bids page. Opening a bid preview from the Dashboard or global search still shows the standalone preview — its {{button:blue|Edit bid}} button jumps you into the window, landing on the Edit tab.
:::
