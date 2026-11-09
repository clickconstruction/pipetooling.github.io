---
name: "Research: the permits a city issues, on a ledger and a map, so an estimator knows which to chase"
number: 292
group: ready
status: asked 2026-11-09 · refined in chat the same day and the owner liked the shape (two signals, the ledger first, the map as a lens, one city at a time) · the first areas are the cities the Inspections tab's permit portals already serve · building 2026-11-09 night on claude/permit-research-card, the owner's word: every call the session's own, live by morning · PR 1 (v2.6782): the migration, permit-pull, the ledger, the Decide sheet, the door into a GC lead
summary: >
  The owner wants more of the work we want. Every city publishes the permits it issues, and
  those permits say who is about to build what, where. A Research section under Prospects takes
  a city's permits onto a ledger and a map, and an estimator doing research marks each one: look
  into it, approach who pulled it, not for us, already taken. Two signals hide in the data and
  get two lenses: a building permit with no plumbing permit yet is work we can still bid, and a
  plumbing permit names the plumber who already has it, which over a year draws who wins what
  where. A score from our own bid history sits beside each row as a hint; the estimator decides.
next: Land PR 1 (v2.6782), push the migration, deploy permit-pull, run the first pull, walk the ledger live; then PR 2 (the map lens, the hint from our own bid history, the who-wins-what lens).
size: L as a train of four (M · S · M · S)
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
2. **Revision 2 (S): the map lens.** The map card over `PinsMapCanvas` beside the ledger, pins
   by verdict and value, cluster at low zoom, the Inspections cities as the frame, a pin opening
   the row's card. No migration.
3. **Revision 3 (M): the score, and the second lens.** The score kernel over `bids` and the GC
   book, drawn as one word with its reason; the *Already taken* rows and every plumbing permit on
   a second lens, by plumber and by city, with a door to the Market desk's book. One column for
   the named plumber if the feed does not already carry it.
4. **Revision 4 (S): more cities, the file, and the digest.** Austin's Socrata feed (issued
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
6. Revision 2: the map frames the Inspections cities, a pin's color matches its row's verdict, and
   clicking a pin opens the row's card.

No live permit row, address or applicant goes in a test, a doc or a card; the test fixtures are
made up (*Ridgeway Builders*, *100 Sample St*).

## Where it stands

2026-11-09: card opened on the owner's ask and the refinement he liked. The same night, on his word to build it through to live with no questions, PR 1 (v2.6782) was written: the migration, the pull, the ledger, the sheet and the door, with the mock-ups revised on the second look. The map, the hint and the who-wins-what reading are PR 2.
