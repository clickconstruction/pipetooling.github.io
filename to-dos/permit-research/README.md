---
name: "Research: the permits a city issues, on a ledger and a map, so an estimator knows which to chase"
number: 292
group: close
status: asked 2026-11-09 · refined in chat the same day and the owner liked the shape (two signals, the ledger first, the map as a lens, one city at a time) · the first areas are the cities the Inspections tab's permit portals already serve · building 2026-11-09 night on claude/permit-research-card, the owner's word: every call the session's own, live by morning · PR 1 (v2.6782): the migration, permit-pull, the ledger, the Decide sheet, the door into a GC lead · PR 1 merged 2026-11-09 08:06Z, the migration pushed, permit-pull deployed, the first pull run from the app at 02:21 Central (329 permits in the 30-day window, 140 already with a plumber) and the ledger walked live: Look into it, Approach them (the lead landed on the Jobs to GC deck with the permit as its job, then was deleted), Not for us · PR 2 (v2.6784, #7447) merged 09:0xZ, 20261109080000 pushed, the map and the hint walked live · PR 3 (v2.6785, #7451) merged and pushed 2026-11-09 morning; dev-mcp redeployed with the catalog; types #7446 merged, #7452 armed · live by 04:30 Central for the owner's look · PR 4 (v2.6786, #7455) merged and pushed 2026-11-09 11:1x Central, permit-lookup and dev-mcp deployed, the card walked live · the tab renamed Permits (v2.6787) and the nightly pull ran on its own at 5:28 AM
summary: >
  The owner wants more of the work we want. Every city publishes the permits it issues, and
  those permits say who is about to build what, where. A Research section under Prospects takes
  a city's permits onto a ledger and a map, and an estimator doing research marks each one: look
  into it, approach who pulled it, not for us, already taken. Two signals hide in the data and
  get two lenses: a building permit with no plumbing permit yet is work we can still bid, and a
  plumbing permit names the plumber who already has it, which over a year draws who wins what
  where. A score from our own bid history sits beside each row as a hint; the estimator decides.
next: The owner's look at Prospects → Permits and the Who pulled it card; his calls under What the owner settles; revision 4 asked 2026-11-10 for Austin, New Braunfels, San Marcos and Seguin: Austin is v2.6859 (the city list, the readers, the per-city doors) and New Braunfels, San Marcos and Seguin are v2.6861 (one reader over a city's map layer, three field maps), so the weekly file is not needed; the digest when he wants it. What the office does with a permit once it arrives (the skim, the dig in, the builders) is #302, to-dos/permit-skim/. The types regen #7479 is armed.
size: L as a train of four (M · S · M · S); shipped: revisions 1 to 3 (M · S · S); left: revision 4 (S)
blocker: None. The owner asked for no questions; § What the owner settles records the guesses made in his place.
opinion: build, ledger first — the pins canvases, the geocode cache, the GC book and the prospect kinds already exist, so revision 1 is one table, one nightly pull, one kernel and one tab; the map is a day once the rows are there
mockup: to-dos/permit-research/ledger.html (the sheet decide.html, the map map.html)
---

# Research: the permits a city issues (#292)

## The ask, in the owner's words

2026-11-09:

> In the bids tab or prospects tab I would like to add a section called research where we take
> all the permits pulled in a city and put them on a map and a ledger where we work to
> categorize them such that we can signal to the estimators who are doing research if they
> should look into them and approach who pulled the permit if we can bid their work and use
> this could be profitable for our company. I would likely need to pair it with a Google Maps
> overlay and we would need to make several revisions. The purpose is to get more work we want
> to do.

And on the areas: the cities the Inspections tab's permit portals already serve are the areas we
already collect permits for, so those are the areas to touch first.

## The design

**The product is the signal, not the map.** One sentence to an estimator: *this permit is work
we want, nobody we know is on it yet, and here is who to call.* Everything else serves it.

**Two signals, two lenses.** Permit data holds two different things, and mixing them on one
list buries the first under the second.

