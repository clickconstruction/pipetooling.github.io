---
name: "Permits: skim every one in a few seconds, dig into the few, and know the builders"
number: 302
group: gated
status: asked 2026-11-10 · the live tab walked the same day at desk and phone width (163 permits wait on a look, none has a verdict) · planned and drawn the same day as eleven frames with a working skim in frame A · the owner's look the same day: good, and better with a map and a street view, so both went onto every card, the desk, the dig in and a bigger look (frame B4) · his second look the same day: much better, and a tap on Who or on the building should show everything public, with a small Google button beside a name, so both were drawn as section L · asked then to fill what the tab lacks today, PR 4 was built first on the ledger and the map (v2.6828): The building, the Google press, a name's other permits, the state's and the clerk's doors · the skim itself not built, nothing written to prod · waiting on his eight calls
mockup: to-dos/permit-skim/mockup.html
ver: v2.6828 (PR 4, on today's ledger and map)
summary: >
  Prospects → Permits is a ledger. It is good for finding a permit and slow for answering one: a
  verdict takes a sideways scroll on a phone, a sheet, a choice of four and a typed reason, and a
  day after the feed went live 163 permits wait and none is answered. The owner asked for two
  steps. Skim: one permit on one screen with everything needed to decide, a street view and a map
  at its top, and two answers, keep
  for a closer look or pass, by swipe on a phone and by key on a desk, with undo and a one-tap
  reason. Dig in: the kept ones open as a page with the site, the county's owner, every permit on
  the address, the builder and the people, and end on Pursue or Not pursuing. Every permit the
  feed brings is in exactly one of four places (Skim, Kept, Pursuing, Closed) and none ages out
  unseen. The longer view is the builder: a name on a permit becomes a company that later permits
  match to, with a good or avoid mark that keeps who set it and why, our own contacts, and a join
  when two names are one company.
next: The owner's eight calls under What the owner settles. On his word to build, PR 1 (the kernel), PR 2 (the skim on today's tables, no migration), and PR 3 (the street view and the map on the card). PR 4's two sheets are live on the ledger and open from the skim card once PR 2 draws one.
size: XL as a train of eleven (S · M · S · M · S · M · M · M · M · M · S); shipped: PR 4 (M)
blocker: The owner's eight calls. PR 1 to PR 3 stand on the defaults drawn if he says build as drawn.
opinion: build the skim first — PR 2 needs no migration, since Keep and Pass are two of the four verdicts the table already holds, and a week of real answers and reasons is what the builder work should be designed from
---

# Permits: skim, then dig in, and know the builders (#302)

The Permits tab came from #292 ([`to-dos/permit-research/`](../permit-research/README.md)), which
stays the home of the feed, the cities and revision 4. This card is what the office does with a
permit once it has arrived.

## The ask, in the owner's words

2026-11-10:

> Can you please take a look at the prospects permits section? I would like to come up with a plan
> to improve this section such that a user can much like Tinder have all the information they want
> presented on one page to them and swipe left or right to either investigate later or ignore going
> into the rest of the steps. I think step one should be to skim and then step two should be to dig
> in. This way, as permits pop up, we can always see them all and close them out and choose to
> pursue them or choose not to pursue them. I think that long term some of these builders are going
> to have identities that we match with and we should be able to mark builders as good or bad and
> add our own contacts so that we can build relationships with the people pulling permits if we can.

## What is there today

Read from the code and walked on the live app as the dev login on 2026-11-10, read-only. No
verdict was saved. The Who pulled it card was not opened, since opening it writes a cached lookup
and may spend a Google call.

**A permit row** (`research_permits`, `ResearchPermitRow` in `src/lib/research/permitResearch.ts`)
carries the permit number and type, applied or issued, the work type, the feed's project name, the
address, zip and a point, the submitted and issued days, the declared value and the area when the
feed gives them, one line for who pulled it, the plumber pairing (a name, or on file with no name,
or none), and the newest verdict with its reason, its look-again day, its lead, who and when.
Beside the name sits a hint from our bid history (warm, cold, seen, new name).

**Where it comes from.** `permit-pull` reads San Antonio's two open-data feeds at 5:30 AM Central
by pg_cron, and on Pull now. The feed runs two or three days behind the city.

