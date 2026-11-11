---
name: "Bids and permits: what the city knows about this site and this GC, on the bid"
number: 307
group: gated
status: asked 2026-11-10 as an idea to explore · #302's train read on main the same day and its two open PRs checked · the latest 120 bids and the permits on hand tested against each other through the dev seat, counts only · the ask drawn as given, then a second look and the pick, at desk and phone width · the owner's word the same day on the first panel, that these are the permits we can see and saying the GC pulled them overstates it · a third look redrew the pick so every line claims only what the records show, and the GC's half now leads with the jobs priced for them · his word on the live tab's same fault: yes, fix it · the live tab's count lines built as v2.6857, the words half of PR 4 · his word the same day: yes, start PR 1 · PR 1, the bid's site kernel, built as v2.6858 and run on the open bids: 7 of 25 San Antonio sites have a permit · his word after that: build it all · PR 2 and 3, the bid window's two blocks, built together as v2.6866 with one read · PR 5, permit news on the Bid Board, built as v2.6870 · PR 6 and 7, the answer on a name and the names tied to a GC, built together as v2.6872 with one table · the rest of PR 4, the read back as history, built as v2.6873 · PR 8, Austin, came with #292's revision 4 the same day (v2.6859, v2.6861), with New Braunfels, San Marcos and Seguin, so the bid's panels read all five cities · his word on the first screenshots: let a person link one of our customers to a name on permits and see what the two share · drawn as link-a-name.html with a second look, twelve GCs probed on real rows · his word: yes, build both · PR 9 and 10 built together as v2.6886, with no migration · the read back held the same night before its first run: the Permits reads would slow past their limit on older rows, so the press is hidden and the pull refuses it · the pairing in those reads made index-driven as v2.6893, proven row for row on prod: half the wait for a signed-in user, the other half being the access rule checked on every row, which the Permits session is fixing · the hold stays until both are pushed and timed
mockup: to-dos/bid-permits/mockup.html (the live tab's words, before and after: before-after-live-words.html; linking a customer to its names: link-a-name.html)
ver: v2.6857 (the live Permits tab's count lines, the words half of PR 4) · v2.6858 (PR 1, the bid's site kernel and the count) · v2.6866 (PR 2 and 3, This site and What we can see about the GC) · v2.6870 (PR 5, permit news on the Bid Board) · v2.6872 (PR 6 and 7, the answer on a name) · v2.6873 (the rest of PR 4, the read back) · v2.6886 (PR 9 and 10, linking a customer to its names) · v2.6893 (the Permits reads' pairing, index-driven)
summary: >
  The owner asked to collect who pulls permits, match the names, and show a GC's other permits to
  a person bidding. The test on real rows says the name is the weak join and the address is the
  strong one. Of 27 GC names on the latest bids, one has a permit under its own name. Of 11 San
  Antonio bid addresses, five have a permit on the address. The feed names one applicant, often a
  person, and Texas gives a general contractor no state license number to match on. So the pick
  starts from the site: the bid window says what the city holds on this address, how far along it
  is, the declared value and area, and whether a plumbing permit is seen on it. Under the GC sit
  the jobs we priced for them with what the city shows on each address, which needs no name to
  match. The name the city lists on a permit is asked about once, and the answer shows which
  other permits it would tie before it ties them. A sent bid gets news when a permit lands on
  its address. Collecting needs no new table of pullers: #302's builder is the home, plus one
  small table of answers. San Antonio covers about three bid sites in ten, so every line says
  what it can see: the city, the first day of the records, and what a count is out of.
next: Push v2.6893's reads and the Permits session's policy migration (the access rule asked once a read, not once a row), time the reads as a signed-in user, then turn the read back on again and run it to January 2025. Then two weeks of use, and a look at what the answers on names have taught. Left unbuilt and named under each PR: the Ours chip, Mark lost on a news line, the likely name grade, Builders' column reading the answers. The owner said build it all, so calls 2 to 7 stand on the picks drawn until he overturns one.
size: L as a train of eight (S · M · M · S · M · M · S · M); shipped: PR 1 to 10; left: the four small pieces named in next (S)
blocker: The owner's go. Call 1 picks the direction; calls 2 to 7 each gate one later PR, none gates PR 1.
opinion: build, site first — the site match and the jobs priced for a GC work today on tables #302 already filled; permits under a GC's names wait until the answers have taught the app whose names are whose
---

# Bids and permits (#307)

## The ask, in the owner's words

2026-11-10:

> I would like to potentially enhance bids such that we start collecting who pulls permits and
> look for matching names and with this tracking offer to users a way to see other permits someone
> has pulled when bidding on things. Can you help me explore this idea?

The same day, on the mock-up's first panel, headed *Permits Ridgeway Builders pulled*:

> It is permits Ridgeway Builders pulled we can see, just saying they pulled would be an
> overstatement. How could I improve this part of the app? Can you look at the mockups you've
> made and ask ourselves is this the best we can do?

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

**The answer, learned once.** The question is *The city lists this name on this permit. Do you
know who that is?* with three answers.

- **Works for the GC.** Before anything is tied, the answer lists the name's other permits and
  offers two presses: *Show all 7 under Ridgeway* or *This permit only*. One person can file for
  more than one builder, so the person answering looks first.
- **Someone else…** asks which: the owner, an architect or engineer, files for others, another
  GC. That is #302's builder kind. A name that files for others is never tied to one GC.
- **Not sure.** An estimator often does not know. The question stays for the next person and is
  not asked of this one again.

Every answer keeps who and when, shows as *your word, Nov 10* beside the name, and can be taken
back on the builder's sheet.

### Collecting

Not a new table of permit pullers. #302's builder already is one: the key is on every permit the
pull brings, and `builders` is where the office speaks about a name. What is missing is the
answer to *is this name that customer*, in both directions.

**One home:** an append-only table of answers, one row per name and customer with the answer
(works for them, someone else, not sure), whether it ties every permit or the one it was asked
on, who and when, the newest winning, the way `builder_marks` and `permit_verdicts` work. The
*works for them* row is the link. `builders.customer_id` is dropped in the same migration, since nothing has ever written
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
7. **The jobs we priced for this GC, and what the city shows on each.** Of the sites we can
   see, how many got a permit, how many list another plumber on a general plumbing permit, and
   how many list us. It stands on the bids' own addresses, so no name has to match. It says
   whether this GC's jobs go ahead and whether our price is the one they build on.
8. **Other permits under names tied to them,** once people have answered: where else they
   build and who is listed on the plumbing. *How often they pull plumbing permits themselves*
   reads better as *which plumber is listed on their jobs*, which `research_builders` computes.

### Coverage and honesty

Four states, each with its own words, and none of them is *No permits*:

| State | The words |
|---|---|
| Records, and a match | The permits, with *Source: City of San Antonio* and the day the records start |
| Records, and nothing on the address | *No permit on this address since Jan 2025. The city's records run 2 to 3 days behind.* |
| A town we do not read | *No permit records for Kyle. Permits are read for San Antonio only.* with the town's own portal as a door when the Inspections tab has one |
| An address that is not a street address | *This bid's address has no street number, so permits cannot be looked up.* with the press to fix it |

**Say what we can see.** The owner's word on the first panel is a rule for every line here.

- A heading names what the records show, never what a builder did: *What we can see about
  Ridgeway Builders*, with the city, the first day of the records and how many of our bids with
  them it covers.
- The name on a permit is *the name the city lists*. The feed gives one contact, not the builder.
- A count says what it is out of: *of the 5 sites we can see, 4 have a permit*.
- Absence is *none seen*, with the day the records start.
- A permit is *on this address*, since a shared address can carry another tenant's.

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

**The pick (direction 2, site first), as redrawn on the third look.** The same parts, turned
around.

- **This site** leads the Location section: one verdict line, then the permits we can see on
  the address with the declared value and area beside the bid's own, and the plumbing line by
  type.
- **The question rides on the site.** Under the permit that looks like this job: *The city
  lists Dana Whitlow on this permit. Do you know who that is?* Works for Ridgeway · Someone
  else… · Not sure. *Works for Ridgeway* lists the 7 other permits before it ties any.
- **What we can see about the GC** sits under the GC card. First the jobs we priced for them,
  each with what the city shows on its address. Then other permits under names tied to them,
  each name saying how it was tied. On a phone the job list folds behind *See the 5 jobs*.
- **Permit news** is a strip at the top of the Bid Board and a chip on the row: a permit issued
  on a sent bid's address, a general plumbing permit listing another name, an application on an
  unsent one. The plumbing news offers *Mark lost…* and never marks anything by itself.
- **The four honest states** are drawn side by side.

**The third look, on the owner's word.** He read the first panel's heading and said it
overstates. It does, four ways: the records are one city, they start on one day, the name on a
permit is a contact and not always the builder, and a total hides how many rows it stands on.
The same fault ran through the pick, so every line was read for what it claims.

| As first drawn | Now |
|---|---|
| Permits Ridgeway Builders pulled | What we can see about Ridgeway Builders, with its three limits beside it |
| 9 permits · $17.0M declared | Of the 5 sites we can see, 4 have a permit |
| Who plumbs for them: Lone Oak Plumbing on 5 | A general plumbing permit lists Lone Oak Plumbing on 1 site you priced |
| Asked us to price 2 of the 9. We won 1. | The jobs you priced for them, each with what the city shows |
| Pulled by Dana Whitlow | The city lists Dana Whitlow |
| Yes, for Ridgeway. 7 other permits now count as Ridgeway's | The answer shows the 7 first, offers This permit only, and takes Not sure |
| No general plumbing permit on it | No general plumbing permit seen on it |
| A plumbing permit was issued on this site | On this address, with the name the city lists |

It changed the design and not only the words. The GC's half used to open on permits tied by
name, the part the test found empty. It now opens on the jobs we priced for them, which stands
on addresses alone and works the day it ships. The live Permits tab had the same fault, a
builder reading *permits in the last year* on 75 days of records, and it is fixed as v2.6857.

Still weak in the pick: a permit on a shared address may be another tenant's, so *looks like
this job* is a hint that can be wrong; seven sites in ten have no records until more cities are
read; knowing a plumbing permit is ours needs the office to say which names are us; and the
names tied to a GC stay few until people have answered a few dozen times.

## Linking a customer to its names on permits (asked 2026-11-10, built as v2.6886)

The owner, on the first real screenshots of the bid's window:

> I think our names for customers may not perfectly match the permits so it would be cool to be
> able to link one of our customers to a known customer name on bids to see similarities.

Drawn in [`link-a-name.html`](link-a-name.html), desk and phone, every name made up.

**What the data says.** Twelve of the GCs on recent bids, each searched by its one telling word
across the contact line of every permit on hand (2026-11-10, counts only). One has the same
name on a permit, which the app already joins. Three have a look-alike: a name sharing the
telling word that may or may not be them. One matched only by accident, the word sitting inside
a longer, unrelated word. Seven have nothing like them. So a likeness is a question for a
person, it will be asked of about a quarter of GCs today, and the rest need a search.

**The link already exists.** It is a `works_for`, every-permit row in `builder_customer_answers`
(v2.6872). Linking a customer to a name writes the same row from another door. No new table.
A tied company reads *Same company*, a tied person *Works for them*, told apart by
`contactParts`.

**Direction 1, from the customer (the pick, built first).** A press, *Find their names on
permits*, under the GC's card in a bid's window and on the customer's own page. One sheet:

- **Names that may be them**, each with its reasons, the strongest first. The strongest is not
  the name: it is a permit on an address we bid to that customer. Then one name begins the
  other, one letter apart, a shared telling word, initials. The common trade words
  (construction, builders, contracting, group) count for little.
- Two presses on a name: **Same company** and **Not them**. A No is kept, so the name is not
  offered again.
- **Compare** puts ours beside the city's and marks what the two truly share: the addresses we
  bid to them against the permits on those addresses, the zips, the people listed with the
  name, and a phone once one has been looked up.
- **A search** over every name on permits, for the customers nothing resembles.
- **Tied to them**, with whose word it is and Take back.

**Is this the best we can do?** Not by itself. A look-alike is a question and never an answer:
one of the three was a different company. The name is the weakest evidence, so Compare draws a
shared word as the least of them. And one customer at a time leaves most unlinked, since nobody
opens forty bids to tie forty names.

**Direction 2, from the permits (built second).** A chip on Builders, *Looks like a customer*,
with its count. Every look-alike pair in one list, the strongest reason first, each answered in
one press. One sitting ties most of what can be tied, and the Needs you card can carry the count.

**Never:** a tie made by the app on a likeness. Only the exact same name is joined without a
person, as it is today.

## The recommendation

Worth building, in the order the evidence gives: the site first, the jobs priced for the GC
second, the news third, the answers on a name fourth. The first three stand on tables #302
already filled and need no new table. The owner's idea of collecting who pulls permits is right, and the bids are what
make it work: each bid's site names a puller, and one Yes turns that name into the GC's record.

## What the owner settles

Each with the pick drawn.

1. **Site first or GC first?** *Pick: site first (direction 2).* The GC's half still ships: the
   jobs priced for them as PR 3, the names tied to them as PR 7.
2. **How far back to read San Antonio.** *Pick: January 2025,* the current datastore, about
   50,000 rows. The 2020 to 2024 file waits until a year proves too short.
3. **Who may answer Yes or No on a name.** *Pick: the office and every estimator,* the people who
   may mark a builder today.
4. **What a plumbing permit under another name does to a sent bid.** *Pick: a chip, a news line
   and a Mark lost… press.* It never changes the outcome by itself, since the type and the tenant
   can both mislead.
5. **Austin next?** About 15% of recent bid sites are in Austin, and its feed names the
   contractor and a phone. *Pick: yes, as PR 8,* moving #292's revision 4 up for that one city.
6. **A bid on the invitation service's placeholder customer.** *Pick: the site half shows, the
   GC half says the bid names no builder* and offers the press to pick one.
7. **What one answer ties.** *Pick: nothing until the list is shown.* Then *Show all 7 under
   Ridgeway* or *This permit only*, the person's choice each time.
8. **May the app tie a look-alike name by itself?** *Pick: never.* It suggests with its reasons
   and a person presses. Only the exact same name is joined without one.

## The plan

Kernel first, each PR shippable alone, every one reusing #302's tables, reads and sheets. Each
PR claims its version, ships a release note and a fragment, amends the guide
`research-permits-for-work-to-bid` or adds a bid guide, and merges with `gh pr merge N --auto`.
Migrations are numbered from `origin/main`, open with the lock timeout, close with the four
fences when they make a table, and are pushed from a checkout of main after the merge.

1. **The bid's site, as a kernel (S, no migration, no screen).** `src/lib/research/bidSite.ts`,
   pure, with tests on made-up addresses: read a bid's address into a city and a key that meets
   `address_key`, or the reason it cannot; which state of the four a bid is in; which permit on
   an address looks like this job; the words for each, and the scope line every later screen
   uses (the city, the first day of the records, what a count is out of). The PR reports one
   count through the dev seat: how many open bids have a permit on their site today.
   **Built 2026-11-10 as v2.6858** (`docs/recent-features/v2.6858.md`). The count: 28 open bids
   name San Antonio, 25 different sites, and 7 of the 25 have a permit on the address. All 7
   carry a building permit or an application, and 2 carry a general plumbing permit. Both sides
   are read into one shape and compared there, since the feed spells a street type out, leaves
   it off, and writes Loop 1604 as 1604. PR 2's read asks by house number, and the kernel
   decides.
2. **This site's permits in the bid window (M, one read, no table).** A function that takes a
   city and a list of house numbers and returns the permits on them, each with its project name
   and area, for the kernel to decide and to read the plumbing line by type. The
   Location section's verdict line and its list, opening `PermitBuildingSheet` for a permit. The
   four states. The robot copies left out. The city's value and area beside the bid's.
   **Built 2026-11-10 with PR 3 as v2.6866** (`docs/recent-features/v2.6866.md`). The read is
   `bid_site_permits(city, numbers[])`. A row does not open the building's sheet yet. One permit
   in both of the city's feeds is counted once, and a plumbing permit filed under the building
   permit's own contact reads *under the building permit's own name*.
3. **The jobs we priced for this GC (M, PR 2's read, no table).** Under the GC card: the scope
   line, the verdict with what it is out of, and each bid to that customer with what the city
   shows on its address, folded behind a press on a phone. The bids in towns with no records
   are counted and named. A setting holds the names that are us on a plumbing permit.
   **Built 2026-11-10 with PR 2 as v2.6866.** Not built: the setting and the *Ours* chip. A
   plumbing permit is marked only when it lists a name other than the building permit's contact.
4. **A year and more of history, and the live tab's words (S, the function redeployed).**
   `permit-pull` takes a first day for a one-time run back to January 2025 and fills
   `builder_key` on the plumbing rows. **The words were built 2026-11-10 as v2.6857**
   (`docs/recent-features/v2.6857.md`, [`before-after-live-words.html`](before-after-live-words.html)):
   every count on Permits says the day the records start, read from `permit_pulls` by
   `permitReach.ts`, and goes back to *in the last year* by itself once the run back has been
   made. **The run back was built 2026-11-10 as v2.6873** (`docs/recent-features/v2.6873.md`):
   `permits.backfilled` keeps a row read as history off the skim, `permit-pull` takes `since`
   with `until`, and Builders carries the press *Read back to …*, 92 days a step.
   **Held 2026-11-10, before its first run** (`docs/recent-features/v2.6886.md`): the skim's and
   Builders' reads pair every building permit with every plumbing permit in a city through an
   `OR` no index serves (2 to 3.5 seconds each today), and older rows would put them past the
   statement timeout. The press is hidden and `permit-pull` refuses a read back until those
   reads are fast for a signed-in user. **v2.6893** (`docs/recent-features/v2.6893.md`) made the
   pairing two indexed joins: 2 to 3 seconds became 0.7 to 1.4. What is left is the access rule,
   checked on every row; the Permits session's `*_permit_policies_once.sql` asks it once a read.
   The hold lifts when both are pushed and the reads are timed as a signed-in user.
5. **Permit news on the Bid Board (M).** One read for every open and sent bid, never one per
   row. The strip, the chips on the row and the phone card, the line on a follow-up, and
   *Mark lost…* opening the outcome the board already has.
   **Built 2026-11-10 as v2.6870** (`docs/recent-features/v2.6870.md`). Not built: *Mark lost…*
   and the follow-up's line. The news line has one press, Open the bid.
6. **The answer on a name (M, a migration).** The answers table, the read that folds a
   customer's names, and `builderMatch.ts`, pure: the three grades, what each asks, and what an
   answer would tie. The question under a site's permit with its list and two presses, the same
   question on a builder's sheet, the take-back, and Builders' *our bids* column reading the
   answers.
   **Built 2026-11-10 with PR 7 as v2.6872** (`docs/recent-features/v2.6872.md`): the table
   `builder_customer_answers`, `nameAnswers.ts`, and the question under the site's lead permit.
   Not built: the *likely* grade, the question on a builder's sheet, Builders' column reading
   the answers, and dropping `builders.customer_id`, which stays unwritten.
7. **Other permits under names tied to them (S).** The second half of the GC's panel: each name
   with how it was tied and its permits, opening #302's builder sheet.
   **Built 2026-11-10 with PR 6 as v2.6872.** The permits open in the panel, not in the sheet.
8. **Austin (M).** A second feed in `_shared/permitFeed.ts` with the contractor's company as the
   builder and the phone kept, which makes the phone a second way to grade a name.
   **Came with #292's revision 4 on 2026-11-10** (v2.6859 and v2.6861, `_shared/permitCities.ts`):
   Austin, New Braunfels, San Marcos and Seguin beside San Antonio. The bid's panels read every
   city the pull reads (v2.6866): a unit on Austin's street is left off the comparison, and a
   city's one plumbing type is read as the building's plumbing. The read back is San Antonio's
   alone so far, and the phone is not kept.

9. **Find their names on permits (M, no migration).** `src/lib/research/nameLikeness.ts`, pure:
   two names graded with the reason for each grade and the words they share, the trade words
   counted for little, an accidental substring refused. The sheet with its suggestions, its
   search over `research_builders` for each city read, Compare, and the two presses, writing
   `builder_customer_answers`. Mounted under the GC's card and on the customer's page.
10. **Looks like a customer (M).** The same row as a list on Builders behind a chip with its
    count, every customer against every name through one index of telling words, and a Needs
    you line while the count is above zero.
    **PR 9 and 10 were built together 2026-11-10 as v2.6886** (`docs/recent-features/v2.6886.md`).
    Not built: the Needs you line, and a phone or web domain in Compare.

**Held:** the same phone or web domain as a grade (it needs Places lookups on hand); the suburbs'
weekly file (#292); a Permits tab on the customer's page; merging customer rows that are one GC.

## How to verify

Each PR on the dev server as the dev login; the preview reads prod, and nothing here writes
until PR 6.

1. PR 1: `npm test -- bidSite`. The count in the PR is a number, with no bid named.
2. PR 2: open a bid on a San Antonio street with a permit: the line names the permit, its day,
   its value and area, and the list shows every permit on the address with the one that looks
   like this job marked. A bid in another town reads *No permit records for* the town. A bid with
   a crossing for an address says it cannot be looked up. A robot copy shows no line.
3. PR 3: a GC with bids in and out of San Antonio shows the count it is out of, each bid with
   its line, and the towns with no records by name. A robot copy is not in the list.
4. PR 4: Builders and the Who card read *since Jan 2025*; a plumbing row from September has a key.
5. PR 5: the strip's count equals the rows with a chip; *Mark lost…* opens the outcome and
   writes nothing until it is saved.
6. PR 6: on a `ZZ Test` customer and a made-up builder key on the local bed
   (`npm run test:pg:permit-skim`), *Works for* lists the other permits before it ties any,
   *This permit only* ties one, *Not sure* leaves the question for the next person, the
   builder's sheet shows who answered, and the take-back brings the question back. No real name
   is answered in a walk.
7. PR 7: a customer with one tied name shows that name's permits; one with none says so.

## Found in passing, not fixed

- `research_permits` pairs any plumbing-kind permit on an address with a building permit, so an
  irrigation permit can close a building permit as *Has a plumber* on the skim. It belongs to
  #302.
- The permits on hand start 2026-08-26, and the live tab overstated the way the first panel
  did: the Who card said *This name pulled N other permits in the last 365 days*, and Builders
  said *N permits this year* and *in the last year*, on 75 days of records. Fixed as v2.6857.

## Where it stands

2026-11-10: asked, read, tested on real rows through the dev seat, drawn and planned in one
sitting. The owner's word on the first panel the same day brought the third look: the pick
redrawn to say what we can see, the GC's half re-aimed at the jobs priced for them, and the plan
grown from seven PRs to eight. On his yes, the live tab's count lines were fixed as v2.6857, the
words half of PR 4, walked on real data at desk and phone width with nothing pressed. On his
word to start, PR 1 was built as v2.6858: the kernel that reads a bid's address the city's way,
run over the open bids for the count above. Nothing is on a screen yet and nothing was written
to prod. Calls 2 to 7 wait on the owner; his start on PR 1 took call 1's pick.
