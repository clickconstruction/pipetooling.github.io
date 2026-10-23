---
name: "Subs: the path off the page onto the bench, and who to call first"
number: 153
group: gated
status: proposed 2026-10-23, three options drawn over the live lane; waits on the owner's pick
summary: >
  Prospects → Subs holds 104 trade companies found on 2026-10-23, one card at a time on the deck
  and a table on the Prospect List sorted by how long since a touch. Nothing on the page says how
  a company moves off it onto the list we call when a job needs their trade (Trade partners, the
  bench), the only door is Add to the bench ✓ on the one card the deck shows, the row does not
  show the trade, and nothing ranks who answers or who we want first. Three options, each drawn
  in mockup.html: A puts Hiring's stage strip over the lane (To call → Called → Talked → On the
  bench → Quoted, with the sentence of what moves a company right), groups the list by trade
  under the bench's own line and gives every row its press; B is Hiring's board, one column a
  trade, ranked by drag; C adds, on top of A, the record in the bench's words (answers · hit or
  miss · often silent · new to us) from the calls, the callbacks and the thread, a three-step
  priority the office sets, and the deck's order By priority.
next: the owner picks from mockup.html; then PR 1 for A (no migration), PR 2 for C (one column, prospects.priority), B only on his word
size: A S · B M to L · C M
blocker: the owner's pick
ver: proposed
opinion: build A now and C next; hold B, since the calls make the judgment a drag would, and the deck, not a board, is the machine that places them
mockup: to-dos/subs-bench-board/mockup.html
---

# Subs: the path off the page onto the bench, and who to call first (#153)

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
- **Hiring's shape** (`TeamProspectsTab.tsx`): the strip is a 57 px row of 88 px boxes with arrows;
  a role column is 300 px; a card is handle · #rank · name · gear, the chips, one fact a line, the
  three presses, the link chips, the read-only bars; the rank is `team_prospects.rank_order` scoped
  to the role column (`teamProspectRanking.ts`, dense 1..n); *call next* is the top never-contacted
  card; *also in* is a same-phone-or-email candidate in another column.

## Options

`mockup.html` draws Today, A, B and C over made-up companies (Ridgeway Concrete, Bluff Creek
Concrete, Hill Country Fire Protection, Kendall Concrete, the caller Marisol, the project Oak Run
Clinic), the lane's shape a week on: To call 96 · Called 5 · Talked 3 · On the bench 2 · Quoted 1,
with Can't reach 2 · Not a fit 1 folded.

### A · The path in sight (S, no migration)

Hiring's strip over the Subs lane, on the Prospect List and over Follow Up's panel both: **To call →
Called → Talked → On the bench → Quoted**, each with its count, the last two doors to Trade partners
at the trade (↗). Under it one sentence, in plain words: *A company moves right as the calls land.
Answered moves them to Talked. Add to the bench ✓ puts them on Trade partners. That is the list we
call when a job needs their trade.* The Prospect List groups by **trade**, in the panel's order
(short of quotes first, then short on the bench, then the book's), each group headed by the panel's
own bench line (*Oak Run Clinic · 1 of 2 quotes · due Oct 30 · 1 on the bench, wants 2 more · 6 to
call here*, with **Ask the bench →** or **Add a sub**). The columns become Company (with the city) ·
Phone · Last call (*answered Wed · "will quote, send the plans"*, *no answer Tue, Thu*, *never
called*) · Stage (a chip: to call · called · talked) · the press: **Call now →** on a company never
called or not yet reached, **Add to the bench ✓** on one we talked to, with *Call again →* beside it.
A sub naming two trades sits under the one the panel ranks worst and wears *also: Sitework*. The
exits fold under the list, *▸ Can't reach 2 · Not a fit 1*, as Hiring folds Passed. On a phone the
strip is two short rows and the rows are the cards the list already draws.

- **The data already holds** every count: the three left stages from the lane's rows and their
  call comments (`calledProspectIds` and `prospectLastCallMap` come from the scan the list already
  makes; Talked needs one more set, *ever answered*, from the same scan), the two right stages from
  the bench the page already reads for the panel (`gcBench.benches`, each partner's `bids` of
  `invited`). The trade groups are `gcNeeds`' rows in its order. Nothing new to store.
- **Call now →** is unchanged: it opens the deck on that card and takes the calling lock. **Add to
  the bench ✓** on a row opens the same `ProspectBenchModal`, filled from the row by
  `benchDraftFromProspect`; `handleBenchSave` takes the prospect as an argument instead of reading
  `currentProspect`. The deck itself is unchanged under the strip.
- **Activity**: the week report's *converted* column reads *to the bench* on Subs
  (`PROSPECT_KIND_WORDS.sub.landed`), so a week reads *Marisol · 31 calls · 9 answered · 2 to the
  bench*. A company's move reads on its row as the comment the press already files.
- **Two lists, one company**: the row leaves this page the moment it lands on the bench (the
  landed section stays as the record). The bench's company line gains one line under the name
  until the first ask replaces it: *from Prospects · Marisol, Thu Oct 29 · answered 1 of 2 calls*,
  read from `prospects` by `converted_gc_company_id`.

Is this the best we can do? It answers the owner's first sentence with nothing new to store and
57 px of chrome: the path is in sight, the list we call is one press away and named, and every row
has the press the top card had. It does not rank who answers; that is C.

### B · The board by trade (M to L, a migration)

Hiring's board under Subs, a fourth sub-tab or the list's place on this lane. One 300 px column per
trade the bench needs, in the panel's order, the column's head carrying the bench's need (*Oak Run
Clinic · 1 of 2 quotes · due Oct 30 · 1 on the bench, wants 2 more*) and *4 never called*. Cards
ranked by drag, *#1* is who we call first, the top never-called card wears *call next*, a company
doing two trades wears *also in: Sitework*. One fact a line (phone, website, *via Web research*,
*Answered Wed · "will quote"*). The presses are the deck's outcomes in Hiring's places: **Didn't
answer · Answered**, then **To the bench ✓ · Pass**. + Add a sub at the foot. Fifteen columns scroll
sideways; a phone scrolls them one at a time as Hiring does.