**The steps after a permit, today.** One press per row, Decide, opens `PermitDecideSheet`: four
verdicts (Approach them, Look into it, Not for us, Already taken), a typed reason the table
refuses to go without, a look-again day on Look into it, and on Approach the part the company
plays. Approach makes a GC lead on the Jobs to GC deck with the permit as a job on it. The name is
a press that opens `WhoPulledItSheet`: the company on Google Places, the parcel at the county, our
history, the city's portal with the number copied, and Approach them with these facts.

**What the walk found.**

| Found | The number | What it means for the design |
|---|---|---|
| Nothing has been answered | 163 wait on a look, 0 approached, 0 to look into, 0 not for us, in the 30-day window at $25k and up | The act is too heavy for the volume. Step one has to cost seconds. |
| The pace | 163 over 23 filing days, about 7 a working day | Once the backlog is cleared the skim is under a minute a day. |
| On a phone the act is off the screen | six controls stack before the first row; the table is 880 wide in a 309 window and Decide sits at 665; the sheet is 1,057 tall in a 747 window with its press below the fold | The phone needs its own shape, not a narrower table. |
| A permit nobody answers drops out of sight | the list reads a 14, 30 or 90 day window, so past 90 days no screen shows it | The queue cannot be a window if every permit is to be closed out. |
| The look-again day does nothing | it is saved and printed on the row; the list still sorts by the filed day, though the sheet says the row comes back to the top | Kept needs a list of its own that reads the day. |
| The same names repeat | 119 names on 163 rows; 26 names pulled 70 of them, the busiest six each | A site with several buildings files one application a building. Stack them. The builder is worth a record. |
| The hint says almost nothing yet | new name on 162 of 163 | The feed's one line (a person, a company, sometimes a permit runner) seldom matches our books by name alone. Matching needs an identity that is corrected by hand once and remembered. |
| The feed is thin | 137 of 163 are applications whose work reads Commercial project; 70 declare no value; 45 give an area | The card must add what the feed lacks: the miles, the county's owner of record, what stands on the lot, the builder's record. |
| New since you looked is per browser | a localStorage day, rewritten on every load | The count of what is left must come from the answers, not from a visit. |

## The design

Drawn in [`mockup.html`](mockup.html), frames A to K. Frame A is a working deck.

**A permit is always in exactly one of four places.** The step strip under the Permits tab shows
all four with their counts, and they add up to every permit above the filter.

| Place | How a permit gets there | What it waits on |
|---|---|---|
| Skim | The pull brings it in with no plumbing permit on it | One answer: Keep or Pass |
| Kept | Someone pressed Keep | The dig in, then Pursue or Not pursuing |
| Pursuing | Someone pressed Pursue; a lead is on the calling deck | The lead's own life on Prospects and Bids |
| Closed | Passed on the skim, not pursued after a dig in, or the feed named a plumber | Nothing; it can be put back |

### Step one: skim (frames A to F)

One card, one permit, top to bottom: **the look** (a street view of the address beside a map with
the office, its ring and the miles), **what** (the kind of work, the size, the declared value, in
the biggest type), **where** (the street), **when** (applied or issued, how many days ago), **who** (the builder, their mark,
our bids with them, how many permits they pulled this year and how many still have no plumber),
**plumber** (none yet, on file with no name, or the name), **the property** (the county's owner of
record and what stands on the lot).

