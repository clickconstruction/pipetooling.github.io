---
name: "A place on a task: the giver marks where the work is, the doer gets the dot, the photo and directions, and Today opens on a map of my tasks"
number: 328
group: gated
status: asked 2026-11-12 · the card and the mock-up the same day · nothing built · waits on Grace's go and her calls
summary: >
  A task is words, a day and people. It cannot say where the work is, and on a large property the
  street address would not help anyway: the task is at the pump house, the north gate, a corner of
  a field. The card proposes one optional thing on a task, a place: a named point on the map. The
  giver picks a place used before with one press, or presses Use where I am while standing on it.
  The doer sees the dot beside the giver's photo, the distance on a press, and Directions. The
  Today tab opens on a map of the tasks that have a place, in Task Mode and out of it. A task with
  no place is made and done exactly as today. The app asks a phone where it is only on a press and
  never saves where a doer is.
next: Grace's go and her seven calls, then PR 1 (the place itself, no screen).
size: L as a train of eight (S · M · M · M · S · M · M · S); PRs 1 to 4 are the whole loop, then a stop to count use
blocker: Grace's go, and her calls on the photo, the map's home and the doer's press.
opinion: build PRs 1 to 4, then count — three optional things like this are already in the app and almost nobody presses them, so the place has to cost one press or it will join them
---

# A place on a task (#328)

## The ask

Grace, 2026-11-12, right after Farm Mode became Task Mode (v2.7050):

> I would like to look at tasks, and I would like to add the ability to add a specific geographic
> coordinate to a task. Would you be able to help me think holistically about how the app works,
> and what a tasteful way to add this would be, and then present to me a mock-up of what you think
> we should add and a plan to build it? This would make it easier for people who are needing to do
> tasks to find those tasks, as well as people who are giving tasks to make super clear what tasks
> are. Having a geographic location and a photo should be enough that it should be really easy for
> users to orient around a task. I also think we could add a new area to the new task mode, which
> is at the top of someone's page when they are in task mode, to be able to see a map of where all
> their tasks are.

She asked for a design, not a build. This card is the plan and [mockup.html](mockup.html) is the
picture. Nothing is built.

## The answer, in short

Let a task carry one **place**: a named point on the map, such as *Pump house*.

- **Giving.** The Add window gets one row, **Place**, under *Assign to*. It shows the places the
  company has used as chips, and one press picks one. **＋ New place** opens a sheet with a view
  from above and a ring. The giver drags the map under the ring, or presses **Use where I am**
  while standing on the spot, and names it. Nothing is pressed by default.
- **Doing.** The task's card wears the place's name. Opened, it shows the giver's photo beside a
  small map with the dot, **Directions**, and **How far am I?**.
- **The map.** The Today tab opens on **Where my tasks are**: every open task that has a place, as
  a numbered dot, with the same number on its card in the list. Task Mode is the Today tab, so the
  map is at the top of Task Mode.
- **No place.** A task with none is made, shown and done as today. The map counts those tasks in a
  line and the list still holds them.
- **Honesty.** The app asks a phone where it is only on a press. Where a doer is never leaves the
  phone. A fix says how sure it is.

## What the app does today

Read on main, 2026-11-12.

### What a task is

- **The task as written** is a row of `checklist_items`: a title, links, a start and a due day, a
  repeat rule, a reminder, who to tell when it is done, and `asks_for_photo`. **The task on a day**
  is a row of `checklist_instances`. Who it is for is `checklist_item_assignees`, one person or
  several. Notes and progress are `checklist_instance_events`.
- **It has no place and no job.** There is no `job_id`. A job rides in the title as a chip
  (`src/lib/checklistJobPreset.ts`), with the job's link in `links[0]`.
- **Where one is made.** The header's **＋ Task** (`src/components/ChecklistAddModal.tsx`, opened
  through `ChecklistAddModalContext`), the home-screen `/task` shortcut
  (`src/pages/TaskShortcut.tsx`), the Checklist page's Manage tab, and a roadmap
  (`ChecklistTechTreeAddTaskModal`, bridged into `checklist_items` by `sync_roadmap_to_checklist`).
  Every role but the superintendent can make one. The window's rows, in order: Task, Assign to,
  Links, Done when, When, notify, Remind.
- **How the doer sees it.** `ChecklistTodayTab` in `src/pages/Checklist.tsx` draws each task as a
  `ChecklistInstanceCard`: a tick or a ring, the title, the due chip, the Done when lines, the
  photo strip, and **＋ Add a note**. Pressing the title opens the card in place, with its history
  and **✓ Complete**. Task Mode keeps Today and History and hides Review and Manage.
