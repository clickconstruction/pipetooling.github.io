---
name: "Subs: the board by trade, built for the moment a set of plans lands"
number: 153
group: gated
status: building since 2026-10-23 on the owner's yes ("Build it all and push any migrations"); PR 1 v2.5807 (the strip, the list by trade, For, the row press, the from-Prospects line) is up; PR 2 the board and the run, PR 3 the migration, PR 4 the ask on landing follow, stacked
summary: >
  Prospects → Subs holds 104 trade companies found on 2026-10-23, one card at a time on the deck
  and a table on the Prospect List sorted by how long since a touch. Nothing on the page says how
  a company moves off it onto the list we call when a job needs their trade (Trade partners, the
  bench), the only door is Add to the bench ✓ on the one card the deck shows, the row does not
  show the trade, and nothing ranks who answers or who we want first. Three options were drawn
  and the owner picked B, the board by trade, for the moment of use: a set of plans lands, the
  office knows which trades it needs, and wants the right subs of each trade on the phone at once.
  The refined B starts from that moment: pick the project and its trades' columns come forward,
  worst first; Call the top 3 on a column runs the deck through the best three in order, with a
  callback and a text offer when one does not answer; a yes lands on the bench and is asked on
  the job in one press. A's stage strip, sentence and press per card and C's record and priority
  (the rank's reason and the column's default order, a drag pinning a card over it) are folded in.
