---
name: "People → Hours: someone still on the clock has a green box that opens My Time"
number: 446
group: close
status: asked 2026-11-25 with a screenshot of the table's head · read in the code, drawn and checked against the ask the same day · built 2026-11-25 as v2.8602, one client-only PR · not yet walked on the live site
mockup: to-dos/hours-on-the-clock-box/mockup.html
summary: >
  On People → Hours a person who was still clocked in showed an empty box that took typing,
  while the column's head said +2 on the clock. Now that person's box for the day is green,
  reads the day so far to the minute with the words on the clock, and is a press that opens
  their My Time. It is never a field, so nothing can be typed under a running session by
  accident. The row, day and week totals count the running time and read in green. A
  salaried day keeps its set hours. A session nobody clocked out of on an earlier day is
  amber, says left open and adds no time.
next: The walking thread walks it on the live site with a ZZ Test person clocked in. Then the owner looks at it on a day with people on the clock, and the card is deleted.
ask: owner · look · On a day with people on the clock, do the green boxes and the green totals on People → Hours read the way you meant?
size: S, built; left: the live walk and the owner's look (XS)
ver: v2.8602
blocker: A live walk, which needs a ZZ Test person clocked in.
opinion: build — it is what was asked, with no migration and no function
---

# People → Hours: a green box for someone still on the clock (#446)

## The ask

The owner, 2026-11-25, looking at People → Hours, with a screenshot of the table's head where a
day read *+2 on the clock* over a row of empty boxes:

> I like how it works, it works well. Sometimes there are people still on the clock. I would
> like to be able to see those people still on the clock in the Table of boxes, but with their
> box being green, where clicking on it brings up their my time card, rather than immediately
> being able to edit them. This way I can't accidentally edit or break something by editing via
> that menu someone who is still on the clock. Yet I can clearly see they're accruing time
> against everyone else's.

He asked for a plan, a mock-up and the question *is this the best we can do*, and said to build
it if it was reasonable and to show it to him first if it was not what he said.

## What was there

- The grid's figure is closed sessions only. A person on the clock showed an empty field.
- A field commits on blur. Tabbing through it wrote a `people_hours` row of 0 hours under a
  running session. A typed number was caught a step later by a toast that opened My Time.
- Approval adds a session's length to `people_hours`. It does not replace the row. So hours
  that reached the row before the clock-out would have been counted twice.
- The column's head said *+N on the clock* (v2.2915). Nothing in the table said who.

## The decision, point by point

| Point | What was built |
|---|---|
| What the green box shows | The whole day so far to the minute: the day's saved hours plus the running time. Under it, the words *on the clock*. The words, the H:MM form with no seconds and the button's shape say it without colour. It reads the clock again every 30 seconds. |
| What a press does | Opens that person's My Time for the day, the card they see on their own Dashboard. Opening it writes nothing. |
| What the office can do there | Put the session on a job, split it, adjust its times, Force clock out. Each is a named press with its own window and save. That card already knows an open session, so it is the right guard. |
| Totals | The row, day and week totals count the running time. A total with running time in it is green, reads H:MM, and a row's names the running part under it. Its tooltip keeps the settled part apart. |
| Saved hours and on the clock the same day | One figure, the day so far. The amber pending badge of the closed session stays beside the box. |
| Crossed midnight | Cannot stay open. The database clocks everyone out at 11:59 PM, and the session lands as pending. |
| Salaried | The day's set hours stay, in grey, and add nothing to a total. The box is still green and says *on the clock*. |
| A day outside the week shown | No column, so no box. The clock strip and the phone's Who's in still show the person. |
| Left open since yesterday | A fault, not time accruing. Amber, *left open*, *no clock-out*, no time added, and a press opens My Time for Force clock out. When it started is in the tooltip. The head reads *1 left open*. |
| Phone | A green cell fills the cell and a tap opens My Time with no day sheet between, so there is no hours box. |
| Read-only users | The same box and the same card. No write is added and one is taken away. |
| Clocks out while the page is open | The page hears the change and the cell is an ordinary box again in under a second, with the amber pending badge. |
| The head's *+2 on the clock* | Kept. It still says how many when the rows scroll. Its tooltip now says the boxes are green and the totals count the time. |
| Keyboard | The box is a button in the tab order where the field was. Enter or Space opens My Time. Focus comes back to the box when the card closes. |

## The pass: is this the best we can do?

Three things in the first drawing were weak and were changed before the build.

1. **The pending badge covered the figure.** A person with a closed morning and a running
   afternoon has the amber badge on the cell's top right corner, over the figure. The box's
   lines now sit to the left when the badge is there.
2. **A salaried figure in bold green read like time accruing.** It is the day's set hours and
   does not move. It now stays grey inside the green box.
3. **A left-open session was drawn with a figure and counted in a green total.** That would
   have put sixteen hours of nothing into the week. It now shows no figure and adds no time.

One thing is said and not fixed: on a phone, a green cell that also has a closed session
waiting on approval no longer shows *1 pending* under it, because one cell is one tap target.
That session is still in the phone's Approvals view and in the amber banner.

One choice the owner may want the other way: the totals count the running time. The other way
is to leave every total settled and write *+7:38 on the clock* under it. The first compares a
person on the clock with a person who has left at a glance, which is what was asked for.

## Where it plugs in

- `src/lib/people/hoursGridLiveByCell.ts`: the cells, the running time, the box's words, the
  day summary, the head and total words. `src/lib/people/hoursGridTime.ts`: `decimalToHm`.
- `src/components/people/PeopleHoursGridLiveBox.tsx`: the box, desktop and phone.
- `src/components/people/PeopleHoursGrid.tsx`: the cell, the totals, the head, the tick, the
  focus hand-back, the day sheet.
- `src/pages/People.tsx`: the memo and the two props.
- Nothing in the database and no edge function.

## How to verify

The mock-up beside this file moves the clock and clocks a person out.

On the live site, as a dev, with a ZZ Test person who has a pay row and a login:

1. Clock the ZZ Test person in. Open People → Hours on this week.
2. Read today's cell on their row: green, a time in H:MM, *on the clock*. Read the row's total
   and the foot: green, with *N:NN on the clock* under the row's.
3. Tab to the box. It takes focus where a field would. Press Enter. My Time opens for that
   person and today, with the session running. Close it. Focus is back on the box.
4. Wait a minute. The box and the totals move on by one.
5. Clock the person out. Within a second or two the cell is an ordinary box with the session's
   hours and the amber *!1* badge, and the totals are black again.
6. Narrow the window under 640 px, or use a phone, and tap the cell while they are clocked in:
   My Time opens, and no sheet with an hours box.
7. Switch to dark and read the box again.
8. Reject or delete the ZZ Test session so nothing is left behind.
