---
name: "Permits: skim every one in a few seconds, dig into the few, and know the builders"
number: 302
group: gated
status: asked 2026-11-10 · the live tab walked the same day at desk and phone width · planned and drawn the same day with a working skim in frame A · the owner's three looks the same day added a street view and a map, everything public on a tap and a Google press · PR 4 built first on the ledger and the map (v2.6828) · his holistic look, "is this the best we can do", cut eleven PRs to eight and re-aimed them, and his two answers (the plumber is sometimes chosen already, not always; the Leader skims in time, the assistants and estimators more likely) are drawn in · his word the same night: build it all on the picks drawn, live by morning · PR 1 and 2, the skim, built as v2.6830 · PR 3 and 5, the pictures and the swipe, built as v2.6833 · PR 6 and 7 and the count of PR 8, built as v2.6835 with one migration, tested on a local bed · LIVE 2026-11-10 10:22Z: #7529 and #7535 merged, migration 20261110090000 pushed (drift 1219 of 1219), street-view-preview and permit-pull deployed, the pull run (413 builders keyed), the client deployed and its bundle read off clicktooling.com · the phone layout fixed after the live walk (v2.6837)
mockup: to-dos/permit-skim/mockup.html
ver: v2.6828 (PR 4, on today's ledger and map) · v2.6830 (PR 1 and 2, the skim) · v2.6833 (PR 3 and 5, the pictures and the swipe) · v2.6835 (PR 6, 7, 8) · v2.6837 (the phone layout) · v2.6842 (the count on the strip alone) · v2.6843 (the second look) · v2.6850 (Keep from Passed, the history on every card) · v2.6879 (Keep reads Investigate) · v2.6892 (Find a permit, Closed on a map)
summary: >
  Prospects → Permits is a ledger. It is good for finding a permit and slow for answering one. The
  owner asked for two steps. Skim: one permit on one screen with everything needed to decide, a
  street view and a map at its top, and two answers, Investigate or Pass (Keep until v2.6879), by swipe on a phone and by key
  on a desk, best first, with undo, a one-tap reason on a pass and a one-tap hand-off on a keep.
  Dig in: a kept permit opens on the two sheets already built (the building, who pulled it), with
  what we did and a close-out at the foot, Pursue or Not pursuing. Every permit is in exactly one
  of four places (Skim, Investigating, Pursuing, Closed) and none ages out unseen. The longer view is the
  builder: a name on a permit becomes a company that later permits match to, with a good or avoid
  mark that keeps who set it and why. A nudge asks the Leader first and the team after two days,
  and one count says whether any of it turns into bids. The first build is eight small PRs, all
  built, then two weeks of use before more.
next: Two weeks of use, then a look at the count on Permits and the pass reasons before anything held is built. The owner's six calls stand on the picks drawn until he overturns one; call 4's pick (a general contractor's lead on the Customers deck) was built last, as v2.6907.
size: XL as a train of eight (S · M · S · M · S · M · M · S); shipped: PR 1 to 8; left: two weeks of use, then the look at the count
blocker: None. The owner said build it all on the picks drawn.
opinion: build the skim small and measure it — PR 2 needs no migration, since Keep and Pass are two of the four verdicts the table already holds, and the count in PR 8 says after a month whether permits become bids or the skim is busywork
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

The same day, on the frames: *it could be better if we showed a map and a street view*; *click on
the Who or the details of a building and see as much possible information*; *a little Google
button, probably near the name of the person*; and then *is this the best we can do? … we have to
look at it holistically before we spend the energy building it*. His two answers to that look:
when a commercial permit is filed the plumber is *already chosen sometimes, not always*; and the
skim belongs *long term to the Leader, who then passes it to the team to follow up on*, though
*more than likely it is just going to be the assistants and estimators*.

## What is there today

Read from the code and walked on the live app as the dev login on 2026-11-10, read-only.

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
refuses to go without, a look-again day, and on Approach the part the company plays. Approach
makes a GC lead on the Jobs to GC deck with the permit as a job on it. Since v2.6828 an address
opens **The building** and a name opens **Who pulled it**, each with everything public the app can
read, and a round G searches Google beside a name or an address.

**What the walk found.**

| Found | The number | What it means for the design |
|---|---|---|
| A backlog, one day in | 163 wait on a look, none answered, in the 30-day window at $25k and up. The tab was a day old | A backlog is certain. That the ledger's weight caused it is a guess, so the skim is built small and measured |
| The pace | 163 over 23 filing days, about 7 a working day | Once the backlog is cleared the skim is under a minute a day |
| On a phone the act is off the screen | six controls stack before the first row; the table is 880 wide in a 309 window and Decide sits at 665; the sheet is 1,057 tall in a 747 window | The phone needs its own shape, not a narrower table |
| A permit nobody answers drops out of sight | the list reads a 14, 30 or 90 day window | The queue cannot be a window if every permit is to be closed out |
| The look-again day does nothing | it is saved and printed; the list still sorts by the filed day | Kept needs a list of its own that reads the day |
| The same names repeat | 119 names on 163 rows; 26 names pulled 70 of them | The builder is worth a record |
| The hint says almost nothing yet | new name on 162 of 163 | Matching needs an identity that is corrected once and remembered |
| The feed is thin, and a third of it is noise | 137 of 163 read only Commercial project; 70 declare no value; #292 found a third of applications are signs, parking and small repairs | The card adds what the feed lacks. The deck is ordered best first |

## The design

Drawn in [`mockup.html`](mockup.html), frames A to M. Frame A is a working deck.

**A permit is always in exactly one of four places.** The step strip shows all four with their
counts, and they add up to every permit above the filter.

| Place | How a permit gets there | What it waits on |
|---|---|---|
| Skim | The pull brings it in with no plumbing permit on it | One answer: Keep or Pass |
| Kept | Someone pressed Keep | The dig in, then Pursue or Not pursuing |
| Pursuing | Someone pressed Pursue; a lead is on the calling deck | The lead's own life on Prospects and Bids |
| Closed | Passed on the skim, not pursued after a dig in, or the feed named a plumber | Nothing; it can be put back |

**One set of words** on the deck, the ledger, the lists and the Decide sheet: **Keep** (the
ledger's Look into it), **Pass** (Not for us), **Pursue** (Approach them), **Has a plumber**
(Already taken). The stored values stay as they are.

### Step one: skim (frames A, B, F)

One card, one permit: **the look** (a street view of the address with the month it was taken,
beside a map with the office, its ring and the miles; satellite where there is no street view),
**what** (the kind of work, the size, the declared value), **where**, **when** (applied or issued,
how many days ago), **who** (the builder, their mark, our bids with them, their permits this year),
**plumber**, **the property** (the county's owner of record and what stands on the lot).

- **Best first.** The deck opens on the permits most likely to be ours: no plumber yet, a size we
  win, close to the office, a builder we know or marked Good. A builder marked Avoid and a name
  that only files for others sink to the end. A green line on the card says why it sits where it
  does. The order is a hint. Every card is still seen and answered.
- **Two answers.** Keep or Pass. On a phone a drag right keeps and a drag left passes; the two
  buttons are always there and are the control. On a desk the card does not move: ← passes, →
  keeps, Z undoes, S opens the bigger look, Enter opens the permit.
- **Nothing is typed.** A pass shows a dark bar under the next card: *Passed. Why?* with four
  one-tap reasons (Too small, Too far, Not our work, Not this builder) and Undo. A keep shows
  *Kept. For?* with the team's names, so the Leader's skim hands a permit to a person in one tap.
  Neither tap is required and neither holds the next card.
- **Everything public, on a tap** (built, v2.6828; frames L1 and L2). The Who line and the Property
  line open the two sheets, with Keep and Pass at the foot. A round G searches Google.
- **One queue for the company.** A permit skimmed by one person is skimmed for everyone.
- **How it is counted.** To skim is every building permit with no answer and no plumbing permit on
  it, however old, above the deck's filter (commercial only; $25k and up or not declared).
- **Caught up** (frame D). *Nothing waiting on a skim.* with what was answered today, when the next
  pull runs, and one press: *Dig in · 14 kept*.

### Finding one again (frame G)

**Kept** opens on Look again today, then the oldest, with chips for Mine and Nobody's yet (the pile
a Leader's skim leaves for the team). A strip says when a kept permit got a plumber and moves it to
Closed. **Closed** has three chips (Passed, Has a plumber, Not pursuing), a search by street,
builder or permit number, the reason and who on each row, and **Put back**. **All permits** is
today's ledger and map, kept whole.

### Step two: dig in (frame H)

No new page. A kept permit opens on the two sheets v2.6828 built, as three chips: **The building**,
**Who pulled it**, **What we did** (the answers, calls and notes on this permit). The foot is the
close-out:

- **Pursue…** asks two taps. *What for*: this job, their next jobs, or both, since the plumber is
  sometimes chosen already and the relationship is then the point. *Who follows up*. It makes the
  lead the Approach press makes today, with the phone and the owner of record carried, on the deck
  the builder's kind points to.
- **Not pursuing…** asks one of five reasons in one tap, and the permit goes to Closed.

### The builder (frames I and J)

A name on a permit becomes a **builder** the first time it is seen, and every later permit of that
name joins it. In the first build a builder is its names, its kind, its mark and its permits.

- **Matching.** `contactParts` splits the feed's line into a person and a company; the company's
  `research_name_key` is looked up in the names a builder is known by. A hit joins the permit; a
  miss makes a new builder. Exact on the key and nothing fuzzier: a wrong join is worse than a
  missed one.
- **The kind.** General contractor, owner, developer, architect or engineer, plumber, files for
  others, person. Once a builder is *Files for others* the skim card leads with the county's owner
  (frame I4).
- **The mark.** Good, Avoid or none, with a line of why, who set it and when, and the marks before
  it. It shows on the card and moves the card in the deck. It does not answer for anyone.
- **What it joins rather than copies.** A builder whose key matches a customer, or that the office
  links, points at that record and shows its bids, jobs and people from there. The people and the
  calls on a builder we are pursuing live on its lead on the calling deck, which already keeps
  them. Nothing is copied onto the builder.
- **Builders** (frame J): every builder with its mark, permits in twelve months, how many have no
  plumber yet, our bids, and the plumber they use, with a chip for *3 or more permits and never
  bid*. That list is who to get to know.

### Who skims, and whether it works (frame M)

- **The nudge.** A Needs you line, *14 permits wait on a skim*, with how long the oldest has
  waited. The Leader is shown it each morning there is something to skim. When a permit has waited
  two days the assistants and estimators are shown it too. Nobody is blocked from skimming.
- **The count.** One strip on Permits for the month: arrived, skimmed, kept, pursued, bid, won, with
  who skimmed, what pursuing was for, and the pass reasons counted. Bid and won are read from the
  leads the permits made. If pursued stays at nothing after a month, the skim is busywork.

### What exists, and what would be new

Rough terms; no migration is written.

| Need | Already there | New |
|---|---|---|
| The permit and its answer | `permits`, `permit_verdicts` (append-only, a reason on each, the newest wins), `research_permits` | Keep is `look` and Pass is `not_for_us`, so PR 2 writes today's table. PR 7 adds a reason code, the person a keep is for, what a pursue is for, a put-back, and a read with no window that returns the four counts |
| Everything public | Built, v2.6828: `permitPublic.ts`, `PermitBuildingSheet`, `GoogleSearchPress`, the Who card's other permits and the state's door | Keep and Pass at the sheets' foot when opened from the card (PR 2) |
| The miles | `estimateDrivingMiles` in `src/lib/bidDistanceToOffice.ts`; the point on the permit | Nothing but the call |
| The street view | `street-view-preview` and `src/lib/fetchStreetViewPreview.ts`, used by the job window and Job Mode | The month the picture was taken on the metadata answer. Each picture is a paid Google call, loaded for the top card only and never stored |
| The map and satellite | The pins canvases with the office ring; satellite tiles in `OnSiteMap.tsx` | A small still tile for the card |
| A builder | Nothing holds one. `customers` are who we bill; `bids_gc_builders` is a legacy name list; `gc_companies` are trade partners; `prospects` are companies on a deck. `permits.contact` is free text | `builders` (name, kind, at most one link each to a customer, a prospect and a trade partner) and `builder_names` (one row per name key, unique) |
| A mark | The nearest pattern is `gc_companies.vetting_status` with who, when and a note | `builder_marks`, append-only: good, avoid or cleared, the reason, who, when |
| People and calls | `customer_contact_persons` for a customer; a prospect's inline contact, `prospect_comments` and `prospect_callbacks` for a lead | Nothing in the first build: a builder shows them from the record it joins |
| The nudge | The Needs you card and its items | One item, shown by role and by how long the oldest permit has waited |
| The count | `permit_verdicts` (who, when, which), `permit_verdicts.prospect_id` to the lead, the lead to its bids | One read that folds them by month |

## Two other ways to do step one (frame K)

- **A triage table with one-key answers.** Better on a desk, worse on a phone, and it is the
  ledger we have. Taken from it: the keys on a desk, the Up next column, the ledger kept whole.
- **Skim the builders, not the permits.** Better for the long view, worse at the answer, since one
  builder's apartments and its sign are not one decision. Taken from it: the Builders list, and
  after the holistic look, its weight in the plan.

## Is this the best we can do?

Asked three times.

**While the frames were drawn**: three answers became two; the typed reason left the skim; the
window went; the desk stopped swiping; the mark is set on the builder and only shown on the card.

**On the owner's looks**: a street view and a map as two equal tiles, not a picture with a small
map in its corner, since the miles are read as often as the picture; everything public as two
sheets over the card and not a trip to the dig in, with what the app can read drawn as data and
what it cannot drawn as a door.

**The holistic look, 2026-11-10**, before the energy is spent building it. The direction held. The
plan was too big and one part was aimed wrong.

1. **The evidence was thin.** The tab was a day old when it showed nothing answered. The skim is
   built small and then measured by the count.
2. **The builder may matter as much as the permit.** The owner's answer: the plumber is sometimes
   chosen by the time a permit is filed. So Pursue says whether it is for this job or their next
   ones, and Builders moved into the first build.
3. **Best first, not newest first.**
4. **Fewer new parts.** The dig-in page became the two sheets already built. A builder's people and
   calls are shown from the record it joins, not copied. The stack, the first-day card and the
   join of two names are held.
5. **One set of words.**
6. **An owner and a count.** The Leader is asked first and the team after two days.

Eleven PRs became eight, one of them built, and then a stop.

**Still weak.** A street view can be years old. For the first weeks the builder's line will mostly
read *new name*. The best-first order is a guess until the reasons and the count say how good it
is. The swipe has one hazard: a drag from a phone's left edge is the browser's Back, so the drag
starts on the card and the buttons never go away. And nobody may skim: the nudge is the only
answer to that, and it can be ignored.

## The plan

Kernel first, each PR shippable alone. Every PR: claim its version, `npm test` on what it touches,
lint, a narrow typecheck, a release note and a fragment, the guide
`research-permits-for-work-to-bid` amended, `gh pr merge N --auto`. Migrations are numbered from
`origin/main`, open with the lock timeout, close with the four fences, and are pushed after the
merge.

1. **The skim's kernel (S). Built 2026-11-10 with PR 2 as v2.6830.** `src/lib/research/permitSkim.ts`, pure, with tests: which rows are
   in the deck, the best-first score with the words that say why, the four counts, the card's
   lines (the days-ago words, the miles), the pass reasons, the answer a key makes, the undo, and
   the one set of words.
2. **The skim (M, no migration). Built 2026-11-10 as v2.6830** (`docs/recent-features/v2.6830.md`). `PermitSkimDeck` as the first view on Permits behind a
   Skim · All permits switch. Buttons and keys, the undo bar, the reason taps, the caught-up
   state. Keep writes `look` and Pass writes `not_for_us` to `permit_verdicts`. Undo holds the
   write until the next answer or the page hides. The Who and Property lines open the two sheets
   with Keep and Pass at the foot. The ledger and the Decide sheet take the same four words.
3. **The look (S, a function redeployed). Built 2026-11-10 with PR 5 as v2.6833** (`docs/recent-features/v2.6833.md`). The bigger look became two doors: each tile opens Google. The two tiles and the bigger look. The street view
   through `fetchStreetViewImageBlob` by the permit's address, the month taken added to
   `street-view-preview`'s metadata answer, satellite when there is no picture, the map tile with
   the office ring, loaded for the top card only.
4. **Everything public, and the Google press (M). Built 2026-11-10 as v2.6828** on the ledger and
   the map (`docs/recent-features/v2.6828.md`).
5. **The swipe (S). Built 2026-11-10 with PR 3 as v2.6833.** The drag on a phone over the same two answers.
6. **Builders with a mark (M, a migration). Built 2026-11-10 with PR 7 as v2.6835** (`docs/recent-features/v2.6835.md`). The identity became the key on the permit itself (`permits.builder_key`), with `builders` holding only what the office says; `builder_names` waits with the join. As planned: `builders`, `builder_names`, `builder_marks`; the
   matcher as a pure kernel shared by the pull and a one-time backfill; the Builders list; the
   builder's page with its kind, its mark and its permits; the card's Who line read from it; the
   mark in the best-first score.
7. **The four places and the hand-off (M, a migration). Built 2026-11-10 with PR 6 as v2.6835.** The lead landing by the builder's kind (call 4) came after, as v2.6907: the lists read each lead's deck once, so its door opens the right one. The reason code, the person a keep is
   for, what a pursue is for, the put-back, the read with no window; Kept with Mine and Nobody's
   yet; Closed with its search and Put back; the dig in as the two sheets with What we did and
   the close-out; the lead landing on the deck the builder's kind points to.
8. **The nudge and the count (S).** The month's strip was built with v2.6835 (`PermitCountStrip` over `permit_funnel`), and `permit_skim_wait` is in the migration for the nudge. The Needs you line was built with it too (`permits-to-skim`, `usePermitSkimNudge`): the Leader is asked every day there is something to skim, the team once a permit has waited two days from the day the feed brought it.

Then two weeks of use, and a look at the count and the reasons before anything else.

**Held until use asks for it:** the stack for one site (frame C); the first-day card (frame E);
joining two names into one builder; people kept on the calling deck's record of a company, which
would serve every deck and is its own card; rules that pass a permit by themselves; calling and
texting a builder's person through the app. More cities and the weekly file stay with #292.

## What the owner settles

Answered 2026-11-10: the plumber is sometimes chosen by the time a permit is filed, not always;
the Leader skims in time and passes the kept ones to the team, the assistants and estimators more
likely.

Left, each with the pick drawn:

1. **The words.** Keep, Pass, Pursue and Has a plumber everywhere, in place of the ledger's four.
2. **A reason on a pass.** Optional and one tap on the skim; asked for on Not pursuing.
3. **What reaches the deck.** Commercial only, $25k and up or not declared, no houses, nothing
   that already has a plumber.
4. **Where a pursued permit lands.** By the builder's kind: a general contractor on the Customers
   deck, an owner or developer on Jobs to GC. Built as v2.6907; until then every one went to Jobs to GC.
5. **What Avoid does.** A red word and a place at the end of the deck. It never passes a permit
   by itself.
6. **Who may mark a builder, and when the nudge widens.** The office and every estimator may mark;
   the team is asked after two days.

## How to verify

Each PR on the dev server as the dev login; the preview reads and writes prod, so the walk uses
one permit and puts it back.

1. PR 2: Prospects → Permits opens on Skim with the count of what waits, the strongest permit
   first with its green line. → keeps and the count drops by one; Z brings the card back and
   nothing was written. ← passes, a reason tap shows on the bar, and under All permits the row
   reads Pass with that reason and the walker's name. Answer the walk's permit back from the
   ledger.
2. PR 3: the top card shows a street view with its month and the map with the miles; an address
   with no picture shows satellite and says so.
3. PR 5: at 375 wide a drag right past a third of the card keeps, a shorter drag springs back, and
   a drag from the left edge of the screen does not answer.
4. PR 6: two permits with one company name sit on one builder; a mark shows on that builder's card
   with its reason and moves the card in the deck.
5. PR 7: the four counts on the strip add up to the rows above the filter under All permits. A keep
   handed to a person shows under their Mine. Pursue makes one lead on the deck the kind points
   to; the lead is deleted after the walk and the permit put back.
6. PR 8: the line shows for the Leader; the count's kept and passed match the lists.

No live permit row, address or applicant goes in a test, a doc or this card. The mock-up's names
are made up; the counts under What is there today are counts only.

## Where it stands

**Live, 2026-11-10 10:22Z.** #7529 (v2.6828) merged at 09:09Z and #7535 (v2.6830, v2.6833, v2.6835) at 10:07Z. Migration
`20261110090000_permit_skim` was pushed at 10:08Z from a checkout of main (drift check: 1219 local, 1219 remote),
`street-view-preview` and `permit-pull` were deployed, and Pull now was run until no building permit was left without
its builder key: Builders listed 413 names, 39 of them with three or more permits and never bid. The client deploy
landed at 10:22Z after three earlier deploys of main timed out in GitHub's Pages step; the words of the skim were read
off the bundle clicktooling.com serves. Walked on localhost against prod at desk width and 375: the deck (340 to
skim), the street view with its month, the builder line on the card, the count, Builders and a builder's sheet, Closed
(293, all Has a plumber).

**One write the walk made, and its undoing.** A Keep landed on one permit under the owner's login when the held
answer flushed as the browser pane lost focus. It was put back through the app after the push; the permit's history
keeps both lines. Kept rows gained Put back because of it.

**Found on the walks and fixed the same night:** the answer bar and the active step filled with a token that does not
exist; `CURRENT_DATE` in the migration; a pursued or closed permit's sheet whose foot only closed; and, on a phone,
filters that pushed the card under its own answers (v2.6837).


2026-11-10: asked, walked, planned and drawn in one day, with three looks from the owner between.
PR 4 was built first, on today's ledger and map, as v2.6828, and walked live read-only at desk and
phone width. His holistic look cut the plan to eight PRs and re-aimed it, and his two answers are
drawn in (frames A, B2, G1, H and M). The same night he said build it all on the picks drawn, to
be live by morning. PR 1 and 2 were built together as v2.6830 and walked live with Undo, so
nothing was written: the deck opened on 340 permits, every one the feed has brought.