- **The look** (asked for on the owner's look at the first frames). Two tiles of equal size across
  the top of the card: a street view of the address with the month it was taken, and the map. The
  date matters, since on a new build an old picture of an empty lot is the signal. Where the car
  never drove, the tile shows satellite and says so. A tap on either opens it big (frame B4) with
  Street view, Satellite and Map as three chips and the two answers still at the bottom; on a desk
  both sit larger beside the card and S opens the big one. Nothing inside the card is dragged
  sideways but the card. Only the top card and the one under it load their pictures.
- **Everything public, on a tap** (asked for on the owner's second look; frames L1 and L2). The
  Who line and the Property line are presses. Each opens a sheet over the card, with Keep and Pass
  still at its foot, that lays out what is public source by source with the day it was read.
  **Who**: the name as filed and the person who filed it, Google's record (phone, website, office,
  kind of business), our books (customer, bids, wins, jobs, people), their permits and the plumber
  they use, and doors to the state's business record and the plumbing license roll. **The
  building**: the permit as the city gave it with every field the feed sent, the county's parcel
  (owner of record, mailing address, doing business as, land and building values, use, year
  built, area, acres), every permit on the address, and doors to the city's own record and the
  county clerk's deeds. The same sheets open from the dig in and from a row on All permits.
- **The Google press.** A small round G beside a builder's name, a person's name, an owner of
  record and an address. It opens a Google search in a new tab: a person is searched with their
  company, a company and an address with the city. It is a link, so it costs nothing and needs
  no key.
- **Two answers.** Keep for a closer look, or Pass. On a phone a drag right keeps and a drag left
  passes; the word appears past a third of the card's width and the card springs back before it.
  The two buttons are always there and are the control; the swipe is the shortcut. On a desk the
  card does not move: ← passes, → keeps, Z undoes, Enter opens the permit now, and the room goes
  to an Up next column, a bigger map and the builder.
- **Nothing is typed.** A pass shows a dark bar under the next card: *Passed. Why?* with four
  one-tap reasons (Too small, Too far, Not our work, Not this builder) and Undo. Tapping a reason
  is optional and never holds the next card. A keep shows *Kept for a closer look* and Undo. The
  reason earns its keep twice: the next reader of Closed sees why, and a month of counted reasons
  says which rules to set (PR 11).
- **A stack** (frame C). Permits from one builder on one street filed within a week draw as one
  card that lists them, with *Pass all 6* and *Keep all 6* and a link to answer them one by one. A
  permit in the group that already has a plumber is left out and the bar says so. A failure on one
  of the six leaves the rest answered and names the one that failed.
- **One queue for the company.** A permit skimmed by one person is skimmed for everyone, as a
  verdict is today; each answer keeps the name and the day.
- **How it is counted.** To skim is every building permit with no answer and no plumbing permit on
  it, however old, above the deck's filter (commercial only; $25k and up or not declared). A
  permit the feed pairs with a plumbing permit never enters the deck: it sits under Closed as Has
  a plumber and still counts on the builder's page.
- **Caught up** (frame D). *Nothing waiting on a skim.* with what was answered today, when the
  next pull runs, and one press: *Dig in · 14 kept*.
- **The first day** (frame E). The backlog gets one card, once: skim all of them (about a quarter
  of an hour at five seconds a card), or skim the last 14 days and pass the older ones in one
  press as Too old, listed under Closed with *Put back all*.
- **The order.** Newest first. A builder marked Good is lifted to the front once marks exist.

### Finding one again (frame G)

- **Kept**: the list step two works. It opens on Look again today, then the oldest kept. A strip
  says when a kept permit got a plumber since it was kept, and moves it to Closed.
- **Closed**: three chips (Passed, Has a plumber, Not pursuing), a search by street, builder or
  permit number, each row with who, when and the reason, and **Put back**, which sends it to the
  skim again.
- **All permits**: today's ledger and map, kept whole, for the wide view and the competitor
  reading (Who wins what).

### Step two: dig in (frame H)

A kept permit opens as a page with its own link (`/prospects/permits/<id>`), not a sheet, so it can
be sent, come back to and worked from a phone. Its sections: **the site** (the street view and the
map side by side, a door to walk the street in Google, the county's
owner of record, mailing address, what stands there, the doors to Google Maps and the appraisal
district); **every permit on this site** (the building permit, site work, the plumbing permit or
none yet, and the other trades once the pull keeps them); **the builder** (the mark, our bids,
their permits and the plumber they use, the people with their numbers, Add a person); **what we
did** (the answers, calls and notes on this permit, newest first); **next** (call a person, look
again on a day); and **close it out**, two presses:

- **Pursue** makes the lead the Approach press makes today, with the phone, the people and the
  owner of record carried, and the permit reads Pursuing with the lead's door.
- **Not pursuing…** asks for one of five reasons (they have a plumber, could not reach anyone, too
  far along, not our kind of work, not this builder) and the permit goes to Closed.

The Decide sheet and the Who pulled it sheet are not thrown away: the page is their content laid
out flat, and the ledger keeps its Decide press for a row answered from the wide view.

### The longer view: the builder (frames I and J)

A name on a permit becomes a **builder** the first time it is seen, and every later permit of that
name joins it.

- **Matching.** The feed's one line is split by `contactParts` into a person and a company; the
  company's `research_name_key` (lower-case letters and digits, the LLC and Inc suffixes dropped)
  is looked up in a list of names a builder is known by. A hit joins the permit to that builder; a
  miss makes a new builder with that one name. A person with no company is a builder of kind
  Person until someone says otherwise. Matching is exact on the key and nothing fuzzier: a wrong
  join is worse than a missed one, and a missed one is fixed once by hand and remembered.
- **Same company as…** joins one builder into another: its names, permits, people, notes and mark
  history move to the survivor, and the join is kept so it can be undone (Split a name off).
  `companyDouble.ts` already finds likely doubles by name, phone and Maps link across the decks,
  the bench and customers; the builder page offers its finds, it does not act on them.
- **What it joins rather than copies.** A builder whose key matches a `customers` row, or that the
  office links by hand, points at that customer. Its page then reads the customer's bids, jobs and
  people where they already live, and a person added there is written to the customer's own
  people. The same goes for a prospect on a deck and a trade partner on the bench. A builder with
  none of the three keeps its people on itself until it becomes one of them.
- **The kind.** General contractor, owner, developer, architect or engineer, plumber, files for
  others, person. *Files for others* is the permit runner the first live look found at the top of
  Who wins what: once a builder has that kind, the skim card leads with the county's owner and
  says the name is not who builds it (frame I4).
- **The mark.** Good, Avoid or none, with a line of why, who set it and when, and the marks before
  it. It shows on the skim card, the dig in, the lists and the builder's page. It informs and does
  not answer (unless the owner says otherwise, call 7).
- **People.** Our own contacts on the builder: a name, what they do, a number, an email, a note,
  and where the row came from (named on a permit, added by someone, the customer's own contacts).
  A person the feed names with no number is listed with *Add her number*.
- **Builders** (frame J), a fifth step on the strip: every builder with its mark, its permits in
  twelve months, how many have no plumber yet, the last permit, our bids, and the plumber they
  use, with a chip for *3 or more permits and never bid*, which is the list of who to get to know.

### What exists, and what would be new

Rough terms; no migration is written.

| Need | Already there | New |
|---|---|---|
| The permit and its answer | `permits`, `permit_verdicts` (append-only, a reason on each, the newest wins), `research_permits` | Keep is `look` and Pass is `not_for_us`, so PR 2 writes today's table. Later: a reason code beside the words so reasons can be counted; two more states (put back, not pursuing); a read with no window that returns the counts |
| The site's facts | `permit_lookups` (a parcel and a company, cached a month), `permit-lookup` | The county lookup run by the nightly pull for every permit in the deck (free, no key), so the card has the owner without a press |
| The miles | `estimateDrivingMiles` in `src/lib/bidDistanceToOffice.ts`; the point on the permit | Nothing but the call |
| The street view | `street-view-preview` proxies Google's Street View picture and its metadata with the key on the server; `src/lib/fetchStreetViewPreview.ts` (`fetchStreetViewImageBlob`, `fetchStreetViewMeta`, `googleStreetViewPanoUrl`) is its client, used by the job window and Job Mode | The metadata answer gains the month the picture was taken. Each picture is a paid Google call, loaded when a card is on top and never stored; the volume is the backlog once and about seven a day after |
| Everything public about the name | `WhoPulledItSheet`: Google's record, the county's parcel, our history as one word and a count, the city's portal with the number copied. It opens from a name on the ledger or the map only | The sheet opened from the skim card and the dig in, with our books in full and the builder's permits. A Google search link. Google's review score if the same call returns it at a fair cost (to check). Doors to the state's business record and the plumbing license roll; reading either by machine is to check |
| Everything public about the address | The county's parcel facts, inside the Who card. `permits.raw` keeps every column the feed sent (all but its search text) and no screen shows it. `permits.address_key` already pairs permits on one address | A sheet of its own: the feed's full row, the parcel, every permit on the address, doors to the city's record and the county clerk's deeds |
| The map and satellite | The pins canvases with the office ring (`PinsMapCanvas`, `PinsMapGoogleCanvas`); satellite tiles in `src/components/materials/OnSiteMap.tsx` | A small still tile of one pin for the card; the full canvas in the bigger look |
| A builder | Nothing holds one. `customers` are who we bill; `bids_gc_builders` is the legacy name list bids fall back to; `gc_companies` are trade partners; `prospects` are companies on a calling deck. `permits.contact` is free text | `builders` (name, kind, the Google facts promoted from the lookup, and at most one link each to a customer, a prospect and a trade partner) and `builder_names` (one row per name key, unique, so a name can belong to one builder only) |
| A join of two | `merge_customers` with its preview and its field choices, for customers only | A builder join that moves names, people and notes and can be undone. Smaller than the customer merge: no money hangs off a builder |
| A mark | The nearest pattern is `gc_companies.vetting_status` with who, when and a note, through `gc_vet_company`. `prospects.prospect_fit_status` keeps no setter or reason. The Market desk's feeding and fading and the hint's warm and cold are computed and store nothing | `builder_marks`, append-only like the verdicts: good, avoid or cleared, the reason, who, when |
| People at a company | `customer_contact_persons`, `gc_company_people`, `supply_house_contacts`; a prospect holds one contact inline | `builder_people` for a builder that is none of those yet; a builder linked to a customer reads and writes the customer's |
| Calls and notes | `prospect_comments` and `prospect_callbacks` once a lead exists; `customer_contacts` for a customer | A small notes log on the permit and the builder for the time before a lead exists; after Pursue the lead's own log is the log |
| Calling and texting through the app | `contacts` hangs off exactly one of nine parents, changed only through `name_contact` | A builder's person as a tenth parent. Left out of this train; a `tel:` link and a logged outcome cover the first months |

## Two other ways to do step one (frame K)

- **A triage table with one-key answers.** Better on a desk: twenty rows in view, neighbours to
  compare, several passed at once. Worse on a phone, where a row cannot carry the property, the
  history and the map, so the answer is made on less. It is also the ledger we have, which nobody
  has answered. Taken from it: the keys on a desk, the Up next column, and the ledger kept whole.
- **Skim the builders, not the permits.** Better for the long view: 119 answers, not 163, and it
  builds the builder from day one. Worse at the answer: one builder's apartments and its sign are
  not one decision, and three in four names have a single permit. Taken from it: the stack,
  limited to one builder on one street, and the Builders list.

The deck stays step one because the ask was one permit, everything on one page, two answers, and
it is the only one of the three that works with a thumb.

## Is this the best we can do?

Asked while the frames were drawn, which changed six things:

1. Three answers (Pass, Later, Pursue now) became two. Pursuing on a glance skips the dig in that
   makes a call worth making. A small *Open it now* serves the rare permit that cannot wait.
2. The typed reason left the skim. On 163 cards it is 163 sentences, and it is why nothing has
   been answered. It became four optional taps after the card has gone.
3. One card per permit became stacks, once the live counts showed 26 names behind 70 rows.
4. The window went. A deck that forgets a permit after 30 days cannot promise every permit is
   closed out. The first day got its own card.
5. The desk stopped swiping. A drag with a mouse is slower than a key.
6. The mark left the skim card as a press. It is a judgment on a company with a reason, so it is
   set on the builder and the dig in, and only shown on the skim.

On the owner's look (2026-11-10: good, and better with a map and a street view): the first draft
had a small map strip that said where and nothing about what is there. Two tiles of equal size
were chosen over a street view with a small map in its corner, since the miles are read as often
as the picture, and a swipe between the two pictures was not drawn, since it would fight the
card's own swipe.

On his second look (much better, and two more asks): the first draft sent the reader to the dig in
for the facts behind a name or an address, which is one step too late, since those are the facts
that decide a keep. They became two sheets over the card, not pages, so the deck is never left.
What is drawn as data is what the app can already read (the feed, Google, the county, our own
books); what it cannot read yet is drawn as a door, not as a promise.

Asked again of the rendered page, at desk width and at 375: the working deck answers by button,
drag and key, takes a reason, undoes and ends on the caught-up card. Three things were fixed on
sight (the stack's line broke in two, a dashed box sat on an address, the triage table used one
key for two acts).

**Still weak.** A street view can be years old, and on a rural road there is none; the tile says
which. The card can only show what the feed and the county give, and for the first weeks
that is the street, the size when declared, the owner of record and the miles; the builder's line
will mostly read *new name*. That is why the builder work is in this plan and not a later one.
The swipe has one hazard: a drag that starts at a phone's left edge is the browser's Back, so the
drag starts on the card, the card sits inside the page's gutter, and the buttons never go away.
The stack's rule (one builder, one street, one week) is a guess until it meets real rows; PR 1's
tests should be written from the shapes the live list shows, with made-up names.

## The plan

Kernel first, each PR shippable alone. Every PR: claim its version, `npm test` on what it touches,
lint, the narrow typecheck, a release note and a fragment, the guide
`research-permits-for-work-to-bid` amended, `gh pr merge N --auto`. Migrations are numbered from
`origin/main`, open with the lock timeout, close with the four fences, and are pushed after the
merge.

1. **The skim's kernel (S).** `src/lib/research/permitSkim.ts`, pure, with tests: which rows are
   in the deck, their order, the stacks, the four counts, the card's lines (the days-ago words,
   the miles from `estimateDrivingMiles`, the builder line from the hint), the pass reasons, the
   answer a swipe or key makes, and the undo. No screen.
2. **The skim (M, no migration).** `PermitSkimDeck` as the first view on Permits behind a
   Skim · All permits switch, the ledger and map untouched under All permits. Buttons and keys,
   the undo bar, the reason taps, the caught-up state, the first-day card. Keep writes `look` and
   Pass writes `not_for_us` to `permit_verdicts` with the reason words (*Kept on the skim*, or the
   tapped reason). Undo holds the write until the next answer or the page hides, since the table
   is append-only. The deck reads `research_permits` from the first pull's day.
3. **The look (S, a function redeployed).** The two tiles on the card and the bigger look. The
   street view through `fetchStreetViewImageBlob` and `fetchStreetViewMeta` by the permit's
   address, the month taken added to `street-view-preview`'s metadata answer (its section in
   `docs/EDGE_FUNCTIONS.md`, deployed after the merge), satellite when there is no picture, the
   map tile with the office ring, and loading for the top two cards only. On the desk, S.