- **Work with no plumber on it yet.** A building permit for new commercial, a tenant finish-out,
  a remodel or a multifamily building, pulled by an owner or a GC, with no plumbing permit filed
  on the same address. That is a bid we can still win; the GC on the permit is who to approach.
  In Texas the plumbing permit is pulled by the licensed plumber, so its absence is the tell.
- **Work a competitor already has.** A plumbing permit names the plumber. Too late to bid, but
  over a year it draws who wins what in which part of town, and which GCs never ask us. That
  feeds the Market desk's relationship book (feeding, fading, new name, dead weight) rather than
  the estimator's list.

**Where it lives: Prospects, not Bids.** *A permit* is already one of the nine prospect sources,
GC lead is already a prospect kind, and Prospects already has the call log, callbacks, calling
locks and the convert door. Research becomes a top tab beside the customer and GC decks, the
place a permit turns into a GC lead; Bids is where a lead becomes a number. A door from a
research row into a new GC lead, and from the lead into a bid, closes the loop.

**The ledger.** One row per permit: number, city, address, kind of work, declared value, who
pulled it, the GC or owner named, filed date, and whether a plumbing permit exists on the
address. Then ours: a verdict, who looked, when, and the reason. Four verdicts cover it:

| Verdict | What it means | What happens |
|---|---|---|
| Look into it | worth a closer read; nobody has called | the row waits on the estimator's list |
| Approach them | call the GC or owner on the permit | a GC lead is made from the row (the door), with the permit as its source |
| Not for us | wrong trade, wrong size, wrong part of town | the row leaves the list, the reason kept |
| Already taken | a plumbing permit names someone else | the row moves to the second lens |

A verdict with no reason is refused, the way the Lien desk holds its reasons: the reason is the
whole point when a second estimator reads the row.

**The score is a hint, never the verdict.** We already know, per GC, what we bid, what we won
and what it paid (`bids.outcome`, `agreed_value`, the GC book). A permit from a GC we have won
with scores higher than a stranger; a permit in a size band where our win rate is good scores
higher than one outside it; a permit inside the drive band the bid form already measures scores
higher than one past it. The score draws as one word beside the row (*warm*, *cold*, *new
name*) with its reason on hover. The estimator decides.

**The map is a lens on the same rows.** The repo already has two pin canvases (Google and
Leaflet) under the Bid Board, the Dashboard and Jobs. Pins colored by verdict, sized by declared
value, filtered by city and filed date, clustered at low zoom; clicking a pin opens the ledger
row's card. One component reused, no new map stack. The Inspections tab's cities draw as the
default frame.

**The data, as found on 2026-11-09.** San Antonio's open-data portal (CKAN) publishes two
datastores with a SQL door: the permits issued (about 155,000 rows since 2025) and the
applications submitted this year. Both carry the permit type, number, project name, work type,
address, a point, the submitted and issued days, the declared value, the area and a primary
contact. Three facts shape the build: a commercial job's trade permits share the building
permit's number (so a plumbing permit on the same number names the plumber), a *Commercial
Project Application* is filed weeks before the permit issues (the earliest signal), and the point
is a longitude and latitude on most rows and Texas State Plane feet on the rest (converted, not
geocoded). The feed runs two or three days behind the city. In a month San Antonio issues about
30 new commercial buildings, 50 commercial remodels, 10 additions, 25 site-work permits, 150 new
houses and 160 commercial project applications; plumbing permits run about 1,800 a month. The
suburbs' portals (Tyler EnerGov, CityView, MyGovernmentOnline) have a public search and, in most
cases, an export, but no clean feed; they come as revision 4's weekly file. **The repo is
public:** permit rows stay in the database and never in tests, docs or cards; the mock-ups' data
is made up.

