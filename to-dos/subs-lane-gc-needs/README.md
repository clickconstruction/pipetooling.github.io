---
name: "Prospects → Subs opens on what GC mode needs: every trade short of quotes or short on the bench, with the project, the due day, who is on the bench and who is here to call; Jobs to GC names the projects bidding"
number: 148
group: close
status: phase 1 shipped and phase 2 added 2026-10-23; one company held by the double check
summary: >
  The Subs lane of Prospects is a blank canvas today: prod has no sub prospect, so the deck says
  "Nobody on Subs yet", and the strip over it reads one chip, "Concrete · 2 more · 0 to call",
  because it only names a trade once a company is on the bench or a live ask is out. The trades GC
  mode will need are already defined (the scope book's sixteen) and the asks that are short of
  quotes carry a project and a due day, but neither reaches the lane. Phase 1 makes the lane open on
  what GC mode needs right now and lead from each need to the companies to call: the bench first,
  then the prospects here, then Add a sub. Jobs to GC gets the same honesty: the projects bidding
  by name and due day, and how many leads on the deck carry a job with a bid day. Phase 2 (after
  the owner's go) researches Central Texas companies per trade and presents a list to add.
next: the owner decides on Campbell Millwork (held: same number as Campbell Painting, Save anyway adds it as a second branch); then retire this to-do
size: XS left (one press, then delete the folder)
blocker: none
ver: proposed
opinion: build the panel — it is the Trade partners need line, read from the caller's side, with the scope book's trades filling the canvas until a project asks
---

# Prospects → Subs opens on what GC mode needs (#148)

## The ask

The owner, 2026-10-23: "In bids, GC, we need to fill a lot of sub labor roles, and those are
somewhat defined. But when a user goes to /prospects?tab=follow-up&kind=subs there are no details
of those domains and it is a blank canvas. I would like to achieve two things, one after the
other: first I would like to better integrate the GC mode into Prospects subs and potentially Jobs
to GC; and then after I would like to have you help me search my local area and backfill people
to call."

## Why it is blank today (read live as the dev, 2026-10-23, read-only)

- `prospects` holds **0 rows of kind `sub`** and **0 of kind `gc_lead`**; 268 customers wait in
  the queue and 59 were not a fit. So the Subs deck has no card and says *Nobody on Subs yet*.
- GC mode on prod has **two test projects**, both named "delete me": one building (Concrete, Fire
  sprinkler, Plumbing as ours, HVAC, Electrical) and one bidding (Concrete only, due 2026-10-24).
  One company is on the bench (a test, Concrete), and it quoted both.
- The strip **The bench needs** reads `tradeBenches`, which names a trade only when a company does
  it or a live ask is out for it. The building project's trades are not live asks, so the strip
  reads one chip: *Concrete · 2 more · 0 to call*. It never says which project needs the quote or
  by when, and never names the fourteen other trades the scope book defines.
- Nothing on the page leads from a need to a company: the chip filters a deck that is empty.

So three things are missing, in order: the real needs (project, due day, quotes in), a door from
each need to the companies (bench, prospects, add), and the roles GC mode is defined around (the
scope book's trades) when no project asks yet.

## The pick (`mockup.html`)

**The Subs lane opens on a panel, What GC mode needs right now**, in place of the chip strip. One
row a trade, three groups, worst first:

1. **Short of quotes**: every open ask short of the two quotes we want, soonest due first. The row
   names the project (a door to its card on GC projects), *1 of 2 quotes*, *due Oct 24, tomorrow*,
   then the bench line and the deck line.
2. **Short on the bench**: trades a company does but fewer than three answer, biggest gap first.
   Deep trades sit last, greyed, so the picture is whole.
3. **The scope book's other trades**: folded into one line of chips, *Nobody does these yet*,
   each chip a door to Add a sub with the trade filled in. The canvas is never blank.

Each row leads, in the owner's order, to the companies to call:

- **The bench first**: *2 on the bench not asked yet* → **Ask them →** opens Trade partners at
  that trade (`/gc?view=partners&trade=Concrete`; the page scrolls to the bench). When everyone is
  asked it says so.
- **Then the prospects here**: *3 to call here* → the trade's name is the deck filter it is today
  (`?trade=`), and the queue heading says the trade.
- **Then find more**: **Add a sub** opens New Prospect as a sub with the trade filled in. Phase 2
  brings the researched list to this door.

**Jobs to GC** keeps *GC work in flight* and adds the honesty under it: *Bidding now: GC test
bidding project, due Oct 24, tomorrow* (a door to the card), and *On this deck: 0 leads carry a job
with a bid day*.

### Rejected

- **A second tab, "GC needs", beside Follow Up.** A tab hides the needs from the caller who lands
  on the deck; the owner's words were "open on". The panel is the deck's own head.
- **Pushing the scope book's trades into the bench as empty benches.** Trade partners would then
  draw sixteen empty cards; the panel folds them instead, and the bench grows only when a company
  is added.
- **Writing a sub prospect for every bench company.** The bench and the queue are two states of one
  company; the double check already keeps them apart.

## Is this the best we can do?

- The panel is Trade partners' need line, read from the caller's side, with the same numbers (two
  quotes an ask, three a trade). The GC page's assistant and this panel disagree on nothing.
- One kernel, `gcNeeds.ts`, takes the bench as `tradeBenches` gives it, the lane's queue and the
  scope book's trade names, and answers the rows, the order and the words. The page only draws.
- Honest when thin: on prod today the panel reads one short ask on a test project, one trade short
  on the bench, and fourteen book trades nobody does. It does not pretend.
- Not done here: a researched list of companies (phase 2), and an Ask window on this page (the
  bench's Ask stays on Trade partners, where the invitation and the portal link live).

## Where it plugs in

- `src/lib/prospects/gcNeeds.ts` (new): `gcBenchInput` (the adapter from `TradeBench[]`),
  `gcNeeds` (the rows and groups), `askWords`, `benchLineWords`, `toCallWords`, `dueWords`,
  `tradePartnersHref`.
- `src/lib/prospects/gcLeadLane.ts`: `gcBiddingLines`, `leadsWithOpenBid`.
- `src/pages/Prospects.tsx`: the Subs effect keeps the bench input beside `benchTrades`; the chip
  strip becomes the panel; the Jobs to GC strip gains its two lines; **Add a sub** opens New
  Prospect with `newTrades` set.
- `src/pages/GcProjects.tsx`: `?view=partners&trade=` scrolls to `benchAnchor(trade)` once the
  board is loaded (today only Follow up's *Who else?* does that scroll).
- Guides: `find-subs-for-the-bench` § Where the bench needs help, `find-jobs-to-build-as-the-gc`
  § What is in flight.

## Plan

1. **PR 1** — the kernel with tests, the Subs panel, the GcProjects door, the guide, the to-do.
2. **PR 2** — the Jobs to GC strip's two lines, its kernel tests, its guide.
3. Stop; show the owner the live lane. Then **phase 2**: the Central Texas list (San Antonio and
   Austin, confirmed from `txCountyLookup.ts` and the projects' addresses), a CSV in this folder,
   deduplicated against the bench and the lane, presented before anything is written.

## How to verify

Local preview, `/dev-login?as=1&to=/prospects?tab=follow-up%26kind=subs`. The panel should read
the Concrete ask on the test bidding project with *due Oct 24*, the bench line *1 on the bench,
everyone asked*, *0 to call here*, and the folded book trades. **Add a sub** on Fire sprinkler
opens New Prospect with *Fire sprinkler* in Trades. **Ask them →** is absent on Concrete (everyone
on the bench is asked). Jobs to GC reads *Bidding now: GC test bidding project, due Oct 24*.

## Phase 2: the list (2026-10-23, `central-texas-subs-to-call.csv`)

105 companies across the fifteen trades GC mode buys out (every scope-book trade but Plumbing, which is ours), seven a trade: five in the San Antonio area (Bexar, Comal, Guadalupe, Kendall) and two in the Austin area (Travis, Williamson, Hays); Landscaping, Glass and storefront and Millwork read four and three. The service area is the app's own (`txCountyLookup.ts`; both GC projects sit in San Antonio).

How it was made: five web-research passes, one per three trades, each asked for established commercial subcontractors that bid to GCs, each phone read off the company's own site (or its own locations page); a company with no confirmable phone was dropped, not guessed. Licence numbers appear only where a site or registry showed one (TECL, TACLA, SCR, one irrigator). The `already` column names anything already on the bench, in Prospects or a customer: one hit, M.C. Ethridge (a Customers-lane prospect).

Read before calling: two Austin rows are branches of San Antonio companies (Northstar Fire Protection, FSG), Central Texas Concretes lists an Alabama area code, Ericstad's website is a placeholder (its row cites the Blue Book), and Campbell Painting and Campbell Millwork share one number. Nothing on this list has been written to prod. On the owner's yes the companies go in through the Subs lane's **Add a sub** (source *Web research 2026-10-23*), never a raw insert.

### Added (2026-10-23, on the owner's yes)

103 of the 105 went in through the app's own New Prospect window as **A sub** (a headless Playwright run of the window, one company at a time: company, office phone, city, website, licence where known, the trade, source *Web research 2026-10-23*). Not added: M.C. Ethridge (already a Customers-lane prospect) and **Campbell Millwork**, which the window's double check held because it shares Campbell Painting's number; it needs the owner's **Save anyway** if wanted as a second branch. Read back on prod: 103 rows of kind `sub`, seven a trade, six on Sitework and Millwork. The panel now reads *7 to call here* on Concrete and a count on every chip.
