---
title: estimate labor hours on a bid
category: Bids & Estimating
roles: dev, master_technician, estimator, assistant
keywords: hours not on the counts, set aside, use for, version switch, renamed fixture, jobs baseline, hours per $1k, billed jobs, labor, hours, labor book, robot default, one book, hours from, override, reset to robot, learned, calibrated, propose, alias, plan code, queue, crew-days, revenue per field hour, usable as a budget, old, new, cost estimate, fill from the book, save and learn, per 100 ft, footage, task, fixed hours, sub line, source, crew rate, company rate, burden, overhead per field hour, bid labor, direct cost, margin, calibration, book vs jobs, evidence, jobs agree, set, keep
---
Bids → Labor turns a bid's count sheet into hours. The view is the one that learns.

A count sheet is the list of fixtures counted off the plans. **Bids → Labor** has a head that judges the bid. It has a queue of the rows the book could not answer. It has a grid with a source on every row. The classic HOURS grid and its Old / New pills retired in v2.3598. Every reader it had lives on below.

## What the head tells you

The top of the tab answers two questions before you read a single row.

**Usable as a job budget?** A bar and a few chips answer it. {{chip:green|hours on 22 of 26 rows}} {{chip:yellow|4 rows need hours ↓}} {{chip:green|rate set}} {{chip:green|materials from takeoff}}. A takeoff is the parts list priced from the count sheet. The estimate is usable when at least nine rows in ten carry hours and a labor rate is set. That is the same reading the job will use to burn against this estimate after the bid is won.

**Does the whole bid make sense?** Five tiles answer it. **Field hours** by stage. **Crew-days**, two techs for eight hours. **Labor $** at the rate. **Footage share**, how much of the labor sits on pipe rows. **Revenue per field hour**, the bid value divided by the hours. A number far above what finished jobs run means the hours are light or the bid is fat. Either way, look before it goes out.

## One book per trade

There is no book to pick any more. Each trade has one labor book, {{chip:blue|🤖 Robot Default}}. The robot seeds it and people correct it. The old Default and Bill books were folded into it. A bid always prices on its trade's book. The line under the tiles names it: *Labor book 🤖 Robot Default · Plumbing · 26 entries · 46 aliases · 9 overrides*. The **Labor book** panel at the bottom of the tab shows every entry. Each has a **Hours from** chip that says where its hours came from:

- {{chip:blue|robot}} means the robot's number stands. *robot · picked over Default 2/3/2* means the fold found the office's old book disagreed and kept the robot's split.
- {{chip:gray|human · from Default}} is a row only the office's book had, carried over as it was.
- {{chip:blue|override · Wendi · Sep 18}} means a person changed the robot's number. The robot's own stays underneath. Hover the chip to read it. {{button:gray|Reset to robot}} puts it back.
- {{chip:green|learned · BP375 · Wendi}} means a queue answer taught the book this entry.
- {{chip:yellow|calibrated ×1.13 · 4 jobs · Sep 18}} means Book vs jobs → Set wrote it. Reset to robot undoes it one entry at a time.

A robot re-seed refreshes the robot's numbers and never replaces one a person set.

**Who may change the book.** Dev and master technicians set anything, reset anything, and Set a calibration. Estimators override entries, stamped with their name. They reset their own overrides. They propose a calibration for a leader to confirm. Assistants and the controller read the book and its chips. The panel says *read-only for your role*.

## Rows arrive with hours when the bid is sent

You do not have to open Labor for a bid to have hours any more. The moment a bid with a count sheet is marked sent, its labor rows are made from the count sheet. They carry the book's hours, the same rows this tab would have made. They use the bid's book, or its trade's robot book when none is saved. What the book cannot answer still lands in the queue below. Nothing you typed is ever overwritten.

## The queue: answer once, the book learns

Rows with no hours yet sit in an amber box at the top, in sheet order. Each row shows what the book thinks it is:

- *reads as Toilet (by alias) — hours from the book* means the book already knows this row. {{button:blue|Fill 2 from the book}} takes every row like it in one tap and never touches hours you typed.
- *no match in the book* means the book has never seen this text. First say what the row is with the three-way switch under its name. {{chip:blue|Fixture}} is hours × count. {{chip:gray|Task · fixed hours}} is a line like sawcutting. Its hours are for the whole line. {{chip:gray|Sub}} is a subcontractor's line. None of your crew's hours go on it. Price it under Direct costs → Subcontractors, and Save marks the row answered. For a fixture, pick what it means in **Read as…**. That is a book entry, or **New book entry…** where you type the fixture's proper name. Then set the three stage hours and press {{button:blue|Save & learn}}.
- **Pipe rows read per 100 ft.** A footage row defaults the unit picker to *per 100 ft*. `ft of 2IN WASTE ×729.5` is one such row. So you type the hours for a hundred feet. The row's hours come out as count ÷ 100 × hours. An entry made this way keeps *per 100 ft* in the book. The entry decides the unit whenever you pick one.

