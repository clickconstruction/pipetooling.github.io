---
title: add a stage and its tasks to a roadmap
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: roadmap, stage, group, add stage, add task, sub task, map, connector, prerequisite, plus button, crew, team, assignees
order: 42
---
On **Roadmap → Map** every box is a **stage**, a numbered group of tasks. The lines between boxes say which stage must finish before the next unlocks.

You open the map from the header, under **Roadmap**. You need to be an **editor** on the roadmap to add anything. Check {{button:outline|Members}} if you do not see the buttons below.

## Add a stage

There are three ways. All open the same small "Add group" dialog where you type the stage's name.

- **Right-click empty canvas** is the quickest. Right-click any open spot, or two-finger tap it, and choose **＋ Add stage here**. The new stage lands exactly where you pointed.
- **From the toolbar**: in the top-right cluster of the map, press the *Add a roadmap group* button. It is the amber flowchart icon. The new stage drops, unlinked, in the middle of your current view.
- **By dragging from a stage**: every stage box has a small connector dot on its right edge. Drag that dot out into **empty canvas** and let go. The dialog opens pre-wired. The stage you dragged from becomes the new one's prerequisite, the stage that must finish first. The new box lands to its right. Drop the dot on an existing box instead and you just link the two.

However you add it, the map holds still. Nothing else moves, and the new stage glows blue for a moment so you cannot lose it. The new stage takes the next number. To renumber, press {{button:outline|Order stages}}. See *number and order roadmap stages*.

## Remove a line

Click any line between two stages. Right-click works too. A small menu names the link, for example "**Drill a well** → **make efficient water**", with **Remove link** in red. Press it and the prerequisite is gone. The downstream stage may unlock immediately. To see every link in one list instead, use the chain-links toolbar button.

:::example Building a chain
Drag from **Drill a well** into empty space, name the new box **Run water to the garden**, and it appears to the right of Drill a well with the line already drawn — the garden stage stays locked until the well is done.
:::

## Add tasks to a stage

1. Hover the stage box. Two tiny buttons sit on its right side. The **✎ pencil** edits the stage. Just below it, the **+** is *Add task to this group*.
2. Press **+**. The "Add task" dialog asks for the task title and, optionally, who it is assigned to. Tick one or more names, or type in the **search box** to filter the list. Enter ticks the only match.
3. {{button:blue|Save}}. The task appears inside the stage as its next number, such as 1.1 or 1.2. It shows on each assignee's list once the stage unlocks. An assignee is a person the task is given to.

## Staff a whole crew at once

Above the assignee list, the dialog shows a **crew chip** for every team on **People → Teams**. Each chip shows its member count.

- **Tap a chip** to tick everyone in that crew. Each name gets a small crew pill. Tap it again to untick them. Untick one person by hand and the chip turns dashed. Your manual picks always win.
- **＋ New crew** builds one without leaving the dialog. Name it, tick who is in it, and press {{button:blue|Save crew}}. It saves to People → Teams, so the same crew shows up everywhere. It comes back already ticked on this task.
- **✎ Edit**, or press-and-hold any chip, opens a crew for changes. Rename it, change its people, or **Delete crew…**. Deleting removes only the grouping, never the people.

:::example Two taps, four assignees
Tap **Farm crew** and all four members are ticked; untick the one who's out this week and the chip goes dashed to show a partial crew.
:::

## Tasks run in order

By default a stage is **step-by-step**. Its tasks go in their numbers' order, and only the next one appears on its assignee's list. The rest wait grayed out. Each shows *after 4.2*, and the person sees theirs in **⏳ Waiting For** with the name of who is ahead. The moment a step is completed, the next one lands on its assignee's list by itself.

If a stage is really a do-in-any-order checklist, switch it to parallel. Parallel means all at once. There are two doors to the same setting:

- **The ⚙ gear on the stage box** sits under the ✎ and ＋ buttons. A small menu offers ***→ In order, one at a time*** or ***⇊ All at once (parallel)***, with a checkmark on the current mode. One tap switches. Every open task goes out immediately.
- **The ✎ pencil** → **Tasks run** → **⇄ Any order** does the same from the edit dialog.

Parallel stages wear a small blue **⇊ parallel** badge. It shows on the Map box, the Plan stage header and the Timeline row. So you can tell at a glance which stages hand out everything at once. Switching back to **In order** pulls not-yet-due tasks off people's lists and returns them to ⏳ Waiting For. Finished work is never touched.

To see a stage's tasks on the map, press the **›** chevron at its left edge. Or press the ⌄⌄ *Show all* toolbar button to expand every stage. **Tap any task title** to open its card. There you can rename it, assign people or post a note. See *staff and discuss roadmap tasks*. **Press and hold** a task instead and it lifts to your finger. Drag it up, down or into another stage, exactly like the task boards. In full screen, the toolbar sits below your phone's clock. The **✕** at its end always brings you back.

:::example Unassigned is fine
You can add tasks with nobody ticked and staff them later from the task card — the card says "Not on anyone's list yet" until you do.
:::

## Move a task to another stage

**Press and hold any task row** and it lifts to your pointer. No special mode is needed. The toolbar's task-edit grip mode works too. While you carry it, the stage under your pointer lights up blue:

- **Drop between rows** in another stage to slot it in at that exact spot.
- **Drop anywhere on a stage box**, on its title, its edges, even a **collapsed** box. The task goes to the end of that stage. A dashed strip shows *Move here — becomes 7.3* while you hover.
- Let go over empty canvas, or press **Esc**, and nothing moves.

Dropping on a **different** stage asks first. A small card shows the task, where it is coming from, and the number it takes on arrival. Press {{button:blue|Move task}} or **Cancel**. Reordering inside the same stage never asks. The task keeps its people, notes and history. Only its number changes. Both stages renumber, and it follows the new stage's in-order rule.

## See a stage's neighborhood

Click any stage card, on its title or an empty spot on it, and the map focuses. The card gets a **blue ring**. The stages that must finish before it glow **amber**. The ones it unlocks glow **green**, wires included. Everything unrelated fades back. A small legend appears at the bottom while you are focused. Click the card again, click anywhere on the canvas, or press **Esc** to clear. Task rows still open their card as usual.

## Find anything on the map

Press the 🔍 search icon in the map's corner and type a stage title, a task or a person's name. The map answers as you type. **Stages with no hit fade back to 30%.** They keep their place, so the arrows still make sense. The **exact text that matched glows amber** inside the cards that stay lit. The panel counts the hits. **Show on map** pans to them. Clearing the search brings the whole map back.
