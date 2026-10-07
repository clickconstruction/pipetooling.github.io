---
name: Map residuals
number: 100
group: residual
status: recorded 2026-10-07 · neither item built · item 1 waits on a mock-up and on redrawing proving slow · item 2 waits on a pick among the options
summary: >
  Two things the Map page shipped without, on purpose. Court areas (v2.4769) cannot move a
  vertex: changing a precinct's shape is remove and redraw. And an address no geocoder can
  place (four on 2026-10-07) is asked again on every visit to the Map page and on every mount
  of the map cards, because geocode-address-batch stores hits only (v2.4805).
next: Item 1 when the office finds redrawing slow — a mock-up of the edit on the Court areas panel first, then one client PR. Item 2 — pick where a miss is remembered and how long it waits (the options below), then one PR and a function deploy.
size: S (item 1, client only) · S–M (item 2, a migration and a function deploy)
blocker: Item 1, a mock-up and a reason to build it. Item 2, none beyond the pick.
ver: v2.4769 · v2.4805
---

# Map residuals: moving a court area's vertex, and the misses the geocoder asks again

Two items the Map page's fragments deferred, recorded 2026-10-07. Item 1 changes a screen and waits on a mock-up. Item 2 changes no screen (the sheet keeps the same rows and reasons; only the repeat lookups go) and needs none.

## 1. Court areas: move a vertex instead of redrawing

**The ask** — [v2.4769](../docs/recent-features/v2.4769.md), *Is this the best we can do?*: "Not done: moving a vertex. Changing a shape is remove and redraw. Vertex editing with the plugin is the next cut if redrawing proves slow."

**Where it plugs in**

- `src/components/map/MapPageView.tsx` → `GeomanDraw`: the toolbar carries the polygon tool alone, with `editMode: false` (and drag, cut, removal and rotate off). Turning `editMode` on is global: Geoman's global edit mode enables every layer on the map not marked `pmIgnore`, so the pins (`Marker` / `CircleMarker` in `PinsMapCanvas.tsx`), the office rings (`Circle` in `LeafletOfficeAnchor.tsx`) and the area filter's shape would all become editable. Editing the one area picked (`layer.pm.enable()` on its layer) avoids that.
- `src/components/map/CourtAreasLayer.tsx`: draws each active area as a react-leaflet `<Polygon>` and keeps no ref to it; a new shape arrives from Geoman's `pm:create` and goes through `polygonFromDrawn`. An edit holds the picked area's layer, and on Save hands `polygonFromDrawn(layer.toGeoJSON())` up. Cancel puts the stored shape back.
- `src/components/map/CourtAreasPanel.tsx`: each area's row has *Rename* (county, precinct, label, drawn from) and *Remove* (retire after a confirm). The edit's door and its Save / Cancel belong on that row.
- `src/lib/legal/courtAreasIo.ts`: `updateCourtArea(db, id, patch)` already takes `polygon` and stamps `updated_at`; only *Rename* calls it today, with words. No migration: `court_areas.polygon` is jsonb (`20261007110000_court_areas.sql`).
- The classification: `court-precinct-nightly` (kernel `supabase/functions/_shared/courtAreasClassify.ts`) reads the active areas each night, and *Classify now* runs it at once. A moved vertex changes no property record's precinct until one of them runs.
- Guide `src/content/help/draw-the-justice-precincts-on-the-map.md`, *Fix or remove one*: "To change the shape itself, remove it and draw it again." It is rewritten with the feature.

**Open questions for the mock-up**

- Imported areas (solid on the map, `source = 'imported'`, from a county file): editable too? If so, does an edited one stay *imported*, or become *drawn* with a note in `source_note`?
- Two areas that share an edge do not move together. Geoman's snapping (`snappable`) can land a moved vertex on the neighbour's edge; a pin left in a sliver between them, within 100 m of both, reads *on a line* for a person to settle (`COURT_LINE_METRES`).
- A precinct in two pieces is a MultiPolygon; each piece edits on its own, and the save keeps one shape.

**The plan** — after the mock-up, one client PR: the door on the panel row, the per-area edit in `CourtAreasLayer`, the save through `updateCourtArea`, a render test for the panel's door, and the guide's *Fix or remove one*. The map edit itself is checked in a browser (Leaflet is not under test).

**How to verify**

- As the dev, Map → *Court areas*. Draw a throwaway area where no pins sit, name it, save it. Move one vertex, save. Reload: the shape holds, the row's `updated_at` moved, and the coverage line recounts.
- While the edit is open, the pins, the rings and the filter shape stay put.
- Cancel puts the old shape back.
- Remove the throwaway area in the same sitting. The nightly classification reads every active area, so a test area left overnight would place real addresses. A removed area stays in the table as a retired row (`active = false`).

## 2. Failed geocodes are asked again on every visit

**The ask** — [v2.4805](../docs/recent-features/v2.4805.md), *Is this the best we can do?*: "the four addresses the geocoder re-asks on every visit are still re-asked (a cached miss belongs to `geocode-address-batch`)".

**What happens today** (2026-10-07): four addresses fail. Each reads *Address not found — No match from OpenStreetMap or Google; no match from US Census*. Two are street addresses with a unit or lot number on the end; two are not addresses at all (a surname, and a few words about the work). The Map page's sheet lists them under *Could not be found*. Every visit asks all three geocoders again, then shows the same reason.

