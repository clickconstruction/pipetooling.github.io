---
title: keep the scope book
category: Bids & Estimating
roles: dev
keywords: gc mode, scope book, scope lines, sets, duplicates, merge, known exclusions, trades
order: 94
---
The scope book is every scope line we keep, by trade. It starts from the scopes on our GC projects and grows each time a line is saved.

A scope line is one piece of work a quote says yes or no to. A set is a named list of one trade's lines, saved to start another job from. The book opens from the GC projects page. Only devs see it while the real build goes on.

## Open the book

1. Open **GC projects** at `/gc` and press {{button:outline|Open the scope book}}.
2. Pick a trade on the left. The number beside it is how many lines the trade has.
3. Pick **Lines**, **Sets** or **Duplicates to merge** at the top.

## Change or add a line

1. Type in the search box to find a line.
2. Press {{button:outline|Edit}} on a line to change its words, its section or its known exclusion.
3. Press {{button:blue|Save the line}}.
4. Type a new line at the foot and press {{button:outline|+ Add to the book}}.

A known exclusion is work the trade leaves out, with who does it instead. The book shows each trade's known exclusions under its lines.

## Fold two lines together

Two lines can say the same thing in different words. The book finds them.

1. Pick **Duplicates to merge**.
2. Press {{button:outline|Fold into}} to keep the line it names.
3. Press {{button:outline|Keep}} to keep the other one instead.

Folding keeps one line. Its jobs join the line it folds into.

## Save a scope as a set

1. On a project's card, press {{button:outline|Save as a set}} beside a trade.
2. The book opens on **Sets** with that trade's lines.
3. Give the set a name and press {{button:blue|Save the set}}.

The set shows under **Start from the book** on the next project's Each scope step.
