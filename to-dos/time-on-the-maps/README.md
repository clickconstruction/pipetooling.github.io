---
name: "Time on the maps: older photos on every map that can hold them"
number: 395
group: ready
status: asked 2026-11-18 · read, drawn and shown the same day · the owner said to build the whole train the same day · building on claude/time-on-the-maps
summary: >
  The owner wants the older photos of Checklist → Review's map on every map in the app, behind one
  press. A Time press sits on the map beside Satellite and Streets. Pressing it frames one spot and
  opens a second row of dates under the map, with Today at its right end. Leaving the screen puts it
  away and nothing about it is remembered. Nineteen places draw a map: one has older photos today,
  five are easy, seven need care and six never get the press. The photographs are Esri's, so a
  Google map comes down while a date shows. One shared frame carries the switch, the press and the
  row, so no card writes them twice.
next: Step 1, the kernel, the press, the row and the shared frame, with Review moved onto them.
size: L as a train of seven (L · M · S · M · M · S · S)
blocker: None to build. Two readings stay open for the owner, on Google's terms and on Esri's tiles with no key, both under Risks.
opinion: build — the archive, its walk and the fall back canvas all exist, so the cost is one shared frame and the wiring
---

# Time on the maps (#395)

Mock-up: [mockup.html](mockup.html), and the same page as an artifact,
*Time on the Maps* — https://claude.ai/artifact/YKbHw9kfKT1Pv3X1LYTubm

This card follows v2.7693, which put **Older photos** on one map. It spreads that press to the
rest and gives it the shape the owner described.

## The ask, in the owner's words

2026-11-18:

> in all the Google Maps visuals across the app I would like to be able to jump back in time using
> the buttons we made where someone can see older layers of the map. I would like their exposure to
> be toggleable where there is a time button on google maps and then when someone activates it
> another row appears of toggles and when they leave the screen the toggle goes away

Then, after the mock-up and the calls below:

> Let's build the entire PR train, testing along the way

## What exists

- **Older photos** is on Checklist → Review's map, *Where the open tasks are*, and nowhere else
  (`src/components/checklist/TaskPlacesTeamMapCard.tsx`).
- **The archive** is Esri's World Imagery Wayback, read with no key. `src/lib/map/olderPhotos.ts`
  has the rules and `olderPhotosIo.ts` walks a spot's tile from the newest release to the oldest.
  One stop is one photograph. `src/hooks/useOlderPhotos.ts` is the walk as state.
- **A date's name.** A photograph is named by the day it was taken. That day comes slowly, so it
  reads **Before Jun 2018** until it lands.
- **Kept.** A finished walk is kept for the visit, and on the device for a week when every
  photograph has its day. Whether the press is on is kept nowhere.
- **One or the other.** The Google canvas is taken down while the archive shows, and the archive
  draws on the Leaflet canvas.
- **The fall back is the twin.** Every mark the Google pins canvas draws has a Leaflet twin in
  `PinsMapCanvas`, because Leaflet is the fall back. So no pins map has a mark only Google can draw.
- **Seven cards repeat one block.** Each resolves the provider, keeps `googleFailed`, loads two
  canvases lazily and picks between them.

## Every map

| Screen | Who | Drawn on | Over the map | Phone | Time |
|---|---|---|---|---|---|
| Checklist → Review, *Where the open tasks are* | Leaders | Google, Leaflet as the fall back | A dot a place, a colour a person, counts | 220 | Has Older photos. Step 1. |
| Checklist, *Where my tasks are* | Everyone | Leaflet, Esri and OpenStreetMap | Task dots | 220 | Easy. Step 4. |
| Dashboard, *Your jobs on a map* | Anyone with jobs | Google, Leaflet | Job pins | 260 | Easy. Step 2. |
| Bids → Bid Board, *Bids on a map* | Office, estimators | Google, Leaflet | Pins, due rings, clusters, office rings, a rail | 220 | Easy. Step 2. |
| Prospects → Research, and the permit places list | Office, estimators | Google, Leaflet | Permit pins, clusters, office rings | 360 | Easy. Step 2. |
| Hiring, *Find their home on the map* | Office | Google, Leaflet | One pin | 320 | Easy. Step 2. |
| Jobs → Pipeline, *Jobs on a map* | Pipeline viewers | Google, Leaflet | Pins, rings, clusters, a rail, **As of**, Crews | 220 | Care: two clocks on one card. Step 3. |
| Clock strip, *Where everyone is* | Leaders, office | Google, Leaflet | Head counts, the office, travel times | 240 | Care: a live map of people. Step 7. |
| Map page, `/map` | Office, estimators | Leaflet only, streets only | Pins, clusters, a drawn area, precincts, painted maps | 360 | Care: no Satellite today, and a drawing tool. Step 4. |
| Job → Materials, the site map | Office | Leaflet | Box pins, painted maps | 560 | Care: its own canvas. Step 5. |
| Tally → On site, the map sheet | Crews | Leaflet | Box pins, painted maps | full | Care: looking only. Step 5. |
| Tally, *Where is it?* | Crews | Leaflet | The box, the reader's dot, a line between | 240 | Care. Step 5. |
| The painting window | Whoever paints | Leaflet today, Google after #387 | Lines, numbered places, the glass, the walk | full | Care: reading only. Step 6. |
| Placing a pin: a box, a task's place | Crews, task givers | Leaflet | The ring in the middle | sheet | Never: a pin placed on an old photo lands wrong. |
| `/way`, a shared painted map | Outside readers | Leaflet | Lines, places, the reader's dot | 360 | Never: an outside page reads one map and nothing else. |
| Task cards, the small place and map pictures | Everyone | Leaflet, held still | One pin, painted lines | 110 to 150 | Never: a still, with no room for a second row. |
| Permits, the skim card | Office | Google, held still | One pin | 104 to 124 | Never: a still. |
| A painted map's picture and print | Whoever paints | An image stitched from Esri tiles | Lines, places | none | Never: a picture, not a map. |
| Legal desk Map, the county picker | Office, law firms | A drawing of Texas counties | Case dots | none | Never: no photograph under it. |

