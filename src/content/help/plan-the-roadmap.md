---
title: plan the roadmap and see how each goal is going
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: roadmap, goals, stages, plan, map, timeline, progress, who sees the roadmap, farm, tech tree
order: 41
---
Roadmap is its own page now. You tap Roadmap in the header to open it.

**Roadmap** is the planner. It holds the big goals, the stages that lead to them, and who is on which task. The daily list stays on **Checklist**. The two pages talk to each other, but they are different work.

:::example The two pages
{{button:blue|Checklist}} Today · History · Review · Manage — the daily list, who did what

{{button:outline|Roadmap}} Goals · Map · Plan · Timeline — the plan, what unlocks what
:::

## Who sees it

The header shows **Roadmap** to the owner, leaders, assistants, the controller, and primaries. Those are the same people who can already edit roadmap tasks. Helpers and subs never see it. The roadmap reaches them as ordinary tasks on **Today**. Look for the purple {{chip:purple|⛰ goal}} chip. A link into the roadmap from a role that is not on the list lands on Today and says so.

Old links still work. A bookmark to the Roadmap tab on the Checklist page opens this page with the same roadmap selected.

## Goals, up top

If you have more than one roadmap, the page opens with a **Goals** strip. It has one card per roadmap, with its stage progress and what is currently in motion. When a stage finishes, the next stage's tasks land on the assigned people's Today lists automatically.

You expand a goal and the stage list works for you, not just reports:

- **Unlock banners**: when a stage finishes, a green banner names it and exactly which stages it opened. It reads "✓ Stage 6 finished → unlocked stage 9". Banners cover the last 30 days.
- **What's next**: you tap an open stage to unfold its tasks. The footer tells you what finishing it would unlock. So you know what is riding on it.
- **{{button:outline|🔔 Remind}}** on an unfolded stage nudges everyone who still has open tasks in it. Each person gets their own list, not a generic blast.
- **⇅ Reorder** opens the hold-and-drag card tool. Only structure editors see it. You drag stages into a new order and it saves as you go. Numbering and the goal bar follow.
- **What's blocking a locked stage**: you tap its 🔒 chip for the full unlock chain. If the stage has no tasks, you tap the row itself. The chain is every unfinished stage that has to finish first, each with its progress. The direct blocker is tagged *unlocks it*. You tap a stage in the list to jump to it.

The goal's bar is **one segment per stage**, in the order you arranged them. Green segments are finished stages. Amber-ringed ones are the current work front. They fill blue as their tasks complete. Pale ones are still locked. A **dashed, hollow** segment is a stage that is not planned yet. It has no tasks and nothing leading into it. So it never reads as done by accident.

You tap the goal card to open the **stage ledger**. It lists every stage with its own mini bar and count, plus a chip telling its story. {{chip:green|✓ done}} means finished. {{chip:yellow|current}} means in motion, with {{chip:blue|2 on lists}} when tasks are already on people's Today lists. 🔒 shows with the stage that has to finish first. Long locked tails fold behind "N more locked stages". **Open roadmap →** inside the ledger selects that roadmap in the canvas below.

**Tap a stage row to unfold its tasks** right there. Each task shows its number, a ✓ or ○, and the full title. It shows the facts that matter: {{chip:yellow|★ pinned}} or {{chip:yellow|⚡ next up}}, and who is on it, or *unassigned*. It shows its live chip: {{chip:gray|on list}}, {{chip:blue|in review}} or {{chip:green|signed off}}. You tap a task to open **Where this task fits**. The ledger stays read-only. Completing happens on Today or in the roadmap itself.

## The roadmap itself

Below Goals sits the roadmap you have selected, with its own row of views. **Plan** is what to do next. See *see what to do next on a roadmap*. **Map** is the canvas of stages and arrows. **Timeline** is the plan as dependency waves. The picker at the top switches roadmaps. It holds create, rename, and share.

:::example A Roadmap page, in one glance
GOALS
⛰ Farm 1 ▸ ■■■■□□□□
⛰ Shop ▸ ■■□□

{{button:blue|Plan}} {{button:outline|Map}} {{button:outline|Timeline}} {{button:outline|Members}}
:::

## Good to know

- The Dashboard's *"N roadmap tasks need a person"* card is the owner's. It does not appear on other people's dashboards, even though they can open the page.
- **Farm Mode** hides the Roadmap page along with the rest of the app. A chip at the top of the checklist says the mode is on and has the way out.