**Is that the best we can do?** Asked twice. On the first mock-up, three presses per row made a
nine-column table that overflowed a desktop and buried the act; the row collapsed to one
**Decide…** press that opens the sheet the reason needs anyway, the permit number folded under
the address, the money under the work, and the list opens on what is new since the reader last
looked. Cut on the same question: a fifth verdict, *Watch*, which is *Look into it* with a later
day, so the row takes a *look again on* day instead; a per-city settings page, since the
Inspections tab's portal list already names the cities; and the file import in revision 1, which
would be guessed with no export in hand. Kept because it costs nothing and the estimator needs
it: a **map** link beside every address that opens the site in Google Maps, and **Pull now**, so
nobody waits for the night to see the feed move.

## Where it plugs in

What exists:

- Prospects: `src/pages/Prospects.tsx`, the top tabs in `src/lib/prospects/prospectsLanding.ts`,
  the kinds and sources in `src/lib/prospects/prospectKinds.ts` (`PROSPECT_SOURCES` has
  *A permit*; `PROSPECT_KINDS` has `gc_lead`), the GC book in `src/lib/gc/gcIo.ts`
  (`addGcCompany`, `loadGcBoardRows`) over `gc_companies`.
- The pins canvases: `src/components/map/PinsMapCanvas.tsx` (`PinsMapCanvasProps`: pins,
  select, popup, fit, cluster, ring priority) and `PinsMapGoogleCanvas.tsx`, the types in
  `src/lib/map/mapCanvasTypes.ts`, the Bid Board's card `src/components/bids/BidBoardMapCard.tsx`
  as the pattern.
- The cities: `inspection_quick_links` (label, cities, url), drawn by
  `src/components/jobs/JobsInspectionsTab.tsx` over `src/lib/inspectionPortalSearch.ts`.
- Geocoding: `supabase/functions/_shared/googleGeocode.ts`, `censusGeocode.ts`, the geocode
  cache `court-precinct-nightly` reads; the drive band in `src/lib/bidDistanceToOffice.ts`.
- The nightly pattern: `supabase/functions/court-precinct-nightly` scheduled by pg_cron
  (migration `20261007120000`).
- Our bid history: `bids` (`outcome`, `outcome_at`, `agreed_value`, `customer_id`), the Market
  desk's kernel `src/lib/bridge/market/marketDesk.ts` (feeding, fading, new name, dead weight).
- Reasons held on a verdict: the Lien desk's hold pattern (`to-dos/desks-as-pages/`).

What is new (PR 1, v2.6782): migration `20261109070000_permit_research.sql` — `permits` (keyed
by city, source, number and type), `permit_verdicts` (append-only, the newest wins),
`permit_pulls`, the predicate `user_can_research_permits()` (the office and every estimator),
the read `research_permits(city, since, residential)` with the plumber pairing and the newest
verdict, and the pg_cron row; `supabase/functions/permit-pull` over `_shared/permitFeed.ts` and
`_shared/permitCoords.ts` (pure, tested from `src/lib/research/`); `src/lib/research/
permitResearch.ts` (the verdicts, the lenses, the words, the lead a permit makes) and
`permitResearchIo.ts`; `ProspectsResearchTab` and `PermitDecideSheet`; the Research top tab on
Prospects, open to every estimator; the guide `research-permits-for-work-to-bid`.

## The plan

1. **Revision 1 (M, PR 1, v2.6782): San Antonio, the ledger, the verdicts, the door.** As
   listed under What is new. Push the migration and deploy the function after the merge, then
   one POST with the cron secret reads the first 75 days.
2. **Revisions 2 and 3 (S + S, PR 2, v2.6784): the map lens, the hint, who wins what.**
   `ResearchMapCard` over the Bid Board's pins canvas, pins coloured by lens, clustered, the
   office ringed, a pin opening the row's card with its Decide press; migration
   `20261109080000_permit_research_hint.sql` (`research_name_key`, `research_contact_history`)
   behind `hintFor` — warm, cold, seen, new name, with the reason on hover; `plumberTally` as the
   Who wins what strip on the taken lens. The pin's size by declared value and the Inspections
   cities as the opening frame were dropped: the office ring and Fit all frame it, and a
   value-sized pin hid the small remodels that are most of the list.
