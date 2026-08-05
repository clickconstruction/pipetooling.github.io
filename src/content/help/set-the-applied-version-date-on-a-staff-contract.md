---
title: set the applied version date on a staff contract
category: Office
roles: dev, master_technician, assistant, controller
keywords: contracts, applied version, applied date, contract book, people contracts, custom date, backdate
order: 74
---
Every document row in **People → Contracts** shows an **Applied version** date — normally the date the matching **Contract Book** copy was last edited. That works until the book gets touched: the date moves for everyone, even people whose paper copy was agreed months earlier. You can now pin the date yourself.

## Set a custom date

1. Go to **People → Contracts**, expand the person, and open the document with the pencil (or the row's ⋯ menu → edit).
2. In the **Applied version** box, the **Contract Book copy** dropdown still picks which book copy applies. Below it, **Applied date** has two settings:
   - {{chip:blue|From book edit}} — the default. The date follows the book copy's last edit, like before.
   - {{chip:gray|Custom date}} — unlocks a date field. Pick the date the contract actually applied.
3. {{button:blue|Save}}.

:::example How the row reads afterwards
A custom date shows in the **Applied version** column with a dotted underline — hover it and the tooltip confirms the date was set manually. Contract Book edits won't move it.
:::

Switching back to **From book edit** clears the custom date and the column returns to tracking the book.

## When to use it

- The paper copy was signed on a known date, but the book text was edited later for other people.
- You're recording an older agreement after the fact and want the column to reflect when it really applied.

## Set the document's official date for everyone

The per-person date above is for exceptions. To set the date at the source, open the {{button:blue|Contract library}} (its **Documents** tab is the Contract Book) and {{button:outline|Edit}} the document — its **Version date** setting works the same way:

- {{chip:blue|From last edit}} — the date follows the last edit to the library text (the default).
- {{chip:gray|Custom date}} — pins the document's official version date. It shows on the book entry and feeds the pickers and Applied version column for **everyone** assigned the document, and editing the text won't move it.

When both exist, the more specific one wins: a person's custom applied date beats the book's version date, which beats the last-edit date.