- **Needs a column**: the rank. A sub is one row and may name two trades, so the rank is per trade:
  a new table `prospect_trade_ranks` (prospect_id, trade, rank_order, dense 1..n per trade), its
  migration with `SET lock_timeout` and the three fence calls, `teamProspectRanking.ts`' math reused.
- **Call now** stays on the list; the board's presses file the deck's own comments
  (`didnt_answer`, `answered`, the bench comment), so Activity counts the calls. Nothing on the board
  takes the calling lock or runs the clock, so *14m on calls* stays the deck's, and two people can
  press the same card a minute apart. The deck gains a fourth order, *By rank*.
- **Activity**: calls from the board count; minutes do not; a drag bumps `updated_at` and would
  show under *Updated* unless the rank write leaves it alone.

Is this the best we can do? Hiring ranks ten people a role by hand because each hire is a judgment
of a person. Here it is seven companies a trade and the judgment is *do they answer, will they
quote*, which the calls themselves say (C). The deck is the calling machine: the lock so two callers
never dial the same company, the clock, the callbacks, the script. A board beside it is a second
view of one queue, and a caller working 104 numbers does not drag cards. The board's two real gains,
the trade in view and a press on every row, A gives the list without a table or a drag. So B is
drawn for the owner's eye and held.

### C · Who answers, who first (M, one column)

On top of A, two more things a row and the card say.

**Answers** is the record, in the bench's own words so a company reads the same on both pages:
*answers* (three of four or better), *hit or miss*, *often silent* (under two of five), *new to us*
(under two calls), with the facts under the chip: *2 of 2 calls · replied by text Wed*, *1 of 2
calls · asked us to call back Fri*, *0 of 3 calls · no text back*, and the day of the last touch.
The facts come from what the app already keeps: the lane's call log (`prospect_comments`
`didnt_answer` / `answered` with their days), a callback they asked for (`prospect_callbacks`), a
text or an email back on the thread Messages ties to the prospect (`messages` where the contact's
`prospect_id` is the row and `direction` is in), and `ok_to_text`. Computed on load by one pure
kernel (`subRecord.ts`, the thresholds `answerRecord`'s), never stored, so it can never go stale.

**Priority** is the office's word, three steps on a chip: **Call first · Normal · Later**, pressed on
the card's utility row or on the list row, with who set it and when. One column,
`prospects.priority` (smallint, null = Normal). *Later* sinks a row to the foot of its trade and off
the deck's first pass; it never hides a company. The old 🔥 warmth (hand-set in Edit prospect,
climbing by one on every Answered, 238 of 268 customer rows at 0 when the list regrouped in v2.2453)
is a second hand-set number beside it and should retire on Subs with this.

**By priority** is the deck's fourth order: Call first, then the biggest gap on the bench, then who
answers, then never called, then coldest. By need folds the priority in as its first key. The card's
head wears the record chip beside the name and the facts under the trade.

- **Call now** and the outcome presses are unchanged. **Activity** gains nothing per user; the
  record is per company. On Trade partners the company's line reads its record under the name until
  the first ask writes the bench's own (*answers · on the phone · never asked*), so the bench's *new
  to us* is not blank on a company we talked to four times.
- Nothing here is money, and nothing here is a teammate's figure: the record is a company's answers
  and the priority is the office's word on a company.

Is this the best we can do? It answers the owner's second sentence with one column and words the
bench already uses. It stores the one thing only a person knows (who we want first) and computes
the rest, so the two never disagree. Cut: three bars like Hiring's (Ability · Drive · Integrity are
a person's; a company's record is one line), a score, and a hand rank by drag (B).

