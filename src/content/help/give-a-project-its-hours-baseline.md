---
title: give a project its hours baseline at award
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: hours baseline, award, baseline at award, labor book, assumed hours, typed baseline, bid hours, costs tab, frozen, projects with no baseline, quickfill, fill them in, superintendent, planned finish, rough schedule, days ahead
order: 13
---
Every project leaves award with one number for the hours it should take. The app writes it the moment you create the job and says where it came from. The Costs tab, the Projects board and the superintendent's line read that one number.

## The three sources

The app tries three sources in order and picks the first one it can use.

- **◆ From the bid's Labor rows.** The bid's own hours. They count when hours sit on nine rows in ten and a labor rate is set. This is the one that scores.
- **≈ From the book, assumed.** Hours per $1,000 from similar projects, times the job's price. A guess, read as one. It needs three kept baselines in the book. Similar means a quarter to four times the job's price. With fewer than three, the book widens to the job's size band. The bands are under $10k, $10k to $100k, $100k to $1M, and over $1M. With fewer than three in the band, the book reads nothing and says so. The book never reads every size at once.
- **✎ Typed.** Your own figure, with your name on it. Use it when you know better than the book.

## Set it when you create the job

1. Open **New Job** from the won bid, or start one by hand.
2. Give the job a price. The job reads as a project when its price is known before the work.
3. Find **Hours baseline at award** under the header. The first usable source is already picked.
4. Pick another source if you know better. A dead one says what would make it usable.
5. For a typed figure, type the hours in the **Typed** box. Add a few words on why.
6. Read the line at the bottom. It names what **Create Job** will freeze.
7. Press {{button:blue|Create Job}}.

:::example On a bid with hours on every row
◆ 480 h · from the bid's Labor rows. 36 of 36 rows carry hours. Rough In 210 h · Top Out 150 h · Trim Set 120 h.

≈ 516 h · from the book, assumed. 4.3 h per $1k × $120,000, from 14 similar projects. The book runs 8% over the bid here.

Create Job freezes 480 h from the bid
:::

When nothing is usable, the line says so. Type hours, or let the job go. The Quickfill deck catches it later.

## The planned finish

Under the hours sits **Planned finish**. It freezes with the hours, so the superintendent's line can say days ahead or behind. The app tries three sources in order.

- **◆ From the rough schedule.** The GC project's own plan, when its weeks were kept with the bid or at award.
- **≈ Assumed from the hours.** The hours baseline at 24 crew hours a day, in working days, from the start the bid assumed. A guess, read as one.
- **✎ Typed.** A day you know.

The line at the bottom names both, such as *Create Job freezes 480 h from the bid · planned finish Nov 14 from the rough schedule*. On the Costs tab the frozen line ends with the plan. A project with a baseline and no plan offers a date box there. Press **Freeze the planned finish** and the line reads days from then on.

## Read it on the Costs tab

Open the job and press **Costs**. The strip under the tiles reads the baseline and its source.

- **◆ Baseline from B874 at award, 480 h.** The bid's hours. The line says how the clocked hours read against them.
- **≈ Baseline assumed from the book at award, 471 h.** Grey and dashed. The superintendent's line draws grey. The score skips this job until a bid or typed baseline replaces it.
- **✎ Baseline typed at award, 220 h.** Your words sit under it, with what the book says beside them.
- **No baseline for this job yet.** Amber. An older project, made before baselines were written at award.

The frozen number never moves. **Refresh from bid** writes the bid's newer figures on the live row. The strip still says what the award froze. A row with no award keeps **Clear**. It takes the row off. The job reads against the assumption again.

The **Where we are** card under the strip sums the line budgets. Its Labor bar reads the clocked hours against the hours frozen at award. A note under the bars says the score reads the frozen hours. The lines' sum shows beside them and never scores. The superintendent's line and the Scoreboard read the frozen hours too.

On a book baseline, **Fill the Labor rows on B917 →** opens the bid's Labor tab. Fill them and press **Take B917's estimate**. **Type a baseline** opens the typed form.

## Catch the projects awarded before

Projects made before this shipped have no baseline. The Needs You card counts them. The line reads *7 projects working with no hours baseline*. On Quickfill it opens **Fill them in**. A project priced under $2,500 never appears on the deck or on the Scoreboard. A project with no price yet still does.

1. Open Quickfill's **Today's lines** station.
2. Read the card. It says when the project was made, what its bid carries and what the book says.
3. Press {{button:blue|Take B901's estimate · 158 h}} or {{button:outline|Freeze the book's 471 h}}. One press writes the baseline and shows the next project.
4. Press {{button:outline|Skip}} if you are not sure. The project waits at the back of the deck.

A press you got wrong has **Undo** under the card. A project with no usable bid and a thin book shows no press. **Open the job** takes you to its Costs tab, where you type a figure.

## Good to know

- A service call never sees any of this. The baseline is for jobs priced before the work.
- A bid sent without hours gives the book the pick. The strip names the bid, so you can fill its Labor rows later.
- A bid with hours on its rows and no rate of its own is still the pick. The block prices it at the company rate from Settings → Line budgets. Create Job saves that rate on the bid, the way the Labor tab's **save it on the bid** does.
- A bid with no Labor rows says so. Add them on its Labor tab and the bid becomes the pick.
- A weekend award counts its working days from the Monday after it.
- Once a project is awarded, the strip offers no **Clear**. The award is written once. Take the bid's estimate or type a baseline to move the live figure.
- The line that carries the bid's price also carries the bid's labor and materials shares. The Bill tab's quiet line reads **◆ workbench** on it. See [see what a line should cost and tune it](/help/see-what-a-line-should-cost).
- A superintendent's bonus will read the frozen award, never the live row. That is why Refresh from bid cannot move it.
