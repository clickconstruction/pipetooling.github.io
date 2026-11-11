---
name: "Permits: a map point for Austin permits the city sends without one"
number: 310
group: ready
status: found 2026-11-11 on the live check after v2.6926 · measured and the route tested the same day, nothing built
summary: >
  About half of Austin's commercial permits arrive from the city's feed with no point. Their skim
  card shows a blank picture, the drive in miles is missing, the Closed map leaves them off, and the
  owner lookup cannot fall back to the point. Almost every one of them still carries the appraisal
  district's property id, and that id finds the parcel on Travis County's layer, whose shape gives
  a point inside Austin. So the pull can fill the point from the parcel instead of geocoding the
  street address, and the same id can name the owner exactly.
next: PR 1, the point from the parcel in the pull, then re-read Austin's window so the rows already held get it.
size: S as a train of two (S · XS); a third (S) only if the owner by id is wanted
blocker: None.
ver: v2.6912 (every city's county read for the owner) · v2.6926 (the Loop and interstate spellings)
mockup: not required — the card's picture, the miles and the map already exist; this fills the point they read
---

# Permits: a map point for Austin permits the city sends without one

## The ask

After v2.6926 went live, the owner's close-out of the Permits work turned up that about 4 in 10
of the newest non-residential Austin permits on the skim had no point. The owner asked for a card
another session, on another computer, can pick up cold.

## What was measured (2026-11-11)

All counts, no rows. Austin's open data, dataset `3syk-w9eu` (public, no key), commercial permits
issued since 2026-08-27, the window the pull keeps:

- **1,516** have `latitude`/`longitude`; **1,735** have none.
- Of the 1,735 with none, **1,696 carry `tcad_id`** (98%); 39 do not.
- The rows with none are not junk: they are the ones with a declared value. On the 200 newest
  Austin building permits in `permits`, most rows with a `declared_value` (often $1M and up) have
  `lat` null, and most rows with a point have no value. So the gap falls on the cards the skim
  ranks highest.
- `tcad_id` is Travis County's **`geo_id`**, not `PROP_ID`: 10 ids tried, `geo_id = '<id>'`
  found 9 parcels (each with an owner), `PROP_ID = <id without leading zeros>` found none.
- Asked with `returnGeometry=true&outSR=4326`, each parcel came back as one ring whose average
  point fell inside Austin. `returnCentroid` gives nothing on this MapServer, so the point is
  computed from the ring.
- No other location column on those rows: `permit_location` is a street string, and there is no
  `location` field. `original_address1` and `council_district` are there.

Re-measure before building with the Socrata count (no key needed):

```
https://data.austintexas.gov/resource/3syk-w9eu.json?$select=count(*) as n, latitude IS NULL as nopoint&$where=permit_class_mapped = 'Commercial' AND issue_date >= '2026-08-27'&$group=nopoint
```

and in the app's table with the dev-mcp seat (`read_rows` on `permits`, `city = Austin`,
`residential = false`, `lat is null`; it returns at most 200 rows and refuses aggregates, so count
a page or ask per day).

The other four cities were not measured. New Braunfels, San Marcos and Seguin read map layers,
so a row there has a point when the feature has geometry; one New Braunfels row in sixteen had
none on the live check. Measure them the same way and say so in the PR.

## The decision

Fill the point from the parcel the permit already names, not by geocoding the street address:

- The id is the county's own key, so the point is the right lot, not a guess at a street number.
  Geocoding a commercial address often lands on the road or a pad site.
- It needs no key and no paid call. Travis's layer is public. Google's Geocoding API would bill
  per row, and the server's `GOOGLE_MAPS_API_KEY` is set up for Places, not proven for Geocoding.
- Geocoding stays as the fallback for the 2% with no id, and only if the owner wants it: it is a
  separate PR and a separate cost decision.

## Where it plugs in

- `supabase/functions/_shared/permitCities.ts`: `AUSTIN_READER` (`AUSTIN_SOCRATA`, `austinWhere`,
  `permitRowFromAustin`), which sets `lat`/`lng` from `texasPoint(record.latitude, record.longitude)`.
  `record` is kept whole in `permits.raw`, so `raw->>'tcad_id'` is already on every Austin row the
  table holds.
- `supabase/functions/_shared/permitParcels.ts` (v2.6912): `TRAVIS_PARCELS.queryUrl`, the Travis
  appraisal district's parcels on `gis.traviscountytx.gov`. Pure; tested in
  `src/lib/research/permitParcels.test.ts`.
