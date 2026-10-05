---
title: use the pricing tape calculator
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator, primary
keywords: calculator, pricing, tape, ledger, history, notes, paste, clipboard, sum, bids, margin, math
---
On **Bids → Pricing** on a desktop, a small calculator icon floats in the bottom-right corner. You click it and the **Pricing Tape** unfolds, a calculator with a paper-tape history.

The Pricing Tape is built for the side-math you do while pricing. Side-math means checking a quote, summing a submittal, or sanity-checking a margin. A submittal is the product paperwork the GC approves.

## Keys land here — on purpose

Sometimes the calculator is lit with an amber ring and the {{chip:yellow|keys land here}} chip. Then your keyboard types into the calculator. The keys are digits, `+ − × ÷`, Enter for `=`, Backspace, and `C` to clear.

- **Click the calculator** to arm it. You click any field on the page and the ring drops instantly. There is no half-focused state.
- You press {{chip:gray|Esc}} once to hand the keyboard back to the page. You press it again to tuck the calculator back into its corner icon.
- The ***—*** button in its header also tucks it away. The calculator remembers open or closed on this device.

## The tape is a ledger

Every `=` prints a line: the expression, the result, and when. The when reads like *4m ago · 3:52 PM*, updating live. The newest line sits at the bottom. Older lines fade up into thin air.

- **Roll back**: you click any old line and its result loads as the start of your next calculation.
- **Search**: the box above the tape filters as you type. Numbers match with or without commas, so "1599" finds 1,599.03. Notes match too.
- The tape survives reloads and closing the calculator, since it's saved on this device. The tape only clears line by line as very old lines age past the 200-line cap.

## Label a line with a note

Right after you press `=`, **just keep typing**. Letters start a note on the line you just made. Enter saves the note.

:::example naming the math while it's fresh
Type `8×1599.03=` and then `water heaters unit 4` and Enter. Next week, searching "water heaters" pulls that line back up, math and timestamp intact.
:::

You hover any older line and click the **✎** to add or edit its note.

## Paste from anywhere

With the calculator armed, you paste with **⌘V**. There are no buttons. Pasting just works:

- **One number**, even "$1,599.03", lands in the display as if you typed it. The number is ready to chain: paste, then `×8=`.
- **A column of prices** from a spreadsheet or submittal sums into one tape line. Every number it used is printed, so a stray grab is visible, never silent. Part codes like "WH-1" are ignored. Accounting negatives like *"(617.97)"* subtract.
- **Copy out**: you click the big result and it shows {{chip:green|Copied ✓}}. Then you paste it wherever it goes next.

## Notes

- The calculator works like a desk adding machine: strictly left to right, so `2 + 3 × 4` is 20.
- The calculator appears only on the Pricing tab, on screens wide enough to give it a corner. Phones have their own calculator a swipe away.
- The tape is yours alone, per device. The tape isn't shared with the team. The tape never touches the bid itself.