Saving writes the row right away. When the row's text was new to the entry you picked, the book learns it as an alias. An alias is another name for the same entry. So `WC 1&2` reads as Toilet on every future bid without asking. The head says what happened: *Saved · "WC 1&2" now reads as Toilet on every bid.*

:::example A plan code the book had never seen
`LAV2 ×6` — no match. Read as… **Lavatory**. The hours fill in from the book (0.5 / 0.5 / 0.5). Save & learn. Next month's bid with `LAV2` on it lands straight in the grid.
:::

## The grid: every row says where its hours came from

Under the queue sit the filled rows. Each shows the row as the count sheet wrote it. The book's name sits under it when they differ. A pipe row shows *hours per 100 ft · 729.5 ft* instead. Then the count, and the three stage hours. Edit them here and they save on their own. Then the row's hours, and a chip. {{chip:blue|book · by alias}} means the book's hours untouched. {{chip:gray|✎ edited · book 1/1/1}} means you changed them and here is what the book said. {{chip:gray|✎ typed}} means no book entry matches and the hours were typed. {{chip:gray|sub · priced under direct costs}} is a sub's line with no hour cells at all. Hover a chip to read where the row came from. That is the entry and book, or what was learned on which bid. The totals row counts each kind.

The head also carries an **Other direct** tile. It adds up equipment, permits, subs, waste and other from the amber sections below. So the bid's cost outside labor and materials is one glance.

## The crew rate: never blank

Under the tiles sits the **Crew rate** card. The **company rate** is the last 90 days of recorded field wages from People times the burden factor. Burden is what an hour costs beyond the wage itself. The wages are every closed clock session on a job, wage-priced. So it reads like *company $35.76/h = $29.80 avg recorded field wage (90 d, 3,120 h) × 1.20 burden*. A bid with no rate of its own is costed at the company rate. The Labor $ tile, the "rate set" chip and the bottom line all read it. Press {{button:blue|save it on the bid}} to write that number onto the bid. Then Pricing and the printed documents read the same rate. Type your own in the rate box to override it. The chip reads {{chip:blue|$35.00/h override}} and *use company rate* clears it.

Two facts sit near the rate and are never added to the bid's cost. **Overhead / field hour** is a tile in the row above. It is the last 90 days of overhead divided by the field hours worked in those days. It matches the *A · per field hour* card on People → Overhead. Only a dev or a leader approved for pay opens that page. The Crew rate line reads *bid labor recorded*, with the hours and dollars clocked on this bid. Both already sit in the overhead pool. The old *Estimators Time* box is gone for the same reason. Bid labor is recorded, not invented.

## The bottom line

Under the grid sits **Direct cost of this bid**. It lists labor at the effective rate, materials from the takeoff, driving, travel and other direct. Other direct is equipment, permits, subs, waste and other. Then the total, and the margin at the bid value. The margin turns amber under 20 %. *Open Pricing →* takes you to the Workbench, which reads the same number.

When the bid carries an **alternate**, a card above the bottom line reads **With and without the alternate**. An alternate is a group marked on the Counts tab. It is the section a customer wants priced with and without. The card shows field hours, labor at the rate and driving in columns. There is a column for the base, each alternate, and the bid with it. A fixture that sits in the base and in the alternate shares one labor row. Its hours follow the counts. WC ×4 in the base and ×1 in the alternate puts one fifth of the WC hours on the alternate. Materials split the same way on Takeoffs → What Pricing sees.

## Direct costs: one list

Under the labor, **DIRECT COSTS** is one list. Every row wears its kind: {{chip:gray|equipment}} {{chip:gray|permit}} {{chip:blue|sub}} {{chip:gray|waste}} {{chip:gray|other}}. Each row says what it is for and the dollars by stage. Pick a kind and press {{button:blue|+ Add}} for a new row. The × removes one. The **driving** line sits on top. It is computed from the hours, the hours-per-trip and $/mile boxes and the bid's distance to the office. So it reads beside the rest: *88 crew-days · 176 trips (8 h each) · 41 mi · $0.70/mi*. One total closes the list.

