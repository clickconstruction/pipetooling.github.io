---
title: work the punch list of unfinished projects
category: Office
roles: dev, master_technician
keywords: punch list, working on it, tick a card, checkbox, my ticks, what am I working on, search the punch list, find a card, search cards, by number, newest first, oldest first, sort the cards, burndown, when will it clear, pace, to-dos, to-do board, mock-ups, next up, what to build next, ready to build, owner decision, do later drop, opinion, build later drop your call, row number, item number, settings
order: 95
---
The **Punch list** is the board of every project that was designed or partly built but is not finished. The board is the same list that lives in the repo's `to-dos/` folder, rendered in the app.

Nobody has to read markdown to see what is waiting. You open it from Settings. **Punch list** is a chip under the search box at the top of the list, on every tab. The page itself is `/punch-list`.

## Read the burndown

The page opens with the **Burndown**. The Burndown shows how many cards were open at each hour, and when the list could clear.

- **Look at** picks the stretch the pace is read from. You can pick a day, three days, a week, two weeks or all of it.
- **Cards** counts each card as one. **Points by size** weighs a card by the size it has left.
- The solid line is the open work. The dashed line is where it heads **With no new cards**. The dotted line is where it heads **At this pace**.
- **New and closed, in waves** shows what came in above the line and what closed below it.
- **Where the open work sits** lists each group, how many cards left it, and how long it takes to empty.

A card is open while its file is in the folder. A card closes when it leaves the board, shipped or dropped. The numbers come from the folder's own history, so nobody keeps them by hand. The numbers update with each deploy.

Cards in **Needs an owner decision** and **Waiting on time or usage** do not close by building. The sentence over the chart counts them for that reason.

**Hide the burndown** folds it to one line. This device remembers the choice.

## Work the cards by number

The page has two views. **By group** is the board in its five groups. **By number** is every card in one list.

You press **By number** in the **View** row above the list. The newest card is on top. A number is given once, so the highest number is the newest card.

- **↓ Newest first** is the sort. You press it and the list runs from the oldest card. The press then reads **↑ Oldest first**.
- A row shows the card's number, its name, its group, its size and its **Next** line.
- You press the **Next** line to open the whole card. The open card has {{button:green|Do}}, {{button:amber|Later}} and {{button:red|Drop}}, as in the groups.
- The chips under the heading narrow the list to one group. The **Show** filters work here too.

The heading counts the cards in the list. This device remembers the view and the sort. The address `/punch-list?view=number` opens the view from a link.

## Find a card with the search

The search field sits beside the **View** choice. You type in it and the cards narrow as you type. The search works in both views.

- A search finds a card by its number. You type *#343* or *343*.
- A search finds a card by its name, its summary or its **Next** line.
- A search finds a card by a shipped version, like *v2.7150*, or by its group's name.
- Capital letters and accents do not matter.
- Two words find the cards that carry both words, in any order.

The search works with the **Show** filters, **Waiting on a mock-up** and the group chips. In By group, a group with no matching card is left out. In By number, the heading says how many cards match.

When nothing matches, the page says *No cards match* and offers {{button:outline|Clear the search}}. You press **×** in the field to clear it, or press Escape. The address carries the search, so `/punch-list?q=ledger` opens on that search from a link. On a phone the field takes its own line under the View choice.

## What a row tells you

Each row is one to-do. The row opens with its **number**. You say *#16* in a note or a request, and everyone knows which one. A number is given once, when the to-do is written, and never reused. So a retired row's number retires with it. The row's name opens the to-do file on main. Beside the name, a chip lists the versions that already shipped for it. Each version links to its write-up.

:::example One row, read left to right
**#17** · **Submittals** `stages 1 → 6c shipped` — what it is, in a sentence. **Next:** the smallest step that ships. Then the links: {{chip:blue|▣ mockup}} {{chip:blue|▣ before-after-5b}} {{chip:purple|◇ design canvas}} {{chip:gray|history}} {{chip:gray|folder}}. On the right: **Size** (XS under an hour · S a sitting · M a day of PRs · L a multi-day train) and what **Blocks** it.
:::

- **▣ mock-ups** open as pages. The mock-ups are the drawings made for the to-do, served beside the app.
- **◇ artifacts** are design canvases on claude.ai the to-do links.
- **history** is every pull request that touched the to-do, newest first. **folder** is everything saved next to it.
- A row with no drawing yet says {{chip:yellow|▢ waiting on a mock-up}}. The **Waiting on a mock-up** toggle by the filters shows only those. A row whose work changes no screen says *mock-up not required* and why.

## Read the Opinion column

Under **Size** and **Blocks**, most rows carry an **Opinion**. An opinion is a reviewer's call: {{chip:green|BUILD}}, {{chip:yellow|LATER}}, {{chip:red|DROP}} or {{chip:gray|YOUR CALL}}. The call comes with one sentence naming the benefit or the cost that decides it.

:::example One opinion
{{chip:green|BUILD}} *35 hand-rolled tel: links with five sanitizers is a bug farm; one script PR ends it.*
:::

The opinion is advice, not a pick. The Do / Later / Drop buttons are still yours. The opinion is a line in the to-do file, `opinion:` in its front matter. So anyone with repo access can change it. A row without one shows nothing there.

## The five groups

Rows sit in readiness order:

- **Ready to build**: unblocked, and the plan names the first PR.
- **Close out**: built, with a deletion or a dated wait left.
- **Needs an owner decision**.
- **Waiting on time or usage**.
- **Residuals**: small leftovers from shipped trains.

Standing lists like *Next up* and *Owner decisions pending* show under All but take no pick.

## Do, Later, Drop

You tap {{button:green|Do}}, {{button:amber|Later}} or {{button:red|Drop}} on a row to sort it. You tap again to clear. The counts at the top and the **Show** filters follow. A note box under the buttons is for the session that picks the row up. Picks are shared. Everyone who opens the board sees the same ones. The name of whoever last changed a row sits under it, with the day.

## Tick the cards you are working on

Every card has a checkbox beside its number. You tick the box when you are working on that card. You untick it when you stop.

- A tick is yours alone. Nobody else sees it.
- A tick is kept with your account. The tick is there after a reload, and on your phone and your computer.
- A tick stays while its card stays in the same group.
- A card that moves to another group loses its tick. A card that leaves the board loses its tick too.
- A flag does not move a card, so a flagged card keeps its tick.

**Working on** in the filter row counts your ticks. You press it to see only the cards you ticked. You press it again to see every card.

A tick is not a pick. {{button:green|Do}}, {{button:amber|Later}} and {{button:red|Drop}} are shared with everyone, and a tick is not.

When a tick does not save, the box goes back and a line says why. When your ticks cannot be read, the page says so and still shows every card.

## Changing what is on the board

The board is rendered from the to-do files, so it cannot be edited here. To add a project, change a status, or retire a finished one, you change the to-do file in the repo. `to-dos/README.md` says how. The board updates with the next deploy.
