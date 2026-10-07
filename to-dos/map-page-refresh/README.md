---
name: "Map page refresh: the office first, pins by status, places with a rail, the address sheet, precincts as a layer"
number: 96
group: ready
size: 5 PRs, each small
blocker: none
status: claude/map-refresh-4-address-sheet — PRs 1 (v2.4791), 2 (v2.4796), 2b (v2.4802), 3 (v2.4804) and 4 (v2.4805, the address sheet) built 2026-10-07; PR 5 next.
summary: >
  The Map page plots every job, bid and estimate but opened on open ocean (two wrong geocodes
  dragged the fit), drew every job the same blue whether working or paid, showed nine drawing tools
  for one, and listed 900 rows with no count, sort, distance or money. The refresh brings it the
  things the Bid Board and Pipeline maps already learned — the office and its rings, status colors,
  clusters, popups with Directions, the phone bar — and gives it a rail of places in place of the
  table, an address sheet for the records the map cannot place, and the court areas as a layer.
next: >
  PR 5: a Precincts chip that draws the court areas without the drawing mode; the place card names
  the county and precinct; the guide updated.
---

# Map page refresh

## The ask, in the owner's words

2026-10-07: *This page could use a general refresh. I think it could do more and look better. Please take a deep look at it and give me a proposal.* On the proposal: *Go with your recommendations on all four, start PR 1.*

## What was found (2026-10-07, live as the dev)

- The page fitted the map to every pin. Two jobs are geocoded to the wrong continent (Grier Ranch in California, Zack's house in Assam), so a desktop opened on open ocean at zoom 12 and a phone on the whole world. No Fit all.
- Every job the same blue; paid jobs are most of the 921 pins. The Pipeline map already colors by section with Paid off.
- Geoman showed nine tools; only the polygon is used.
- The table: 923 rows, one per record (one customer with nine jobs is nine rows), no count, sort, distance or money; cut off on a phone.
- Four addresses fail to geocode on every visit and their progress list sat in the header. Nothing listed the records with no location; nothing flagged a wrong one. Review geocodes hid behind a Debug corner.
- None of the shared map toolkit (anchor, rings, clusters, Fit all, popups with Edit / Directions, phone bar, hover pulse, scroll gate) had reached the page; it kept its own copy of the geocode flow.

## The decision (the owner's four calls, taken as recommended)

1. **Places, not records** — one pin per address with a count badge; the card lists the records.
2. **Estimates stay** as a layer that starts off.
3. **The rail replaces the table** — the selected place's card, the distance bands, the list in view nearest first.
4. **300 miles** is the line past which a pin is out of every fit: drawn, listed by address with its count and distance. A far pin is a far job as often as a wrong address (29 of the first 31 were one real site in South Carolina), so the list says which address and how many records, and a person decides.

Stays as it is: OpenStreetMap on this page (drawing and the precinct layer are Leaflet-only, so the Google provider rule does not apply); the Court areas mode.

## The mock-up

`mockup.html` beside this file — the desktop with the rail, and the phone twice (a pin tapped; the first view).

## Where it plugs in

- Page: `src/pages/Map.tsx` → `src/components/map/MapPageView.tsx`; data `src/hooks/useMapPageData.ts` (its own geocode flow; the cards use `useAddressGeocodeCoords`).
- Shared toolkit: `src/components/map/PinsMapCanvas.tsx` (+ `PinsMapGoogleCanvas`), `src/lib/map/clusterPins.ts`, `pulseTarget.ts`, `scrollZoomGate.ts`, `mapCanvasTypes.ts`, `mapPointsBounds.ts`; the office anchor `useOfficeAnchor` / `resolveOfficeAnchor`; the home fit `bidBoardMapHomeFitPoints`; the colors `jobsLedgerStatusDotColor`, `BID_STAGE_MARKER_COLOR`.
- Court areas: `CourtAreasLayer`, `CourtAreasPanel`, `src/lib/legal/courtAreas*.ts`.
- The Bid Board's address sheet: `BidBoardMissingAddressesModal` + `composeMissingAddressRows`; the Google re-check: `MapGeocodeReviewModal` (`geocode-one` `refresh_google_only`).

## The plan

1. **The first view** (v2.4791): office anchor + rings, home fit, Fit all, far pins out of the fit and listed, the toolbar cut to the polygon. Kernel `src/lib/map/mapPageFirstView.ts`; `LeafletOfficeAnchor` lifted out of the canvas.
2. **The shared canvas** (v2.4796): `PinsMapCanvas` gains a `children` slot (Leaflet only) so the page mounts `GeomanDraw`, `CourtAreasLayer` and its fly-to inside it; popups with Open / Directions, the phone bar, the scroll gate; the page's own `MapContainer` and its default-view read go. Kernel `src/lib/map/mapPagePins.ts`. **2b** (v2.4802): pins by status (jobs by Pipeline section with the Collections ring, bids by board section with the due ring, estimates violet), the chips as key and switches with counts, Paid / Lost / Estimates off by default, the Cluster toggle. Kernel `src/lib/map/mapPageSections.ts`.
3. **Places and the rail** (v2.4804): `mapPagePlaces.ts` (records grouped by address key, the badge count, the liveliest record's color, the most urgent ring, the bands, the nearest list, the totals), `MapPageRail.tsx` with `PlaceCard` (also the popup), hover pulse; the table retired; the drawn area filters the map; the phone stacks the rail under the map.
4. **No location and wrong location** (v2.4805): `MapAddressSheet` — no address, not found with the geocoder's reason and a Google Maps check, far with the Google re-check; `mapPageUnplaced.ts`; the geocode progress list left the header; Debug removed (Review geocodes from the sheet). Typing the address in the sheet itself is not built: the record is one click away.
5. **Precincts as a layer**: a Precincts chip draws the court areas without the mode; the place card names county and precinct; guide updated.

## How to verify

Dev login, `/map`. PR 1: the map opens on the office ring with the diamond and two rings; the toolbar has Fit all; the line under the map names the far pins with miles; the map's left toolbar shows + − and the polygon only; Court areas still draws and saves. Phone: the same at 375 px.

## Where it stands

PRs 1 (v2.4791), 2 (v2.4796), 2b (v2.4802), 3 (v2.4804) and 4 (v2.4805) built 2026-10-07. The two wrong geocodes are the office's to fix by hand on the job records; nothing here changes data.
