---
title: use the pricing tape calculator
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator, primary
keywords: calculator, pricing, tape, ledger, history, notes, paste, clipboard, sum, bids, margin, math
---
On **Bids → Pricing** (desktop) a small calculator icon floats in the bottom-right corner. Click it and the **Pricing Tape** unfolds — a calculator with a paper-tape history, built for the side-math you do while pricing: checking a quote, summing a submittal, sanity-checking a margin.

## Keys land here — on purpose

When the calculator is lit with an amber ring and the {{chip:yellow|keys land here}} chip, your keyboard types into the calculator — digits, `+ − × ÷`, Enter for `=`, Backspace, `C` to clear.

- **Click the calculator** to arm it. Click any field on the page and the ring drops instantly — no half-focused state.
- Press {{chip:gray|Esc}} once to hand the keyboard back to the page; press it again to tuck the calculator back into its corner icon.
- The **—** button in its header also tucks it away. It remembers open or closed on this device.

## The tape is a ledger

Every `=` prints a line: the expression, the result, and when — "4m ago · 3:52 PM", updating live. The newest line sits at the bottom; older lines fade up into thin air.

- **Roll back**: click any old line and its result loads as the start of your next calculation.
- **Search**: the box above the tape filters as you type — numbers match with or without commas ("1599" finds 1,599.03), and notes match too.
- The tape survives reloads and closing the calculator (it's saved on this device), and only clears line by line as very old lines age past the 200-line cap.

## Label a line with a note

Right after you press `=`, **just keep typing** — letters start a note on the line you just made. Enter saves it.

:::example naming the math while it's fresh
Type `8×1599.03=` and then `water heaters unit 4` and Enter. Next week, searching "water heaters" pulls that line back up, math and timestamp intact.
:::

Hover any older line and click the **✎** to add or edit its note.

## Paste from anywhere

With the calculator armed, paste with **⌘V** — no buttons, it just works:

- **One number** (even "$1,599.03") lands in the display as if you typed it, ready to chain: paste, then `×8=`.
- **A column of prices** from a spreadsheet or submittal sums into one tape line, with every number it used printed — so a stray grab is visible, never silent. Part codes like "WH-1" are ignored; accounting negatives like "(617.97)" subtract.
- **Copy out**: click the big result — {{chip:green|Copied ✓}} — and paste it wherever it goes next.

## Notes

- The calculator works like a desk adding machine: strictly left to right, so `2 + 3 × 4` is 20.
- It appears only on the Pricing tab, on screens wide enough to give it a corner. Phones have the OS calculator a swipe away.
- The tape is yours alone, per device — it isn't shared with the team and never touches the bid itself.
