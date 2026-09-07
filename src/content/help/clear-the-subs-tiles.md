---
title: clear the four Subs tiles from the board
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: subs tab, on a handshake, stages waiting, offers out, signed this month, tiles, queue, work order, send, nudge, re-send, extend, withdraw, signed on paper, availability, free, days off, GC ask, inspection, bill, pay, next row
order: 65
---
The four tiles at the top of **Jobs → Subs → Work** are doors, not just numbers. Click one and it opens a queue you clear from inside: the rows the tile counts, the row you're on expanded into the one form that resolves it, a progress bar counting what you've handled since opening, and the counting rule spelled out in the footer so nobody has to guess why a row is or isn't there.

Every button in a queue is a move the board already has — sending a work order, nudging, withdrawing, moving a window, answering the GC, billing, paying. The queues just put them in the order the office needs them.

## How a queue works

- The **first row opens** as you arrive; click any row to open it instead. {{button:blue|Next row ↓}} in the footer (or **Enter** in the open row's form) moves to the next one.
- A handled row turns {{chip:green|✓ green}}, keeps an **Undo** where the move can be taken back, and sinks below the rows still waiting. The bar under the header reads **1 of 2 handled**.
- **Escape**, the ✕, or clicking the backdrop closes the queue. The tile re-counts when you get back to the board.
- {{button:outline|Open the full assembler ›}} is always there when the pre-read is wrong — it opens on the same job, sub, price and dates.

## On a handshake → Get it in writing

Every row is a sub working with a balance open and nothing signed. The open row is a small work order pre-read from their sheet:

- **Price** is the sheet total. **Window** runs from the day they started to about ten working days past today. **Takes about** and **Offer good for** (3 · 7 · 14 days) round it out. The scope is the trade library's default lines.
- {{button:blue|Send}} writes the order, mints its WO number and sends the offer notice to their portal. The row turns green with **Undo** (which withdraws it).
- A sheet whose job number has no Pipeline row shows {{chip:yellow|Not in Pipeline}} and a **Job** picker in the same form; the button becomes {{button:blue|Link and send}}. **New job…** opens Edit Job when the job doesn't exist yet.
- {{button:outline|Send the rest as drafted · N}} sends every remaining ready row at its pre-read values, one confirm.

:::example Two on a handshake
Texas R & A · #977 · $40,000 · working 7 days — open first because it's the most money. Pick the job, Link and send. Airfordable HVAC · #880 · $4,200 — Send. The bar reads 2 of 2 handled and the tile drops to $0.
:::

## Stages waiting → Put a sub on it

Every row is a window with no order behind it, grouped **Window passed** → **Open now** → **Ahead** → **No dates yet**.

- The open row's **Who** list is every roster sub with a chip for the row's span: {{chip:green|free those days}}, {{chip:yellow|on #273 · Trim & final}} (another live order overlaps — stacking is allowed, it's just said out loud), or {{chip:gray|off Sep 10}} (they marked the day off on their portal). Benched subs sit behind **+ N on the bench**.
- A **passed** window opens with its dates already moved to the next weekdays; the button reads {{button:blue|Move window and send offer}}. Otherwise it's {{button:blue|Send offer}}, and the sub picks a start inside the window from their portal.
- When the GC has asked for other dates the row shows {{chip:yellow|GC asked Sep 29 – Oct 10}} with {{button:green|Accept Sep 29 – Oct 10}} and {{button:outline|Answer with…}} (two dates and a why the GC reads).
- {{button:outline|Crew does this one}} clears the window when the stage isn't sub work after all — the line item stays on the job.

## Offers out → Chase the signatures

Every row is a sent order waiting on a signature, expired ones first. **Sent · seen** reads the portal visit log — *never opened their portal* is the call-them signal — and the phone number sits on the row.

- An **expired** row opens on {{button:outline|Re-send}}: a fresh **Good for**, the price and window editable, the same WO number; the offer notice goes out again. {{button:outline|Offer someone else…}} withdraws it and opens the assembler on the same job, price and dates for the next sub.
- A **live** row offers {{button:blue|Nudge}} (the reminder the board sends), {{button:outline|Extend +7 days}}, {{button:outline|Withdraw}} and {{button:outline|Signed on paper}}.
- {{button:outline|Nudge everyone unopened · N}} in the footer nudges only the rows whose sub has never opened their portal.

## Signed this month → What's next on each

Every row is an agreement signed this calendar month, with where the sheet sits on its rail and the office's next move as a button:

- Sheet in **Pre-inspection** (the sub said done): {{button:outline|Schedule inspection…}} opens the inspection request; {{button:green|Passed → bill}} moves the sheet on.
- Sheet **waiting on the customer**: {{button:blue|Bill Knight Contracting}} opens Bill Customer pre-filled.
- Sheet **queued for the pay run**: {{button:blue|Pay Behar Kraja · $1,000.00}} opens Make Payment with the amount.
- Rows the sub still owns read {{chip:gray|Waiting on the sub}} so the count of what needs the office is honest.
- Each row shows **portal** or **on paper** for how it was signed, the sub's own picked dates when there are some, and **Print** for the document. The footer steps back a month: {{button:outline|‹ August · 5}}.

## Related guides

- *set a window for a sub's stage* — what a stage and a window are.
- *send a sub a work order from a sheet* — the full assembler.
- *schedule a sub across every surface* — the whole plan in job order.
