---
title: read a supply house's price sheet
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: price sheet, quote, supply house, takeoffs, drop a file, pdf, fixture, subtotal, parts book, duplicate, their number, read a quote, enter pricing
order: 85
---
A supply house sends a quote, priced fixture by fixture. You can drop that quote on Takeoffs. The app reads it into rows for you.

Each row is matched to a part already in the book. Nothing is made twice, and nothing is filed without your press.

## Open a sheet

Go to **Bids → Takeoffs** and open the bid. Then do any one of these.

- Drag the quote's PDF onto the tab and drop it.
- Press {{button:gray|Price sheet ▾}} in the title row, then **Read a file…**.
- Copy the quote's rows and paste them on the tab.

The sheet opens in a panel on the right. Your takeoff stays where it is, beside it.

## Check the supply house

The top of the panel names the house, with its reasons. A reason may be the letterhead, or the price request this bid sent.

If the reasons disagree, the panel asks you instead. Press the right house. Nothing is filed until you say.

## Read the one line

Under the house is one line about the whole sheet. It counts the pages, the fixtures and the rows.

The chips beside it say where the rows stand.

- {{chip:green|40 ready}} rows carry a number the house is already known by.
- {{chip:blue|11 to confirm together}} rows match a part by its model number or its words.
- {{chip:yellow|14 need you}} rows ask a question.
- {{chip:gray|6 charges stay in their bundles}} rows are not parts.

## File what is ready

At the top of the panel is one blue button. It says what it will do, such as {{button:blue|File 40 rows · 25 wait ▸}}.

Press it. The ready rows are filed under the supply house. The rows that wait stay where they are.

A line then says what was filed. If a row could not be filed, the line names it and gives the reason.

Rows matched by a model number sit under **One look, then file**. Look down them once. Then press **Confirm 11 as the same parts**.

## Answer the cards

The panel opens on the rows that need you. Each row is a card with one question.

Press the button that answers it. The card works the same way as [one pasted price](/help/paste-a-price-from-a-quote-or-a-call#when-the-card-asks-a-question).

Press **Leave it out** to skip a row. You can bring it back later from its fixture.

## Open a fixture

Below the cards is **By fixture**. Each fixture is one line with its price each.

Press a line to see its rows. A row that says **in the bundle** has no price of its own. Its fixture's subtotal covers it.

That row is still worth filing. It keeps the house's number on the part, so the next sheet finds it.

A fixture that does not add up says so in amber. Its rows do not sum to the subtotal the paper prints. Check the paper before you use it.

## Place the fixtures

When every row of a fixture is filed, the sheet offers to place it. Its line under **By fixture** says where it goes.

Press {{button:gray|Place · $52.72 each}}. The fixture gets one line on the takeoff, at the house's price each.

The app looks for an assembly that already holds the same parts. It uses that one. It makes a new assembly only when none matches.

Press **Place 14 fixtures** to place every ready fixture at once. Your own count shows on the button.

While the sheet is open, a ready fixture is also offered on its own takeoff row. Press **Use** there.

Some fixtures wait for you.

- **Costed by hand.** The fixture already has lines you put there. Press **Use the sheet's** to replace them, or leave it.
- **No fixture with that tag.** The bid has no row with the sheet's tag. Pick the right row under **It is…**.
- **Does not add up.** Check the paper first.

Press **Take off** to undo a placement. The assembly stays in the book.

## Leave and come back

Every press saves at once. There is no Save button.

Press **Fold ›** to put the sheet away. A chip in the title row shows it is waiting, such as {{chip:yellow|Hillcrest Supply sheet · 14 wait}}. Press the chip to open the sheet where you left it.

Anyone who edits the parts book can open the chip and carry on.

## Take a sheet back

Filed a sheet under the wrong house? Press **Take this sheet back…** at the foot of the panel.

Every price the sheet filed returns to what it was. A price someone changed since is left alone, and the panel says how many.

The sheet itself stays. You can settle it and file it again.

## A sheet with no bid

A supply house may send its general price list. It is not for one bid.

Open **Materials → Parts Book** and press {{button:gray|Price sheet ▾}}, or drop the file there.

The sheet works the same way. It files part prices only. No fixture is placed, and no assembly is made.

## Find a sheet again

Press {{button:gray|Price sheet ▾}} and then **All price sheets…**. The list shows every sheet, with how many rows are filed and how many wait.

Press **Open** on a sheet to carry on where it was left.

## A sheet you already read

Drop the same file again and the app opens the read you already have. It does not read the sheet twice.

A house may send a later copy of the same quote. The app reads it as a new sheet and says what moved. The line counts the prices that changed and the rows that are new or gone.

## What it cannot read yet

A PDF that is a picture of a page has no text to read. A photo is the same. Paste the rows as text for now.
