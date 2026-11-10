---
name: "Bids and permits: what the city knows about this site and this GC, on the bid"
number: 307
group: gated
status: asked 2026-11-10 as an idea to explore · #302's train read on main the same day and its two open PRs checked · the latest 120 bids and the permits on hand tested against each other through the dev seat, counts only · the ask drawn as given, then a second look and the pick, at desk and phone width · nothing built
mockup: to-dos/bid-permits/mockup.html
summary: >
  The owner asked to collect who pulls permits, match the names, and show a GC's other permits to
  a person bidding. The test on real rows says the name is the weak join and the address is the
  strong one. Of 27 GC names on the latest bids, one has a permit under its own name. Of 11 San
  Antonio bid addresses, five have a permit on the address. The feed names one applicant, often a
  person, and Texas gives a general contractor no state license number to match on. So the pick
  starts from the site: the bid window says what the city holds on this address, how far along it
  is, the declared value and area, and whether a plumbing permit is already on it. The name on
  that permit is asked about once, Yes or No, and a Yes hands the GC every permit that name ever
  pulled. A sent bid gets news when a permit lands on its site. Collecting needs no new table of
  pullers: #302's builder is the home, plus one small table for the Yes and the No. San Antonio
  covers about three bid sites in ten, so every screen says when it has no records instead of
  reading as no permits.
next: The owner's look at the mock-up and his word on the six calls. PR 1 is a kernel and a count, with no migration and nothing on a screen, and can start on his word.
size: L as a train of seven (S · M · S · M · M · M · M); PR 1 and 2 alone answer whether this site has a permit
blocker: The owner's go. Call 1 picks the direction; calls 2 to 6 each gate one later PR, none gates PR 1.
opinion: build, site first — the site match works today on tables #302 already filled; hold the GC's profile until the Yes and No answers have taught the app whose names are whose
---

# Bids and permits (#307)

## The ask, in the owner's words

2026-11-10:

> I would like to potentially enhance bids such that we start collecting who pulls permits and
> look for matching names and with this tracking offer to users a way to see other permits someone
> has pulled when bidding on things. Can you help me explore this idea?

He asked to explore, not to build. This card is the exploration: what exists, what a test on real
rows showed, a mock-up of the ask as given, a second look, and a plan. No app code is in its PR.

## What is there today (read on main at v2.6849, 2026-11-10)

### What #302 and #292 shipped