next: merge the four PRs in order (PR 1 v2.5807 first), push the migration with PR 3, walk the board live with ZZ rows, then use it on the next set of plans
size: M to L over four PRs · PR 1 S · PR 2 M · PR 3 M · PR 4 S
blocker: none; the owner said build it all on 2026-10-23
ver: v2.5807
opinion: build B as refined, in his words (we look for specific kinds of subs at a time, and when plans land we need that trade's subs at once); ship A's cut first inside it so the path is in sight while the columns and the drag come behind
mockup: to-dos/subs-bench-board/mockup.html
---

# Subs: the board by trade, built for the moment a set of plans lands (#153)

## The ask

The owner, 2026-10-23, with two screenshots:

> Right now I do not think we do a great job Managing the subcontractors that have subscribed to
> us because I don't think on this particular page we communicate well how someone can move off
> this page into some sort of list that we want to call when we have jobs. Take a look at how
> hiring looks in these columns or we can rank the responsiveness of people or the priority of
> people. Would you be able to help me.

The first screenshot is Prospects → **Subs** → Prospect List: the search box, the chips *Never
called 100 · Recent 4 · Going cold 0 · Cold 0 · On the bench 0*, then *Never called (100) — oldest
first, matches the calling queue* with the columns Company · Contact · Phone · Added · Last touch ·
Email / Links and **Call now →** on every row, every row *added today* with a dash for the contact
and a website under the dash. The second is Prospects → **Hiring**, the model he likes: the stage
strip (Screen 26 → Interview 0 → Try-out 0 → Hire 1 → Review 33), the sentence *One column per
role you're hiring for — drag cards to re-rank (#1 is the top candidate), then Advance the ones
worth interviewing*, one column per role of ranked cards, each with a phone, an email, *via
employers.indeed.com*, *Never contacted* or *Contacted 92 days ago*, a note, the presses **Talked
today · Advance · Passed**, the chips *call next* and *also in: Plumber*, and three bars Ability ·
Drive · Integrity on a rated card.

"Subscribed to us" reads as the companies on this lane: nothing signs a sub up on its own today.
Every one of the 104 went in through New Prospect (phase 2 of punch list #148, the Central Texas
list, source *Web research 2026-10-23*), and the only other writer of a sub is the same window.

**His pick, the same day**, on the first drawing (A the strip and the list by trade, B Hiring's
board, C the record and the priority, the recommendation then A and C):

> I like all the features of A and C, but B makes the most sense for me, just because we are
> looking for specific kinds of subs at any given time. And often we will get a set of plans and
> then have the need to contact that particular sub as swiftly as we can. Would you be able to
> help me? Refine B.

So the shape is B, one column a trade, and the reason is the moment of use: plans land, the office
knows which trades the job needs, and it wants the right subs of each trade on the phone at once.
The refined B below starts from that moment and folds A and C into it.

## Today

Read live on the dev server against prod as the dev, 2026-10-23, read-only.

- **The lane**: 104 subs over fifteen trades, seven a trade (six on Sitework and Millwork), all
  added the same day; four called by the afternoon, none answered; nobody on the bench from here.
  The bench itself holds one company (a test, Concrete, approved up to $50,000, quoted 2 of 2 asks)
  and one ask short of quotes (a test project due the next day).
- **Follow Up** (`/prospects?kind=subs`): the panel **What GC mode needs right now** (v2.5782,
  `src/lib/prospects/gcNeeds.ts`) at 228 to 472 px, one row for Concrete (*1 on the bench ·
  everyone asked · 6 to call here*, the doors Call for Concrete · Add a sub) and fourteen book
  trades as chips, each *7 to call*; then the card at 484 px (the company, *text? not asked*, the
  website, the trade chip, *from Web research 2026-10-23*, *never called*, the phone, Call script),
  the outcome row **Didn't Answer · Answered · Can't reach · Not a fit · Add to the bench ✓** at
  688 px, then Set callback · Edit prospect · 🔥 0, the comments, the info card and the queue rail
  (*1 of 104*, Coldest · Never called · By need).
- **Prospect List**: the chips are the recency buckets of `prospectListGrouping.ts` (never called ·
  recent under 30 days · going cold · cold · the lane's landed word, *On the bench*). The row shows
  no trade and no stage past "called or not"; its one press is **Call now →**, which opens the deck
  on that card. *On the bench 0* is a section of this list (`prospect_fit_status = 'converted'` with
  `converted_gc_company_id`), not a door to Trade partners.
- **Activity**: the week report (`prospectWeekReport.ts`) counts calls, answered and *converted*
  per caller; on Subs *converted* means Add to the bench, and the word does not say so. Source
  success reads *Web research 2026-10-23 · 0 of 104*.
- **The bench** (`/gc?view=partners`, `GcTradePartners.tsx`): a strip of trades with counts, Actions
  for assistants (*Concrete has 1. Find 2 more.* → **Find on Prospects →**, the door back to this
  lane, v2.5560), then one card a trade with COMPANY · WHEN WE ASK · ASKED RIGHT NOW, each company
  with its vetting chip, its record chip (*answers · hit or miss · often silent · new to us*,
  `answerRecord` in `src/lib/gc/reliability.ts`: quotes over asks, two asks the least judged on) and
  *quoted 2 of 2 asks*. No screen takes a company off the bench.
- **The one door** from here to there: **Add to the bench ✓** on the deck's current card opens
  `ProspectBenchModal` (the bench's Add a company, filled from the card), and `handleBenchSave` runs
  `addGcCompany` → `markProspectOnBench` (`prospect_fit_status = 'converted'`,
  `converted_gc_company_id`, the comment *Added to the bench: ‹name› (/gc?view=partners)*), the
  timer event, the lock release, both caches, the advance. The handler reads `currentProspect`, so a
  list row cannot press it today.
- **What the app knows about a set of plans**: a GC project's trades are its trade packages
  (`gc_trade_packages`: `trade`, `ours`, `project_id`), made by New project from the scope book;
  the open asks and their quotes are `gc_invites` and `gc_quotes` on a package; the Subs lane
  already reads all of it for the panel (`loadGcProjects` → `tradeBenches` → `gcBenchInput`). The
  ask itself is one write, `askGcCompanies(packageId, companyIds, byName, on, send)` →
  `gc_invite_companies` (`src/lib/gc/gcIo.ts`), the one Trade partners' Ask window makes; the
  invitation email goes out through `gc-trade-email` when a dev sends it, else the ask carries a
  note that a dev sends it. A Trades-mode bid carries no divisions the app knows.
- **Hiring's shape** (`TeamProspectsTab.tsx`): the strip is a 57 px row of 88 px boxes with arrows;
  a role column is 300 px; a card is handle · #rank · name · gear, the chips, one fact a line, the
  three presses, the link chips, the read-only bars; the rank is `team_prospects.rank_order` scoped
  to the role column (`teamProspectRanking.ts`, dense 1..n); *call next* is the top never-contacted
  card; *also in* is a same-phone-or-email candidate in another column.

## Options

`mockup.html` opens on the moment of use, then Today, then the whole board, then A and C as they
fold in, a side by side and the decisions. Every company, person and number is made up (Ridgeway
Concrete, Hill Country Fire Protection, Alamo Sprinkler Co, Kendall Concrete, the callers Marisol
and Grace, the project Oak Run Clinic), the lane's shape a week on: To call 96 · Called 5 · Talked
3 · On the bench 2 · Quoted 1, with Can't reach 2 · Not a fit 1 folded.

### B, refined · the board by trade, built for the moment a set of plans lands (the pick)

**The moment.** The board opens on **For**: a GC project at bidding, listed from the projects the
lane already reads, or trades ticked by hand. Picking *Oak Run Clinic* lights its four columns (its
packages we do not self-perform), worst first (nobody on the bench, then short of quotes, then
thin), and folds the other eleven behind *11 trades folded · Press to show all*. Each lit column's
head carries the project's ask (*0 of 2 quotes · due Oct 30, in 7 days*) and the bench's line
(*nobody on the bench · wants 3*, or *1 on the bench, everyone asked*), with **Ask the bench →**
beside it when a bench company is not asked yet.

**Call the top 3 →**, one press a column, opens Follow Up as a **run**: the column's three best
cards, in the column's order, the project named in the head and in the call script, the deck's own
lock, clock, outcomes and callbacks. The run is a slice of the queue fixed at the press (the three
ids on the link), so nothing reshuffles under the caller; the rail shows *The run · 2 of 3* with
the whole queue behind it. **Call now →** on one card is a run of one.

**When one does not answer**: Didn't Answer files the call as today, sets a callback for 3 pm today
on that company (the deck's Set callback, so the Calendar shows it and the card reads *callback set
Fri 3 pm*), offers a one-press text (*Click Plumbing here, we have a set of plans for a fire
sprinkler scope, call us back*) only when they said we may text (the `textRefusal` rule of v2.5606:
a company not asked reads *Ask first* and nothing goes), and moves to the next card. After the
last card the deck shows the run's receipt (*1 will quote and is asked · 2 to call back at 3 pm*)
and **Back to the board →**.

**To the bench, and asked.** Answered and a yes is **To the bench ✓**: Add a company filled from
the card, as today, with one tick when a project is picked: *Ask them to quote Oak Run Clinic · Fire
sprinkler now*, which writes the ask on the job's package through `askGcCompanies`, the ask Trade
partners makes. The card leaves the board as it lands; the bench's line under the name reads *from
Prospects · Marisol, Thu Oct 29 · answered 1 of 2 calls* until the first quote replaces it, so a
company is on one list at a time and *new to us* is not blank on a company we talked to.

**The board with nothing picked** is Hiring's: one column a trade the bench buys out, in the
panel's order, the strip over it (**To call → Called → Talked → On the bench → Quoted**, the last
two doors to Trade partners), the sentence of what moves a company right, each column's head with
its need and **Call the top 3 →**, the exits folded under. A card is handle · #rank · name · gear;
the chips say why it sits there (*★ Call first · answers · pinned by Grace*, *call next*, *also in:
Sitework*, *often silent · later*); one fact a line (the phone and city, the last call and its
note, a callback set); the presses **Call now →** (the deck), **To the bench ✓** and **Pass**. The
call is never logged on the board: the deck has the lock and the clock, so two callers never dial
one company and the minutes count.

**The rank** (C folded in). A column's default order is the office's priority (*Call first*, then
Normal, *Later* last), then the record in the bench's words (*answers · hit or miss · new to us ·
often silent*, `answerRecord`'s thresholds over the lane's call log, a callback they asked for, a
text or an email back on the thread Messages ties to the prospect, and `ok_to_text`), then never
called before called, then coldest. A drag pins a card by hand (an amber edge, *pinned*), and
pinned cards hold their place over the flow, as Hiring's #1 does. The priority is set on the card
or the deck (Call first · Normal · Later, with who and when); the record is computed on load and
never stored.

- **Needs a column**: the trade is on every prospect already (`prospects.trades`, the bench's
  spelling, v2.5559). New: `prospect_trade_ranks` (prospect_id, trade, rank_order; null flows, set
  is pinned; one row a company a trade, since a sub can name two trades and sit in two columns)
  and `prospects.priority` (smallint: 1 Call first, null Normal, 3 Later). One migration with
  `SET lock_timeout` and the three fence calls on the new table; the types regen.
- **Call now and the deck**: Call now on the Prospect List keeps opening the deck on that card; on
  a board card it is a run of one. The deck gains the run (`?run=<ids>`, the head, the rail, the
  receipt, Didn't Answer's callback and text offer in a run) and the order **By rank** (the column's
  order). The outcome presses, the lock, the clock and Activity's counts are unchanged, so the week
  still reads *Marisol · 31 calls · 9 answered · 2 to the bench* (*converted* reads *to the bench*
  on Subs, A's word).
- **The hand-off**: `handleBenchSave` takes the prospect as an argument; the window gains the ask
  tick when a project is picked and calls `askGcCompanies` on the package after `addGcCompany`;
  the Board lane's door (`gc_office_team()`) covers both writes.
- **Honest costs**: a migration; fifteen columns scrolling sideways when nothing is picked (a phone
  shows one at a time, as Hiring does); two places to see one queue and one place to log a call;
  the invitation email still goes out as asks do today; the board is a new component beside
  `TeamProspectsTab.tsx`'s, not a reuse of it (its card and column are bound to `team_prospects`).

Is this the best we can do? It starts from the owner's moment and ends with the sub asked on the
job, four presses from the plans landing (pick the job, Call the top 3, Answered, To the bench ✓
and ask). It stores the two things only a person knows (the pin and the priority) and computes the
rest, so the board and the bench never disagree on who answers. It keeps one place for the call
(the deck), so the lock, the clock and Activity stay whole. Cut: a text to every unreached company
at once (one press a company, after the call, is the texting rule), a run across trades (one trade
a run keeps the script right), and Hiring's three bars (a company's record is one line).

### A · folded into B, and PR 1's shape

A's pieces live on the board: the strip with its counts, the sentence of what moves a company, the
last two stages as doors to Trade partners, a press on every card, the exits folded, Activity's
word, the bench's *from Prospects* line. A is also what ships first inside B's plan: the Prospect
List grouped by trade in the panel's order under the bench's line, the **For** picker lighting the
project's trades first, **Call for ‹trade› →** on each group, **Add to the bench ✓** on a row we
talked to, no migration. The office has the path and the trades in sight while the columns, the
run and the drag come in the PRs after.

### C · folded into B

C's record and priority are the rank's reason on every card and the column's default order, as
above; the deck's order **By priority** became **By rank** (the column's order, pins included).
The old 🔥 warmth (hand-set in Edit prospect, climbing by one on every Answered, 238 of 268 customer
rows at 0 when the list regrouped in v2.2453) is a second hand-set number beside the priority and
retires on Subs with it.