- **What a leader sees.** The Review tab (`ChecklistOutstandingTab`) with **Outstanding by
  person**, and the Manage tab.
- **Rows are read and written directly.** No RPC makes or reads a task. `checklist_items` is read
  by the office, the task's maker and its assignees, and written by the office or its maker.

### Photos on a task

- A task photo is a `task_photos` row on **a day's** card (`src/lib/taskPhotos.ts`,
  `src/lib/photos/taskPhotosIo.ts`, `TaskPhotoTile`, `TaskPhotoStrip`), taken at a percent, at the
  finish or on a Done when line, then filed to Drive by the `photo-save` sweep.
- **Only someone who can work the card can add one, and never when the task is made.** So the
  giver cannot show the spot today. "A place and a photo" needs a photo the giver takes, which the
  app does not have.
- Every photo is shrunk before it leaves the phone, and the shrink drops the camera's data on
  purpose: `src/lib/photos/shrink.ts` says "no position travels with the picture". Nothing in the
  app reads a photo's position.

### The maps the app already has

- **One shared canvas.** `src/components/map/PinsMapCanvas.tsx` (Leaflet on OpenStreetMap tiles,
  free) and `PinsMapGoogleCanvas.tsx` (used only when a Google browser key is set, and dropped for
  the page if it fails). They take the same props: dots with a colour, a ring and a number, a
  selected dot, clusters that open on a press. On a phone there is no popup: the caller draws a bar
  under the map.
- **Who uses it.** The Map page, *Your jobs on a map* on the Dashboard, *Jobs on a map* on the
  Pipeline, *Bids on a map*, *Where everyone is*, the Prospects research map, and the one-dot home
  picker (`src/components/flows/HomeMapWindow.tsx`). The cards are 220 to 260 tall on a phone and
  fold with **Hide map**, remembered on the device.
- **The closest relative.** Materials on site (`src/components/materials/OnSiteMap.tsx`): a view
  from above (Esri World Imagery, with a Streets switch), zoomed to a property, where a box gets a
  spot. Its placing mode is a ring in the middle of the map and the words *Drag the map until the
  ring is on …*, with **Use my location** from `src/lib/materials/myLocation.ts`. This is the
  sheet the giver needs, already drawn once.
- **Directions.** `src/lib/directionsUrl.ts` builds a Google Maps directions link from an address,
  and `googleMapsUrlForLatLng` one from a point. Links leave the app through
  `src/lib/openInExternalBrowser.ts`.
- **A weak signal.** The service worker keeps the app's own files and no map tiles. A tile that
  fails stays blank, and no map says so.
- **Pin Mode is not about maps.** It sits beside Task Mode in the gear menu and pins a *page* to
  the Dashboard's quick bar. "Map" is also taken on this page's neighbour: a roadmap's **Map** view
  is its tree of stages.

### Where a point already lives

- `address_geocodes`: the shared cache from an address to a point, filled by the `geocode-one` and
  `geocode-address-batch` functions. A job has no point of its own. It has an address, and the
  cache.
