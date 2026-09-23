---
name: Where everyone is (clocked-in map)
number: 31
group: ready
status: mock-up approved as drawn 2026-09-22 ("I like it, save it to the punchlist so we can build later") · built 2026-09-23 on feat/clocked-in-map (v2.3756) · left: a live look on a weekday morning with crews clocked in on several jobs, then delete this file
summary: >
  A Map button in the Currently In bar's control cluster (Dashboard, People → Hours, Quickfill)
  that opens a modal: one pin per job with the head count on it, office sessions on the office
  diamond, people with no job named under the map with the Assign door; the stops listed beside
  the map, Open job and Directions on each. Client only — every address is already on the
  strip's session rows and the two shared pins canvases and the geocode hook exist.
next: A live look on a weekday morning with crews clocked in on several jobs (an Isiah-style session with no job, one bid session), then delete this file.
size: M
blocker: none
ver: v2.3756
mockup: to-dos/clocked-in-map-mockup.html — approved 2026-09-22
---

# Where everyone is: the clocked-in map

**The ask (2026-09-22):** "I would like to be able to see everyone who is clocked in on a map
based on the job they are working on. I think we could add a map button to the header in the
same style on this dashboard area … the map should open as a modal."

**The mock-up:** `to-dos/clocked-in-map-mockup.html` — the button on the bar, the modal on
desktop, the modal on a phone, the decisions table. Published: https://claude.ai/artifact/57ZxzwmT3Q1Q4cMdwdHd9a

## What is already there

- The strip is `src/components/DashboardTeamActiveClockStrip.tsx` (mounted on the Dashboard,
  `PeopleHoursDashboardClockStrip`, `QuickfillPeopleHoursNewSection`); its orange header keeps a
  white-on-orange control cluster (the "+" add-session button, copy-mix). The Map button joins it.
- Every open session row (`ClockSessionRow`, `src/types/clockSessions.ts`) embeds
  `jobs_ledger.job_address` or `bids.address` + `bids.customers.name`. No new query.
- Address → coordinates: `useAddressGeocodeCoords` (cache `address_geocodes`, then
  `geocode-address-batch` in chunks of 20), as `useDashboardJobsMapPins` uses it.
- Canvases: `PinsMapGoogleCanvas` / `PinsMapCanvas` (`src/components/map/`), `MapCanvasPin` +
  `MapCanvasAnchor` (`src/lib/map/mapCanvasTypes.ts`), `clusterPins`, `mapCanvasFitPoints`,
  provider fallback `resolveDashboardMapProvider` (`src/lib/dashboardJobsMap.ts`).

## Decisions the mock-up takes (say no to any)

| Question | Proposed |
|---|---|
| A pin is… | A job or bid with someone clocked on it; people at one place share the pin, the badge is the head count |
| Office sessions (JP000) | On the office anchor diamond with its distance ring, never a pin |
| No job on the session | Listed under the map as "Not on a job" with the strip's Assign door; never placed by guess or by phone location |
| Address will not geocode | The jobs map's line: "1 job has no map location yet · JP…" |
| Colors | Jobs blue, bids violet, office navy — the Dashboard and Bid Board maps' colors |
| Freshness | Derived from the strip's own `sessions` prop (it ticks and refreshes over realtime); header says the time and "live" |
| Who sees it | Whoever sees Currently In, all three mounts |
| Provider | Google when the browser key loads, OpenStreetMap otherwise |
| Open job | The strip's own opener (tabbed window for the office, read-only pane for superintendents) |
| Not in scope | Phone GPS, breadcrumbs, "last seen" |

The second pass added: stops ordered by head count; a footer link to the full Map page so the
modal never grows filters. Removed: a count on the button (the bar already says "(7)").

## The PR (client only, size M)

1. Kernel `src/lib/clockedInMap.ts` (pure, tested): sessions → stops (place key = job id | bid
   id | office), people per stop with since/elapsed/memo, legend, unmapped line, colors, the
   "not on a job" list.
2. `ClockedInMapModal` (+ `.render.test.tsx`): the two canvases, `useAddressGeocodeCoords` over
   the stops' addresses, desktop popup / phone selected-bar, Fit all, Esc + ✕.
3. The button in the strip's header cluster; the modal mounts once inside the strip so all
   three pages get it.
4. Release note + `docs/recent-features/` fragment; help guide "see where everyone clocked in is
   right now"; a row in `docs/DASHBOARD_SECTIONS_ARCHITECTURE.md`; no APP_DIRECTORY change (no
   new route).

## Verify

`scripts/mobile-surface-shots.mjs --out /tmp/shots /dashboard` for the phone form; a live look
on a weekday morning with crews clocked in; Isiah-style sessions with no job; one bid session;
the Google key absent (OSM fallback).