### Rejected

- **A stage called Signed up.** Nothing signs a sub up on its own; the first stage is To call.
- **Logging the call on the board.** Didn't answer · Answered on a card with no lock and no clock
  lets two callers dial one company a minute apart and loses the minutes; the deck does it.
- **A run across trades.** The script names the project and the trade; one trade a run keeps it
  right. The office presses Call the top 3 on the next column when the run is done.
- **Reading a Trades-mode bid's divisions.** The app has none; a GC project's packages are the
  trades a set of plans needs.
- **Pushing the stages onto Trade partners.** The bench has its own words (asked, looking, quote
  in, passed); the strip's last two boxes are doors to it, not a copy.

## Decisions for the owner

1. **The For picker.** Drawn: the GC projects at bidding, whose trades are their packages; or trades
   ticked by hand.
2. **Call the top N.** Drawn as three. It could follow the ask: the quotes still wanted plus one.
3. **When one does not answer.** Drawn: the call is filed, a callback is set for 3 pm today, the
   run moves on, and a one-press text is offered only when they said we may text. The hour and the
   text's words are yours.
4. **The ask on landing.** Drawn: To the bench ✓ during a run ticks *Ask them to quote this job
   now*. The invitation email goes out as asks do today (a dev sends it, or the ask carries the
   note).
