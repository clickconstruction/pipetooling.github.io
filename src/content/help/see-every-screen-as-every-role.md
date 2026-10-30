---
title: see every screen as every role
category: Office
roles: dev
keywords: what everyone sees, every screen, every role, lens, drawing, chart, overlapped, sealed frame, invented data, test data, sample company, style review, theme, dark mode, light mode, phone, tablet, desk, empty state, loading, failing, offline, training mode, gaps, open alone, settings
order: 67
---
**Settings → What everyone sees** draws any screen of the app as any role. The real app draws it, signed in as an invented person at an invented company. Nothing on the tab reads or writes a real row.

Use it to review the look of the app. Use it before a change to the theme, and after one, to see every screen at once.

## Pick who, where and the state

- **Who** picks a role. Each role is an invented person, such as Eli for the estimator and Hal for the helper.
- **Where** lists every screen that role can open. The list comes from the same gates the app uses. A screen the role cannot open is not on its list. For the dev, the list ends with each training lesson that has a drawing, under **Lessons**. The invented company has no course turned on. Only a dev can read a course that is off.
- **State** picks what the screen is going through. The states are Full, Empty, Loading, Slow, Failing, Offline and Training mode.

:::example The states, on any screen
Empty shows a company with no jobs yet. Loading never finishes, so you see the screen waiting. Failing makes every read fail, so you see the error words. Offline drops the connection. Training mode marks the person read only.
:::

## The customer's side

**Who, outside** holds the people outside the company. They are the homeowner, the general contractor, the subcontractor, the supply house and the collections law firm. Pick one and **Where** lists their pages.

Each page opens on its sample, the same one What customers see shows. A customer's page always stays light, so the frames are one row of widths. **Every screen** draws all of an audience's pages and checks them too.

Their emails, texts and papers are on [What customers see](/settings?tab=settings-what-customers-see).

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

Frames load one after another. The first one fetches the app, and the rest load it from memory. A frame that comes up empty loads once more by itself.

## Check every screen

Pick **Every screen**, then press {{button:blue|Check every screen}}. The tab draws the screens six at a time and checks each one as it settles. A checked screen makes room for the next, so the whole list gets checked while you watch.

Each check looks for five things:

- text that falls under 3 to 1 against what it sits on
- a word in a drawing or a chart that a line or a shape runs across
- a page that scrolls sideways
- a picture that does not load
- an error the screen caught

Text includes the words of a drawing or a chart. Each word is read against the shapes drawn under it, not only the page.

A screen with none of them wears {{chip:green|Clean}}. A screen with one wears what it found, such as {{chip:red|Scrolls sideways}}. The count line above the cards adds them up, such as *3 scroll sideways*. **Screens to look at** lists each one, and a tap on a name scrolls to its card.

Use it after a change to the theme. Pick Dark, press Check every screen, and every screen with text that is hard to read is on the list.

## Try a theme before it ships

Press {{button:outline|Theme draft}} to open every color the app's theme uses. Each one has its light value and its dark value. Change one and every frame on the tab redraws with it.

- **Draft** and **Current** flip between your change and the look that ships today.
- **Contrast, as you type** shows whether body text, muted text, links and the top bar stay readable. A pair under 4.5 to 1 turns red.
- {{button:blue|Copy as CSS}} copies the change as the lines a developer pastes into the app's style sheet.
- {{button:outline|Reset}} puts every color back.

The draft stays on this device until you reset it. Nobody else sees it.

Pair the draft with **Every screen**. Change a color, press Check every screen, and the count line says what your change broke.

## Why nothing here is real

Each frame is the real app in a sealed window. The frame's storage, requests and live updates stay inside the frame. A button you press in a frame works on the invented company. A reload puts the company back the way it was.

A preview a screen opens inside a frame is sealed too. A customer's sample page asks its edge function on the sample token alone.

