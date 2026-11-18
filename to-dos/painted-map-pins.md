---
name: "Pins on a painted map: points of interest"
number: 393
group: ready
status: A shipped (v2.7773) · B's column shipped and pushed (v2.7775) · B's marks in the app, the copies and the shared link in one PR (v2.7776, v2.7777, v2.7778), its function to deploy after the merge · C answered 2026-11-18, a separate list, drawn, and the owner likes the mock-up · C's column in its PR · C's screens built on `claude/393-job-places`, held for B's PR and the column's push
summary: >
  The owner wants to set pins, points of interest, on a painted map, and not only lines. A painted
  map can already hold a place: a numbered dot with a name, a few words and a photo. Look it over,
  the screen in the owner's screenshot, has no ＋ Place, which may be why it looked missing. A place
  has no kind and no mark of its own, and a job has no pins outside a painted map. This card puts
  three readings to the owner. A is ＋ Place on Look it over. B is kinds of pins, each with its own
  mark. C is a job's own pins, with no painted map. He ticked all three on 2026-11-18, so it is a
  train of three in that order.
next: Push C's column once it merges, then merge C's screens. Deploy `painted-map-link` once B's PR merges. Then one walk on the live app, of a place with a kind and of a place on the job.
size: L as a train of three (S · M · L); left: two pushes and merges, one deploy and one walk (S)
blocker: None. Two of C's calls were not answered one by one, the word and what a link carries, so they are built at their picks and are the owner's to change.
ver: v2.7773 · 7775 · 7776 · 7777 · 7778
opinion: build — the owner picked all three and then a separate list for C; A and B are done but for a deploy and a walk
---

# Pins on a painted map (#393)

## The ask, in the owner's words

2026-11-17, with two screenshots from a phone: a walk's **Look it over**, and the **Close the map?**
question.

> I want to make a few more upgrades. One, I want to also be able to set pins Like points of
> interest beyond just having a map

The same message asked for Google's map under a painted map, now [#387](painted-maps-on-google.md),
and for two ways out of **Close the map?**, built in v2.7690.

## The answer

2026-11-18. The three readings below were put to the owner in one question, with A as the pick and
closing the card unbuilt as a fourth choice. He ticked all three:

> A. ＋ Place on Look it over (Recommended), B. Kinds of pins, C. A job's own pins

Taken as a train in that order. Each step is its own PR.

## Where it stands

- **A, ＋ Place on Look it over: shipped**, v2.7773. The press sits between the walk's lines and
  **Save**. It opens the place panel over the waiting lines. A place is saved when it is added, as
  the walk's own is, and the screen says so. Walked on a local server against the live database
  before the merge. Not walked on the deployed app or on a real phone.
- **B, kinds of pins: built**, in four steps.
  1. **The column: shipped and pushed**, v2.7775. `painted_map_places.kind`, one short lowercase
     word or null, by migration `20261118080000_painted_place_kind.sql`. The check holds the shape
     of the word and not the list, so a new kind needs no migration. Its bed scenario passed in CI.
  2. **The marks in the app**, v2.7776. Seven kinds, gate, parking, door, meter, shutoff, cleanout
     and hazard, each with a drawing in `paintedPlaceKind.ts`. The place panel's chips pick one.
     The dot wears the mark on the map and in the lists, with its number on its shoulder, and a
     hazard is red.
  3. **The picture, the printed page and the file**, v2.7777. The picture draws each mark on the
     map and in its key. The printed page gives a place with a kind its mark in the list. A file
     draws nothing, so it says the kind in the place's name, as in *Hazard: Open trench*.
  4. **The shared page**, v2.7778. `painted-map-link` reads the kind and hands it on as the table
     keeps it, and `/way/<code>` draws the mark on its map and beside each place. The page holds
     the list, so a new kind needs no deploy. **The function is deployed after the merge.** Until
     then a link shows plain dots, and nothing breaks either way round.

  Steps 2 to 4 are one PR. **Left for B:** deploy `painted-map-link`, then walk a place with a kind
  on the live app, on a made-up map on no job, thrown away after. The printed page has not been
  sent to a real printer.

  **The list of kinds is a first list.** The card's pick was to wait until places were in use and
  learn the kinds from what people mark. Read on 2026-11-18, prod held no place on any painted map,
  so there was nothing to learn from. The seven are the card's examples and the six names the place
  panel already offered. The list is one array in the app and is the owner's to change.
