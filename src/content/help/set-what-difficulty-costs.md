---
title: set what difficulty costs
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: pricing rules, price list, difficulty, gc rating, points, cost lines, field hours, office hours, paying point, cap, bid board, workbench, take a line off, rated higher since this was priced, who may rate, the site, site scale, pick the site, occupied building, phases
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

:::card The site

Each site point adds a percent of the bid's field hours at its labor rate. The site is picked on the bid, not on the GC. One site point at 4% on 480 hours at $80 adds 19.2 hours, $1,536.

:::

:::card Paying

The paying point carries the price for the days the GC's median runs past the threshold, at a rate a month. A $172,400 bid to a GC paid in 62 days, 17 days past 45, at 1.5% a month adds about $1,465.

:::

:::card The cap

All lines together add at most a percent of the bid's own cost. Past it, every line shrinks by the same share and the Workbench says so.

:::

:::

The sheet also says who may rate a GC: the office, the estimators, the masters. Tick the ones who may. Version 2 ticks all three. A group you untick reads the rating and cannot save.

## Change a rule

:::steps

1. Press {{button:outline|Pricing rules}} on the Bid Board.
2. Change a number. The try-it line under the rules reads the new numbers on an example bid at once.
3. Press {{button:blue|Save as version 2}}. The press names the next version.

:::

A saved version is never changed. Bids priced under version 1 keep their lines. Press **Every version** at the foot of the sheet to read each one.

## The score's target

Under the price list the sheet holds one more rule, **The score's target**. It is the profit the owner wants on each paid field hour. The Scores tab builds its hurdle from it. See [read the team scores and set the hurdle](/help/read-the-team-scores#set-the-target).

## What a bid shows

Open a bid on the **Pricing** tab. The Workbench writes the lines the first time it costs a bid to a rated GC. They land on the Labor tab's direct costs. Under the priced-margin line the Workbench reads {{chip:yellow|Difficulty · 4 points · +$6,420 in cost}}. Beside it, what that is on the price at the target margin. Press the chip to open the fold. It lists each line with its arithmetic and its sentence. It says who rated and who priced. It has the door to the GC's rating.

On the **Labor** tab the lines sit in **Direct costs** with the chip {{chip:yellow|difficulty}}. They read like any other direct cost. They cannot be typed over or removed there.

## Pick the site on a bid

The site belongs to the job, not to the GC. So it is picked on each bid.

:::steps

1. Open the bid on the **Pricing** tab.
2. Under the difficulty chip, find the line **The site: not picked on this bid**.
3. Press **Pick** and choose the sentence that fits the site.
4. The Workbench reads the pick into the bid's lines at once.

:::

:::example The line under the Workbench strip
The site: 1 point · An occupied building, or no room to stage. **Change**
:::

Press **Change** to pick again. Press **Clear the pick** to take it back. A bid to a GC nobody has rated can still carry a site pick. A master can pick the site from the Bid Board too. See [rate how a GC is to work with](/help/rate-how-a-gc-is-to-work-with#rate-from-a-bid).

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

The same line shows when the site was picked somewhere else since the bid was priced. It reads **The site was picked since this was priced**. Press **Read the new rating in** to take it.

## At send

The margin kept on the bid keeps the difficulty cost apart. Bid vs actual can hold the hours against the clock later.

See [rate how a GC is to work with](/help/rate-how-a-gc-is-to-work-with) for the rating itself.
