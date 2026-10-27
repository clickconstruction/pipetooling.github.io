---
title: see every screen as every role
category: Office
roles: dev
keywords: what everyone sees, every screen, every role, lens, sealed frame, invented data, test data, sample company, style review, theme, dark mode, light mode, phone, tablet, desk, empty state, loading, failing, offline, training mode, gaps, open alone, settings
order: 67
---
**Settings → What everyone sees** draws any screen of the app as any role. The real app draws it, signed in as an invented person at an invented company. Nothing on the tab reads or writes a real row.

Use it to review the look of the app. Use it before a change to the theme, and after one, to see every screen at once.

## Pick who, where and the state

- **Who** picks a role. Each role is an invented person, such as Eli for the estimator and Hal for the helper.
- **Where** lists every screen that role can open. The list comes from the same gates the app uses. A screen the role cannot open is not on its list.
- **State** picks what the screen is going through. The states are Full, Empty, Loading, Slow, Failing, Offline and Training mode.

:::example The states, on any screen
Empty shows a company with no jobs yet. Loading never finishes, so you see the screen waiting. Failing makes every read fail, so you see the error words. Offline drops the connection. Training mode marks the person read only.
:::

## Pick what varies

**Across** picks the one thing that changes from frame to frame. The other choices hold still.

- **Widths and themes** draws six frames. The frames are phone, tablet and desk, light on top and dark below.
- **Roles** draws one screen as all nine roles. A role that cannot open the screen shows its dashboard instead, and the frame says so.
- **States** draws one screen in all seven states.
- **Every screen** lays out every screen the role can open, one card each.

## What each frame tells you

Each frame shows how many questions the screen asked. A question is answered from the invented company, by a rule, or not at all. A question with no answer is a **gap**. The screen shows its own error words there, and {{chip:red|1 gap}} lists it under the frame.

- {{button:outline|Reload}} draws the frame again from the start.
- {{button:outline|Open alone ↗}} opens the frame in its own tab. That tab is sealed too, and a small mark in the corner says so.
- {{button:outline|Draw it}} brings a frame to life. At most six frames are drawn at once, and one on a phone.

## Check every screen

Pick **Every screen**, then press {{button:blue|Check every screen}}. The tab draws the screens six at a time and checks each one as it settles. A checked screen makes room for the next, so the whole list gets checked while you watch.

Each check looks for four things:

- text that falls under 3 to 1 against what it sits on
- a page that scrolls sideways
- a picture that does not load
- an error the screen caught

A screen with none of them wears {{chip:green|Clean}}. A screen with one wears what it found, such as {{chip:red|Scrolls sideways}}. The count line above the cards adds them up, such as *3 scroll sideways*. **Screens to look at** lists each one, and a tap on a name scrolls to its card.

Use it after a change to the theme. Pick Dark, press Check every screen, and every screen with text that is hard to read is on the list.

## Why nothing here is real

Each frame is the real app in a sealed window. The frame's storage, requests and live updates stay inside the frame. A button you press in a frame works on the invented company. A reload puts the company back the way it was.

The customer's pages, emails and texts are on [What customers see](/settings?tab=settings-what-customers-see).
