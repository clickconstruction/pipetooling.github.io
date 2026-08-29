---
title: fix the app when it won't load
category: Getting Started
roles: dev, master_technician, assistant, controller, estimator, helpers, subcontractor
keywords: loading, stuck, black screen, white screen, blank, crash, cache, fix, offline, reload
order: 3
---
If the app opens to a stuck **Loading…** screen or a blank page, work down this list — each step fixes a different cause.

## 1. Close and reopen

Fully close the app (or the browser tab) and open it again. On phones, swipe it away from the app switcher first. This clears most one-off hangs.

## 2. Wait a few seconds on the Loading screen

If loading is slow, the screen offers a **Taking too long? Fix the app** link after a few seconds, and after about 8 seconds the app stops waiting and shows the sign-in screen on its own. If the whole office is stuck at the same time, the server is likely having trouble — that usually resolves within minutes and your data is safe; try again shortly.

## 3. Run the repair page

Go to **clicktooling.com/fix** in your phone or computer browser and tap {{button:blue|Fix app}}. It clears the app's cached files and storage so the next load starts fresh. Then reload and sign in again.

:::example Nothing at /fix?
If that address doesn't open the repair page on your device, use the long form: **clicktooling.com/fix-cache.html** — it works everywhere.
:::

## Notes

- The repair page never touches job data — everything lives on the server. You only re-enter your sign-in.
- Still stuck after all three steps? Tell the office/dev team **what you see and the time it happened** — that makes it fast to find in the server logs.
