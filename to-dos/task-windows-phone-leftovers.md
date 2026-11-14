---
name: "Tasks on a phone: what the New task walk left"
number: 348
group: close
status: carried from #331 when it closed 2026-11-13 · built the same day on the owner's word *build the leftovers* · PRs 1 to 4 open as #8003, #8008, #8009 and #8012 · rows 9 and 10 built in v2.7203 on the owner's word *Yes, build both* · left: a walk of two sheets on a phone, and Grace's two notes
summary: >
  Punch list #331 redrew the window that gives a task, and its close-out walk in the iPhone
  simulator fixed the one thing that broke it: the window leaving the top of the screen when the
  keyboard came up. The same walk saw thirteen smaller things in and around the task windows. One is
  a fault: on a phone the three-dot menu of the last task on Manage is cut off, so Delete cannot be
  reached. Three sheets are still pinned to the page the way the task window was. The rest are
  words that read wrongly and rows that run past one phone screen. Two notes of Grace's from #331
  ride along, waiting on her word. No database change in any of it.
next: The five PRs merge. Then someone at a phone opens a Messages sheet and the Dispatch job picker with the keyboard up, to see each stay on screen. Grace's two notes wait on her word.
size: M as five small PRs (S · S · XS · S · S), built; left: a walk on a phone
blocker: a person at a phone for the walk, and Grace's word for her two notes.
ver: v2.7155 · v2.7203
opinion: close it after the walk — every row that could be built is built, and the two sheets left unwalked take the same two numbers the walked ones do
mockup: not required — each row is a fix to a screen that exists, found on a walk
---

# Tasks on a phone: what the New task walk left (#348)

## Where this comes from

Punch list #331 closed on 2026-11-13 on the owner's word. Its last step was a walk of **New task**,
**Edit task** and the roadmap's **Add task** in the iOS Simulator: an iPhone 17 Pro on iOS 26.4,
Safari, the on-screen keyboard up. The walk and its fix are in
[docs/recent-features/v2.7155.md](../docs/recent-features/v2.7155.md).

The walk also saw the rows below. None was a reason to keep #331 open, and none has a home
without this card. Every one was seen on the simulator, not on a phone in a hand.

## The rows

### PR 1 · Manage on a phone (S)

1. **The ⋮ menu of the last task is cut off.** The menu opens under its press, inside the list
   (`position: absolute; top: 80%` in `src/pages/Checklist.tsx`). The list's edge cuts it, so on the
   last task, or the only one a search finds, the top of *Edit* shows and *Delete* cannot be
   reached. The fix is a menu that opens upward when there is no room below, or one drawn over the
   page instead of inside the list.
2. **"No tasks yet." over an error.** When the list fails to load, Manage draws the error and,
   above it, *No tasks yet. ＋ New task adds the first.* Both cannot be true. With an error on the
   page the empty line should not draw.
3. **A task only for its giver reads *notifies on done*.** The bell is hidden in the window when
   the task is only yours, but the stored tick stays on, and Manage's chip reads it. The chip
   should stay off when the giver is the only one who has the task.

### PR 2 · The sheets follow the keyboard (S)

4. **Where is it?** (`TaskPlaceSheet`) is pinned to the page. With the keyboard on the place's
   name, Safari slides the page and the sheet's title and *Cancel* leave the top. The name and
   **Use this place** stay in view, so the place can still be saved.
5. **`PhoneSheet` and the dispatch job picker** read `useVisualViewportHeight`, which hears the
   keyboard take room but not the page slide. They were not walked. They should take
   `useVisualViewportBox` and `taskWindowPhoneFrame` as the task window did, and be walked.

### PR 3 · Words (XS)

6. **The roadmap's sentence doubles a full stop.** A stage named *North fence.*
   reads "It joins the stage North fence.. Nobody has it yet."
   (`roadmapTaskSentence` in `src/lib/tasks/newTaskWindow.ts`). Drop the stage name's own last
   full stop before the sentence adds one.
7. **Edit task tells a one-time task about days to come.** Every Edit task shows "Saving reshapes
   the days still to come. The ones already done keep their notes." That is about a task that
   repeats. A one-time task should not show it.

### PR 4 · Rows that pass one phone screen (S, wants a pick)

8. **Someone else's names sit under the bar.** With the keyboard up, the search box lands just
   above the bar and the names it finds are below it until the rows are swiped. The box could be
   brought to the top of the rows when it takes the keyboard.