Prospects → Permits is live ([`to-dos/permit-skim/`](../permit-skim/README.md), #302, on the feed
[`to-dos/permit-research/`](../permit-research/README.md), #292, built).

- **A permit row** (`permits`, migration `20261109070000`): the city, the feed it came from, the
  permit number and type, a kind (building, plumbing), applied or issued, residential or not, the
  work in words, the feed's project name, the street address and its `address_key`, zip, a point,
  the submitted and issued days, the declared value, the area, and `contact`: one line for who
  pulled it. `raw` keeps the feed's whole row.
- **Who pulled it is one name.** San Antonio's feed has 17 columns. The only party is
  `PRIMARY CONTACT`, free text: a person, a company, or both. There is no contractor column, no
  owner, no license number. The city's own portal shows the applicant, the contractor and the
  licensed professional, but it is a form, not a feed, so #292 made it a door.
- **Where the pull comes from.** `permit-pull` reads two San Antonio datastores (permits issued,
  applications submitted) at 5:30 AM Central and on Pull now. It keeps eight building types and
  every plumbing type, and skips the other trades. San Antonio is the only city. The first pull
  read 75 days, so the rows on hand start on 2026-08-26.
- **A name's other permits.** `permits.builder_key` (v2.6835) is the company on the contact line,
  else the person, keyed by `research_name_key`: lower case, letters and digits, the LLC and Inc
  words dropped. The Who card and a builder's sheet list a name's permits by that key over a year
  (`loadPermitsOfBuilder`), which today means the 75 days on hand. An address opens The building
  with every permit on it (`loadSitePermits`).
- **Builder identities.** `builders` holds what the office says about a key: its kind and a
  `customer_id`. `builder_marks` holds Good and Avoid. On 2026-11-10 both tables are empty: the
  tab is a day old and nobody has said anything about a name yet. `builders.customer_id` exists
  on prod and nothing writes it: `saveBuilder` sends the name and the kind, and no screen has a
  press for the customer. Joining two names into one builder (`builder_names`) is held on #302.
- **Our history beside a name.** `research_contact_history` and `research_builders` count our
  bids to a customer, or to a legacy `bids_gc_builders` row, whose keyed name **equals** the
  permit's key. That equality is the only link between a permit name and a customer today.
- **Still in flight.** #7549 (v2.6843, a second look at what someone else passed) and #7559
  (v2.6850, Keep on a passed row, history on every card). Neither touches identity or bids.

### What a bid holds that a permit could match

- **The GC**: `bids.customer_id` to `customers` (a name, an address, contact details, no license
  number). A bid offered to several GCs has a `bid_gcs` row and `bid_gc_recipients` rows per GC
  (`docs/PER_GC_BID_PLAN.md`). `bids.gc_builder_id`, the legacy list, is empty on every one of
  the latest 120 bids.
- **The site**: `bids.address`, one line of free text. The bid keeps no point; the distance to
  the office is geocoded when the field loses focus.
- **The project**: `bids.project_name`, free text.

### How clean those fields are (the latest 120 bids, counts only)

| Found | Count | What it means |
|---|---|---|
| Robot copies | about half the rows are the estimator twins' copies of a real bid | Every read here leaves them out, or each site counts twice |
| No GC on the bid | 17 of 120 | No name to match; the site still can |
| A placeholder for a GC | 25 of 120 sit on one customer named for the invitation service, not a builder | A name match on that row would be wrong for every bid on it |
| One GC, several customer rows | one builder is three customer rows; four more carry a city or branch in the name | An equal-key match misses a branch name; a link has to be taught |
| The address | 5 of 120 empty; a few are a town or a crossing; the rest are a street line with free punctuation, suites, and *Parkway* where the city writes *pkwy* | The bid's address needs its own reading before it can meet `address_key` |
| Where the sites are | of about 67 different sites, 19 are in San Antonio, 10 in Austin, the rest in some twenty other towns | San Antonio's feed can speak for about three sites in ten |

### The test: do they meet?

Run on 2026-11-10 against the permits on hand (75 days, about 6,500 rows), by hand through the
dev seat. No name or address from it is in this card.

- **By name: 1 of 27.** The 27 GC names on those bids were keyed the way `research_name_key`
  keys them. One has a permit under its key. A search for the largest local GC on the bids found
  no row naming it anywhere in the contact line.
- **By address: 5 of 11.** Eleven San Antonio bid addresses were looked up by house number and
  street. Five have a permit on the address. Four of the five carry a building application.
- **The name on the site's permit is seldom our GC.** On those four, the name is the bid's GC
  once, a person twice and a different company once.
- **A plumbing permit means less than it sounds.** Two of the five sites have plumbing permits.
  One is an irrigation permit alone. The other is general, gas and irrigation on a shopping
  centre's address, filed before the tenant's own application.

So the feed answers *what is happening on this address* well and *what has this GC pulled*
poorly, until someone tells the app which names are the GC's.

## The questions an exploration should settle

### Matching

**The site.** A bid meets a permit when the city is one we read and the house number and the
street agree. The bid's line is read by a new pure kernel: drop the suite, the building and the
unit, cut at the city, turn *Parkway* into *pkwy* the way the feed writes it, lower the case. An
exact match is shown as a fact with the permit's own address beside it, never asked about. A
shopping centre has many tenants on one address, so the screen says *permits on this address*
and lists each with the feed's project name. A permit whose project name shares a word with the
bid's is marked *looks like this job*. Nothing fuzzier than that.

**The name.** Three grades, and only the first is taken without a person:

| Grade | The evidence | What the app does |
|---|---|---|
| The same | the permit's key equals the customer's key | Joined, as the hint already does |
| Likely | one key begins the other (a branch or a longer legal name); later, the same phone or web domain | Asks once: *Same company?* |
| Possible | the name pulled the permit on a site we bid to that GC, and the bid has one GC | Asks once: *Does this name file for them?* |

There is no license number to lean on. Texas does not license general contractors at the state
level, and neither city's feed carries a plumber's license number.

**Yes and No, learned once.** A Yes joins the name to the customer, and every permit under that
name becomes the GC's from then on. A No is kept for that pair so the question never comes back,
and it may carry who the name is instead (the owner, an architect or engineer, files for others,
another GC), which is #302's builder kind. A name whose kind is *files for others* is never
joined to one GC: its permits reach a GC only through a site. Both answers keep who and when,
and both can be taken back on the builder's sheet.

### Collecting

Not a new table of permit pullers. #302's builder already is one: the key is on every permit the
pull brings, and `builders` is where the office speaks about a name. What is missing is the
answer to *is this name that customer*, in both directions.

**One home:** an append-only table of answers, one row per name and customer with Yes or No, who
and when, the newest winning, the way `builder_marks` and `permit_verdicts` work. The Yes is the
link. `builders.customer_id` is dropped in the same migration, since nothing has ever written
it, and `research_builders` keeps returning a customer from the answers so no caller changes.

What the pull itself still needs:

- **History.** A year of a GC's permits needs a year of rows, and the pull has 75 days. The
  city's datastore holds about 155,000 issued permits since 2025, and a second file holds 2020 to
  2024. A one-time run back to January 2025 is free and is about 50,000 kept rows.
- **The plumber's key.** Plumbing permits on hand before v2.6835 have no `builder_key`; the pull
  filled building permits only. The same one-time run fills them.
- **The plumbing type.** Irrigation and gas are plumbing types in this feed. A line that says
  another plumber is on the job must read the type and say it.

### What a person bidding would use

In the order the test says it pays:

1. **Is there a permit on this site, and how far along?** Applied or issued and how long ago. A
   job with an application is real, and one with an issued permit is starting.
2. **The city's numbers against ours.** The declared value and the area on the permit, beside
   the bid's own value. A plumbing bid at 30% of the declared value says something is misread.
3. **Is a plumbing permit already on it, of which type, under whose name?**
4. **Who pulled it,** with the one question that teaches the app.
5. **Who else has pulled permits on this address:** earlier tenants and the plumbers who have
   worked in the building.
6. **After the bid is sent: news.** A permit issued on the site is the day to call. A general
   plumbing permit under another name is the answer nobody phoned in.
7. **The GC's year,** once names are joined: permits by kind and declared value, where they
   build, which plumber is on their jobs and how often, and how many of those jobs they asked us
   to price. *How often they pull plumbing permits themselves* reads better as *who plumbs for
   them*, which `research_builders` already computes.

### Coverage and honesty

Four states, each with its own words, and none of them is *No permits*:

| State | The words |
|---|---|
| Records, and a match | The permits, with *Source: City of San Antonio* and the day the records start |
| Records, and nothing on the address | *No permit on this address since Jan 2025. The city's records run 2 to 3 days behind.* |
| A town we do not read | *No permit records for Kyle. Permits are read for San Antonio only.* with the town's own portal as a door when the Inspections tab has one |
| An address that is not a street address | *This bid's address has no street number, so permits cannot be looked up.* with the press to fix it |

A San Antonio mailing address can sit outside the city limits. The kernel treats a zip as read
when the feed has rows in it, and says *none found* rather than *none* everywhere. A GC's count
always names the city and the first day of the records.

### Cost, limits and terms

| Source | Cost | Limits and terms |
|---|---|---|
| San Antonio open data (CKAN) | Free, no key | Licensed Creative Commons Attribution: the screen names the source. Provided as-is; other records by open records request. Two or three days behind. No rate limit is published; the pull is paged and nightly |
| Austin open data (Socrata, issued construction permits) | Free; a free app token for steady use | Names the contractor's company, trade and phone, and a point on every row. No declared value, no project name, no license number |
| The suburbs (Leon Valley, Converse, Schertz, New Braunfels and the rest) | No feed | A portal with a search and sometimes an export: #292's weekly file |
| Google Places, behind the Who card | Paid per lookup, cached a month in `permit_lookups` | Never fired by opening a bid; only by a press |
| Bexar County parcels | Free, no key | The owner of record for an address |
| The city's permit portal | Free to read by hand | A form, not a feed. Reading it by machine is scraping, so it stays a door |

People's names are on these records. The bid's permit lines show to the people who read
Prospects → Permits today (`user_can_research_permits`: the office and every estimator) and never
on a portal, a letter or a customer's page. The repo is public: no live row, name or address goes
in a test, a doc or a card.

## The mock-up

[`mockup.html`](mockup.html), at 1,248 and 375 wide, every name made up. Rendered and read on
2026-11-10: every frame filled, nothing past a frame's edge, no sideways scroll on a 375 screen,
light and dark.

**The ask as drawn (direction 1, GC first).** The bid window's People section carries the GC's
permits: a year by kind and value, where they build, who plumbs for them. A suggested match by
name waits for Yes or No. The Location section says the address already has a permit. The Bid
Board row carries a chip.

**Is this the best we can do?** No, on three counts, each from the test.

1. **It leads with the part that is empty.** One GC name in 27 has a permit under it. For most
   bids the GC panel would open on a question or on nothing.
2. **It asks the match question without evidence.** *Same company?* on two similar names is a
   guess. *This name pulled the permit on the site you are bidding to them* is a reason.
3. **It is only there when the bid is open.** The moment a permit changes what a person does is
   mostly after the bid is sent, and nobody opens a sent bid to look.

**The pick (direction 2, site first).** The same parts, turned around.

- **This site** leads the Location section: one verdict line, then the permits on the address
  with the city's value and area beside the bid's own, and the plumbing line by type.
- **The question rides on the site.** Under the permit that looks like this job: *Dana Whitlow
  pulled this permit. Does she file for Ridgeway Builders?* Yes · No. A Yes says what it just
  did: *7 other permits now count as Ridgeway's*.
- **The GC's year** sits under the GC card and says how much it knows: *9 permits in San Antonio
  since Jan 2025, under 2 names*, or *No permits under this name yet*, with the door to match one.
- **Permit news** is a strip at the top of the Bid Board and a chip on the row: a permit issued
  on a sent bid's site, a general plumbing permit under another name, an application on an unsent
  one. The plumbing news offers *Mark lost…* and never marks anything by itself.
- **The four honest states** are drawn side by side.

Still weak in the pick: a permit on a shared address may be another tenant's, so *looks like
this job* is a hint that can be wrong; seven sites in ten have no records until more cities are
read; and the GC's year stays thin until people answer the question a few dozen times.

## The recommendation

Worth building, in the order the evidence gives: the site first, the news second, the name
answers third, the GC's year fourth. The first two stand on tables #302 already filled and need
no new table. The owner's idea of collecting who pulls permits is right, and the bids are what
make it work: each bid's site names a puller, and one Yes turns that name into the GC's record.

## What the owner settles

Each with the pick drawn.

1. **Site first or GC first?** *Pick: site first (direction 2).* The GC's panel still ships, as
   PR 6, after the names have been taught.
2. **How far back to read San Antonio.** *Pick: January 2025,* the current datastore, about
   50,000 rows. The 2020 to 2024 file waits until a year proves too short.
3. **Who may answer Yes or No on a name.** *Pick: the office and every estimator,* the people who
   may mark a builder today.
4. **What a plumbing permit under another name does to a sent bid.** *Pick: a chip, a news line
   and a Mark lost… press.* It never changes the outcome by itself, since the type and the tenant
   can both mislead.
5. **Austin next?** About 15% of recent bid sites are in Austin, and its feed names the
   contractor and a phone. *Pick: yes, as PR 7,* moving #292's revision 4 up for that one city.
6. **A bid on the invitation service's placeholder customer.** *Pick: the site half shows, the
   GC half says the bid names no builder* and offers the press to pick one.

## The plan

Kernel first, each PR shippable alone, every one reusing #302's tables, reads and sheets. Each
PR claims its version, ships a release note and a fragment, amends the guide
`research-permits-for-work-to-bid` or adds a bid guide, and merges with `gh pr merge N --auto`.
Migrations are numbered from `origin/main`, open with the lock timeout, close with the four
fences when they make a table, and are pushed from a checkout of main after the merge.

1. **The bid's site, as a kernel (S, no migration, no screen).** `src/lib/research/bidSite.ts`,
   pure, with tests on made-up addresses: read a bid's address into a city and a key that meets
   `address_key`, or the reason it cannot; which state of the four a bid is in; which permit on
   an address looks like this job; the words for each. The PR reports one count through the dev
   seat: how many open bids have a permit on their site today.
2. **This site's permits in the bid window (M, one read, no table).** A function that takes a
   city and a list of keys and returns the permits on them with the plumbing line by type. The
   Location section's verdict line and its list, opening `PermitBuildingSheet` for a permit. The
   four states. The robot copies left out. The city's value and area beside the bid's.
3. **A year and more of history (S, the function redeployed).** `permit-pull` takes a first day
   for a one-time run back to January 2025 and fills `builder_key` on the plumbing rows. Every
   count on Permits and on the bid says the day the records start, read from `permit_pulls`.
4. **Permit news on the Bid Board (M).** One read for every open and sent bid, never one per
   row. The strip, the chips on the row and the phone card, the line on a follow-up, and
   *Mark lost…* opening the outcome the board already has.
5. **Yes and No on a name (M, a migration).** The answers table, the read that folds a
   customer's names, and `builderMatch.ts`, pure: the three grades and what each asks. The
   question under a site's permit, the same question on a builder's sheet, the take-back, and
   Builders' *our bids* column reading the answers.
6. **The GC's year (M).** Under the GC card: the count with its city and first day, by kind and
   declared value, where, who plumbs for them, how many they asked us to price. The detail is
   #302's builder sheet, opened for every name the GC is known by.
7. **Austin (M).** A second feed in `_shared/permitFeed.ts` with the contractor's company as the
   builder and the phone kept, which makes the phone a second way to grade a name.

**Held:** the same phone or web domain as a grade (it needs Places lookups on hand); the suburbs'
weekly file (#292); a Permits tab on the customer's page; merging customer rows that are one GC.

## How to verify

Each PR on the dev server as the dev login; the preview reads prod, and nothing here writes
until PR 5.

1. PR 1: `npm test -- bidSite`. The count in the PR is a number, with no bid named.
2. PR 2: open a bid on a San Antonio street with a permit: the line names the permit, its day,
   its value and area, and the list shows every permit on the address with the one that looks
   like this job marked. A bid in another town reads *No permit records for* the town. A bid with
   a crossing for an address says it cannot be looked up. A robot copy shows no line.
3. PR 3: Builders and the Who card read *since Jan 2025*; a plumbing row from September has a key.
4. PR 4: the strip's count equals the rows with a chip; *Mark lost…* opens the outcome and
   writes nothing until it is saved.
5. PR 5: on a `ZZ Test` customer and a made-up builder key on the local bed
   (`npm run test:pg:permit-skim`), Yes joins, the question is gone, the builder's sheet shows
   who answered, and the take-back brings the question back. No real name is answered in a walk.
6. PR 6: a customer with one joined name shows that name's permits; one with none says so.

## Found in passing, not fixed

- `research_permits` pairs any plumbing-kind permit on an address with a building permit, so an
  irrigation permit can close a building permit as *Has a plumber* on the skim. It belongs to
  #302.
- The permits on hand start 2026-08-26, so *in the last year* on the Who card and on Builders
  reads 75 days today.

## Where it stands

2026-11-10: asked, read, tested on real rows through the dev seat, drawn and planned in one
sitting. Nothing is built and nothing was written to prod. The six calls wait on the owner.
