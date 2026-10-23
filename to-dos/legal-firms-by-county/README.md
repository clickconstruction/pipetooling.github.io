---
name: "Legal firms by county — one collections firm per county, the desk picks the firm from the venue, a county map shows who covers what and where the cases are"
number: 144
group: ready
status: PR 1 built 2026-10-23 (v2.5756: `legal_firm_counties`, the Settings picker, `useLegalMatters.countiesByFirm`) and PR 1b (v2.5758: zoom and pan, today's cases as dots, the contents card); PRs 2–4 open
summary: >
  Today the Legal Desk knows one collections law firm: the one active row of `legal_firms`, and
  every release goes to it. The owner is engaging a second firm — one for San Antonio, one for
  Austin — and wants each firm to cover a territory, drawn on a map, with the cases shown on the
  same map, and the firms able to see which firm covers what. Territories are counties: venue for a
  collections suit is the county (small claims, the JP precinct), and every customer address already
  carries both. The owner clicks counties on a Texas county map to color them for a firm, one firm per
  county; the desk reads the account's venue county and picks that firm; a Map lens shows the counties
  by firm with a pin per case; the firm portal gains a Who covers what page.
next: a mock-up of the county picker and the map lens beside this file; then PR 1
size: L as a train of four (M+migration, M, L, M+edge); one migration, the legal-portal function changed, no new function
blocker: none to start; the firms' own confidentiality call (what one firm may see of another's cases) is asked of counsel before PR 4 widens past counts
ver: proposed
opinion: build — the second firm is signed or close, and without this the desk would send Austin's cases to the San Antonio firm
mockup: required — the county picker on Settings and the Map lens on the desk; the desk's header change is small
---

# Legal firms by county (#144)

## The ask

The owner, 2026-10-22, in the Legal Desk design spike: "Right now we only offer one law firm, but I
think we should offer multiple law firms based on jurisdiction. I would love to be able to draw a map
and have each law firm represent that area and then I would love to be able to see the cases on that
map. I think that law firms are mature enough that they can see what other firms are representing
what. … I plan to have a firm for San Antonio and a separate firm for Austin."

## The decision

**Territories are counties, not a line drawn freehand.** A collections suit is filed where venue
lies, and venue is the county (the JP precinct for small claims). The record already names it:
`customer_addresses.county` and `jp_precinct` (v2.4764, v2.4771), and `court_areas` maps county →
precinct. A freehand line would cut counties, and the desk could not then say which firm an account
belongs to. So the map the owner draws is **a Texas county map where a click colors a county for a
firm**, one firm per county at a time; the edges snap to county lines. The owner chose this on
2026-10-22 ("Counties. Territories are counties I click on a Texas county map, one firm per county.").

Decided with it:

1. **A county nobody covers stays uncolored**, and the desk says so on the account instead of
   guessing a firm. No default firm.
2. **An account in two firms' counties** picks the firm of the county holding the largest open bill,
   says which, and offers a switch. The release goes to the firm shown.
3. **A matter stays with the firm it was released to** (`legal_matters.firm_id` already holds it).
   Changing a county's firm affects new releases only. Moving a live matter is a deliberate press
   with a note; the old firm's portal shows it as moved.
4. **Each firm keeps its own fee model**, so *What's left for us?* can differ by city.
5. **What firms see of each other**: every firm's name, territory, and how many matters and dollars
   each holds. Not another firm's customer names or amounts per case — a customer's record goes to
   counsel under an engagement, and widening that is counsel's call, asked before PR 4 goes further.

Rejected: a freehand polygon per firm (venue is by county; ambiguity at the line); a default firm for
uncovered counties (sends a case to a firm that does not practice there); ZIP codes (do not follow
county lines).

Open: the two firms' first county lists (a starting guess: Bexar, Comal, Guadalupe for San Antonio;
Travis, Williamson, Hays for Austin — the owner picks on the map); whether the Map lens lives on the
Legal Desk or on `/map` as a layer.

## Where it plugs in

- **Firms**: `legal_firms` (one active row today; `useLegalMatters` takes `firms.find((x) => x.active)`
  as *the* firm — `src/hooks/useLegalMatters.ts:100`). `legal_firm_recipients`, `legal_portal_links`
  are per firm already. Settings → Jobs & billing → **Collections law firm** (`LegalFirmSettingsBlock`,
  dev only) edits the one firm; the desk's header firm group (v2.5750) shows it.
- **Venue**: `customer_addresses.county`, `jp_precinct`; `court_areas`; the lien property record's
  county (`src/lib/legal/legalProperty.ts`, `legalPacket.account.customerCounty`); the city → county
  suggestion `src/lib/txCountyLookup.ts` (`suggestTxCountyForCity`) for a job address with no record.