9. **Done when…'s hint is five lines on a phone.** Open, it pushes the window past one screen.
   A shorter hint, or one behind a press, would keep it to one.
10. **Pick a day's four weeks** open under the bar and push Where and Add below the screen. The
    iPhone's own calendar already opens from the date. On a phone the four weeks could wait for a
    task that repeats.
11. **A narrow screen or larger text.** At 322 px wide, *Repeats* is cut at the edge of the When
    bar and the Add row takes four lines. Safari's text at 125% on a current iPhone is that wide.

### Seen, and left alone unless someone asks

12. **Opening.** The roadmap's Add task raises the keyboard as it opens. New task rings its box
    and waits for a tap. An iPhone only raises the keyboard inside a tap, so this may be the
    phone's rule and not ours.
13. **After turning the phone and back**, Safari draws the bar's Send words larger. It is the
    browser's own text sizing.

## Waiting on Grace's word (carried from #331)

- **An old task's sentence in Edit task** reads like *Theo gets it on Tue, Feb 17.* for a day long
  past. *has had it since Tue, Feb 17.* may read better. Wording only.
- **The faces do not hold everyone.** Replayed on the record, Me and the last four people covered
  87 of 137 tasks, and the rest press **Someone else** first. Count it again after two weeks of
  use before changing anything.

## What I would not claim

- **None of this was seen on a real phone.** The simulator's Safari and keyboard are Apple's own.
  A phone in a hand, a small iPhone and Android were not walked.
- **Row 5 is a reading of the code**, not a sighting. The two sheets use the hook that missed the
  slide. Whether a field in them sits low enough to cause it has to be walked.
- **Row 1 was seen once**, on a list a search had cut to one task. It follows from where the menu
  is drawn, so it should hold for the last task of any list.

## The build

| PR | What | Size |
|---|---|---|
| 1 | Manage on a phone: the ⋮ menu reaches Delete, no empty line over an error, no *notifies on done* on a task only for its giver | S |
| 2 | Where is it?, `PhoneSheet` and the dispatch job picker follow the keyboard's slide, each walked in the simulator | S |
| 3 | The roadmap sentence's full stop, and Edit task's hint only on a task that repeats | XS |
| 4 | Someone else's names, the Done when… hint, Pick a day's four weeks and the narrow When bar, after a pick | S |

## Where it stands

Built 2026-11-13 on the owner's word *build the leftovers*. Each PR carries its release note and its fragment, and this card is not edited by any of them.

| PR | Rows | What was built | Checked |
|---|---|---|---|
| #8003 | 1, 2, 3 | The ⋮ press and its menu are one piece, drawn over the page. It opens above its press when there is no room under it. No empty line draws beside a load error. A task only for its giver no longer reads *notifies on done*. | On the local app at phone size: the menu of the last task opened upward with *Delete* in reach. |
| #8008 | 4, 5 | Where is it?, `PhoneSheet` and the dispatch job picker fill the part of the page that shows. The place sheet's map gives way so the name and **Use this place** stay above the keyboard. | Where is it? walked in the iPhone simulator with the keyboard up. The other two are covered by tests and were not walked. |
| #8009 | 6, 7 | The roadmap sentence closes a stage name once. Edit task shows its line about days to come only on a task that repeats. | Tests. |
| #8012 | 8, 11 | The Someone else search box goes to the top of the rows when it takes the keyboard. The When bar's words tighten on a narrow screen. | Both walked in the iPhone simulator, the bar at 125% text. |
| v2.7203 | 9, 10 | The Done when… hint is one line in each window. On a phone the four weeks draw only for a task that repeats. | Measured on the local app at phone size: with Done when… open the window no longer scrolls, and Pick a day shows the date box alone. |

**Left.**

- **Row 5** wants a walk of `PhoneSheet` and the dispatch job picker on a phone. Reaching them means a real person's thread or Dispatch mode, so it was left for someone at a phone.
- **Rows 12 and 13** are left alone, as written.
- **Grace's two notes** below still wait on her word.

To walk a phone window in the simulator, switch its on-screen keyboard on first. It is hidden
until this is run once for the device, and a field is tapped again:

```bash
xcrun simctl spawn <udid> defaults write com.apple.Preferences AutomaticMinimizationEnabled -bool NO
```

Run Vite with `--host 127.0.0.1`, since the simulator's Safari does not reach `localhost`. For a
narrow room on one device, Safari's page menu has a larger-text press: 125% is 322 px wide.