4. **Everything public, and the Google press (M, no migration). Built first, 2026-11-10, as
   v2.6828, on today's ledger and map.** Shipped: `permitPublic.ts`, `PermitBuildingSheet`,
   `GoogleSearchPress`, Their other permits and the state's door on the Who card, an address as
   a press. Left for the skim: both sheets opened from the card with Keep and Pass at the foot,
   and our books in full on the Who card. As planned: the Who sheet grown from
   `WhoPulledItSheet` (our books in full, the builder's permits, the doors) and a new sheet for
   the building (the feed's full row read from `permits.raw`, the parcel, every permit on the
   address by `address_key`), both opened from the card's Who and Property lines with the two
   answers at the foot. `googleSearchDoor` as a pure function with tests: what is searched for a
   person, a company, an owner and an address. A lookup still runs only when a sheet is opened,
   and stays cached a month.
5. **The swipe and the stack (S).** The drag on a phone over the same answers, and the stack card
   with its counted presses through `batchWords`, acting on what is ready and naming what failed.
6. **The four places (M, a migration).** A reason code on a verdict, the two new states (put back,
   not pursuing), a read with no window that returns the deck and the four counts in one call, and
   the step strip: Kept (reading the look-again day, with the got-a-plumber strip) and Closed (the
   three chips, the search, Put back). `plumbingOnFile` after a keep closes the permit.
7. **The dig in (M).** The page at `/prospects/permits/:id` and its route, the sections of frame
   H from what the two sheets already load, the notes log, Pursue through today's
   `approachFromPermit`, Not pursuing with its five reasons. The nightly pull asks the county for
   every permit in the deck, so the skim card's Property line fills without a press. The app
   directory and the access matrix get the page.
8. **Builders, the identity (M, a migration).** `builders` and `builder_names`, the matcher as a
   pure kernel shared by the pull and a one-time backfill, `research_permits` returning the
   builder, the skim card's builder line read from it (their permits this year, how many have no
   plumber, the plumber they use), and the Builders list, read-only.