## The book checks itself against finished jobs

The **Book vs jobs** tile reads the crews' recorded hours against what the book predicted. It covers every job linked to a bid that priced with this book. *book runs ×1.18 light · 3 jobs* means the crews ran 18 % over the book. A job counts once it is at least 25 % done with 8 or more field days. Younger jobs say nothing yet, and the tile says so.

When the book runs more than 3 % off, the tile offers the fix. A leader sees {{button:blue|Set ×1.18 on 12 entries}}. Every robot entry the linked jobs touched takes the robot's own numbers × the multiplier, to the quarter hour. It lands as a {{chip:yellow|calibrated ×1.18 · 3 jobs}} override. A person's override is never touched. A second Set re-reads from the robot's numbers rather than compounding. An estimator sees {{button:blue|Propose ×1.18}} instead. The tile then reads *proposed ×1.18 by Wendi · Sep 18* for everyone until a leader presses Set or *clear*.

Each filled row wears an evidence chip: {{chip:green|3 jobs agree}}, {{chip:yellow|2 jobs · wide}} or {{chip:gray|no jobs yet}}. Wide means the jobs disagree by more than a third. Tap it to open the evidence under the grid. There is one line per job. It shows done %, what the book said for that entry, what the crew ran, and the ratio. What the crew ran is the job's hours shared out by the book's own weights. Then it reads *Median ×1.36 → set the entry to 1.25 / 1.25 / 1.25 h*. {{button:blue|Set}} writes those hours onto that one entry as a calibrated override for every future bid. {{button:gray|Keep}} leaves it. Link jobs to their bids and the evidence fills in. You can link on the job's Costs tab, the Bid Board's *Link* chip, or Settings → Data.

## The Jobs baseline tile: what billed jobs actually took

{{chip:gray|Jobs baseline · 7.8 h per $1k}} reads every job that bills. Each keeps its baseline: recorded hours, wages, people, materials and price. This tile reads them all as **hours per $1,000 of price**. It shows the median, with the middle half beside it. It says what that implies for this bid's value: *7.8 h per $1k (6.5–10.2 middle half) · 42 jobs · this bid ≈ 960 h*. It is the book's answer for a bid with no count sheet, and a sanity check for one with. Jobs under 8 recorded hours do not count. A visit is not a job. It needs three baselines before it speaks.

## Telling the book how an entry reads

In the **Labor book** panel, an entry's form has two fields beside the hours. **Reads as** is *Fixture · hours × count* or *Task · fixed hours for the line*. **Hours are per** is *each* or *per 100 ft*. Mark your pipe entries per 100 ft once and every bid's footage rows fill in right. The entries table tags them {{chip:gray|per 100 ft}} and {{chip:gray|task · fixed hours}}. Editing a robot entry's hours makes it an override with your name on it. The form reminds you the robot's numbers stay underneath.

:::example 2" waste, once
Add the entry *2" waste* · Reads as Fixture · Hours are per **per 100 ft** · RI 4 / TO 0 / TS 0 · Additional names `ft of 2IN WASTE`. On the next bid, `ft of 2IN WASTE ×729.5` lands in the grid at 29.2 hours with the chip *book · by alias · per 100 ft*.
:::

## When a fixture leaves the counts

Labor rows follow the count sheet by name. A fixture can leave this version's counts. You may switch versions, re-import with new names or remove a row. The fixture's labor row is not deleted any more. The row moves to a box under the grid called **Hours not on the counts**. Hours in that box count in no total.

Each row in the box shows its hours and the day it was set aside. Pick a counted fixture in **Use for…** and press {{button:blue|Use for WC}}. The set-aside hours land on that row. {{button:gray|Remove}} lets the row go.

Count the fixture again and its hours come back by themselves. Switch back to a version that has the fixture and the hours return too. A name that changed only in capitals, spaces or a `[Group]` prefix keeps its row and its hours.

:::example A version without the floor drain
Floor drain carries typed hours on Version 1. Version 2 has no floor drain. Open Labor on Version 2 and the floor drain waits in **Hours not on the counts**. Switch back to Version 1 and it is in the grid again with the same hours.
:::

## Under the grid

Several things sit under the grid as they always did. They are the rate box, the sub-sheet prints, Vehicle Travel, Lodging and Meals, Direct Costs and the Labor book panel. The sub-sheet prints are Rough In, Top Out and Trim Set, on the totals row. Old's *Apply matching Labor Hours* is gone with Old. The queue's *Fill from the book* is the same move, and it never touches hours you typed.
