---
name: "Pins on a painted map: points of interest"
number: 393
group: ready
status: answered 2026-11-18, the owner ticked all three readings · A in its PR · B's column in its PR · B's marks on the map built on `claude/393-pins-kinds`, held for the push · B's picture, print and file built on `claude/393-pins-copies`, stacked on it · B's shared page built on `claude/393-pins-way`, stacked on that, its function to deploy after the merge · C not started
summary: >
  The owner wants to set pins, points of interest, on a painted map, and not only lines. A painted
  map can already hold a place: a numbered dot with a name, a few words and a photo. Look it over,
  the screen in the owner's screenshot, has no ＋ Place, which may be why it looked missing. A place
  has no kind and no mark of its own, and a job has no pins outside a painted map. This card puts
  three readings to the owner. A is ＋ Place on Look it over. B is kinds of pins, each with its own
  mark. C is a job's own pins, with no painted map. He ticked all three on 2026-11-18, so it is a
  train of three in that order.
next: Push B's column once it merges, then merge B's three screen PRs in order and deploy `painted-map-link`. Then walk the marks on the live app. C opens with one call from the owner on Materials on site's places.
size: L as a train of three (S · M · L); left: B's push, merges and deploy (XS) and C (L)
blocker: None for A or B. C waits on the owner's call, whether Materials on site's places get a point and become the pins.
opinion: build — the owner picked all three; A answers his screenshot, B follows, and C opens with his call on Materials on site's places
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

- **A, ＋ Place on Look it over: built**, in its PR from `claude/393-painted-map-pins-e3e77c`. The
  press sits between the walk's lines and **Save**. It opens the place panel over the waiting lines.
  A place is saved when it is added, as the walk's own is, and the screen says so. Its fragment in
  `docs/recent-features/` holds the rest.
- **B, kinds of pins: in four steps.**
  1. **The column: built**, in its own PR. `painted_map_places.kind`, one short lowercase word or
     null, by migration `20261118080000_painted_place_kind.sql`. The check holds the shape of the
     word and not the list, so a new kind needs no migration.
  2. **The marks in the app: built**, on `claude/393-pins-kinds`. Seven kinds, gate, parking, door,
     meter, shutoff, cleanout and hazard, each with a drawing in `paintedPlaceKind.ts`. The place
     panel's chips pick one. The dot wears the mark on the map and in the lists, with its number on
     its shoulder, and a hazard is red. It names the column in every read, so it merges after the
     push.
  3. **The shared page: built**, on `claude/393-pins-way`, stacked on step 4. `painted-map-link`
     reads the kind and hands it on as the table keeps it, and `/way/<code>` draws the mark on its
     map and beside each place. The page holds the list, so a new kind needs no deploy. The
     function is deployed after the merge and after the push. Until then a link shows plain dots,
     and nothing breaks either way round.
  4. **The picture, the printed page and the file: built**, on `claude/393-pins-copies`, stacked on
     step 2. The picture draws each mark on the map and in its key. The printed page gives a place
     with a kind its mark in the list. A file draws nothing, so it says the kind in the place's
     name, as in *Hazard: Open trench*.

  **The list of kinds is a first list.** The card's pick was to wait until places were in use and
  learn the kinds from what people mark. Read on 2026-11-18, prod held no place on any painted map,
  so there was nothing to learn from. The seven are the card's examples and the six names the place
  panel already offered. The list is one array in the app and is the owner's to change.
- **C, a job's own pins: not started.** It opens with one call that is the owner's: whether
  Materials on site's places (`job_places`) get a point and become the pins, or a job's pins are a
  list of their own.

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