## The calls, each with a pick

1. **The press.** **Time**, with a clock, to the right of Satellite and Streets. On, it fills dark.
   With a date showing it reads **Time · Mar 2019**, and the date alone on a phone.
2. **The row.** One line under the map, oldest on the left, **Today** held at the right end. It
   slides sideways, so thirty dates stay one line. It sits under the map and not on it, because the
   map's edges hold the zoom buttons and Esri's credit.
3. **Time frames the spot.** The press zooms to one spot on today's photograph, with **Today** lit.
   A date swaps the photograph and keeps the framing, so then and now can be flipped. The first
   mock-up left the map alone until a date was pressed. That gave a wide map of today beside a close
   photograph of the past, which compares nothing.
4. **Leaving Time.** **Time** again, **Satellite** or **Streets**. The map fits its dots again.
5. **Leaving the screen.** Time lives in the map on screen. Another tab, a closed window or
   *Hide map* ends it. Sending the app to the background does not. Only the dates found are kept.
6. **Which spot.** The open dot, or the only dot, or the screen's own place, such as a job's
   address. With several dots and none open the row says *Press a dot to pick the spot.*
7. **A new spot keeps its date.** With a date showing, a press on another dot shows the photograph
   the same release has there. The archive's releases cover the whole map, so nothing is asked twice.
8. **What stays in the past.** Dots, counts, lines and the office stay, not dimmed. The row says
   *The dots are today's*. On Jobs it says the pins' own day, and the two clocks stay apart: As of
   starts in February 2026 and most photographs are older than that.
9. **One or the other.** The Google map comes down while a date shows and comes back on Today.
10. **One piece.** `PinsMapFrame` around the two pin canvases carries the provider rule, the
    switch, the press and the row. The maps with their own canvas take the hook, the press and the
    row, and swap one tile layer.
11. **Satellite on every card.** The frame gives each card the Satellite and Streets switch. A card
    that had none opens on Streets as before.

Weighed and not picked: a slider, since the dates are uneven and Jobs already has one for another
clock. Then beside now in two halves, since Google beside Esri breaks Google's rule; Esri beside
Esri is allowed and is a later card. One date for the whole map, since a date means one spot.

## Risks said plainly

- **Google's terms, 3.2.3 (e).** They keep a Google map from being used with or near another
  provider's map, and one of their examples is linking a Google map to one. A press on a Google map
  that swaps it for Esri's is close to that example. v2.7693 made this call for one map and this
  card spreads it to seven. Read in a browser on 2026-11-18.
- **Esri's tiles with no key.** World Imagery is under Esri's Master License Agreement. Whether an
  app that is not Esri's may read its tiles with no key was not confirmed. The app already does on
  four canvases. An ArcGIS account and key would settle it.
- **Cost.** No key and no bill. A first open reads one list, about fifteen to fifty small answers
  for the walk, and one slow answer a photograph for its day.
- **The Google half cannot be seen before a merge.** The browser key is a deploy secret. Each step
  is walked on the live app after its deploy.

## How it meets #387

[Painted maps on a Google map (#387)](../painted-maps-on-google.md) keeps the Leaflet painting
canvas as its fall back. Time makes that canvas the archive's canvas too, so it cannot be retired.
Time in the painting window is for reading and never shows while a line is being drawn.
Google's terms, 3.2.3 (c), also forbid tracing roads, building outlines or utility lines from its
Satellite map, which #387 should read before a line is painted by hand over Google's photograph.

## The plan

1. **The kernel, the press, the row and the frame** (L). `src/lib/map/mapTime.ts`, `useMapTime`,
   `MapTimeRow`, `MapViewControl`, `PinsMapFrame`. Review moves onto them and *Older photos*
   becomes **Time**. Guide, release note, fragment, Glossary.
2. **Four easy cards** (M). Dashboard, Bid Board, Research and *Find their home* on the frame.
3. **Jobs → Pipeline** (S). On the frame, beside As of.
4. **My tasks and the Map page** (M). Both on the frame's Leaflet half.
5. **The Materials maps** (M). `OnSiteMap` takes Time when it is looked at, never when a pin is
   being placed and never as a still.
6. **The painting window** (S). `PaintedMapCanvas` takes Time when nothing is being drawn. `/way`
   does not pass it.
7. **Where everyone is** (S). On the frame.

## How to verify

- Kernel tests for the words, the lit date, the step and the carried date. Render smokes for the
  row, the frame's swap between the canvases, and each card.
- A scratch page with made-up dots against the live archive at a desk's width and a phone's, light
  and dark: the row, a date, Today at the same framing, and Time off.
- After each deploy, the same walk on the live app over the Google map, which no local run can see.
