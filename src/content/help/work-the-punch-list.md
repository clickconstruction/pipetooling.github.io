---
title: work the punch list of unfinished projects
category: Office
roles: dev, master_technician
keywords: punch list, waiting on me, questions to answer, answer a card, go ahead, change, not now, answered, who a card waits on, working on it, tick a card, claim a card, who is working on it, taken, free to pick up, tick cleared, my tick is gone, 12 hours, checkbox, my ticks, what am I working on, search the punch list, find a card, search cards, by number, newest first, oldest first, sort the cards, burndown, when will it clear, pace, to-dos, to-do board, mock-ups, next up, what to build next, ready to build, owner decision, do later drop, opinion, build later drop your call, row number, item number, settings
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

## Answer the questions that wait on you

Some cards wait on a person. Such a card carries one question, and says who it waits on.

The **View** row has a pill for those cards. The pill reads **Waiting on me** with a count when a card asks you. The pill reads **Waiting on a person** when no card asks you. The page opens on this view when a card asks you.

- Each row leads with the question. A word in front says what kind of thing is asked.
- **Look** asks you to open a screen. **Read** asks you to read a text through.
- **Walk** asks you to be there for a walk. **Decide** asks you to pick an answer.
- **Use** asks you to use the thing for a while.
- The card's name is under the question. You press the name to open the card.
- A small picture shows the built screen. You press it, or **See all**, to open every picture.
- A card that is not built shows **Today** beside **If built**. The second picture is a mock-up.
- A row says so when its pictures are old. The line reads *The screen changed after these were drawn.*

You answer on the row with {{button:green|Go ahead}}, {{button:amber|Change}} or {{button:gray|Not now}}.

- **Go ahead** says the work can move on.
- **Change** opens a box. You type what should change, then leave the box.
- **Not now** says the question can wait.
- You press a pressed answer again to take it back.

An answered card leaves the list. The card folds into **Answered** at the foot. You press **Answered** to see those cards and change an answer.

An answer belongs to its question. When a card asks a new question, the card comes back to the list.

The pills over the list show whose questions you see. **Me** is yours. **Everyone** is every question. This device remembers the pill.

A card's own row carries the same question and the same answer. The row carries both in **By group** and in **By number**.

## Work the cards by number

Two more views list every card. **By group** is the board in its five groups. **By number** is every card in one list.

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

A tick is a claim. Everyone who opens the board sees your name on the card.

- A tick is kept with your account. The tick is there after a reload, and on your phone and your computer.
- Nobody else can take your tick off.
- A tick stays while its card stays in the same group.
- A tick is cleared after 12 hours with no update. [See who is working on a card](#see-who-is-working-on-a-card) says what an update is.
- A card that moves to another group loses its tick. A card that leaves the board loses its tick too.
- A flag does not move a card, so a flagged card keeps its tick.

**Working on** in the filter row counts your ticks. You press it to see only the cards you ticked. You press it again to see every card.

A tick is not a pick. {{button:green|Do}}, {{button:amber|Later}} and {{button:red|Drop}} sort a card. A tick says who is on it.

When a tick does not save, the box goes back and a line says why. When the ticks cannot be read, the page says so and still shows every card.

## See who is working on a card

A ticked card says who is on it, on a line under its name. The line has the name and how long ago the last update was.

:::example A card somebody holds
{{chip:yellow|● Sam is working on this. Last update 3 h ago.}}
:::

An update is either of two things.

- The person ticks the card.
- The card's file changes in the repo.

A claim goes quiet after 12 hours with no update. The card then reads as free to pick up. The line says who had it and when it went quiet. That line goes when the person who had the card next opens the board.

:::example A card whose claim went quiet
{{chip:gray|○ Free to pick up. Sam had it and went quiet 2 h ago.}}
:::

You can tick a card that is free to pick up. The card then reads as yours.

Your own tick is cleared when your claim goes quiet. Your box is empty the next time you open the board. The card says why.

:::example A card whose tick was cleared
{{chip:gray|◌ Your tick was cleared after 12 quiet hours. Tick the card again if you are still on it.}}
:::

That line shows on the visit that clears the tick. You do not see it again after you leave the board. You tick the card again if you are still working on it.

You can keep a claim fresh before the 12 hours pass. You untick the card and tick it again.

Two people can tick the same card. The card then names both.

The time of a file change comes from the last deploy. A change made since then counts after the next deploy.

## Changing what is on the board

The board is rendered from the to-do files, so it cannot be edited here. To add a project, change a status, or retire a finished one, you change the to-do file in the repo. A card's question is one line in its file, `ask:`. `to-dos/README.md` says how. The board updates with the next deploy.
