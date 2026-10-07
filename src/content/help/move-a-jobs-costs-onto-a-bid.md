---
title: move a job's costs onto a bid
category: Office
roles: dev, master_technician, assistant
keywords: bid, bids, costs, wrong job, misfiled, reassign, migrate, move costs, delete job, tally parts, materials, team labor, clocked to the wrong thing, bid costs, pre-job work
order: 72
---
A crew sometimes clocks in and buys parts against a job when the work was really bid work. That money landed in the wrong place, and you can move it onto the bid.

Bid work is walking the site, running a camera, or pricing a set of plans. The crew clocked it against a **job**, not the **bid**. The money is real. It just landed in the wrong place. So the bid looks cheaper than it actually was.

You can move it. It lives in the same place as reassigning costs to another job.

## Move the costs

1. Open the job and click {{button:outline|Edit}}.
2. Scroll to the bottom and click {{button:red|Delete}}.
3. Because the job has costs on it, the button becomes {{button:outline|Reassign to another job…}}. Click it.
4. At the top of the window, switch the target from **Another job** to {{chip:blue|A bid}}.
5. Search for the bid by number, project, or address, and pick it.
6. **No matching bid yet?** The bottom of the list always offers *+ Create new bid "your search text"*. One click starts a bid named after what you typed. It uses this job's service type, customer and address. It selects the new bid as the target. Finish the bid's details on Bids later.
7. Read the preview. Then click {{button:red|Confirm move to bid and delete}}.

:::example The preview is the real thing
The preview isn't an estimate. It actually performs the move on the server, counts what happened, then rolls it all back — so the numbers you read are exactly what pressing Confirm will do.
:::

## What moves, and what does not

**Moves to the bid:** parts, billed materials, supply-house invoice splits, card charges, team labor, and field reports. Team labor means the clocked hours re-point at the bid.

**Deleted with the job:** the job's schedule blocks, inspections, fixtures, notes thread, status history and team-member list. A bid has nowhere to put these.

**The job total, the revenue, is not carried over.** A bid has no revenue total to add it to. The amount is shown to you and then goes away with the job. If that job was carrying real revenue, bill it before you move the costs.

The window lists all of this, with counts, before you confirm. Read that box. It is the whole point of the step.

## After the move

The costs now sit on the bid. You see them in **Bids → Bid Costs** alongside the clocked labor that was already there. The bid's real cost goes up, which is the point. Next time you price similar work, the number you compare against is honest.

:::example This cannot be undone from the bid side
Moving the costs is one-way. A dev can restore the whole deleted job for 90 days from **Settings → Data & recovery → Recently deleted** ([recover a deleted job or bid](/help/recover-a-deleted-job)), but anything already moved onto the bid stays on the bid.
:::

## If you only want to fix future work

This flow deletes the job. The job may still be live. You may only want the crew clocking to the right place from now on. Then do not use this. Have them clock in against the bid instead. Move the misfiled costs only once the job itself is genuinely surplus.