- **Pins**: `address_geocodes` (lat, lng) — the Map already geocodes every address
  (`src/components/map/`), so a case pin needs no new data.
- **The release**: `legal_matters.firm_id` is stamped at *Mark attorney ready* from the one firm; PR 2
  passes the picked firm instead.
- **The portal**: `supabase/functions/legal-portal/index.ts` resolves a link to one `firm_id`; PR 4 adds
  a read of every firm's counties and counts.
- **New**: `legal_firm_counties (firm_id, county, since, until, set_by)` — one live row per county
  (a partial unique index on `county` where `until is null`); a Texas county boundary file for the
  picker and the lens (simplified GeoJSON, public domain from the Census TIGER files, kept under
  `public/`); the kernels `legal/firmForAccount.ts` (venue → firm, the two-county rule) and
  `legal/firmMap.ts` (counties by firm, pins by stage, the legend's counts).

## The plan

1. **PR 1 — firms and counties** (migration): `legal_firm_counties`; Settings → **Collections law
   firms** (plural): each firm's card as today, plus its counties on the county map (click to color,
   click again to clear; a county held by another firm says whose it is). `useLegalMatters` returns
   `firms` and `countiesByFirm`; nothing reads them yet. The three house calls on the new table.
2. **PR 2 — the desk picks the firm by venue**: `firmForAccount` (the property record's county, else
   the job address's suggested county, else none; the largest-bill rule across counties); the header's
   firm group reads *Snell Law Firm · Bexar County*, amber *No firm covers Hays County* when none;
   *Mark attorney ready* releases to the shown firm; *What's left for us?* uses its fee model; the
   Robot/Needs You lines that name "the firm" read the account's.
3. **PR 3 — the Map lens**: Legal Desk → **Map**: counties colored by firm, a pin per Collections
   account at its property (needs a dev's eyes · with the firm, by stage · given up on), tap → the desk
   on that account; the legend per firm with count and dollars; cases in an uncovered county flagged.
4. **PR 4 — Who covers what** (legal-portal): the firm portal's page with the county map, every
   firm's name and territory, and each firm's matter count and dollars; its own matters as today.
   Deploy `legal-portal` after merge.

## How to verify

- PR 1: color Bexar for firm A and Travis for firm B on a local preview against prod, read-only; the
  rows land in `legal_firm_counties`; clicking Bexar again clears it; a county held by A shows A's
  name when B's card is open.
- PR 2: The Learning Experience (Bee Cave, Travis) reads the Austin firm; Burd & Assoc. (Amarillo,
  Potter) reads *No firm covers Potter County*; a two-county account shows the switch. Never press
  *Mark attorney ready* on a live account — use a ZZ test customer with a Collections job.
- PR 3: every pinned account opens the desk on itself; the legend's dollars add up to the desk's list
  header.
- PR 4: open the firm portal as each firm (its link); the other firm's counties and counts show, its
  customer names do not.

## Where it stands

Proposed 2026-10-22 during the Legal Desk spike (the spike's own changes — the four questions, Record
of contact, the floor slider, the write-down panel, What goes to the firm — ship first as their own
PRs). The mock-up is `mockup.html` beside this file on the `spike/legal-desk` branch, redrawn on the real county file, until the spike merges. **PR 1 shipped as v2.5756** (2026-10-23): the
`legal_firm_counties` migration (which also drops `legal_firms_one_active`, so two firms can stand),
Settings → **Collections law firms** with the county picker in the mock-up's shape (pick a firm, click
to color, a held county asks before it moves, Save counties / Undo changes), the county file
`public/geo/tx-counties.json` (`docs/TX_COUNTY_MAP.md`), the kernels `legal/firmCounties.ts` and
`legal/txCountyMap.ts`, and `useLegalMatters.activeFirms` / `countiesByFirm`, which nothing reads yet.
**PR 1b shipped as v2.5758**: the settled mock-up's four additions, zoom and pan (`legal/countyMapView.ts`),
today's cases as faint dots placed by `legal/firmMap.ts` (built once for PR 3's lens: stands, the county
card, `legendCounts`, `uncoveredWords`) with `legal/countyAt.ts` for point-in-county, and the contents
card under the firm cards. **The desk's header, 2026-10-23**: the owner asked for the full screen button the other
modals have, and for the header to expose the map and the way to add firms; v2.5780 shipped the full screen toggle
(with a retry for a failed read of the legal tables and the border longhands), and a mock-up of the firms flow
(`header-mockup.html` beside this file) goes to the owner before PR 2 is built. PR 2 is next.
