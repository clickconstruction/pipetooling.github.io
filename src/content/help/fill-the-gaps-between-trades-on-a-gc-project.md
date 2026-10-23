---
title: fill the gaps between trades on a GC project
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: gc mode, gap, gaps, exclusion, exclusions, known exclusions, leaves out, left out, cost to cover, compare quotes, scope, trades, our number, plus question mark
order: 97
---
A gap is work on the job that no trade covers yet. Every quote leaves something out, and the job still needs it done. This guide shows where each gap shows up and how to close it before our bid goes out.

## The two kinds of gap

A gap can show before any quote comes in. We set up each trade's scope when we start the project. Each trade has **known exclusions**, the work it never does, with who does it instead. When the trade it points to does not list that work, the card says so in red.

:::example On a project's card

1 gap: Plumbing leaves out Gas piping for HVAC.

:::

Read it left to right. Plumbing leaves the work out. Gas piping is the work. HVAC is who should do it. The HVAC scope does not list gas piping yet.

A gap can also come in with a quote. A company ticks what its quote leaves out, such as dewatering or a pump truck. That work still has no price in our number. Until we put a cost on it, the trade reads **+ ?** everywhere the number shows.

## Set each trade's known exclusions when you start a project

:::steps

1. Open [GC projects](/gc) and press {{button:blue|New project}}. Go to the **Each scope** step.
2. Pick a trade. Under **Known exclusions**, read the list. The usual ones for that trade are already there.
3. Press {{button:outline|+ Add an exclusion}} to add one. Type the work and pick who does it instead.
4. Read **Gaps between the trades** under the list. It names each thing left out that nobody on the job covers.
5. Press {{button:outline|Add it to HVAC}} to put the work on that trade's lines. Press {{button:outline|Add HVAC}} when that trade is not on the job yet.
6. Press {{button:blue|Create the project}} when the list is clear.

:::

Every company sees its trade's known exclusions when it quotes. A known exclusion needs no cost, because another trade, the owner or we do it. Pick **the owner** or **us** as who does it, and it is never a gap.

:::fold A gap on a project already made

The scope of a project changes only when a new set of plans comes in. Press {{button:outline|A new set of plans came in}} on the card. Under **The scope lines it touches**, press {{button:outline|+ Add a line this set brings}} on the trade that should do the work. The gap clears once the line is on that trade. Read [read the plans of a GC project](/help/read-the-plans-of-a-gc-project).

:::

## Close a gap a quote brings in

:::steps

1. Find the trade on the project's card. Press {{button:blue|Compare quotes (1)}} on its row.
2. Read **Their exclusions**. Each thing a company wrote it leaves out has a row.
3. A row marked {{chip:red|excluded}} has a box under it. Type our cost to cover the work and press Enter.
4. The **All in** row adds the cost to their quote. Press {{button:blue|Carry this number}}.

:::

The cost to cover it is what the work will cost us. Use another company's price, or our crew's hours and material. Until every excluded row has a cost, **All in** says {{chip:yellow|needs a cost}}. The card's Next line says **Set the missing cost on Concrete**, and Our number shows the trade as **+ ?**.

Two rows need no cost. A row that says *a Known exclusion · HVAC does it* is work another trade covers. A row with a price *if it comes up*, such as rock at $38 per cy, is a price for a maybe. Neither one holds our bid.

:::tryit

Open the test project on [GC projects](/gc) and press **Compare quotes (1)** on Concrete. Change the cost to cover Rebar supply and watch the All in number move.

:::

## Where a gap shows

- The project's card says each known gap in red under the trades.
- The price card, Our number and the Project Board show **+ ?** beside a number with a cost missing.
- The card's green, amber or red band says **Set the missing cost** as the next step while one is open.
- Compare quotes says it in words at the top. *No cost is set for rebar supply yet.*

## Who does the work when nobody quoted it

A gap closes in one of three ways. Another trade on the job takes the work, so add the line to its scope. We do it ourselves, so put our cost in the box. The owner does it, so make it a known exclusion by the owner when you start the next project.

## See it in the walk

Press {{button:outline|New here?}} on GC projects. Stop 8, **Gaps**, shows a gap line taken apart and links back here.

## What comes next

Once each trade's number is whole, read [compare quotes and carry one](/help/compare-quotes-and-carry-one) and send our bid. The known exclusions you keep live in the scope book. Read [keep the scope book](/help/use-the-scope-book).
