---
title: update the app when a new version is ready
category: Getting Started
roles: all
keywords: update, new version, reload, refresh, white screen, stale, fix app, hard reload
order: 4
---
ClickTooling updates itself. When a new version has been released, the app reloads onto it by itself at a quiet moment — when you first open a page and have not touched anything yet, when you move to another page with nothing open, or when the tab has sat in the background five minutes or untouched half an hour. You see a brief pill while it happens:

:::example While it updates
Updating to the newest version…
:::

Nothing you were doing is lost: the app never reloads on its own while a window is open, a field has the cursor in it, or something is still saving. On the settings blocks and the Form Studio, unsaved edits are kept in the tab while you work, so if the app updates under them they come straight back after the reload with a note saying so — save when ready. When it cannot find a quiet moment, it asks instead:

:::example The update pill
A new version is ready. {{button:blue|Reload}} Not now
:::

- **Reload** — applies the update right away. The app refreshes once and brings you back where you were. Finish typing anything first: an unsaved form is lost on reload, just like a browser refresh.
- **Not now** — hides the pill so you can keep working. The app leaves you alone for ten minutes, then takes the next quiet moment; the pill also comes back on its own, and closing and reopening the app picks up the update automatically.

The app also checks for new versions on its own about once an hour, and when you return to a tab that's been sitting in the background — so a phone left open overnight finds the morning's update by itself.

## If a page ever fails to load

Right after an update, a page can occasionally fail to load its files. The app fixes this itself — you'll briefly see **Updating app…** and it reloads once automatically. If it still can't load, it shows a **Reload** button; and if all else fails, use the fix-it page:

1. Go to `/fix-cache.html` (also linked from **Settings** as **Fix app**).
2. Click **Fix app** — it clears the app's caches and reloads fresh.

## Force a fresh copy any time

Open the {{icon:gear}} **gear menu** in the top-right of the header and choose **Hard Reload**. This clears cached files and reloads the newest version, then returns you to the page you were on.
