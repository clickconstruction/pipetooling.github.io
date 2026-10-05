---
title: trust estimate drafts to save themselves
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: estimate autosave, draft saved, lost work, hard reload, save draft, change order draft, autosaved
order: 64
---
Draft estimates and change orders **autosave** while you work. You don't have to press {{button:outline|Save draft}} to be safe.

## How it works

- About a second and a half after you stop typing, the draft saves itself. A small **Autosaved** note appears next to the {{button:outline|Save draft}} button.
- **Switching away saves immediately.** You can jump to another tab to look something up and come back whenever. The draft saved the moment you left.
- Reloading the page brings back exactly what you had, even a hard reload. Your work lives on the estimate, not in the browser tab.

:::example Running around mid-estimate
You're pricing a pool liner job and need the customer's gate code from a text thread. You switch to Messages, get pulled into two other things, and come back twenty minutes later after a reload. The line items, option names, and pitch you'd written are all still there.
:::

## A draft you never touch disappears

{{button:blue|New estimate}}, {{button:outline|New change order}} and a Projects card's **+ Estimate** open a fresh draft right away. You can start typing at once. You may leave that draft without typing anything: no title, no customer, no priced line, no terms. Then it removes itself on the way out. The first real edit keeps it, and that edit autosaves. {{button:outline|Save draft}} or sending keeps it too.

:::example Opened one by mistake
You press New estimate, realise the customer already has one, and go back to the list. Nothing is left behind — the list shows exactly what it showed before.
:::

Drafts you opened from the list are never removed this way. A draft with anything typed into it stays. Some empty drafts are left over from before, or from a tab closed mid-way. Those still collapse behind the Pipeline's **Clean up empty drafts** button.

## If autosave can't save

- If a save fails, say on a bad connection, the note turns into ***Autosave failed — press Save draft***. You fix the connection and press {{button:outline|Save draft}} yourself.
- A Supporting document link that isn't a valid https address pauses autosave until you correct it. An invalid link is never saved onto the estimate.
- An **Expires on** date with its year half typed is not saved. Half typed means `26` for 2026, or a pause part way through. The rest of the draft saves, and a line says so. The draft keeps the date it had. On a change order, a half-typed **Response requested by** date holds the description, reason and schedule lines with it. You finish the year and it all saves. Sending waits for a finished date too.

{{button:outline|Save draft}} still works exactly as before. Sending to the customer always saves first.
