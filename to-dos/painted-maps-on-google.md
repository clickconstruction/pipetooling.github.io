---
name: "Painted maps on a Google map"
number: 387
group: ready
status: asked 2026-11-17 · read the same day · the owner picked it to build first, then parked it on the punch list the same evening · nothing built
summary: >
  The owner wants to paint and read a painted map over Google's map, not the map it draws on today.
  Today *From above* is Esri's photograph and *Streets* is OpenStreetMap, both on Leaflet. The app
  already draws seven other maps on Google through one browser key, with Leaflet as the fall back, so
  no new key is needed. The work is the painting canvas itself: the line drawn by hand, its corners,
  the magnifying glass and the walk are all written against Leaflet. One canvas serves the painting
  window and the public `/way` page, so those two move together. The picture and the print stitch map
  tiles into an image, which Google does not allow for its tiles, so they need their own call.
next: The owner's word to build and a look at the Google billing console, then step 1, the kernel.
size: L as a train of five (S · M · L · S · S)
blocker: The owner's word, and one look only the owner can take. Google bills by the map opened and `/way` counts every outside reader, so the month's count against the free allowance is read before step 2.
opinion: build, after the billing look — the key, the fall back rule and a shared Google canvas already exist, so the cost is the drawing tools, not the plumbing
mockup: not required — the presses and the tools stay where they are and only the map under them changes, and Google's own tiles cannot be drawn in a mock-up without the live key
---

# Painted maps on a Google map (#387)

This card follows [Paint a map (#345)](paint-a-map/README.md), which built painted maps on Leaflet and
left Google as *a switch for later*. This is that switch.

## The ask, in the owner's words

2026-11-17, with two screenshots of a painted map on his phone:

> I want to be able to not use OpenStreetMap, I want to see Google Maps

The first ask on #345 said it too: *draw a line on a Google Maps overlay*.

He picked it to build first the same evening, then changed his mind:

> add the Google Maps Change to the punchlist and open a punchlist card

## What a painted map draws on today

- **From above** is Esri's World Imagery. **Streets** is OpenStreetMap. Both are free tiles on Leaflet.
  So moving to Google swaps both pictures, not only the streets.
- **One canvas, two screens.** `src/components/paintedMap/PaintedMapCanvas.tsx` is mounted by the
  painting window (`PaintedMapWindow.tsx`) and by the public page (`src/pages/PaintedWay.tsx`).
- **A layer on two other maps.** `PaintedMapsLayer.tsx` lays painted maps over the Map page
  (`MapPageView.tsx`) and Materials on site (`OnSiteMap.tsx`). Both of those are whole Leaflet maps,
  and the Map page's drawing tool is Leaflet's own.
- **A person's task map.** `TaskPlacesMapCard` draws on `TaskPlacesMapCanvas`, Leaflet. The team's
  map on Checklist → Review moved to Google in v2.7686, and that note left this one as a follow-up.
- **The picture and the print.** `src/lib/paintedMap/paintedMapPicture.ts` and
  `paintedMapPictureIo.ts` load Esri's tiles and paint them into one image.

## What the app already has

- **The key.** `VITE_GOOGLE_MAPS_BROWSER_KEY`, a deploy secret. It is nowhere local.
- **The rule.** `resolveDashboardMapProvider` in `src/lib/dashboardJobsMap.ts`: Google when the key
  is set and the API loads, Leaflet with no key or once Google fails on the page.
- **A Google canvas for pins.** `src/components/map/PinsMapGoogleCanvas.tsx`, on
  `@vis.gl/react-google-maps`. It draws dots and an info window. It draws no line and takes no
  drawing press, so it is a model for the new canvas, not the canvas.
- **The map type.** `src/lib/map/googleMapType.ts`: Satellite is `hybrid`, Streets is `roadmap`, and
  a photograph is held flat so a dot does not slide off its spot.

## What is new

A second painting canvas on Google with the same props as today's, so the window and `/way` choose
between the two and nothing above them changes. It has to carry everything the Leaflet one does:

- the saved lines, with their poor parts, and the numbered places with their taps;
- the line being drawn: a press adds a corner, a corner drags, a middle dot inserts one;
- the press held still that becomes a placing press, and the catch on a nearby corner;
- the magnifying glass, which today is a second small map riding above the finger;
- the walk: the dot for the person, follow, and the frame that keeps them in view;
- the first view, refit and fly to a place.

The Leaflet canvas stays as the fall back, as on every other map in the app.

## The calls, each with a pick

1. **Which screens.** The painting window and `/way`, then the person's task map. The Map page and
   Materials on site stay on Leaflet: each is a whole map with its own tools, and each would be its
   own card.
2. **What *From above* is on Google.** `hybrid`, the photograph with street names, as Review's map
   chose. The other choice is the bare photograph.
3. **The picture and the print.** Keep them on Esri for now. Google's paid picture service is the
   other choice, and its images are small. Read Google's terms at that step: the v2.7686 note reads
   them as not allowing a Google map used with or near another provider's map, and a picture made
   from Esri's tiles by an app that shows Google's map may fall under that.
4. **The public page.** Google in the app first. `/way` moves only after the billing look, since
   every outside reader's open counts.
5. **The magnifying glass.** One small Google map made when the window opens and kept, never one per
   drag. Whether Google counts it as its own map opened is read at that step.

## Risks said plainly

- **Two photographs do not line up exactly.** Esri's and Google's pictures of one spot can sit a few
  feet apart. A line drawn by hand over Google's photograph may sit a little off on a picture or a
  print still made from Esri's. Not measured.
- **Sharper is not promised.** Which photograph is newer or sharper varies by place.
- **Cost.** #345 read Google's free count as 10,000 opens of the basic map a month since March 2025,
  billed past it. The app's seven Google maps already draw on that count. The real numbers are in the
  billing console, which no session can see.
- **Old maps.** Every painted map already saved was drawn over Esri's photograph. They will open on
  Google's with the same small shift.

## The plan

1. **The kernel** (S). Which map the painting canvas draws on, from the key, a failure on the page
   and the screen it is on. The picture's own rule. Tests. No screen changes.
2. **A Google canvas for looking** (M). Lines, places, the person's dot, the first view and refit.
   Mounted in the painting window when nothing is being drawn, with the Leaflet canvas as the fall
   back. Guide `paint-a-map`, release note, fragment, the Glossary's entry amended.
3. **Drawing by hand on Google** (L). Corners, the held press, the catch, the magnifying glass and
   the walk. After this the window is on Google from start to Save.
4. **The public page** (S). `/way` on the same canvas, once the billing look says yes.
5. **The person's task map** (S). `TaskPlacesMapCard` on the shared Google canvas, as v2.7686 did for
   the team's.

The picture and the print are call 3 and are not in the train.

## How to verify

- The key is a deploy secret, so Google's tiles cannot be seen before a merge. Locally, a one-screen
  harness with Playwright proves three things: with no key the Leaflet canvas draws, with a key the
  Google canvas mounts with its map type, and when Google refuses the key the screen falls back with
  its lines and presses working.
- After each merge, walk it on the live app on a made-up map on no job: draw a line by hand, place a
  corner under the glass, save, open the link, then throw the map away.
- Before step 3 merges, one walk on a real phone outside. The held press and the glass have only
  ever been walked in a headless browser.

## Out of scope

The Map page and Materials on site. Pins of new kinds on a painted map. The Dashboard's Paint a map
press. Any change to who can open a map or make a link.