- **C, a job's own pins: built**, in two steps, the column and the screens. See the next section.

## C: a list of its own, kept on the job

2026-11-18. C opens with a call that is the owner's, so it was put to him with what the live data
held that day: 1 painted map, 0 places on any map, and 4 Materials on site places, none with a
point. The pick was to hold C on a card of its own until a job has a second map. The other choices
were Materials on site's places becoming the pins, a separate list, and dropping C. He chose:

> A separate list of pins

**The mock-up** is [`painted-map-pins-on-the-job.html`](painted-map-pins-on-the-job.html), drawn
the same day. Nothing in it is built. It draws three screens:

1. **Under the job's address**, with the job's painted maps: a line, *Places on this job*, and a
   press, **＋ Place on this job**.
2. **Places on this job**: the window a painted map opens, in a places-only shape. The same place
   panel, kinds, photo and **Put the dot where I am**. Its marks wear letters.
3. **On a painted map of the same job**: the job's places drawn with a dashed ring and a letter,
   under their own heading, *On this job*. The map keeps its own numbered places.

**The owner's word on the mock-up**, 2026-11-18:

> I like what you've mocked up.

Taken as a yes to build it as drawn. He was asked three things at once: build it as drawn, what
the list is called, and what a link carries. He answered with that message and not call by call.
So calls 1 and 3 are built at their picks and stay his to change. Call 1 is one file of words.

**The calls, each with its pick.**

1. What the list is called. Pick: *Places on this job*. The other way: *Pins on this job*, his own
   word, which a box in Materials on site already uses.
2. How a place on the job is told from a map's own. Pick: a letter and a dashed ring.
3. Whether a link or a copy of a painted map shows the job's places. Pick: no. A link shows what
   was painted on that map, and the job's list has its own link, picture and page.
4. Who sets and changes one. Pick: as on a painted map today. Anyone who can open the job sets one,
   and whoever set it, or the office, changes or removes it.
5. Materials on site's places. Pick: untouched, as he chose.
6. A development's map, and a map on no job. Pick: not in this build.

**How it is kept.** The job's list is a painted map that holds places only and is marked as the
job's own. So everything a place already has comes with it: its kind and mark, its photo, who may
read and change it, and its own link, picture and page. No new table.

The table does not hold a job to one such map. A job that goes leaves its maps standing on no job,
and two jobs can be combined, so a rule of one a job would refuse those. The app makes one and
reads every one a job has as one list.

**The train, as built.**

1. **The column: built**, in its own PR. `painted_maps.job_list`, a yes or no, by migration
   `20261118090000_painted_map_job_list.sql`. Its scenario in the painted maps bed passed in CI.
2. **The list, and the job's places on every map of the job: built**, on `claude/393-job-places`,
   as one step. The line and the press on `JobPaintedMapsStrip`. `PaintedMapWindow` in its
   places-only shape, with letters. The dashed, lettered layer on `PaintedMapCanvas` and the *On
   this job* rows on the job's other maps. It names the column in every read of a map, so it merges
   after the push.

**Built differently from the mock-up, on purpose.**

