---
name: "Painted maps on a Google map"
number: 387
group: ready
status: asked 2026-11-17 · read the same day · the owner picked it to build first, then parked it on the punch list the same evening · Grace's word to build 2026-11-19 (*Please build*), which is not the billing look · step 1, the kernel, built the same day (v2.7979, #8974), with no screen changed · Google's terms read at that step, and a sixth call added from them · the Google canvas's doors to Leaflet moved to one place and mended the same day (v2.7981, #8975) · step 2, a Google canvas for looking, built the same day (v2.7990, #8984) and proved in a headless browser against Google's own script, held as a draft until the count was read · the month's count read 2026-11-20 in the Google console, from Grace's Chrome: 4,269 Dynamic Maps loads for November 1 to 20 against the 10,000 free, 3,871 in October, nothing billed · step 2 rebased over #402's four PRs and armed on Grace's number the same day · merged the same day and walked on clicktooling.com on a made-up map on no job: drawn on Esri's photograph and saved, opened again on Google's photograph with the street names, then **Streets**, **Time** and **Draw a line**, each as built, and the map thrown away after · the automatic check of the live site found to be most of the month's count and taken off Google the same day (v2.8049, #9056) · step 5, the person's task map, built the same day on the owner's own word (v2.8032, #9037) · audited the same day on a made-up map on the local server, both maps side by side at 320, 390 and 1400 px: two mends opened (#9089, #9090) and two things left for the owner (*The audit*, below)
summary: >
  The owner wants to paint and read a painted map over Google's map, not the map it draws on today.
  Today *From above* is Esri's photograph and *Streets* is OpenStreetMap, both on Leaflet. The app
  already draws seven other maps on Google through one browser key, with Leaflet as the fall back, so
  no new key is needed. The work is the painting canvas itself: the line drawn by hand, its corners,
  the magnifying glass and the walk are all written against Leaflet. One canvas serves the painting
  window and the public `/way` page, so those two move together. The picture and the print stitch map
  tiles into an image, which Google does not allow for its tiles, so they need their own call.
next: Before step 3, the owner's word on call 6. Step 4 is not started, and the count is looked at again before it, since every outside reader's open counts. Step 5 is built (v2.8032), and its count is worth a look about a week after. Three things are the owner's call, each below. Google's own place labels over the photograph. A map that is not Google's on the page behind the window. The ten seconds a slow phone waits before the fall back.
size: L as a train of five (S · M · L · S · S)
ver: v2.7979 · v2.7981 · v2.7990 · v2.8032 · v2.8049
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
- **Google's own labels.** Seen on the live walk of step 2: Google's photograph with street names also carries Google's own place labels, such as rooms, shops and an ATM.
  At the zoom a site is read at there can be a dozen of them around a line.
  They cannot be pressed, and the road map carries them too.
  Google's map can be told to hide them, and whether it should is the owner's call.
- **Cost.** #345 read Google's free count as 10,000 opens of the basic map a month since March 2025,
  billed past it. Read again on Google's pricing page on 2026-11-19: 10,000 free a month for Dynamic Maps,
  then $7.00 for each 1,000 up to 100,000, with or without a Map ID. The app's seven Google maps already
  draw on that count. Read in the console on 2026-11-20: 4,269 loads for November 1 to 20, about 6,400 for
  the month at that pace, 3,871 in October, and nothing billed.
  Read again the same day (v2.8049): most of those loads were the automatic check of the live site, which no longer opens a Google map.
  On the five days that check reached no page, people made 4 to 19 requests a day.
  So the pace above is too high, and the room under the free 10,000 is wider than it reads.
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
   Built 2026-11-20 on the owner's own word from a walk on a phone (v2.8032): Google by default, with a press on the map that switches to the OpenStreetMap map and is kept on the device.

The picture and the print are call 3 and are not in the train.

## The audit, 2026-11-20

Steps 1 and 2, the doors to Leaflet and the suite's change were read and walked by a second session, on the local server with a made-up key, on a made-up map on public ground and on no job.
Google drew with the key taken off its script's address, which gives its own tiles with a watermark.

What held:

- **The rule.** Only the painting window, and only for looking, draws on Google. The public page `/way` made no request to Google with a key in the build, at a phone and at a desk.
- **The drawing.** The same saved map on both canvases at 390 px: every line, dash, dot and mark on the same pixel. Google's dash has square ends and a clear gap. Leaflet's has round ends that nearly close the gap. Both read as dashed.
- **The changes of map.** **Time** took Google down and gave it back with no new request to Google. So did closing the window and opening the map again. **Draw a line** and **Make a picture** each brought the Leaflet canvas up on the same spot, and the window kept it.
- **A refused key and a blocked script.** The Leaflet canvas came up with every line and place, within a second of Google's canvas for a refused key, and 0.3 s after the window opened for a script that failed outright.

Two mends, each its own pull request:

- **A key refused earlier on the page** (#9089). Google says no once for a page. A painted map opened after a page's own map had fallen back waited eight seconds on an empty frame.
- **A blank frame while Google loads** (#9090). With the script slow, the frame was a white box with no word for up to ten seconds. It now says *Loading the map…*.

Left for the owner:

- **A map that is not Google's on the page behind the window.** At a desk the window is 1,080 px wide over a dimmed page. Opened from the Map page or from Materials on site, that page's Leaflet map shows beside Google's map, at the window's edge. The rule takes Google down for Time and for a picture because of the terms' clause on maps that are not Google's (3.2.3 (e)), and by that same reading this is the one place the two still share a screen. A page that cannot be seen behind the window while Google is up would end it. This is a reading and not legal advice.
- **The ten seconds.** A painted map is read in the field. On a slow signal the reader now waits up to ten seconds for a map that used to show its lines at once. A shorter wait for this canvas, or the lines drawn on the Leaflet canvas while Google loads, would mend it.
- **Google's own place labels**, as the risk above says. In the walk a park's name and its one-line description sat beside the line.

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
