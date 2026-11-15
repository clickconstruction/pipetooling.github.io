---
title: set what difficulty costs
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: pricing rules, price list, difficulty, gc rating, points, cost lines, field hours, office hours, paying point, cap, bid board, workbench, take a line off, rated higher since this was priced, who may rate
---

A GC's rating is points. The price list says what a point costs on a bid. The owner and the controller set it once, on the Bid Board. Every bid to a rated GC reads it when the Pricing tab first costs the bid. The points become cost lines on the Labor tab. Margin stays margin.

## Open the price list

Open **Bids** and press **Bid Board**. Press {{button:outline|Pricing rules}} in the tools row. The sheet opens on the published version. Estimators read it. The owner, the controller and a dev edit it.

## What the rules say

:::cards

:::card Field

Each field point adds a percent of the bid's field hours at its labor rate. Two field points at 5% on 480 hours at $80 add 48 hours, $3,840.

:::

:::card Office

Each office point adds office hours at the office rate. One office point at 12 hours and $80 adds $960.

:::

:::card Paying

The paying point carries the price for the days the GC's median runs past the threshold, at a rate a month. A $172,400 bid to a GC paid in 62 days, 17 days past 45, at 1.5% a month adds about $1,465.

:::

:::card The cap

All lines together add at most a percent of the bid's own cost. Past it, every line shrinks by the same share and the Workbench says so.

:::

:::

The sheet also says who may rate a GC: the office, the estimators, the masters. Tick the ones who may.

## Change a rule

:::steps

1. Press {{button:outline|Pricing rules}} on the Bid Board.
2. Change a number. The try-it line under the rules reads the new numbers on an example bid at once.
3. Press {{button:blue|Save as version 2}}. The press names the next version.

:::

A saved version is never changed. Bids priced under version 1 keep their lines. Press **Every version** at the foot of the sheet to read each one.

## What a bid shows

Open a bid on the **Pricing** tab. The Workbench writes the lines the first time it costs a bid to a rated GC. They land on the Labor tab's direct costs. Under the priced-margin line the Workbench reads {{chip:yellow|Difficulty · 4 points · +$6,420 in cost}}. Beside it, what that is on the price at the target margin. Press the chip to open the fold. It lists each line with its arithmetic and its sentence. It says who rated and who priced. It has the door to the GC's rating.

On the **Labor** tab the lines sit in **Direct costs** with the chip {{chip:yellow|difficulty}}. They read like any other direct cost. They cannot be typed over or removed there.

## Take a line off this bid

:::steps

1. Press the difficulty chip on the Workbench.
2. Press {{button:outline|Take a line off this bid…}}.
3. Pick the line and write why.
4. Press {{button:blue|Take Their office off this bid}}. The press names the line.

:::

The GC keeps its rating. The bid records who took the line off and why. The fold shows it struck through.

## When the GC is rated again

A bid keeps the lines it was priced with. When the GC is rated again since, the Workbench says **Rated higher since this was priced**. The line gives the points then and now. Press **Read the new rating in** to rewrite the lines from the new rating. A bid that went out keeps its lines for good.

## At send

The margin kept on the bid keeps the difficulty cost apart. Bid vs actual can hold the hours against the clock later.

See [rate how a GC is to work with](/help/rate-how-a-gc-is-to-work-with) for the rating itself.
