---
title: update the app when a new version is ready
category: Getting Started
roles: all
keywords: update, new version, reload, refresh, white screen, stale, fix app, hard reload
order: 4
---
ClickTooling updates itself. When a new version is ready, the app reloads onto it by itself at a quiet moment.

A quiet moment is one of these. You first open a page and have not touched anything yet. You move to another page or tab with nothing open. The browser tab has sat in the background five minutes or untouched half an hour. You see a brief pill while it happens:

:::example While it updates
Updating to the newest version…
:::

Nothing you were doing is lost. The app never reloads on its own while a window is open. It waits while a field has the cursor in it. It waits while something is still saving. On the settings blocks and the Form Studio, unsaved edits are kept in the tab while you work. If the app updates under them, they come straight back after the reload. A note says so. Save when ready. When it cannot find a quiet moment, it asks instead:

:::example The update pill
A new version is ready. {{button:blue|Reload}} Not now
:::

- **Reload** applies the update right away. The app refreshes once and brings you back where you were. Finish typing anything first. An unsaved form is lost on reload, just like a browser refresh.
- **Not now** hides the pill so you can keep working. The app leaves you alone for ten minutes, then takes the next quiet moment. The pill also comes back on its own. Closing and reopening the app picks up the update automatically.

The app also checks for new versions on its own about once an hour. It checks again when you return to a tab that has been sitting in the background. So a phone left open overnight finds the morning's update by itself.

## If a page ever fails to load

Right after an update, a page can occasionally fail to load its files. The app fixes this itself. You briefly see **Updating app…** and it reloads once automatically. If it still can't load, it shows a **Reload** button. If all else fails, use the fix-it page:

1. Go to `/fix-cache.html`. It is also linked from **Settings** as **Fix app**.
2. Click **Fix app**. It clears the app's caches and reloads fresh.

## Force a fresh copy any time

Open the {{icon:gear}} **gear menu** in the top-right of the header and choose **Hard Reload**. This clears cached files and reloads the newest version, then returns you to the page you were on.
