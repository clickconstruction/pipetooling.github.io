---
title: plan the roadmap and see how each goal is going
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: roadmap, goals, stages, plan, map, timeline, progress, who sees the roadmap, farm, tech tree
order: 41
---
**Roadmap** is its own page now — tap **Roadmap** in the header. It is the planner: the big goals, the stages that lead to them, and who is on which task. The daily list stays on **Checklist**; the two pages talk to each other, but they are different work.

:::example The two pages
{{button:blue|Checklist}} Today · History · Review · Manage — the daily list, who did what

{{button:outline|Roadmap}} Goals · Map · Plan · Timeline — the plan, what unlocks what
:::

## Who sees it

The header shows **Roadmap** to the owner, leaders, assistants, the controller, and primaries — the same people who can already edit roadmap tasks. Helpers and subs never see it; the roadmap reaches them as ordinary tasks on **Today** (look for the purple {{chip:purple|⛰ goal}} chip). A link into the roadmap from a role that isn't on the list lands on Today and says so.

Old links still work: a bookmark to the Roadmap tab on the Checklist page opens this page with the same roadmap selected.

## Goals, up top

If you have more than one roadmap, the page opens with a **Goals** strip: one card per roadmap with its stage progress and what is currently in motion. When a stage finishes, the next stage's tasks land on the assigned people's Today lists automatically.

Expand a goal and the stage list works for you, not just reports:

- **Unlock banners** — when a stage finishes, a green banner names it and exactly which stages it opened ("✓ Stage 6 finished → unlocked stage 9"). Banners cover the last 30 days.
- **What's next** — tap an open stage to unfold its tasks; the footer tells you what finishing it would unlock, so you know what's riding on it.
- **{{button:outline|🔔 Remind}}** on an unfolded stage nudges everyone who still has open tasks in it — each person gets their own list, not a generic blast.
- **⇅ Reorder** (structure editors only) opens the hold-and-drag card tool — drag stages into a new order and it saves as you go; numbering and the goal bar follow.
- **What's blocking a locked stage** — tap its 🔒 chip (or the row itself, if it has no tasks) for the full unlock chain: every unfinished stage that has to finish first, the direct blocker tagged *unlocks it*, each with its progress. Tap a stage in the list to jump to it.

The goal's bar is **one segment per stage**, in the order you arranged them: green segments are finished stages, amber-ringed ones are the current work front (they fill blue as their tasks complete), and pale ones are still locked. A **dashed, hollow** segment is a stage that's *not planned yet* — no tasks and nothing leading into it — so it never reads as done by accident.

Tap the goal card to open the **stage ledger** — every stage with its own mini bar and count, plus a chip telling its story: {{chip:green|✓ done}}, {{chip:yellow|current}} with {{chip:blue|2 on lists}} when tasks are already on people's Today lists, or 🔒 with the stage that has to finish first. Long locked tails fold behind "N more locked stages". **Open roadmap →** inside the ledger selects that roadmap in the canvas below.

**Tap a stage row to unfold its tasks** right there — each task with its number, a ✓ or ○, the full title, and the facts that matter: {{chip:yellow|★ pinned}} or {{chip:yellow|⚡ next up}}, who's on it (or *unassigned*), and its live chip ({{chip:gray|on list}} / {{chip:blue|in review}} / {{chip:green|signed off}}). Tap a task to open **Where this task fits**. The ledger stays read-only — completing happens on Today or in the roadmap itself.

## The roadmap itself

Below Goals sits the roadmap you have selected, with its own row of views: **Plan** (what to do next — see *see what to do next on a roadmap*), **Map** (the canvas of stages and arrows), and **Timeline** (the plan as dependency waves). The picker at the top switches roadmaps, and holds create, rename, and share.

:::example A Roadmap page, in one glance
GOALS
⛰ Farm 1 ▸ ■■■■□□□□
⛰ Shop ▸ ■■□□

{{button:blue|Plan}} {{button:outline|Map}} {{button:outline|Timeline}} {{button:outline|Members}}
:::

## Good to know

- The Dashboard's *"N roadmap tasks need a person"* card is the owner's — it does not appear on other people's dashboards, even though they can open the page.
- **Farm Mode** hides the Roadmap page along with the rest of the app; a chip at the top of the checklist says the mode is on and has the way out.
