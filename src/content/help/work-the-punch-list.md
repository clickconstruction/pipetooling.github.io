---
title: work the punch list of unfinished projects
category: Office
roles: dev, master_technician
keywords: punch list, to-dos, to-do board, mock-ups, next up, what to build next, ready to build, owner decision, do later drop
order: 95
---
The **Punch list** is the board of every project that was designed or partly built but is not finished — the same list that lives in the repo's `to-dos/` folder, rendered in the app so nobody has to read markdown to see what is waiting. Open it from the gear menu {{icon:help|gear}} → **Punch list**.

## What a row tells you

Each row is one to-do. Its name opens the to-do file on main; beside it, a chip lists the versions that already shipped for it, each one a link to that version's write-up.

:::example One row, read left to right
**Submittals** `stages 1 → 6c shipped` — what it is, in a sentence. **Next:** the smallest step that ships. Then the links: {{chip:blue|▣ mockup}} {{chip:blue|▣ before-after-5b}} {{chip:purple|◇ design canvas}} {{chip:gray|history}} {{chip:gray|folder}}. On the right: **Size** (XS under an hour · S a sitting · M a day of PRs · L a multi-day train) and what **Blocks** it.
:::

- **▣ mock-ups** open as pages — the drawings made for the to-do, served beside the app.
- **◇ artifacts** are design canvases on claude.ai the to-do links.
- **history** is every pull request that touched the to-do, newest first; **folder** is everything saved next to it.

## The five groups

Rows sit in readiness order: **Ready to build** (unblocked, the plan names the first PR), **Close out** (built; a deletion or a dated wait is left), **Needs an owner decision**, **Waiting on time or usage**, and **Residuals** (small leftovers from shipped trains). Standing lists like *Next up* and *Owner decisions pending* show under All but take no pick.

## Do, Later, Drop

Tap {{button:green|Do}}, {{button:amber|Later}} or {{button:red|Drop}} on a row to sort it; tap again to clear. The counts at the top and the **Show** filters follow. A note box under the buttons is for the session that picks the row up. For now the picks stay on the device you made them on.

## Changing what is on the board

The board is rendered from the to-do files, so it cannot be edited here. To add a project, change a status, or retire a finished one, change the to-do file in the repo — `to-dos/README.md` says how, and the board updates with the next deploy.