### Rejected

- **A stage called Signed up.** Nothing signs a sub up on its own; the first stage is To call.
- **A kind filter or a sort instead of the strip.** The owner's complaint is that the path is not
  in sight; a strip with counts says it, a sort does not.
- **Pushing the stages onto Trade partners.** The bench has its own words (asked, looking, quote
  in, passed) and its own assistant; the strip's last two boxes are doors to it, not a copy.

## Decisions for the owner

1. **The stage names.** Drawn: To call · Called · Talked · On the bench · Quoted. The last could read
   *Working with us* and count awards instead of quotes.
2. **Where the strip sits.** Drawn on the Prospect List and over Follow Up's panel both. The list
   alone saves Follow Up 57 px.
3. **The list's groups.** Drawn by trade, in the panel's order, each group headed by the bench's
   line. The other way is by stage, Hiring's, with the trade as a chip on the row.
4. **Priority's steps.** Drawn as three words, Call first · Normal · Later. One star on or off is
   simpler and loses *Later*.
5. **The old 🔥 warmth.** With C it retires on Subs, or on every lane.
6. **A way back.** No screen takes a company off the bench today. A company declined on Trade
   partners could get *Send back to Prospects*, the door a lost GC project already has
   (`cardHead.ts` `prospects`), so the two lists never hold one company by accident.
7. **B at all.** Drawn and held. Say the word if the drag is wanted; it is one PR after A and C,
   with its migration.

## Where it plugs in

- **A** · `src/lib/prospects/subsStages.ts` (new, pure): the five stages from the lane's rows, the
  called and answered sets and the bench's partners; the groups by trade over `gcNeeds`' rows; the
  strip's words and the sentence; the row's press. `src/pages/Prospects.tsx`: the chips row becomes
  the strip (`activeTab === 'prospect-list'`, and over the panel on Follow Up for `kind === 'sub'`),
  the list's sections by trade for subs (`prospectListGrouping.ts` keeps the customer deck's
  buckets), the row's **Add to the bench ✓** through `ProspectBenchModal` with `handleBenchSave`
  taking the prospect, the exits folded. `prospectWeekReport.ts` / the Activity tab: the landed word
  by kind. `GcTradePartners.tsx` `PartnerLine`: the *from Prospects* line, read by
  `converted_gc_company_id` (one `prospects` read on the GC page, under the lane's own policy).
  Guide: *find subs for the bench* § The path to the bench (new), *work the prospect calling queue*
  one clause. Docs: the Prospects map's kind note, the Glossary's Prospects entry, APP_DIRECTORY's
  Subs line.
- **B** · migration `prospect_trade_ranks` (+ `docs/migrations/`), `src/components/prospects/SubsBoard.tsx`
  over `teamProspectRanking.ts`' kernels and dnd-kit (already in the bundle), a `?tab=board` key on
  Subs, the deck's `by_rank` order, ACCESS_CONTROL for the table.
- **C** · migration `prospects.priority` (+ `docs/migrations/`), `src/lib/prospects/subRecord.ts`
  (new, pure: the record and its words from the comments, the callbacks, the thread's inbound lines
  and `ok_to_text`; the thresholds `answerRecord`'s), the list's two columns, the card's chip and
  picker, `callingOrder.ts` `by_priority` and By need's first key, `PROSPECT_COLUMNS` + the types
  regen, `PartnerLine`'s record line, the guide's § Who answers, who first.

## The plan, once the pick is in

1. **PR 1 · A** (S): the kernel with tests, the strip, the list by trade, the row's press, the exits,
   Activity's word, the bench's line, the guide, the docs. No migration.
2. **PR 2 · C** (M): the migration, the record kernel with tests, the columns, the picker, the order,
   the bench's record line, the guide. The migration-PR deploy sequence (`db push`, types regen).
3. **B** only on the owner's word, after 1 and 2.

## How to verify

Local preview, `/dev-login?as=1&to=/prospects?kind=subs%26tab=prospect-list`, with ZZ rows (the ZZ
rule hides them from the office): a ZZ sub on Concrete never called, one with a Didn't Answer, one
with an Answered, one added to the bench (then deleted from `gc_companies` by hand, since no screen
removes a company). The strip should read the four across To call · Called · Talked · On the bench,
the groups in the panel's order with the bench's line, the press by stage, the exits folded. Press
**Add to the bench ✓** on the Talked row: Add a company opens filled from the row; cancel. Press
**On the bench**: Trade partners opens at Concrete. Activity's week line reads *to the bench*. With
C: the Answered row reads *answers · 1 of 1 calls*, Call first lifts it to the top of By priority,
Later sinks it. Then delete the ZZ rows.

## Where it stands

Proposed 2026-10-23. Nothing built. The owner picks.