4. **Revision 4, as built (2026-11-10): the owner asked for Austin, New Braunfels, San Marcos and Seguin.**
   All four publish permits a program can read, tested live that day:
   - **Austin** (v2.6859): the city's Socrata dataset of issued permits, with the contractor, the
     applicant, a valuation, square feet and plumbing permits. Issued only, so a permit shows later
     in its life than San Antonio's applications do.
   - **New Braunfels** (v2.6861): a layer on the city's open-data map service with applicant, owner and
     contractor names, submit and issue days, and plumbing permits; no valuation.
   - **San Marcos** (v2.6861): the city's building-permits map layer with type, land use, applied and issued
     days, square feet and a project name; no names and no valuation.
   - **Seguin** (v2.6861): the city's permits map layer with apply and issue days, a description
     and a link to the city's own page for the permit; no valuation, and its name column is the
     desk that issued the permit, so it names no one.
   The three map layers are one more door (a reader over an ArcGIS feature layer) and three field
   maps. The dropped-file import below is no longer needed for these cities.
   What is not built: the county parcel record outside Bexar (cards open the appraisal district),
   the Needs you line counting cities other than San Antonio, and the city box on a phone's Skim.
   **The earlier plan for this revision:** more cities, the file, and the digest. Austin's Socrata feed (issued
   permits with contractor and applicant columns, a point on every row) as a second city; the
   suburbs' portals as a weekly export dropped on an **Add a permit file** press that reads the
   file's columns the way the bank statement import does; a weekly line in the estimators'
   morning mail counting new *Approach them* rows by city, through the existing nudge run.

Each PR: claim its version, `npm test` on the files it touches, `check:edge-bundles` when a
function changes, lint, the narrow typecheck, `gh pr merge N --auto`; the next PR stacks on main.

## What the owner settles

The owner asked for no questions on 2026-11-09 and for the session's best guess on each; the
guesses, for him to overturn:

1. **Which city first.** San Antonio: the one city on the Inspections tab's list with a clean
   feed. Austin is drawn as revision 4's second city.
2. **Residential.** The list opens on commercial, multifamily and project applications; **Include
   houses** shows the single-family permits too. The data is pulled either way.
3. **Who researches.** The office and every estimator, with or without the Prospects flag; the
   *who looked* column names whoever decides.
4. **The competitor lens.** Built as the *Already have a plumber* lens in revision 1 (the rows
   the feed pairs), with the by-plumber and by-city reading in revision 3.

## How to verify

On the dev server or the deployed app as the dev login, after the first pull:

1. Prospects → Research shows the first city's permits with their filed dates, the newest first,
   each row's pairing read (*no plumbing permit* or *plumbing permit on file*).
2. Pick a row, press **Look into it** with no reason: the press is refused with its words. Add a
   reason; the row carries it, who looked and when.
3. Press **Approach them** on a row with a GC named: a GC lead opens in the GC deck with *A
   permit* as its source and the permit's number and address in the notes; the research row
   reads *Approached* with the lead's door.
4. Press **Not for us** with a reason: the row leaves the default list and shows under the
   *Not for us* filter with its reason.
5. The next morning the pull has added the day's permits and touched no verdict.
6. Press **Map**: a pin's colour matches its row's lens, a cluster opens on click, and a pin opens
   the row's card beside the map with Decide… on it. The word under a name reads warm on a GC we
   have won with; hover shows the reason.

No live permit row, address or applicant goes in a test, a doc or a card; the test fixtures are
made up (*Ridgeway Builders*, *100 Sample St*).

## Where it stands

2026-11-09: card opened on the owner's ask and the refinement he liked. The same night, on his word to build it through to live with no questions, PR 1 (v2.6782, #7439) was written: the migration, the pull, the ledger, the sheet and the door, with the mock-ups revised on the second look. It merged at 08:06Z after four CI rounds (the CSS tint tokens, the app time zone in the pull, the dev-mcp catalog, the egg-surface test on the open path); the migration was pushed and `permit-pull` deployed at once.

