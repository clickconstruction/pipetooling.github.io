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

Nothing you were doing is lost. The app never reloads on its own over words you typed. A message, a note or a report you have not sent stays on the screen. Those words stay until you send or clear them, however long the tab sits. The app never reloads on its own while a window is open. The app waits while a field has the cursor in it. The app also waits while something is still saving. The app checks all of this again at the moment it reloads. If you touched the page in between, it does not reload. Your other open tabs are not reloaded with it. Each tab takes its own quiet moment. On the settings blocks and the Form Studio, unsaved edits are kept in the tab while you work. If the app updates under them, they come straight back after the reload. A note says so. Save when ready. When the app cannot find a quiet moment, it asks instead:

:::example The update pill
A new version is ready. {{button:blue|Reload}} Not now
:::

- **Reload** applies the update right away. The app refreshes once and brings you back where you were. A reload clears words you typed and have not sent, just like a browser refresh. So **Reload** asks first when the page holds such words.
- **Not now** hides the pill so you can keep working. The app leaves you alone for ten minutes, then takes the next quiet moment. The pill also comes back on its own. Closing and reopening the app picks up the update automatically.

The app also checks for new versions on its own about once an hour. It checks again when you return to a tab that has been sitting in the background. So a phone left open overnight finds the morning's update by itself.

## When you press Reload over words you typed

The app does not reload yet. The app takes you to each place you typed. Each place shows an orange ring for a second. If you typed in several places, the page moves from one to the next. Then the pill offers two presses:

:::example The update pill over words you typed
Reloading clears what you typed. {{button:amber|Reload anyway}} Not now
:::

- **Reload anyway** reloads the app, and your words are gone. Press it only when you do not need them.
- **Not now** keeps your words. Send or clear them, and the app updates at the next quiet moment.

Touch anywhere else on the page and the pill goes back to **Reload**. Your words stay where they are.

Two other presses ask the same way. One is **Hard Reload** in the gear menu. The other is **Reload** on a page that could not load. The app takes you to each place you typed. Then a small bar offers **Reload anyway** and **Not now**.

## If a page ever fails to load

Right after an update, a page can occasionally fail to load its files. The app fixes this itself. You briefly see **Updating app…** and it reloads once automatically. If something is still saving, it waits for that first. If it still can't load, it shows a **Reload** button.

The app never reloads by itself over words you typed. A message or a report you have not sent stays on the screen. It stays until you send it or clear it. While it is there, the app shows the **Reload** button and waits for you.

A window can fail to load the same way, for example a job you pressed on a list. Then only the window gives up. The page behind it stays as it was. An amber line tells you:

:::example When a window cannot load
The job could not open. Check your signal, then press it again.
:::

Press the same row again once you have a signal.

When your signal is back, the app mends the page by itself. It reloads once, and your next press opens the window. It waits while a window is open, while a field has the cursor in it and while something is saving.

It also waits while words you typed are on the page. Then the amber line tells you what to do:

:::example When you have typed words on the page
The job could not open. The app must reload first, and it will not reload over what you typed. Send or clear it, then press again.
:::

Send your message or clear it. The app reloads soon after, and the press opens the window.

If all else fails, use the fix-it page:

1. Go to `/fix-cache.html`. It is also linked from **Settings** as **Fix app**.
2. Click **Fix app**. It clears the app's caches and reloads fresh.

## Force a fresh copy any time

Open the {{icon:gear}} **gear menu** in the top-right of the header and choose **Hard Reload**. This clears cached files and reloads the newest version, then returns you to the page you were on.

**Hard Reload** clears words you typed and have not sent. So it asks first when the page holds such words. See [When you press Reload over words you typed](#when-you-press-reload-over-words-you-typed).
