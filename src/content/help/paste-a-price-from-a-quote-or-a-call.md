---
title: paste a price from a quote or a call
category: Office
roles: dev, master_technician, assistant, estimator
keywords: paste a price, quote, price sheet, phone price, one price, supply house, parts book, takeoffs, their number, undo, duplicate, by the hundred, price moved
order: 84
---
You have one price from a supply house. It may be a row in a mail, or a number from a call. You can file it in two presses.

The app finds the part on file for you. Nothing is made twice.

## Paste a row

1. Press {{button:gray|Price sheet ▾}} and then **Paste a price**. The button is at the top of **Bids → Takeoffs**, and on **Materials → Parts Book**.
2. Pick the supply house. The houses this bid asked for prices come first.
3. Paste the row into the box. You can also type it: the house's number, the words and the price.

The app reads the house's number only when it is all digits. A number with letters in it counts as words.

A card appears for the row. It shows the part on file and how it was found.

- {{chip:green|Same Hillcrest Supply number}} means the house's own number is on the part.
- {{chip:blue|Same model number}} means the maker's number in the row is on one part.
- {{chip:blue|Same words}} means a part says the same words, and its sizes agree.

4. Press the blue button. It names the price it will file, such as {{button:blue|File $18.40}}.

A green line says what was filed. Press **Undo** on it to put the old price back.

:::example a row from a mail
You paste `512207  AX8802XL-LR-PC ARLO SUPPLY KIT  18.40` and pick Hillcrest Supply. The card shows the Arlo supply kit on file. You press **File $18.40**. Hillcrest's number is now kept on the part too.
:::

You can paste several rows at once. Each row gets its own card and its own press.

For a whole quote, see [read a supply house's price sheet](/help/read-a-supply-houses-price-sheet).

## When the card asks a question

The card asks before it files a price that looks wrong.

- **Price moved a lot.** The new price is more than a quarter away from the one on file. The card shows both. Press **File** to take the new one, or **Keep** to leave the old one.
- **Unit differs.** The house prices the part by the hundred. The book prices it each. Pick the reading that is right.
- **A newer price is on file.** Your paper is older than the price in the book. The newer price stays unless you say otherwise.
- **Two parts on file.** Two parts carry the same model number. Press **Use this one** on the right part.
- **Nothing on file.** No part matches. Check the name, then press the button that makes the part and files the price.

If the card picked the wrong part, press **Another part…** and search the book.

## A price for one part

Open the part's prices. Press **A price from a quote or a call…** above **Their numbers**.

Pick the house, type the price and say where it came from. **Their number** is optional.

## Where a price came from

A part's prices now show their source under the house's name. It may read *By phone* or *Pasted from a quote*.

A price you change by hand loses its source. It is your number then.