5. **Where a call is logged.** Drawn: only on the deck (Call now → on a card is a run of one). The
   other way is Didn't answer · Answered on the card too, with no lock and no clock.
6. **The rank.** Drawn: the column's default order is Call first, then the record, then never
   called, then coldest, and a drag pins a card over it. The other way is Hiring's, every card
   hand-ranked from day one.
7. **Priority's steps and 🔥 warmth.** Drawn: Call first · Normal · Later, and warmth retires on
   Subs.
8. **Where the Board sits.** Drawn as a sub-tab beside Follow Up (Follow Up · Board · Prospect List
   · Activity), the Prospect List kept. The other way is the Board in the list's place on Subs.
9. **PR 1 first.** Drawn: A's cut ships first, no migration; the columns, the run, the drag and the
   ask tick follow.

## Where it plugs in

- **PR 1, A's cut** · `src/lib/prospects/subsStages.ts` (new, pure): the five stages from the
  lane's rows, the called and answered sets and the bench's partners; the groups by trade over
  `gcNeeds`' rows, the project's trades first when one is picked; the strip's words and the
  sentence; the row's press. `src/pages/Prospects.tsx`: the chips row becomes the strip on the
  Prospect List and over Follow Up's panel for `kind === 'sub'`; the list's sections by trade for
  subs (`prospectListGrouping.ts` keeps the customer deck's buckets); the **For** picker over the
  projects `loadGcProjects` already reads; the row's **Add to the bench ✓** through
  `ProspectBenchModal` with `handleBenchSave` taking the prospect; the exits folded.
  `prospectWeekReport.ts` / the Activity tab: the landed word by kind. `GcTradePartners.tsx`
  `PartnerLine`: the *from Prospects* line, read by `converted_gc_company_id` (one `prospects` read
  on the GC page, under the lane's own policy). Guide: *find subs for the bench* § The path to the
  bench (new); *work the prospect calling queue* one clause. Docs: the Prospects map's kind note,
  the Glossary's Prospects entry, APP_DIRECTORY's Subs line.
- **PR 2, the board and the run** · `src/lib/prospects/subsBoard.ts` (new, pure): the columns from
  `gcNeeds`' rows and the project's packages, each column's order (pins, priority, the record,
  never called, coldest), the top N, *call next* and *also in*, the column's head words;
  `src/lib/prospects/subRecord.ts` (new, pure): the record and its facts from the comments, the
  callbacks, the thread's inbound lines and `ok_to_text`, the thresholds `answerRecord`'s;
  `src/lib/prospects/callRun.ts` (new, pure): the run from the link, the next card, the callback
  hour, the text's words through `textRefusal`, the receipt. `src/components/prospects/SubsBoard.tsx`
  (new): the column, the card, the picker, the fold; dnd-kit for the drag in PR 3. `Prospects.tsx`:
  the `?tab=board` key on Subs, the run on Follow Up (`?run=`, the head, the rail, the receipt,
  Didn't Answer's callback through the deck's `prospect_callbacks` write and the text offer through
  `quo-send`), the order **By rank**, the script naming the project. Guide: § Call the top three
  when plans land.
- **PR 3, the migration** · `supabase/migrations/<next>_prospect_trade_ranks.sql`:
  `prospect_trade_ranks` (prospect_id, trade, rank_order, unique on prospect and trade, the three
  fence calls) and `prospects.priority`; `docs/migrations/`; the types regen; `PROSPECT_COLUMNS` +
  `priority`; the drag over `teamProspectRanking.ts`' dense-rank math; the picker on the card and
  the deck; ACCESS_CONTROL. The deploy sequence: the client first, then `db push`.
- **PR 4, the ask on landing** · `ProspectBenchModal` gains the tick when the run names a package;
  `handleBenchSave` calls `askGcCompanies(packageId, [companyId], byName, today, send)` after
  `addGcCompany`; the receipt reads *asked on ‹project›*; the guide's hand-off words.

## The plan, once the yes is in

1. **PR 1 · A's cut** (S, no migration): the strip, the list by trade, the picker, the press per row,
   the exits, Activity's word, the bench's line, the guide, the docs.
2. **PR 2 · the board and the run** (M, no migration): the columns with the record and the default
   order, Call the top 3 as a run on the deck, the callback and the text offer, the receipt, By
   rank; the drag and the priority picker drawn but inert until PR 3.
3. **PR 3 · the migration** (M): the ranks table and the priority column, the drag, the picker; the
   migration-PR deploy sequence (`db push`, types regen).
4. **PR 4 · the ask on landing** (S): the tick and the ask write.

Each PR: kernels and tests first, a render smoke on the words that moved, a release note, a
fragment, the Prospects map and the page map amended.

## How to verify

Local preview, `/dev-login?as=1&to=/prospects?kind=subs%26tab=board`, with ZZ rows (the ZZ rule
hides them from the office): three ZZ subs on Fire sprinkler never called, one on Concrete with an
Answered, one with a Didn't Answer. Pick the test bidding project in **For**: its trades' columns
light, Fire sprinkler first (*nobody on the bench*), the rest fold. Press **Call the top 3 →** on
Fire sprinkler: Follow Up opens as a run, the head names the project, the rail reads *1 of 3*;
press **Didn't Answer**: the card reads *callback set 3 pm*, the Calendar shows it, the text press
reads *Ask first*, the run is on *2 of 3*; press **Answered**, then **To the bench ✓** with the ask
tick: Add a company opens filled, the ask lands on the package (Trade partners reads *asked*), the
card is off the board, the bench's line reads *from Prospects*. Finish the run: the receipt and
**Back to the board →**. Drag the Concrete #2 over #1: it reads *pinned*, and By rank on the deck
follows. Set *Later* on a card: it sinks to the foot. Then delete the ZZ rows, the test company
from `gc_companies` by hand (no screen removes one) and its ask.

## Where it stands

Proposed 2026-10-23 as three options; the owner picked B the same day and asked for it refined
around the moment a set of plans lands. The refined B was drawn (the moment first, the run, the
whole board, A and C folded in) and he said the same evening: "Build it all and push any migrations,
let me know when complete."

| PR | Version | What it does |
|---|---|---|
| 1 | v2.5807 | A's cut, no migration: the strip over the lane (`subsStages.ts`), the Prospect List by trade in the panel's order with the stage chip and the press per row (Call now →, Add to the bench ✓ on a row we talked to), the **For** picker over the projects out for a bid, the exits folded, Activity's *to the bench*, Trade partners' *from Prospects* line (`benchOrigin.ts`). |
| 2 | next | The Board sub-tab and the run on the deck. |
| 3 | next | The migration `prospect_trade_ranks` + `prospects.priority`, the drag, the priority picker. |
| 4 | next | The ask on landing. |
