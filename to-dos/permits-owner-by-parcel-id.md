---
name: "Permits: the owner of record read by the parcel id an Austin permit carries"
number: 316
group: gated
status: split off 2026-11-11 from the retired card #310, where it was PR 3 (optional, ask first) · measured the same day, nothing built
summary: >
  The Property line finds an Austin permit's owner by matching the street address at Travis
  County, then by the permit's point. Almost every Austin permit also carries the county's own
  id for its lot. Asked by that id the answer is the lot the permit names, with no matching.
  Measured on 185 commercial addresses, today's lookup lands on another parcel 8 times, about
  1 in 23. The other 177 already end on the right lot, so the gain is those few wrong owners.
next: The owner says build it or drop it. On a yes it is one PR in permit-lookup and its three callers.
size: S, one PR
blocker: The owner's yes. It was "only if the owner asks" on #310 and nobody has asked.
ver: v2.6912 (every city's county read for the owner) · v2.6926 (the Loop and interstate spellings) · v2.6958 (the point from the parcel, PR 7702)
mockup: not required — the Property line already exists; this changes which parcel answers it, not what it shows
---

# Permits: the owner of record read by the parcel id an Austin permit carries

## The ask

Card #310 gave Austin's permits a map point from the lot's parcel and was retired on 2026-11-11.
Its third PR, the owner read by the same id, was never built: the card said to ask the owner
first. This card holds that PR so a session can pick it up cold once the owner says yes.

## What was measured (2026-11-11)

Counts only, no rows. Austin's feed, the 75-day window, commercial building permits that carry
`tcad_id`: 864 rows on 714 addresses. 220 of those addresses were put through today's lookup
code (`streetParts`, `addressQuery`, `parcelFactsByAddress`, then `pointQuery`) against the
live layer, with the points as the pull leaves them since v2.6958.

- **185** carry an id the county's layer holds. 35 do not, and this card does nothing for them.
- Of the 185, the street address found **the parcel the permit names 102 times**.
- It found **no parcel 75 times**, and the point then found the named parcel **all 75 times**.
- It found **another parcel 8 times**: 5 on a plain address, 2 with a unit, 1 with a BLDG.
- So today 177 of 185 end on the named parcel, and 8 show the owner of a different lot.

The 8 were not opened one by one. A permit can name a parent lot while the address is a unit
inside it, so "another parcel" is not proven wrong every time. Open a few before building.

Re-measure with a `vite-node` script that prints counts only. It needs no key: the feed and the
layer are public.

## The decision for the owner

Build it, or drop it. One line each way:

- **Build:** about 1 Austin card in 23 stops showing a neighbour's owner. One small PR, no cost
  per lookup, no migration.
- **Drop:** 96 in 100 are already right, and the card's **Open at the appraisal district** link
  lets a person check the rest.

## Where it plugs in

- `supabase/functions/permit-lookup/index.ts`. Body today: `{ kind: 'parcel', address, city, lat?, lng? }`.
  For a county in `permitParcels.ts` it asks by address, then by point, and keeps the answer in
  `permit_lookups` under `parcelLookupKey(city, address)` for thirty days.
- The id is not on the client's row. `research_permits_v2` returns no `raw`. The function has the
  service client, so the cheap route is `permit_id` in the body and one read of
  `permits.raw->>tcad_id` there. No change to the RPC, no migration.
- `supabase/functions/_shared/permitParcelPoints.ts` (v2.6958): `TRAVIS_PARCEL_POINTS.idOf` reads
  the id off a row. `tcad_id` is the layer's **`geo_id`**, ten digits with leading zeros, not
  `PROP_ID`.
- `supabase/functions/_shared/permitParcels.ts`: `TRAVIS_PARCELS` (`queryUrl`, `outFields`,
  `facts`). `parcelFactsByPoint` marks its answer `matched_by: 'point'`.
- The three callers: `lookupParcel(row.address, row.city, refresh, { lat, lng })` in
  `PermitSkimDeck.tsx`, `PermitBuildingSheet.tsx` and `WhoPulledItSheet.tsx`, through
  `lookupParcel` in `src/lib/research/permitResearchIo.ts`.
- The words on the card: `parcelPointWords` and the lot line in `src/lib/research/permitCityDoors.ts`
  say *read at the permit's point* for `matched_by: 'point'`.

## The plan (one PR, S)

1. **Kernel**, beside `permitParcels.ts`: `idQuery(source, id)` (`geo_id = '<id>'`, quotes
   doubled, the source's `outFields`, no geometry) and `parcelFactsById(source, body)` (the first
   row with an owner, marked `matched_by: 'id'`). Only Travis has an id column to ask; the other
   sources stay as they are.
2. **`permit-lookup`**: the body gains `permit_id?`. With it, and a source that can be asked by
   id, the function reads the permit's `raw->>tcad_id`, asks by id first, and falls back to the
   address and then the point exactly as today. One id is a short URL, so a GET is fine here
   (the firewall only turns away a long list, see below).
3. **Kept answers.** Two traps, both in `askedOtherQuestion`:
   - It compares the first part of the kept `query` with today's address question. Write the id
     question after the address question in `query`, or teach the comparison about it. Otherwise
     every kept "no parcel" is asked again on every open.
   - A kept **found** answer is never asked again inside its thirty days, so the 8 wrong owners
     would stay a month. Ask again, once, when an id is given and the kept `query` holds no
     `geo_id`.
4. **Callers**: pass the permit's `id` from the three screens. A city other than Austin sends it
   too and the function ignores it.
5. **Words**: an answer by id needs no extra words on the card, because it is the exact lot.
   Leave the *read at the permit's point* line as it is.
6. Tests with made-up ids and rows in `src/lib/research/permitParcels.test.ts`. Release note and
   fragment. `docs/EDGE_FUNCTIONS.md` `permit-lookup` section amended in place. The guide
   `research-permits-for-work-to-bid.md` needs a change only if a sentence there becomes false.

## What #310 learned that this needs

- **A long list of ids must go by POST.** A hundred ids in a URL is turned away by the county's
  firewall with a page that is not JSON and a 200 status. Fifty pass. One id is fine.
- **The layer is rebuilt monthly and does not hold every id.** About one Austin row in five with
  an id finds no parcel under it. Fall back, never fail.
- **Ids that start with R are not Travis's.** They sit in the zips of Austin over the Williamson
  County line. Travis's layer answers nothing for them.
- **An edge deploy goes from `main` only**, from a clean copy:
  `git worktree add --detach <scratch>/main-deploy origin/main`, copy `.env.local`, link
  `node_modules`, then `npx supabase functions deploy permit-lookup --project-ref yewfzhbofbbyvkvtaatw`.
  Check `npm run check:edge-drift` before and after.

## How to verify

- `npm test -- permitParcels`, `npm run check:edge-bundles`, `npm run typecheck`.
- Before the deploy, run the new kernel against the live layer from a `vite-node` script that
  prints counts only: the 8 in 185 should fall to none.
- After the deploy: Prospects → Permits, Austin. Open a few cards and read the Property line. A
  walk needs a dev preview signed in with dev-login. If the Browser pane refuses localhost, drive
  the dev server with the repo's Playwright.
- The repo is public: no live address, owner or permit number in a test, a doc, this card or the
  PR. Made-up ids look like `0000000001`.

## Not on this card

The Austin rows that still have no map point: 422 of 4,319 on 2026-11-11. Their ids are not on
Travis's layer, or are Williamson County's, or are missing. A point for them means Williamson
County's own parcel layer, which nobody has looked at, or geocoding the street address, which
costs per row. That is a separate ask and a separate cost decision.
