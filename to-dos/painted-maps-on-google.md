---
name: "Painted maps on a Google map"
number: 387
group: ready
status: asked 2026-11-17 · read the same day · the owner picked it to build first, then parked it on the punch list the same evening · Grace's word to build 2026-11-19 (*Please build*), which is not the billing look · step 1, the kernel, built the same day (v2.7979, #8974), with no screen changed · Google's terms read at that step, and a sixth call added from them · the Google canvas's doors to Leaflet moved to one place and mended the same day (v2.7981, #8975) · step 2, a Google canvas for looking, built the same day (v2.7990, #8984) and proved in a headless browser against Google's own script, held as a draft until the count was read · the month's count read 2026-11-20 in the Google console, from Grace's Chrome: 4,269 Dynamic Maps loads for November 1 to 20 against the 10,000 free, 3,871 in October, nothing billed · step 2 rebased over #402's four PRs and armed on Grace's number the same day
summary: >
  The owner wants to paint and read a painted map over Google's map, not the map it draws on today.
  Today *From above* is Esri's photograph and *Streets* is OpenStreetMap, both on Leaflet. The app
  already draws seven other maps on Google through one browser key, with Leaflet as the fall back, so
  no new key is needed. The work is the painting canvas itself: the line drawn by hand, its corners,
  the magnifying glass and the walk are all written against Leaflet. One canvas serves the painting
  window and the public `/way` page, so those two move together. The picture and the print stitch map
  tiles into an image, which Google does not allow for its tiles, so they need their own call.
next: Step 2 (#8984) merges on the count read 2026-11-20, then is walked on the live app on a made-up map on no job and thrown away after. Before step 3, the owner's word on call 6. Steps 4 and 5 are not started.
size: L as a train of five (S · M · L · S · S)
blocker: One call. Step 3 waits on call 6, drawing by hand over Google's photograph. Step 4 wants the count looked at again first, since `/way` counts every outside reader.
opinion: build — the count read 2026-11-20 leaves room under the free 10,000, and the key, the fall back rule and a shared Google canvas already exist, so the cost is the drawing tools, not the plumbing
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
Since v2.7814 it is also the canvas **Time** draws on (punch list #395): the photo archive is Esri's and cannot sit on a Google map, so the Leaflet canvas must stay whole, and a Google painting canvas goes down while Time is on.

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
   Read on 2026-11-19: Google's pages name what it bills a successful map load and do not say whether a second map on one page is a second one, so the plan counts the glass as one more.

6. **Drawing by hand over Google's photograph.** Found at step 1, when the terms were read (v2.7979).
   Google's terms (3.2.3 (c)) forbid making content from its content, and the first example is tracing roads, building outlines and utility posts from the satellite view.
   A line drawn by hand along the road in the photograph is close to that example, and so is a meter, a shutoff or a cleanout dragged onto its spot.
   The app then keeps the line, shows it on maps that are not Google's, prints it and sends it out as a file.
   My pick: read painted maps on Google and keep drawing by hand on Esri's photograph, which is steps 2, 4 and 5 without step 3.
   The other choice is the owner's own reading, or a lawyer's, that marking a way in is not tracing, and then step 3 as planned.
   A walked line comes from the phone's readings and not from the photograph, so it reads differently and could move to Google by itself.
   The kernel keeps `drawing` and `placing` off Google until this is settled, and a test holds the line.
   This is a reading and not legal advice.

## Risks said plainly

- **Two photographs do not line up exactly.** Esri's and Google's pictures of one spot can sit a few
  feet apart. A line drawn by hand over Google's photograph may sit a little off on a picture or a
  print still made from Esri's. Not measured.
- **Sharper is not promised.** Which photograph is newer or sharper varies by place.
- **Cost.** #345 read Google's free count as 10,000 opens of the basic map a month since March 2025,
  billed past it. Read again on Google's pricing page on 2026-11-19: 10,000 free a month for Dynamic Maps,
  then $7.00 for each 1,000 up to 100,000, with or without a Map ID. The app's seven Google maps already
  draw on that count. Read in the console on 2026-11-20: 4,269 loads for November 1 to 20, about 6,400 for
  the month at that pace, 3,871 in October, and nothing billed.
- **Old maps.** Every painted map already saved was drawn over Esri's photograph. They will open on
  Google's with the same small shift.

## The plan

1. **The kernel** (S). Which map the painting canvas draws on, from the key, a failure on the page
   and the screen it is on. The picture's own rule. Tests. No screen changes.
   Built 2026-11-19 (v2.7979): `src/lib/paintedMap/paintedMapProvider.ts`. Its reach is empty, so every answer is still Leaflet, and each step below adds its own word to it.
2. **A Google canvas for looking** (M). Lines, places, the person's dot, the first view and refit.
   Mounted in the painting window when nothing is being drawn, with the Leaflet canvas as the fall
   back. Guide `paint-a-map`, release note, fragment, the Glossary's entry amended.
   Built 2026-11-19 (v2.7990, #8984). Held as a draft until the count was read on 2026-11-20, then armed.
   One thing differs from the line above: a window that has left Google's map to draw or to place keeps the Leaflet canvas until it closes, so a new line stays on the photograph it was drawn over.
   Google bills by the map made, and the canvas keeps one map for the whole visit, so going to Time and back or opening a second painted map makes no new one.
3. **Drawing by hand on Google** (L). Corners, the held press, the catch, the magnifying glass and
   the walk. After this the window is on Google from start to Save. Waits on call 6.
4. **The public page** (S). `/way` on the same canvas, once the billing look says yes.
5. **The person's task map** (S). `TaskPlacesMapCard` on the shared Google canvas, as v2.7686 did for
   the team's.
   The count read on 2026-11-20 leaves room for it, but it opens a Google map on Today for everyone with task places, so the count is worth a second look when it is built.

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