**Where it plugs in**

- `supabase/functions/geocode-address-batch/index.ts`: per address it reads `address_geocodes`. On a miss it asks OpenStreetMap (Nominatim, 1.1 s apart), then Google (when `GOOGLE_MAPS_API_KEY` is set; a billed request), then the US Census. It writes `address_geocodes` on a hit only. A failure goes back in `failures` (`error_code`, `detail`) and nothing is stored, so the next call asks all three again.
- `address_geocodes` (baseline): `lat` and `lng` are NOT NULL. A `geocode_error` text column exists, and every write sets it to null. Every signed-in user reads, inserts and updates (`20260908035852_address_geocodes_all_roles.sql`); delete stays with the map roles (Settings → *Review geocodes*); the read-only fences block training-mode writes, and the function tolerates the refusal (`isRlsRefusal`).
- `src/hooks/useMapPageData.ts`: every load reads the cache for every key, then sends each key with no row to the function in chunks of 20. Its `geocodeAddressRows` feed the line under the map (*Placing 4 addresses…*, `unplacedLine` in `src/lib/map/mapPageUnplaced.ts`) and the sheet's *Could not be found*.
- `src/hooks/useAddressGeocodeCoords.ts`: the same pair for the map cards — Dashboard *Your jobs on a map* (`useDashboardJobsMapPins.ts`), the Jobs map card, the Bid Board map card and the Clocked-in map. Its `askedRef` stops a repeat within one mount only.
- Also calling the function: `src/components/quickfill/QuickfillScheduleSection.tsx` (its own invoke) and the address picker's prewarm (`prewarmAddressGeocode` in `src/hooks/useAddressSuggestions.ts`).
- The sheet: `src/components/map/MapAddressSheet.tsx`; the reason words: `src/lib/map/geocodeErrorMessage.ts`.
- Docs: `docs/EDGE_FUNCTIONS.md` → *geocode-address-batch*; guide `src/content/help/see-every-job-and-bid-on-one-map.md`, *Records the map cannot place*, which says the line reads *Placing 4 addresses…* while the geocoder works.

**Options** (nothing decided)

1. **A miss row in `address_geocodes`**: make `lat` / `lng` nullable, and write `geocode_error` with a retry-after (a new column, or `geocoded_at` plus a fixed wait). The function returns the stored reason without asking until the wait passes. Every reader of the table then has to skip rows with no point (`grep -rln address_geocodes src supabase/functions`): the hooks above, `MapGeocodeReviewModal`, `JobFormAddressPin`, `QuickfillScheduleSection`, and the functions `geocode-one`, `court-precinct-nightly`, `owner-confirm-nightly` and `property-lookup`. The hooks cast rows to their own `GeocodeRow` type, so regenerated types (`lat: number | null`) will not flag them all; each reader needs a look. A miss row would also show in *Review geocodes*, where deleting it forces a fresh ask.
2. **A separate miss table** (for example `address_geocode_misses`: the key, the error code and detail, when it was tried, how many times, and when to try again). `address_geocodes` and its readers stay as they are; only `geocode-address-batch` (and `geocode-one`, if a hit there should clear a miss) reads and writes it. The clients can stay as they are: they still send the keys, and the function answers from the table, without the outside lookups or the 1.1 s waits. The CREATE TABLE ends with the three fence calls (`CLAUDE.md`).
3. **Client side only**: remember a miss per browser with a retry-after. No migration, but each browser and each person still asks once, and the fragment puts the cached miss in the function.
4. **Fewer misses instead of remembered ones**: retry with a trailing unit or lot number stripped (two of the four look like that), or fix the records from the sheet. Neither stops the next bad address being asked again on every visit.

Any option answers the same questions: how long a miss waits before it is asked again (a fixed wait, or a backoff); whether *Re-check with Google* or *Review geocodes* forces a fresh ask; whether the sheet says when an address was last tried. An address fixed on its record is a new key, so it is asked fresh in every option. Whatever decides "ask again yet?" is a pure kernel with tests (`CLAUDE.md` → kernels first).

**The plan** — one PR: the migration if the pick needs one (`docs/migrations/<version>_<slug>.md`), the function change and its kernel, the `docs/EDGE_FUNCTIONS.md` section, and the guide's line if the words change. After the merge, `supabase db push`, then deploy `geocode-address-batch` (and `geocode-one` if it changed).

**How to verify**

- Before: as the dev, open the Map page with the browser's network panel open and reload. A `geocode-address-batch` POST carries the failing addresses on every load, and takes seconds. The line under the map reads *Placing 4 addresses…* before the count.
- After: the first load asks. A reload inside the wait makes no outside lookup for them: no POST, or a POST answered from the stored miss in well under a second. The sheet still lists them under *Could not be found* with the same reason, and the line goes straight to the count.
- With a made-up address, never a customer's: from the console, signed in as the dev, invoke `geocode-address-batch` with a string no geocoder can place (`zz test no such place 00000`). The first call fails after the three lookups; a second fails at once with the same `error_code` and `detail`.
- Past the wait, one visit asks again.
- A training-mode (read-only) user loads the page without an error; the miss is simply not stored.
- The Dashboard card and the Bid Board map card behave the same on a second mount.
