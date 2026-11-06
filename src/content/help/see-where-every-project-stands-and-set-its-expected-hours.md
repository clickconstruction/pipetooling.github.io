---
title: see where every project stands and set its expected hours
category: Jobs & Scheduling
roles: dev, master_technician, assistant, controller, superintendent
keywords: projects board, projects, expected hours, target, pace, ahead, behind, labor budget, strip, days, stages, crew day, superintendent, recent changes, undo, back to the budget, job kind, service call, kind not set, missing from the board
order: 31
---
Projects is one page for every working project. Each project is a card. The strip on the card is the labor budget, filled by the real days the crew worked. One look says which projects are ahead and which are behind. The leader and the office set the expected hours under the strip. The superintendent reads the same number on the phone.

## Open the board

Open **Jobs** and press {{button:blue|Projects}} beside {{button:green|Forecast}}. The page also opens at [/projects-board](/projects-board). On a job's Costs tab, the Where we are card has a door, **On the Projects board ›**. The door opens that project's card large.

## Which jobs land here

A Working job lands here by its kind. The chip beside the job's name shows the kind.

- {{chip:blue|Project}} lands here at any price.
- {{chip:green|Service call}} stays off, even when it is priced at $25,000 or more.
- {{chip:yellow|Kind not set}} lands here only with a stage In order or a price of $25,000 and up.

A job that only carries a GC project's bills stays off. Nobody clocks on it.

A job is missing and it should be here? Open the job and press the **Edit** tab. Press {{button:blue|Project}} under **Kind**. The job is on the board the next time the board opens. Read [say whether a job is a service call or a project](/help/say-whether-a-job-is-a-service-call-or-a-project) for how the app reads a kind.

## Read a card

The worst project comes first. A card with a red edge is behind. A green edge is ahead.

- The amber pieces are the real days. Each piece is as wide as that day's hours. The pieces turn red when the job is behind.
- The faint ticks past the days are the days left at this crew's pace.
- The blue mark is the work done, with a chip beside it. {{chip:green|+2 d}} means two days ahead. {{chip:red|−3 d}} means three days behind. {{chip:gray|on pace}} means the hours and the work agree.
- The thin line along the bottom is the money spent. It turns red when the money runs ten points ahead of the work.
- The bars across the track are the stages. Hover a bar to read the stage's name and the budget to reach it.

The small symbol at the end of the expected row says where the budget came from. ◆ is the bid. ✎ is a number the office typed. ≈ is assumed from the lines. 🎯 is a target someone set.

:::example A card that reads behind
*J1050 · The Bunker* shows red pieces to 65% of the track, the blue mark at 30%, and the chip *money ahead*. The money line is red. The words under the slider say *Spending 15 points ahead of the work.* The leader opens the card large and reads the days to see where the hours went.
:::

## Hover a day

Hover an amber piece and the day comes off your cursor. You read the hours and the money first. Then who clocked and for how long, the subs, what was bought, and the report's percent. On a phone, tap the piece and the day opens as a window.

## Set the expected hours

The slider under the strip is the expected hours. Its left end is the hours already in. Its right end is the labor budget's edge. Slide it and the strip reads live as if the target were set. A box asks why. Type the reason and press {{button:blue|Keep it}}. {{button:outline|Put it back}} throws the change away.

The card then reads the target with 🎯, who set it, when, from what, and why. The superintendent reads the same line on the phone. The target never changes the budget on the Costs tab.

A project at or over its labor budget shows the slider pinned. The words say the budget is the lever now, on the Costs tab. Read [how the labor budget is set](/help/job-charges-timeline) for that lever.

## Set a target on any job

A service job never lands on the board. Its target lives on the job window instead.

Open the job and stay on the **Job** tab. The **Target** line sits above the review. It reads the expected hours if the office set them. Otherwise it reads the labor budget's hours and says where they came from. With neither it reads **No target yet**.

Press {{button:outline|Set a target}}. Type the hours and say why in a few words. Press {{button:blue|Keep it}}. The line then reads the target, who set it, when, and the reason. {{button:outline|Change the target}} opens the same box again. {{button:outline|Back to the budget}} clears it.

The crew reads the line and the reason. A lead's Your week card counts the crew's hours against this number once the job finishes. A job that finishes with no target is named as not counted.

## Undo a change

**Recent changes** at the top of the page lists the last changes, newest first. Press {{button:outline|Undo the last change}} to put the latest one back. Press **back to the budget** on a card to clear its target.

## Open a card large

Press the card's title, or any space around the controls, to open it large. The strip is taller and each stage is named under its piece. The slider is long. {{button:outline|−}} and {{button:outline|+}} move it one crew day. A box takes the hours typed. The full reading sits under it.

## The leader's Dashboard

The leader also sees Projects on the Dashboard, as one line under Money in. The line counts the working projects, how many are behind, how many are ahead, and names the worst one. Press the line and it opens to the same cards as the board. Press {{button:outline|Close ▴}} and it folds back to one line. The Dashboard remembers your choice.

## Who sees what

The leader, the assistant and the controller set the expected hours. A superintendent sees the whole board and reads every number, and sets nothing. The point is that someone else moved the number.

Everyone on the board reads the same hours and the same money percent. Only a dev, the leader and the controller see dollars on a day. Everyone else reads each person's hours and the report.
