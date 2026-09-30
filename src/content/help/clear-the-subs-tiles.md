---
title: clear the four Subs tiles from the board
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: subs tab, on a handshake, stages waiting, offers out, signed this month, tiles, queue, work order, send, nudge, re-send, extend, withdraw, signed on paper, availability, free, days off, GC ask, inspection, bill, pay, next row
order: 65
---
The four tiles at the top of Jobs → Subs → Work are doors, not just numbers. Tap one and it opens a queue you clear from inside.

The queue holds the rows the tile counts. The row you are on opens into the one form that resolves it. A progress bar counts what you have handled since opening. The footer spells out the counting rule, so nobody has to guess why a row is or is not there.

Every button in a queue is a move the board already has. You can send a work order, nudge, withdraw, move a window, bill or pay. You can answer the GC, the general contractor. The queues just put these moves in the order the office needs them.

## How a queue works

- The **first row that needs a form opens** as you arrive. In Offers out that is the first expired offer. Live offers stay collapsed until you click them. Click any row to open it instead. {{button:blue|Next row ↓}} in the footer moves to the next one. **Enter** in the open row's form does the same.
- A handled row turns {{chip:green|✓ green}}. It keeps an **Undo** where the move can be taken back. It sinks below the rows still waiting. The bar under the header reads **1 of 2 handled**.
- **Escape**, the ✕, or clicking the backdrop closes the queue. The tile re-counts when you get back to the board.
- {{button:outline|Open the full assembler ›}} is always there when the pre-read is wrong. The pre-read is the values the board filled in for you. The assembler is the full work order form. It opens on the same job, sub, price and dates.

## On a handshake → Get it in writing

Every row is a sub working with a balance open and nothing signed. The open row is a small work order pre-read from their sheet:

- **Price** is the sheet total. **Window** runs from the day they started to about ten working days past today. **Takes about** and **Offer good for** round it out. **Offer good for** is 3, 7 or 14 days. The scope is the trade library's default lines.
- {{button:blue|Send}} writes the order and mints its WO number, the work order number. It sends the offer notice to their portal. The row turns green with **Undo**. **Undo** withdraws the order, but the order stays as a draft. The row then reads {{chip:green|✓ Withdrawn · draft kept}} with a **Discard** beside it.
- A sheet whose job number has no Pipeline row shows {{chip:yellow|Not in Pipeline}}. A **Job** picker sits in the same form. The button becomes {{button:blue|Link and send}}. **New job…** opens Edit Job when the job does not exist yet.
- {{button:outline|Send the rest as drafted · N}} sends every remaining ready row at its pre-read values, with one confirm.

:::example Two on a handshake
Texas R & A · #977 · $40,000 · working 7 days — open first because it's the most money. Pick the job, Link and send. Airfordable HVAC · #880 · $4,200 — Send. The bar reads 2 of 2 handled and the tile drops to $0.
:::

## Stages waiting → Put a sub on it

Every row is a window with no order behind it. The rows are grouped **Window passed**, then **Open now**, then **Ahead**, then **No dates yet**.

- The open row's **Who** list is every roster sub with a chip for the row's span. A sub with nothing on those days shows {{chip:green|free those days}}. {{chip:yellow|on #273 · Trim & final}} means another live order overlaps. Stacking is allowed, it is just said out loud. {{chip:gray|off Sep 10}} means they marked the day off on their portal. Benched subs sit behind **+ N on the bench**.
- A **passed** window opens with its dates already moved to the next weekdays. The button reads {{button:blue|Move window and send offer}}. Otherwise it reads {{button:blue|Send offer}}, and the sub picks a start inside the window from their portal.
- When the GC has asked for other dates the row shows {{chip:yellow|GC asked Sep 29 – Oct 10}}. You can tap {{button:green|Accept Sep 29 – Oct 10}}. Or you tap {{button:outline|Answer with…}} and give two dates and a why the GC reads.
- {{button:outline|Crew does this one}} clears the window when the stage is not sub work after all. The line item stays on the job.

## Offers out → Chase the signatures

Every row is a sent order waiting on a signature, expired ones first. *Sent · seen* reads the portal visit log. *never opened their portal* is the call-them signal. The phone number sits on the row.

- An **expired** row opens on {{button:outline|Re-send}}. You get a fresh **Good for**, and you can edit the price and window. The WO number stays the same. The offer notice goes out again. {{button:outline|Offer someone else…}} withdraws it and opens the assembler on the same job, price and dates for the next sub.
- A **live** row offers {{button:blue|Nudge}}, the reminder the board sends, plus {{button:outline|Extend +7 days}}, {{button:outline|Withdraw}} and {{button:outline|Signed on paper}}.
- {{button:outline|Nudge everyone unopened · N}} in the footer nudges only the rows whose sub has never opened their portal.

## Signed this month → What's next on each

Every row is an agreement signed this calendar month. The row shows where the sheet sits on its rail, the line of steps a sheet moves through. The office's next move is a button:

- Sheet in **Pre-inspection** means the sub said done. {{button:outline|Schedule inspection…}} opens the inspection request. {{button:green|Passed → bill}} moves the sheet on.
- Sheet **waiting on the customer**: {{button:blue|Bill Knight Contracting}} opens Bill Customer pre-filled.
- Sheet **queued for the pay run**: {{button:blue|Pay Behar Kraja · $1,000.00}} opens Make Payment with the amount.
- Rows the sub still owns read {{chip:gray|Waiting on the sub}}. That keeps the count of what needs the office honest.
- Each row shows **portal** or **on paper** for how it was signed. It shows the sub's own picked dates when there are some. **Print** opens the document. The footer steps back a month: {{button:outline|‹ August · 5}}.

## Related guides

- *set a window for a sub's stage*: what a stage and a window are.
- *send a sub a work order from a sheet*: the full assembler.
- *schedule a sub across every surface*: the whole plan in job order.
