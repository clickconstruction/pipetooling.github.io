---
title: trust estimate drafts to save themselves
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: estimate autosave, draft saved, lost work, hard reload, save draft, change order draft, autosaved
order: 64
---
Draft estimates and change orders **autosave** while you work — you don't have to press {{button:outline|Save draft}} to be safe.

## How it works

- About a second and a half after you stop typing, the draft saves itself. A small **Autosaved** note appears next to the {{button:outline|Save draft}} button.
- **Switching away saves immediately.** Jump to another tab to look something up, come back whenever — the draft saved the moment you left.
- Reloading the page — even a hard reload — brings back exactly what you had. Your work lives on the estimate, not in the browser tab.

:::example Running around mid-estimate
You're pricing a pool liner job and need the customer's gate code from a text thread. You switch to Messages, get pulled into two other things, and come back twenty minutes later after a reload. The line items, option names, and pitch you'd written are all still there.
:::

## A draft you never touch disappears

{{button:blue|New estimate}}, {{button:outline|New change order}} and a Projects card's **+ Estimate** open a fresh draft right away so you can start typing. If you leave that draft without typing anything — no title, no customer, no priced line, no terms — it removes itself on the way out. The first real edit (which autosaves), {{button:outline|Save draft}}, or sending keeps it.

:::example Opened one by mistake
You press New estimate, realise the customer already has one, and go back to the list. Nothing is left behind — the list shows exactly what it showed before.
:::

Drafts you opened from the list are never removed this way, and a draft with anything typed into it stays. Empty drafts left over from before (or from a tab closed mid-way) still collapse behind the Pipeline's **Clean up empty drafts** button.

## If autosave can't save

- If a save fails (bad connection, for instance), the note turns into **Autosave failed — press Save draft**. Fix the connection and press {{button:outline|Save draft}} yourself.
- A Supporting document link that isn't a valid https address pauses autosave until you correct it — an invalid link is never saved onto the estimate.

{{button:outline|Save draft}} still works exactly as before, and sending to the customer always saves first.