- `clock_sessions` (in, out, arrived), `reports`, `dispatch_requests` and `estimator_requests`
  (`location_lat`, `location_lng`), `job_containers` (a box's spot), `people` and `team_prospects`
  (a home town's point), `permits`.
- **No column anywhere says how sure a fix was.**

### How the app asks a phone where it is

- **Without a press:** on clock in, clock out and *I'm here* (`src/lib/resolveClockPunchCoordinates.ts`,
  which falls back to a guess from the network), on sending a field report, and on opening *On my
  way*. The guides say so: "Your location is captured when you punch."
- **On a press:** *Use my location* for a box, *Attach this location* on Task Dispatch and on Ask
  estimating, and *Use my location* on the Away note, whose line is the model for this card: "Your
  location stays on this phone. We never see it."
- Every one is a single reading. Nothing follows a phone.

## What the record says

Counted on the live app, 2026-11-12, reading only. Counts alone left the page.

| What | Count |
|---|---|
| Tasks ever written | 151, 44 of them in the last 90 days |
| Tasks tied to a job | 2 of 151 |
| Tasks whose title names a spot in words (matched against a list of place words) | 25 of 151, 10 of the last 44 |
| Tasks that came from a roadmap | 14 of the last 44 |
| Tasks for one person | 130 of 151 |
| People who gave a task in 90 days | 4 |
| Task photos | 0 (the photo strip is six days old) |
| Task Dispatch requests with *Attach this location* | 2 of 211 |
| Ask estimating requests with a location | 0 of 12 |
| Boxes with a spot on a site map | 0 of 102 |
| Open tasks one person holds | from 1 to 84, the middle person 19 |
| Presses on the Task Mode strip's **Exit**, ever | 0 of 54,438 presses on record |

Four things follow, and each one moved the design.

1. **A place must cost one press.** Three optional things like it are in the app now, and people
   skip them. A sheet with a map, every time, would be skipped too. So the first thing in the row
   is the places already used, as chips.
2. **The map cannot open on the job.** Two tasks in 151 have one. It opens where the last place was
   set, and **Use where I am** is the fast way in the field.
3. **About one task in five is at a spot.** The other four must not look unfinished. No empty map
   on a card, no *No place* line.
4. **Nobody can say Task Mode is used.** It is a switch on a device, and its Exit press has never
   been recorded. A map only inside Task Mode could be a map nobody sees. So it is the Today tab's
   first block, and Task Mode gets it because Task Mode is the Today tab.

## The design

### 1. Why a point and not an address

A task here is often on a large property: a yard, a field, a mechanical room, behind a building.
One address covers all of it. The task's real "where" is fifty yards past the second gate, and
only a point says that. The tasks on the record bear it out: the ones that name a spot name a part
of a place, never a street.

A point alone is not enough either. `29.5512, -98.2874` means nothing to a person, and it cannot be
picked from a list. So a place is **a point with a name**. The name is what a doer reads on the
card and what a giver presses next week.

### 2. How the giver sets it

In order of how often it will be the right press:

1. **A place used before.** Chips under *Assign to*, newest first, the way crew chips sit there
   now. One press. They are read from the tasks themselves, so there is no list to keep.
2. **Use where I am**, inside **＋ New place**. One press while standing on the spot, then a name.
   The sheet shows the fix on the map before anything is saved, and says how sure the phone is.
3. **Drag the map under the ring**, in the same sheet. The way from a desk, and the way to fix a
   poor reading. A view from above by default, because a field has no streets.

The default is no place. A task with none takes exactly today's presses.

Not in the first build:

- **Typing coordinates.** Nobody in the field types two numbers of six places, and at a desk the
  map is faster. Cheap to add later as a paste box if someone asks.
- **Reading the place off the photo.** It sounds free and is not. A phone's browser hands a web
  page a fresh camera photo with no position on it, and the app drops a photo's data on purpose.
  The honest version of the same idea costs one press: take the photo, then **Use where I am**,
  while standing there.

### 3. How the doer uses it

- **On the card:** the place's name under the due line, with the dot's number.
- **Opened:** the giver's photo and a small map side by side, each about 130 tall. The photo says
  what it looks like and the dot says where. Together they need no other words.
- **Directions** opens the phone's maps app at the point. On a road it routes there. Off a road it
  routes to the nearest one, and the view from above and the photo do the last hundred yards. The
  guide will say that plainly.
- **How far am I?** is the one press that asks the phone where it is. The answer reads *250 ft
  north-east of you. Your phone is sure within 30 ft.* It is worked out on the phone and kept only
  while the page is open.
- **Placed by Rosa on Nov 3.** A place can go stale. A machine moves, a gate is rebuilt. The line
  says who set it and when, so the doer can judge it.

### 4. The map at the top of Today

- **What is on it:** my open tasks that have a place. A numbered dot each, and the number is the
  task's number in the list under it. Red is overdue, blue is due. A task done today leaves the
  map.
- **A press on a dot:** on a phone, a bar under the map with the task, **Directions** and **Show
  the task**, which scrolls to the card and opens it. At a desk, the canvas's own popup.
- **No place:** one line under the map, *2 more tasks have no place. They are in the list below.*
  Counted and listed, never hidden. When no open task has a place there is no map at all.
- **Many in one spot:** the canvas's cluster disc with the count. A press zooms in. Tasks at one
  place share a dot that wears the count, and the bar lists them.
- **Far apart:** the first view frames every dot. One task a long way off is drawn and named in a
  line with a press, the way the Map page treats a far place, so the rest stay readable.
- **Height:** 220 on a phone, 300 at a desk, the Pipeline map's sizes. **Hide map** folds it and
  the device remembers. Folded, it is one line: *Where my tasks are · 3 places · Show map*.
- **Satellite or Streets:** a switch on the map, as on the box map. From above when the dots sit
  within a mile of each other, streets when they are spread across town.
- **Show where I am:** a press on the map that adds a blue dot, and fills the distance on every
  card for that visit.
- **What a leader sees:** on the Review tab, above *Outstanding by person*, the same map with every
  open task, one colour a person, and a press on a name to see that person alone. It shows where
  tasks are. It never shows where a person is.

### 5. Honesty and privacy

- **Only on a press.** Three presses ask: *Use where I am* (giving), *How far am I?* and *Show
  where I am* (doing). Clock in already takes a reading without a press. This does not add another.
- **What is kept.** The giver's reading becomes the task's place. That is the point of the press,
  and the sheet shows it before it is saved. A doer's reading is never saved and never sent.
- **How sure.** A reading comes with its own margin. The app shows it, *within 20 ft*, and keeps
  it on the place. Past about 150 ft it does not accept the reading quietly: *Your phone is only
  sure within 400 ft. Drag the map until the ring is on the spot.*
- **No signal.** A phone finds itself without one. So the distance and the direction still
  answer, the photo is already on the phone, and the map says *The map did not load. There is no
  signal here.*
- **Indoors.** The margin grows and the app says so. A mechanical room is found by the photo, not
  the dot.
- **Refused.** *Location is off for this app. The map and Directions still work.* One answer is
  lost, the distance.

### 6. Words

**Place**, everywhere a person reads: *Place*, *New place*, *Use this place*, *2 tasks have no
place*. The mark on the map is a **dot**.

- Not **pin**: Pin Mode sits one row under Task Mode in the same menu and means a pinned page.
- Not **location**: in this app that word is where a *person* is, on Task Dispatch, on the punch
  and in Settings. A task's place is not anyone's location.
- Not **spot** as the noun: it is the word *Attach this location* uses for where you stand
  ("Finding your spot…"). It stays in sentences, *the ring is on the spot*.
- Materials on site already calls a named part of a job a place (`job_places`), so the word means
  the same kind of thing in both.
- The block is **Where my tasks are**, not *Map*, because a roadmap's Map view is two tabs away.

### 7. Underneath

- **Storage.** Five columns on `checklist_items`, the task as written, so a repeating task keeps
  its place every day: `place_name text`, `place_lat` and `place_lng double precision`,
  `place_accuracy_m integer` (null when set by dragging), `place_set_by uuid`, `place_set_at
  timestamptz`. A check holds the point whole: both numbers or neither, inside the range.
- **Migration.** One file, additive and idempotent, opening with `SET lock_timeout = '3s';`,
  numbered from main and claimed. No new table, so no fence calls. Pushed after the merge with
  `supabase db push`. `src/types/database.ts` is regenerated.
- **Who may read it.** Whoever may read the task: the office, its maker, its assignees. The place
  rides on the row, so there is no new policy. Whoever may edit the task may set or move its place.
- **Places used before.** A read of the tasks that have a place, one per name, newest first. No
  list table. If the office later wants to rename or move a place for all its tasks at once, that
  is when a table earns its keep, and not before.
- **Kernels first.** `src/lib/tasks/taskPlace.ts`: is this a whole place, the distance and the
  direction words, the accuracy words, the directions link, which places to offer, the dots and
  their numbers, the no-place count. All pure, all tested.
- **Screens reuse.** `PinsMapCanvas` for the two maps, `OnSiteMap`'s ring and layer switch for the
  sheet, `requestMyLocation` with the accuracy added, `directionsUrl.ts` with a point,
  `openInExternalBrowser`, the *Hide map* fold.

## The PR train

Each ships alone with its tests, its guide, a release note and a fragment.

| PR | What | Touches | Size |
|---|---|---|---|
| 1 | The place itself, no screen | the migration and its doc, `taskPlace.ts` and tests, the types | S |
| 2 | Giving: the Place row, the chips, the *Where is it?* sheet | `ChecklistAddModal`, `ChecklistItemEditModal`, a new `TaskPlaceSheet` on the box map's parts, `myLocation.ts` | M |
| 3 | Doing: the place on the card, the small map, Directions, How far am I?, the three honest cases | `ChecklistInstanceCard`, a new `TaskPlaceBlock`, `directionsUrl.ts` | M |
| 4 | Where my tasks are, at the top of Today | `ChecklistTodayTab`, a new `TaskPlacesMapCard` on `PinsMapCanvas` | M |
| — | **Stop. Two weeks on, count the tasks with a place.** | | |
| 5 | A roadmap task carries a place | `checklist_tech_tree_group_tasks`, `sync_roadmap_to_checklist`, the roadmap's add window | S |
| 6 | The giver's photo of the spot | a photo on the task as written, shown on every day's card | M |
| 7 | The leader's map on Review, by person | `ChecklistOutstandingTab` | M |
| 8 | A doer on the spot adds a missing place | one small function, since a doer cannot edit the task | S |

PR 6 is drawn in the mock-up beside the place because Grace asked for both. It is after the stop
because no task has a photo of any kind yet, and the place is the half that is new.

## How to verify

- **Kernels:** the distance and direction words at 50 ft, 500 ft, 0.3 mi and 12 mi, and on each of
  the eight directions. The accuracy line at 20, 150 and 400 ft. A half place refused.
- **Locally, every write refused** (headless Chrome, every request but a GET aborted): the Add
  window with and without a place, a card with and without one, Today with three places and two
  tasks without, at 375 and 1400, light and dark. The browser's location is set by Playwright's
  `geolocation` option, then refused, then given a 400 ft margin.
- **Live, once:** one made-up task placed with *Use where I am* outdoors, opened on a second phone,
  Directions pressed, then the task deleted.
- **A weak signal:** the phone in airplane mode with location on. The distance must still answer.

## What I would not build

- **Following a phone.** No trail, no "who is near". The app takes one reading on one press.
- **Done when you arrive.** A task that ticks itself at the gate would be wrong in both directions
  and would need the phone watched.
- **Lines and areas.** *Clear the fence line* is a line and *mow the back field* is an area. A dot
  in the middle and the photo carry both well enough. Drawing shapes is a tool of its own.
- **A route.** The order to walk the dots in. The numbers are the list's order, which the giver
  already set.
- **Tiles kept on the phone.** It would make the map work with no signal. It is real work and a
  question for the tile providers. The distance and direction cover the gap for now.
- **A places list to manage.** See *Underneath*.

## Is this the best we can do?

**What the counts took out.** The first sketch had a map on every card and the place sheet as the
only way in. The counts say that sheet would be skipped, and that four cards in five would wear an
empty map. Both went.

**What I tested it on.** The kinds of task on the record, by kind and not by name:

- *A thing at a fixed spot* (a pump, a gate, a shelf). The design's centre. It works.
- *A stretch or an area* (clear along a line, a marker every mile). One dot is a compromise. A
  marker every mile is better as several tasks, each with its place, and the chips make the second
  one cheap.
- *A thing that moves* (a machine). A place set last week is wrong. So the card says who placed it
  and when, and PR 8 lets the doer who finds it set it right.
- *No place at all* (order a part, make a call). Most tasks. Untouched.

**What is still weak.**

- The photo half rests on a strip nobody has used yet. If the giver's photo is not taken, the dot
  stands alone. It still answers "where", which is the larger half.
- Four people give tasks. If those four do not press the chips, nothing else matters. That is why
  the train stops after PR 4.
- Indoors, a dot is a guess. The app says so and leans on the photo.

**What would make it better and is not in the train.** A place's own page, with every task ever
done there and its photos. It falls out of the same columns for free later, and it is the first
thing I would add if places catch on.

## Grace's calls

1. **The word.** *Place*, with *dot* for the mark on the map. Or another.
2. **The map's home.** At the top of the Today tab for everyone, which puts it at the top of Task
   Mode (my pick). Or in Task Mode only.
3. **The photo.** Build the giver's photo after the stop (my pick), or pull it forward to sit with
   PR 2.
4. **Done tasks on the map.** They leave it (my pick), or stay for the day as small green dots to
   show progress.
5. **The doer's press.** May a doer on the spot add a place to a task that has none, PR 8 (my
   pick: yes). And may a doer move a place that is wrong, or only say so in a note.
6. **Typing coordinates.** Leave it out (my pick), or add a paste box in the sheet.
7. **The stop.** Build PRs 1 to 4, then count before 5 to 8 (my pick). Or build all eight.

## Where it stands

Card and mock-up, 2026-11-12. Nothing built, no migration written, no number claimed past this
card's. The reading is on main as of that day, with Task Mode's rename (v2.7050) armed and not yet
merged, so the mode's files are named in words here and not by path. The counts were read without
writing anything and are in this card as counts only.