9. **The builder's page: the mark, the kind, the join (M, a migration).** `builder_marks`, the
   mark sheet, the kind (with Files for others changing the skim card's lead), Also filed as,
   Same company as… with its undo, the link to a customer, a prospect or a trade partner. Good
   builders lift to the front of the deck.
10. **People (M, a migration).** `builder_people`, Add a person on the builder and the dig in, the
   feed's person offered with *Add her number*, a linked customer's people read and written in
   place, and Pursue carrying the people onto the lead.
11. **Rules from what the reasons say (S).** After a month of answers: the reasons counted on
   Closed, and rules the office turns on (a builder marked Avoid, a kind, a value) that pass a
   permit by themselves, each counted and listed under Closed with Put back. A line in the
   estimators' morning mail: how many wait on a skim.

Not in this train: more cities and the weekly file (#292, revision 4); the plumbing license roll
behind Who wins what; calling and texting a builder's person through the app.

## What the owner settles

1. **The two answers.** Right keeps for a closer look and left passes, under the words Keep and
   Pass. Or other words?
2. **A reason on a pass.** Optional and one tap, as drawn. Or required, or none?
3. **The backlog.** Skim all 163, or start from the last 14 days and pass the older ones in one
   press as Too old?
4. **What reaches the deck.** Commercial only, $25k and up or not declared, no houses, nothing
   that already has a plumber: today's default list. Keep it?
5. **One queue or one each.** As drawn, a permit skimmed by one person is done for everyone. Or
   does each estimator skim their own?
6. **Where a pursued permit lands.** Today the lead goes on the Jobs to GC deck. A general
   contractor who needs a plumber reads more like the Customers deck. Which, or by the builder's
   kind?
7. **What Avoid does.** As drawn, a red word on the card. Or should an Avoid builder's permits
   pass by themselves, counted and listed under Closed?
8. **Who may mark a builder.** The office and every estimator, as with verdicts. Or the office
   alone?

## How to verify

Each PR on the dev server as the dev login; the preview reads and writes prod, so the walk uses
one permit and puts it back.

1. PR 2: Prospects → Permits opens on Skim with the count of what waits. → keeps and the count
   drops by one; Z brings the card back and nothing was written. ← passes, a reason tap shows on
   the bar, and under All permits the row reads Not for us with that reason and the walker's name.
   Answer the walk's permit back from the ledger's Change.
2. PR 3: the top card shows a street view with its month and the map with the miles; an address
   with no picture shows satellite and says so; a tap opens the bigger look and the answers work
   from inside it. PR 4: a tap on Who and a tap on Property each open their sheet, the G opens a
   Google search for the name in a new tab, and Keep works from inside a sheet. PR 5: at 375 wide a drag right past a third of the card keeps, a shorter drag springs back, and
   a drag from the left edge of the screen does not answer. A stack's press says its count.
3. PR 6: the four counts on the strip add up to the rows above the filter under All permits. Put
   back returns a passed permit to the deck.
4. PR 7: a kept permit's page opens from Kept and from its link; Pursue makes one lead with the
   people and the owner of record on it; the lead is deleted after the walk and the permit put
   back.
5. PR 8 to 10: two permits with one company name sit on one builder; a mark shows on that builder's
   skim card with its reason; Same company as joins two and Split a name off undoes it.

No live permit row, address or applicant goes in a test, a doc or this card. The mock-up's names
(Ridgeway Builders, Calloway and Finch, Tall Pine Development, Lantern Creek) are made up; the
counts under What is there today are counts only.

## Where it stands

2026-11-10: asked, the live tab walked read-only at desk and phone width, the plan written and the
mock-up drawn and checked in the browser. Card #302 claimed on `claude/laughing-hopper-0a3816`.
The owner looked the same day: good, and better with a map and a street view. Both were drawn in
(the cards, frame F, frame H and the new frame B4) and the plan gained PR 3. His second look: much better, with a tap on Who or the building for
everything public and a Google button by a name; drawn as section L, and the plan gained PR 4.

The same day he asked for help with what the tab lacks today. PR 4 was built ahead of the skim,
on the ledger and the map, as v2.6828 (`docs/recent-features/v2.6828.md`): an address opens The
building, a round G searches Google beside a name or an address, the Who card lists the name's
other permits and opens the state's search, and the building opens the county clerk's deeds.
Walked live, read-only, at desk and phone width. The skim (PR 1 to 3) is not built. Waiting on
his eight calls.