- The sentence about what a link carries is under *On this job* in the map's window and not on the
  Share sheet, since [#394](painted-map-share-sheet/README.md) is rebuilding that sheet.
- **Throw this list away** is offered to the office alone. The mock-up drew no such press.
- A list with no place on it shows no line under the address, only the press.

**Left as it falls, and said in the fragment.** The list shows in the other lists of painted maps
as a map named *Places on this job*. A place has no **Directions** of its own. One place cannot be
shared by itself.

## Asked in passing: a faster Share, for routes and for places

2026-11-18, in the same message as his word on C's mock-up:

> I do want to eventually add a share button to both painted routes as well as places so a user
> can hit share and then immediately take that link into text and text it to someone so someone
> else can identify a location. Could you help me decide if we should add this to this edition or
> add it as another edition.

**The answer given: another edition, and most of it already has a home.**

- **A painted map, his routes.** This is [#394](painted-map-share-sheet/README.md), carded and
  drawn the same day by another session. Its lead press is **Text it from my phone…**, and every
  sending press makes the link itself. Nothing of it belongs on this card.
- **The job's list of places.** C keeps it as a painted map, so it has **Share** from its first
  day, as the mock-up draws. It gets #394's sheet when that lands, with nothing more to build.
- **One place alone**, to text someone a single spot. This is new and is on no card yet. It needs
  the sheet #394 builds, and one call of its own: what the reader opens. That is either the map
  with that place picked out, or a plain pin in their own map app. It fits #394 as a later step
  better than a card of its own.

## What a painted map held when the card was written

- **A place.** A numbered dot at a point, with a name of up to 80 letters, up to 200 letters of
  words and one photo (`painted_map_places`).
- **Three doors set one**, and Look it over is the fourth since A. **Start with a place** on the start sheet. **＋ Place** while the red bar
  says Painting. **＋ Place** in the map's own row, beside **Draw a line**.
- **Look it over had none**, until A. It is where a walk ends, before anything is saved
  (`PaintedWalkReview.tsx`). Its presses were **Fix this line by hand**, **Leave this line out**,
  **Save the map**, **Keep painting** and **Throw it away**.
- **Every place looks the same.** A place has no kind and no mark of its own.
- **A job has no pins outside a painted map.** Materials on site keeps a job's named places
  (`job_places`), each with a name and, since v2.7580, the painted map that shows the way there.
  None has a point of its own.

*That was true on 2026-11-17. A and B have since changed the second, fourth and fifth points.*

## Three readings, each with a size and a pick

- **A. ＋ Place on Look it over** (S). The walk's own **＋ Place**, on the screen the walk ends on.
  It opens the same place panel. Pick: build first, since it answers the screen in the owner's
  screenshot.
- **B. Kinds of pins** (M). A place gets a kind, each with its own mark: for example a gate, a
  meter, a shutoff, a cleanout, parking or a hazard. The mark shows on the map, on the `/way` page,
  in the picture and in the print. A column and a migration. Pick: next, once places are in use, so
  the list of kinds comes from what people mark.
- **C. A job's own pins** (L). Points of interest kept on the job with no painted map, shown on
  every painted map of that job. It overlaps Materials on site's places for a job, so it starts with
  a call on whether those places get a point and become the pins. Pick: only if a job needs pins
  without a map.

## Where it plugs in

- The screens: `src/components/paintedMap/PaintedWalkReview.tsx` (Look it over),
  `PaintedWalkPanel.tsx` (the walk's **＋ Place**), `PaintedPlacePanel.tsx` (a place's name, words
  and photo) and `PaintedMapWindow.tsx` (`placeOnWalk` and `startPlace`, which open that panel).
- The place: `src/lib/paintedMap/paintedMap.ts` and `paintedMapIo.ts`. Where a place is drawn:
  `PaintedMapCanvas.tsx`, `src/pages/PaintedWay.tsx` and `src/lib/paintedMap/paintedMapPicture.ts`.
- The table: `painted_map_places`, made in `20261113220000_painted_maps.sql`.
- For C: `job_places`, made in `20261029010000_materials_on_site.sql`, with its painted map from
  `20261117180000_place_painted_way.sql`.

## How to verify

- A: a render test on Look it over, where **＋ Place** opens the place panel and the place shows with
  the walk's lines. Then a walk on the live app on a made-up map on no job, thrown away after.
- B: kernel tests for the kinds and their marks, and render tests on the map, the `/way` page and the
  picture.

## Related

[#345](paint-a-map/README.md) built painted maps and their places. [#387](painted-maps-on-google.md)
puts them on Google's map. [#392](paint-a-map-press/README.md) is the Dashboard's Paint a map press.