**The walk, 2026-11-09 02:21 Central, on the live app in the owner's Chrome:** Pull now read 75 days of both feeds in about a minute; the window showed 329 permits, 189 waiting on a look and 140 with a plumber already. On a $1,500 application: Look into it with a reason drew the chip with the decider's name, the day and the look-again day, and the row left the waiting lens; Change → Approach them made a GC lead on the Jobs to GC deck named for the permit's contact, *General contractor · from A permit*, with *Commercial project at <the address>* as its job, and the row read *Approached · the GC lead*; the lead was deleted from its Edit window, and the row's link went with it; Change → Not for us closed the walk with its reason. Two things were learned: a third of the window's applications declare under $25k (signs, parking, small repairs), so PR 2 adds a declared-value floor at $25k by default; and a plain navigation served the old shell once (the service worker), so a hard reload is the first press if the tab is missing.

PR 2 (v2.6784, #7447) followed the same night: the map lens, the hint from our own bid history, Who wins what, the header-search door and the value floor. It merged at 09:0xZ; the migration was pushed and the map walked live in the owner's Chrome at 03:5x Central: the Google canvas over San Antonio with the clusters and the legend, a pin's card beside it with the permit, its chips (no plumber yet, new name), Pulled by, Decide… and the Google Maps door; the Ledger · Map switch; the value floor at $25k and up, or not declared, by default.

**Found on that look, fixed as PR 3 (v2.6785):** the Already have a plumber lens drew the GC's or the expediter's name in the Plumber column on most commercial rows, and Who wins what led with a permit expediter, because a commercial job's plumbing permit in this feed is usually pulled under the building permit's own contact. The read now names a plumber only when the plumbing permit names someone else; the row still counts as taken, reading *on file, no plumber named*. PR 3 (#7451) merged at 10:2xZ; 20261109100000 was pushed at once and the read checked through the dev seat: of the first hundred rows of the 15-day window, eleven name a plumber (none of them the applicant), twenty-seven carry a plumbing permit on file under the applicant's own name, and fifty-nine have none. The hint read was checked the same way: a GC we have won with reads *warm* with its count. The types PR #7446 merged with the first regen; #7452 carries the second (the two hint functions) and dev-mcp runs on its catalog. #7427, the earlier bill-pay-codes regen, is superseded and still open for the owner to close, since the session's classifier refused the close.

**PR 4 (v2.6786), on the owner's question that morning,** "is there any way we can get more information on who pulled a permit beyond names like a person and a company": the card behind the name. Google Places for the company (phone, website, office address, kind), Bexar County's own parcel layer for the owner of record (no key; the appraisal district's detail page linked by parcel id), our history with the name, and the city's record as a door with the permit number copied. Each lookup cached a month in `permit_lookups` through `permit-lookup`. Approach them from the card carries the phone, the website and the address onto the lead. Not built: reading the city's record by machine (the portal is a form, not a feed) and the plumbing license roll for the who-wins-what names.

**PR 4 walked live, 2026-11-09 11:1x Central, in the owner's Chrome:** on a company name the card drew Google's record (the kind of business, the website, the office address, Open in Google Maps), *new name* from our history, and the city's door with the permit number copied; the county had no parcel under that street, and the card said so. On a person's name Google's answer was marked *best guess, read with care*, and the county section drew the owner of record, the DBA, the mailing address, the appraisal, the built area, the year and the acres, with Open at the appraisal district. Approach them with these facts opened the Decide sheet on Approach naming what the lead would carry; cancelled, no lead made. Both lookups cached their rows in `permit_lookups`. The nightly pull had run on its own at 5:28 AM, so the Pulled line read the morning's time with no press.

**Left for the owner, 2026-11-09 morning:** the look at Prospects → Research (Reload on the app's new-version strip if the tab is missing), the calls under What the owner settles, and the word on revision 4.
