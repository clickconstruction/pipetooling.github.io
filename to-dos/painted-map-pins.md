---
name: "Pins on a painted map: points of interest"
number: 393
group: gated
status: asked 2026-11-17 with two screenshots of a walk on the owner's phone · read the same day · three readings put to the owner, A, B and C, with a pick · nothing built · carded the same evening at the owner's word
summary: >
  The owner wants to set pins, points of interest, on a painted map, and not only lines. A painted
  map can already hold a place: a numbered dot with a name, a few words and a photo. Look it over,
  the screen in the owner's screenshot, has no ＋ Place, which may be why it looked missing. A place
  has no kind and no mark of its own, and a job has no pins outside a painted map. This card puts
  three readings to the owner. A is ＋ Place on Look it over. B is kinds of pins, each with its own
  mark. C is a job's own pins, with no painted map.
next: The owner says which reading is meant. A is the pick to build first, then B.
size: M as a train of two (S · M) for A then B; C alone is L
blocker: Which reading the owner means.
opinion: build A — one press on the screen the owner was looking at, over the place panel that exists; B once places are in use
---

# Pins on a painted map (#393)

## The ask, in the owner's words

2026-11-17, with two screenshots from a phone: a walk's **Look it over**, and the **Close the map?**
question.

> I want to make a few more upgrades. One, I want to also be able to set pins Like points of
> interest beyond just having a map

The same message asked for Google's map under a painted map, now [#387](painted-maps-on-google.md),
and for two ways out of **Close the map?**, built in v2.7690.

## What a painted map holds today

- **A place.** A numbered dot at a point, with a name of up to 80 letters, up to 200 letters of
  words and one photo (`painted_map_places`).
- **Three doors set one.** **Start with a place** on the start sheet. **＋ Place** while the red bar
  says Painting. **＋ Place** in the map's own row, beside **Draw a line**.
- **Look it over has none.** It is where a walk ends, before anything is saved
  (`PaintedWalkReview.tsx`). Its presses are **Fix this line by hand**, **Leave this line out**,
  **Save the map**, **Keep painting** and **Throw it away**.
- **Every place looks the same.** A place has no kind and no mark of its own.
- **A job has no pins outside a painted map.** Materials on site keeps a job's named places
  (`job_places`), each with a name and, since v2.7580, the painted map that shows the way there.
  None has a point of its own.

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
