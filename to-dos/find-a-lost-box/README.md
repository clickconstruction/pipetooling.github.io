---
name: "Find a lost box: show where a cage or box was last put, and draw the way to it"
number: 372
group: close
status: asked 2026-11-16 · the card the same day · the mock-up 2026-11-17 · call 1 answered the same day (*Yes, cage or box*) · the owner's word the same day (*Build all the steps*), taken as the train of five with every other call at the card's pick · all five steps built and tested the same day · steps 1 and 2 and the way's column merged (#8503, #8510, #8511), both migrations on the live database · all five steps walked on a test job in a local browser · step 3 in this PR · the way's screens and step 5 built, each waiting its turn · not tried on a real phone
summary: >
  The owner wants the app to show someone where their crate is when it is lost, and to draw a path
  to where they can find it. The app has no crate: this card takes it to mean a cage or a box from
  Materials on site, and he confirmed that on 2026-11-17. Read against what is live, the path has nowhere to
  end today. A box can carry a pin on the site map, and of the 96 live cages and boxes read on
  2026-11-16 none has one. So the first job is the spot, not the line. The card proposes a sheet on
  the box, Where is it?, that says everything the app knows (the place, the where note, the newest
  photo, who touched it last), draws the reader's own dot and a straight line to the pin with an
  honest distance, and ends with I found it, which pins the box where the finder stands. A way
  painted once to each place where boxes stand (#345) is the path that knows about gates and
  fences, and a task carries it to someone who is not on the crew.
next: The rest of the train lands one PR at a time: step 3, then the way's screens once the way's migration is pushed, then step 5, which closes the card's table. Then the owner's try on a real phone, which is step 0 and more: pin five boxes on a test job with I found it, some outdoors and some inside, walk away and press Show where I am, lock the phone mid-walk, and read what the sheet says indoors. Calls 2 to 11 stay his to change.
size: L as a train of five (S · M · S · M · S), on the card's picks; left: three PRs to land and a real phone (S)
blocker: None to build. The merge queue, one PR at a time. Nothing here, and nothing in Paint a map (#345) that it stands on, has been tried on a real phone.
opinion: build — built on the owner's word. Whether it is used turns on crews pinning boxes, which step 3 asks for and a count of pinned boxes will show.
---

# Find a lost box (#372)

## The ask

The owner, 2026-11-16:

> to add the feature to show someone where their crate is if it is lost and draw a path to where
> they can find it

He said no more than that. He asked for it on the punch list and not built now. This card is the
reading, the smallest thing worth building, what it would cost, and his calls.
[mockup.html](mockup.html) draws the smallest version worth building on made-up data. It was drawn
on 2026-11-17, while the calls were put to him.

On 2026-11-17, with call 1 answered, he said:

> Build all the steps

**So the train is built.** *What is built* below says what went in and what differs from this
card. The sections above it are the card as it was written, kept for the reasons behind each
choice.

## What I took it to mean

- **A crate is a cage or a box from Materials on site (#209).** The app has no *crate*. It has
  *cages* and *boxes*, each with a stencil such as A1, on a job (`job_containers`, kinds cage, box
  and loose). I found the word *crate* nowhere in the app, the guides or the cards.
- **Someone is a person on that job's crew, or the office.** They need A7, they are on the site,
  and they do not know where it stands.
- **Lost means the person asking does not know.** The app may know. It shows where the box was
  last put, by whom and on what day.
- **A path is a line on the view from above,** from where the person stands to the box.

The first was confirmed by the owner on 2026-11-17 (call 1). The other three are still guesses.

## What the app knows about where a box is, today

Read on main, 2026-11-16.

- **A box answers *where* three ways.** A **place** it stands in, by name (`job_places`: *Level
  2*, *the laydown yard*). A **where note** in the crew's words, up to 120 letters (*by the north
  stair*). A **pin** on the site map (`lat` and `lng` on the box's own row).
- **The pin is set by hand on the phone.** On a box, **Pin on map**, then **Use my location** or
  drag the map until the ring sits on it, then **Put A1 here** (`pinContainer` in
  `src/lib/materials/onSiteStore.ts`). **Map** on the On site tab draws the pinned boxes on the
  view from above, with the job's painted maps under them (`OnSiteMap`, `TallyOnSiteTab`).
- **The pin keeps no day, no person and no margin.** A move between places is recorded with who
  and when (`job_container_moves`). A pin is two numbers on the row and nothing else. So the app
  cannot say *pinned three weeks ago*, and for a lost box that is the fact that matters.
- **Nobody pins.** The dev seat read the live cages and boxes on 2026-11-16, counts only. Of 96,
  **none has a pin.** 92 have a place, and **86 of those share one place.** The #345 card read 0 of
  102 on 2026-11-12. So a place narrows little, and no box has a point a line could end on.
- **A box is found by typing.** The header search finds a box by its stencil, its line of words,
  its place and its parts, for the office and the crew alike. For a field role the row opens the
  box on the phone's On site tab (`boxDoors` in `src/lib/materials/boxSearch.ts`).
- **The box has no Directions and no *How far am I?*.** A task's place has both (#328).
- **The app can follow a phone now.** Paint a map (#345) reads a walker's phone while a red bar
  says Painting, and its shared page has **Show where I am**. Both work only with the screen on.
- **A box cannot say it is lost.** **Can't find** is a press on one part's line in a box. There is
  no press for a whole box that is not where the app says.
- **Signed out, a scanned label says almost nothing, on purpose.** The box page answers the box's
  name, its kind and the office's number (`box-read`). Taunya closed the place, the photo and the
  contents on 2026-11-15, because they were *a list of what is worth taking and where*, open to a
  photo of a label. This card keeps that door closed.

## Who can read a map, which decides where a path can live

Checked in `supabase/migrations/20261113220000_painted_maps.sql` and
`20261115063000_task_painted_maps.sql`.

- **A map on a job is read by the job's crew and the office.** Its gate is
  `on_site_can_touch_job`, the same function that gates the job's boxes. So whoever can read a box
  can read a map on that box's job. **The box's job is the home that costs nothing.**
- **A map on no job is read by its maker and the office.** A way to a box painted from the search
  door, on no job, would be read by nobody on the crew.
- **A map on a task is read by whoever reads the task** (`painted_map_id` on the task, since
  v2.7340). That is how a person who is not on the crew gets a map today. A task may point only
  at a map its giver can open.
- **Anyone who reads a map may add a line or a place to it,** signed as themselves. Only its maker
  and the office may rename it or throw it away.

## What *draw a path* can honestly be

Three different things, cheapest first. They stack.

1. **A straight line from you to the pin, with a distance.** *About 240 ft, give or take 20 ft.*
   It moves as the person walks with the screen on. It knows no wall, fence, floor or gate. It is
   the compass, not the route. No new table.
2. **A way that somebody painted.** A person who knows the site walks or draws the way from the
   gate to a place where boxes stand, once. It is a painted map on the job. It knows the gate and
   the fence because a person drew them. It leads to a place, not to one box, so one map serves
   every box in the laydown yard.
3. **A route the app works out** along the job's painted lines, from where you stand to the box.
   It needs painted lines that join up, and a kernel that walks them. Later, and only if 1 and 2
   are used.

**Said plainly, the limits:**

- **About 16 ft under open sky, worse beside a building.** That is #345's own finding. A line can
  put a box on the wrong side of a fence.
- **Indoors the phone is lost, and a phone knows no floor.** Many boxes stand inside: a corridor,
  a cage room, a garage. The line gets a person to the right side of the right building. The
  place, the where note and the photo do the last steps.
- **The screen must be on.** A browser hands a page no position while the phone is locked.
- **A pin is where someone said the box was, on some day.** Boxes get moved by other trades. The
  sheet must always say the day and the person, never a bare dot.
- **Nothing in #345 has been tried on a real phone.** This card stands on all of it.
- **There is no tag on the box.** The app knows only what people record. A box that reports where
  it is by itself needs hardware, which is call 9.

## The smallest version worth building: *Where is it?*

Steps 1 and 2 of the train. One press on a box, **Where is it?**, opening one sheet.

- **What the app knows, in sentences.** *A7 is in Level 2, by the north stair. Jordan counted it
  on Nov 2. Pinned on Nov 2 by Jordan, within 20 ft.* Or: *Nobody has pinned A7. It was last put
  in the laydown yard.* The names here are made up.
- **The newest photo of the box,** so the person knows what they are looking for.
- **The view from above,** with the pin, the job's painted maps under it as today, and the other
  boxes of the same place faint around it.
- **Show where I am.** A press, then the reader's own dot, a dashed straight line to the pin and
  the distance, said as a task's place answers *How far am I?* with *about* in front: *About 240
  ft north-east of you. Your phone is sure within 25 ft.* The dot moves while the sheet is open
  and the screen is on. It never leaves the phone.
- **Directions.** Opens the phone's maps app at the pin, for the drive to the site.
- **I found it.** The press that makes the feature pay for itself. It reads the phone once and
  pins the box where the finder stands, with their name and the day. A reading worse than 150 ft
  is refused in words, as a task's place refuses one. Then **Move box** if the place changed too.
- **With no pin and no place,** the sheet says so and offers the two presses that fix it.

Every search ends by correcting the record. That is the only way the next search is shorter.

## The mock-up

[mockup.html](mockup.html), drawn 2026-11-17 for steps 1 and 2 only. Every name, place, day and
distance in it is made up, and its view from above is a drawing of no real place. It was rendered
at 375 and 1,240 wide, in light and in dark, and its *Try the search* section was pressed through
before it was shown. Nothing ran off the side of the phone.

What it draws, in order:

- **Where the press sits.** The phone's box screen today and as suggested.
- **The sheet in three states.** Opened on a pinned box. After **Show where I am**. On a box
  nobody has pinned, which is every box today.
- **I found it.** A good reading, with *Is A7 still in the Laydown yard?* under it, and a reading
  too wide to keep.
- **Try the search.** A helper is walked from the street to a pin five days old. The box is not
  there. She finds it 60 ft away and presses **I found it**, and the sheet's sentences change.
- **When the phone is unsure, and when the pin is old.** Indoors, and a pin from six weeks ago.
- **The office.** The same sheet in the office's box window, at desk width.
- **The pin remembers.** Step 1 as a table of what the sheet wants to say and what is kept.

Three things the drawing settled that the card had left loose. Each is mine and easy to change.

- **The press takes the place of the Pin on map chip.** The phone's box screen has three chips in
  one row at 375 wide: **Move box**, **Pin on map** and **Photo**. A fourth does not fit. So the
  middle chip reads **Where is it?**, pinned or not, and today's map to drag stays inside the
  sheet as **Move the pin by hand**.
- **A pin older than 30 days turns amber and fades,** with one sentence: *That pin is six weeks
  old. Boxes get moved.*
- **The distance borrows a task place's words, not a painted line's.** A painted line's *give or
  take* is about a length that was walked. This is one point to another, which
  `taskPlaceHowFarWords` already says, with a direction and the phone's own margin.

## The train

Each ships alone with its tests, the guide's section, a release note and a fragment.

| Step | What | Tables and policies | Screens | Size |
|---|---|---|---|---|
| 0 | **A try with no code.** Pin five boxes on the test job with **Use my location**, outdoors and inside. Look at where the dots land on **Map**. | none | none | none |
| 1 | **The pin remembers.** Who pinned a box, when, and how sure the phone was. | One migration on `job_containers`: three columns, and a trigger that stamps the person and the day when the pin changes, so a phone cannot claim another name. No new table and no new policy. | none | S |
| 2 | **Where is it?** The sheet above. | none | The phone's box screen and the office's box window. A kernel for the sentences and the distance words (`src/lib/materials/`). It reuses `OnSiteMap`, `requestMyFix`, `haversineMeters`, `directionsUrl.ts` and a task place's distance words (`taskPlaceHowFarWords` in `src/lib/tasks/taskPlace.ts`). | M |
| 3 | **Pins as a side effect.** After **Count this box**, after a photo, after a signed-in scan of the label and when a box is added: one line, *Pin A7 where you stand?*, one press. Never twice in a day for one box. | none | The phone's count, photo and scan sheets | S |
| 4 | **The way to a place.** On a place's row, **＋ Paint the way here**. The painting window opens on the job with the name *The way to Level 2*, and the saved map comes back onto the place. The sheet of step 2 draws that way under the pin. | One migration: `painted_map_id` on `job_places`, a guard that a place points only at a map on its own job or its development, and a way to set it. `job_places` has a select and an insert policy today and no update, so this adds an update policy or one function. No new table. | The place's row on the phone and on the office page, and the sheet | M |
| 5 | **Send someone to it.** On the sheet, a press that opens the New task window with *Find A7*, the pin as the task's place and the place's map. The person given the task reads the map through the task. | none: the column and its guard are live | The sheet, and the New task window as it is | S |

**After the train, each its own call:** a **Can't find this box** mark (call 5), a route worked
out along painted lines, a link for a driver who is not signed in (call 4), a tag on the box
(call 9).

**Docs each step owes:** the crew's guide *keep track of the material in the cages and boxes on
site* has a section *Find a box on the site*, which each step amends. Step 1 and step 4 each owe a
`docs/migrations/` note, a types regen and a line in `docs/MATERIALS_ON_SITE_ARCHITECTURE.md`.
Step 4 owes a line in `docs/ACCESS_CONTROL.md`.

## What is built

2026-11-17, on the owner's word *Build all the steps*. Each step is its own PR with its tests, a
release note and a fragment, and the fragments say more than this table. The versions of the PRs
not yet merged are in their titles.

| Step | PR | What went in |
|---|---|---|
| 1 | #8503, merged | The pin remembers. Four columns on `job_containers` and the `job_containers_stamp_pin` trigger. Migration `20261117170000`, on the live database. |
| 2 | #8510, merged | **Where is it?**: the sheet on the phone's box screen, and the third tab of the office's box window. |
| 3 | the PR that carries this edit | The pin ask: *Pin A7 where you stand?* after a count, a photo, a scanned label and a new box. |
| 4, the column | #8511, merged | A place can carry the way to it. One column, an update policy and a guard on `job_places`. Migration `20261117180000`, on the live database. |
| 4, the screens | built, not opened | **＋ Paint the way here** on a place, **Open the way** on a box's sheet, and a helper's search offering **Paint a map** (call 8). |
| 5 | built, not opened | **Send someone to it**: the New task window on *Find A7*, with the pin as the task's place and the way as its map. |

**What differs from the card**, each in its fragment:

- **The pin keeps four facts, not three.** The name is kept beside the person, as a box move keeps
  it, because the crew's roles cannot read the users table.
- **The distance uses a task place's words, with a direction**, as the mock-up drew.
- **The office has a third tab in the box's window**, not a window of its own.
- **I found it uses the reading on the screen while the dot is on.** The walk found that asking
  the phone a second time took several seconds.
- **The pin ask is offered to a box with no pin or a pin older than seven days**, once a day for a
  box on a device. The card said *never twice in a day* and named no age. The seven is a guess.
- **The way's guard carries its own error code**, so the app prints its reasons.
- **Take the way off** is a press the card did not name, on the office page. A wrong way needs a
  way out that does not throw the map away.
- **The newest photo is only as good as today's box photos.** A box photo's picture stays on the
  phone that took it, and the app draws none from Drive. On another phone the sheet shows the
  photo's name and who took it, with no picture.

**Walked**, on a dev server against the live database, in a headless Chromium at phone and desk
width, as the dev account, with a made-up location, on a test job's test cage: the sheet on a box
nobody pinned, **I found it**, **Show where I am** from 240 ft away, a margin too wide to trust,
**Move the pin by hand**, **Remove the pin**, the office's tab, the pin ask after a count, a way
painted to a made-up place and opened from the cage, and **Send someone to it** as far as the New
task window, with nothing sent. No request failed. The walk of step 5 found that the New task
window kept a place and dropped its way, which step 5's PR fixes. Dark mode was not looked at. The
pin and the made-up way were taken off after. The made-up place stays on the test job, since a
place cannot be removed in the app.

**Not done**: step 0, the owner's try. Nothing has been tried on a real phone.

## What a walk of the live app found, and what it means here

A session walked Paint a map on the live app on 2026-11-16 and 17. Each finding below was checked
in the code on 2026-11-16.

### A helper who types *paint* is not offered Paint a map

**Found, and it is not the door's gate.** The door's gate in `src/lib/search/doors.ts` is
`everyone`, and `/dashboard` is a route a helper may open. The header search drops the door
afterwards. For a field role it keeps only the guides, the sites, the boxes and the painted maps
by name (`src/components/HeaderGlobalSearch.tsx`, the line that reads
`fieldLookup ? [...mine.filter((d) => d.kind === 'guide'), …]`). Every page and window door goes,
whatever its gate. It was written for #181, before #345, and its comment gives the reason: a field
role's *few pages stay where its own nav puts them*.

So a helper who types *paint* gets the guide and any map with that word in its name, and no door
to start one. The guide's own **Go there** leads to Jobs, which a helper cannot open, so it is
dropped too.

**What a helper has today:** **＋ Paint a map** under the address on their own job card and on *On
my way*. Both need a job on their day. With no job on the schedule they have only the door's
address.

**The fix, XS, no migration:** let a field role keep a window door that is marked for the field
and that its route guard admits. Mark **Paint a map**, and later this card's door. Put the rule in
the kernel, where `doors.test.ts` can hold it, since today the test passes while the screen
disagrees. It is worth doing with step 4, which is the first time crew are asked to paint.

**This card's own door is already open.** A field role's search finds a box and opens it on the
phone. **Where is it?** sits on that screen.

### Photos left in the bucket when a map is thrown away

When a maker who is not office throws a map away, their own photos go with it. A teammate's photo
on that map stays in the bucket until the office removes it (v2.7454 and v2.7473,
`docs/migrations/20261116234500_painted_map_photos_after_the_map.md`). The leftover is private:
its uploader and the office can list it, and nobody else reads it. It costs storage and a chore,
and nothing leaks.

**Does this card make it worse?** Only if crews paint a new map for each search. On the card's
picks they do not. A search paints nothing: the straight line is drawn on the phone and saved
nowhere. The way to a place is painted once, lives as long as the place, and is thrown away
rarely. So on the picks it does not matter.

If the owner picks a map for every lost box (call 6), it matters. Many short maps, added to by
whoever found the box, thrown away by whoever started them. Then build the fix that was offered on
#345 and not taken: **a table that records who threw a map away**, so the maker can take every
photo under the map's id and not only their own.

### A map needs a home the someone can read

Covered above. The home is the box's job, where the crew already reads. A person who is not on
the crew gets the map on a task (step 5). A map on no job would be read by its maker and the
office only, so this card never makes one.

### A phone follows a person only roughly, and nothing is tried on a real phone

Both are in *the limits* above. They are why the straight line says *about*, why the sheet leads
with words and a photo, and why step 0 is a try on a real phone before any code.

## Privacy

- **The reader's dot stays on their phone.** Nothing is sent while a person looks for a box.
- **I found it sends one point, on a press,** with the person and the day, as a count does. It is
  where the box is, said by a person. It is never read against hours or pay.
- **No trail is kept.** The app never records the way a person walked to a box.
- **Where a box stands is never shown to someone who is not signed in.** The box page stays as
  Taunya closed it.

## The owner's calls

Each has my pick first. All nine were put to the owner in the session on 2026-11-17, call 1 first
and alone, then the other eight in one message, each as one sentence with its pick. Call 1 is
answered. He then said *Build all the steps*, which this card took as the train of five with every
other call at its pick. He has not spoken to calls 2 to 11 one by one, so each stays his to
change, and a change goes on the call's own line.

1. **What is a crate, and who is looking for it?** My pick: a cage or a box from Materials on
   site, looked for by the job's crew or the office. Or: a box that has left the site, where the
   app can show only where it was last seen. Or: something the app does not hold yet, such as a
   supplier's or a customer's crate, which is a different card.
   **Answered 2026-11-17: *Yes, cage or box*.** A crate is a cage or a box from Materials on
   site. The call as put to him named the job's crew or the office as the ones looking, and he
   raised no other reading.
2. **What should the path be?** My pick: a straight line with a distance first (step 2), then a
   way painted once to each place (step 4). Or the painted way only. Or a route the app works
   out, which is much larger and waits.
3. **How does a box get its spot?** My pick: **I found it** on the sheet, and the one-press ask
   after a count, a photo and a scan (step 3). Or pinning stays its own press, as today, which no
   one has used.
4. **Who may be shown where a box is?** My pick: whoever can read the box today, and a person
   given a task that carries it. Nobody signed out. Or a link for a driver, which shows the way
   to a place and never a box's name or what is in it.
5. **Who says a box is lost?** My pick: nobody has to. The first build serves the person who is
   asking. Or a **Can't find this box** press that tells the office that day and clears on the
   next pin or scan. That is one more step, with one column and a Needs you line.
6. **One way per place, or a map per lost box?** My pick: one way per place, painted once. A map
   per lost box means many short maps and the leftover photos above.
7. **Try it first?** My pick: yes, step 0. It needs no code. It also answers #345's open try,
   since it is the same phone doing the same thing.
8. **Should a helper's search offer Paint a map?** My pick: yes, with step 4. Or leave the field
   search as it is and keep the press on the job card only.
9. **Did you mean a tag on the crate?** My pick: no, not now. A tag that phones find is read only
   in its maker's own app. A tracker with its own signal costs a fee for each crate each month.
   Either is hardware to buy and a different card. Say so if that is what you meant.
10. **Should the press take the place of the Pin on map chip?** My pick: yes, as the mock-up
    draws it. Or a fourth press on a line of its own, under the three chips.
11. **When does a pin read as old?** My pick: after 30 days. It is a guess with nothing measured
    behind it.

## What it would cost, in short

| | On the card's picks |
|---|---|
| New tables | none |
| Migrations | two, both small: three columns and a trigger on `job_containers` (step 1), one column, a guard and an update door on `job_places` (step 4) |
| New policies | one, on `job_places`, or one function in its place |
| Edge functions | none |
| Public doors | none |
| Screens | one new sheet on the box, one ask on three sheets that exist, one press on a place's row |
| Kernels | one for the sentences and the distance words, one for when to ask for a pin |
| Guides | one section of one guide, amended at each step |

## How to verify, when it is built

- **Kernels:** a box with a place and no pin, a pin and no place, both, neither, a pin a month
  old, a reading with a wide margin, a distance of 40, 500 and 5,000 ft.
- **Locally:** a headless browser with a made-up location moved toward a made-up pin. The page
  hidden and shown again. Phone and desk widths, light and dark.
- **Live:** on the test job only, as the sample helper through **View as**. Made-up boxes, each
  retired after. Nothing on a real job.
- **On a real phone:** step 0's five boxes, then the same five through the sheet. Lock the phone
  mid-walk. Stand inside and read what the sheet says.
- Made-up names, jobs and places only, in the repo, the PR and every screenshot.

## Where it stands

2026-11-16: the card, on the owner's word that it goes on the punch list and is not built now. No
code, no migration, no mock-up, no write to the live app. Two things were read from it: the count
of live cages and boxes with a pin and a place, through the dev seat, and the code named above.

2026-11-17: the mock-up, and the calls put to the owner in a session. Still no code, no migration
and no write to the live app. Step 0 was described to him as his to do, since it needs a person
standing at the boxes: on the test job, stand at five boxes, some outdoors and some inside, press
**Pin on map**, **Use my location** and **Put A1 here** on each, then open **Map** on the On site
tab and look at where the dots land. Nobody has done it yet. Step 1 is built only on his answer to
call 1 and his word to build.

2026-11-17, later: the owner answered call 1, *Yes, cage or box*. He has not said build, and
calls 2 to 11 are open. Step 1 hangs on none of them: a pin that keeps its day, its person and its
margin is wanted under every answer but a tag on the box (call 9).

2026-11-17, later still: the owner said *Build all the steps*. All five were built that day and
are landing one PR at a time. *What is built* above has the table. The card moved from *gated* to
*close*: nothing waits on a decision.