- `supabase/functions/permit-pull/index.ts`: reads a page, maps it with `feed.rowOf`, dedupes, then
  **upserts every column, `lat` included, on every read**. A point filled anywhere but here is
  wiped by the next pull, which re-reads the last ten days. So the fill belongs in the pull, before
  the upsert, on the page's rows that came back without a point.
- The readers of the point, unchanged: the skim card's picture and miles (`PermitSkimLook`,
  `PermitSkimGoogleStill`, `scoresMiles`), the Closed map (`ResearchMapCard`), and `permit-lookup`'s
  point fallback (`lookupParcel(..., { lat, lng })` from the three screens).

## The plan

1. **PR 1 (S): the point from the parcel.** A pure kernel in `_shared/` (beside `permitParcels.ts`):
   - `parcelIdsToAsk(rows)`: the Austin rows with no point and a `raw.tcad_id`, ids deduped.
   - `travisParcelQuery(ids)`: `where=geo_id IN ('…','…')` (quotes doubled), `outFields=geo_id`,
     `returnGeometry=true`, `outSR=4326`, `geometryPrecision=6`, `f=json`; at most about 100 ids a
     request (the layer's `maxRecordCount` is 1000; keep the URL short).
   - `pointOfRings(rings)`: the average of the outer ring's vertices, or the area centroid; held to
     `texasPoint`'s box so a bad shape gives no point.
   - `fillPoints(rows, body)`: each row with no point takes its parcel's point; a row whose id found
     nothing stays as it was.
   In `permit-pull`, for the Austin feed only (a `fillPoint?` hook on `FeedReader` keeps the other
   feeds untouched), ask the layer once per page for that page's ids and fill before the upsert.
   A failed request leaves the page's points empty and the pull goes on; say so in the outcome's
   words, never fail the pull for it. Tests with made-up ids and a made-up ring. Release note and
   fragment; `docs/EDGE_FUNCTIONS.md` `permit-pull` section amended in place.
2. **PR 2 (XS, no code if PR 1 is right): the rows already held.** After PR 1 merges and
   `permit-pull` is deployed from main, re-read Austin's whole window once so every held row is
   upserted again with its point:
   `supabase.functions.invoke('permit-pull', { body: { city: 'Austin', since: '<75 days back>' } })`,
   run from a dev preview through the app's own client (signed in with dev-login), as New Braunfels
   was re-read on 2026-11-11. Do not pass `until`: that turns the run into a read back as history.
   Then count the rows with no point again and put the before and after in the fragment.
3. **PR 3 (S, optional, ask first): the owner by id.** `permit-lookup` could ask Travis's layer by
   `geo_id` before the street address, exact where the address match is loose (a suite, a `BLDG`,
   a campus). The function gets `address`, `city`, `lat`, `lng` today; it would also need the id
   (the client reads `permits.raw`, or the function reads the row). Cached answers: see
   `askedOtherQuestion` in `permitParcels.ts`, which re-asks a "no parcel" kept under an older
   question.

## How to verify

- `npm test -- permitParcels` and the new kernel's tests; `npm run check:edge-bundles`;
  `npm run typecheck`.
- A dry run before the deploy is not possible from the branch: an edge deploy from an unmerged
  branch is refused, and every deploy goes from a clean copy of `origin/main`
  (`git worktree add --detach <scratch>/main-deploy origin/main`, copy `.env.local`, symlink
  `node_modules`, then `npx supabase functions deploy permit-pull --project-ref yewfzhbofbbyvkvtaatw`
  with its output written to a file, never piped into `head`). Ask the kernel the live layer first
  with a small `vite-node` script that prints counts only.
- After the deploy and the re-read: open Prospects → Permits, pick Austin, and the top cards that
  had *No point on this permit* show the map, the miles and, in the county's line, the owner.
- The repo is public: no live address, owner or permit number in a test, a doc, the card or the PR.
  Made-up ids look like `0000000001`.

## On another computer

The session needs `.env.local` in its worktree (Supabase keys, the management token for
`check:migration-drift`), the dev-mcp key in its environment for the counts, and `gh` signed in.
No migration is planned, so no `supabase db push`. Claim the version with `npm run claim` on the
branch, read its output, and put the branch name in this card's `status` when the work starts.
