---
title: start a GC project from its plans
category: Bids & Estimating
roles: dev
keywords: gc mode, general contractor, new project, plans, sheet index, trades, scope, scope book, bid set, drive link
order: 93
---
A GC project starts the day its plans come in. The New project window takes you through the project, the plans, the trades and each scope.

GC mode is the part of the app where we are the general contractor. The GC projects page lists every GC project and holds the {{button:blue|New project}} button. Only devs see the page while the real build goes on.

## Step 1, the project

1. Open **GC projects** at `/gc` and press {{button:blue|New project}}.
2. Type the project's name and its address, with the street and the town.
3. Pick the customer from the list, or pick **Someone new** and type the name.
4. Pick the architect the same way.
5. Add the bid due date and the size in square feet when you have them.
6. Press {{button:blue|Next →}}.

The customer is who we work for. Sometimes that is the owner. Sometimes it is another general contractor or an owner's rep. Pick the role under the customer when it is not the owner. Press {{button:outline|+ Add an owner different from the customer}} when the property has another owner.

## Step 2, the plans

1. Name the set, such as *Bid set*, and give the day it came in.
2. Press {{button:outline|Paste a sheet list}} and paste the sheet index from the cover sheet.
3. Press {{button:blue|Add the sheets read}}. Each row is one sheet, with its number and its title.
4. Paste the project manual's table of contents into the sections box when there is one.
5. Paste the set's link under **Google Drive link to the plans**.
6. Press {{button:blue|Next →}}.

The sheets and the sections are what the trades and the scope lines read from. A row with a problem shows it in red. Fix it before you go on.

## Step 3, the trades

The trades are guessed from the sheets and the sections. Each one shows which sheets brought it in.

1. Untick a trade we will not need.
2. Add a trade the plans did not show under **Add a trade**.
3. Type a budget for each trade, or press {{button:outline|Fill the empty budgets from the size}} for a rough number.
4. Tick **Ours** on a trade our own crew does.
5. Press {{button:blue|Next →}}.

## Step 4, each scope

Each trade gets its usual scope lines. A scope line is one piece of work a quote says yes or no to.

1. Pick a trade on the left.
2. Change a line, take one out, or press {{button:outline|Add a line}}.
3. Press {{button:outline|Use these lines}} under **Start from the book** when a saved set fits.
4. Press {{button:outline|+ Add an exclusion}} for work the trade leaves out, and name who does it instead.
5. Press {{button:blue|Create the project}}.

A gap is work every trade leaves out. The footer counts them. Close a gap by giving the work to a trade.

## What happens after

The project, its trades with their scope and the first set of plans are made together. The page lists the project with its sheets, its trades and its gaps. Nobody is asked to quote yet. Who to ask comes with the company record.

The app also makes the project's folder in Drive, with **Plans** and **Team only** inside. Plans is shared with anyone with the link. The page shows who can open each set's link. Press {{button:outline|Check again}} after you change the sharing in Drive.
