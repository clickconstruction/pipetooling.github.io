---
name: "A site's materials: press the Worth, see everything with no price, and price it fast"
number: 342
group: gated
status: asked 2026-11-13 by the owner · the site's screen read in the code and measured on the real site the same day, read only · the card and the mock-up the same day · nothing built · waits on the owner's pick of a drawing and eight short calls
mockup: to-dos/site-materials-price-the-unpriced/mockup.html
summary: >
  On a site's materials screen the Worth figure says how little of the site has a price. A press
  on it already lists the rows with no price, and stops there: pricing one row is three presses
  and a search that finds nothing for most names. On the real site 96 of 100 rows have no price.
  The card measures where a price could come from for each of them: the parts book fits 34 rows
  and the company's supply house bills fit 39, 46 rows between them, and 48 rows have no fit
  anywhere. Almost every fit is a short list, not one sure answer, so the design offers and a
  person accepts. An offer is never counted as known. An accepted price is a tie to the parts
  book where the book has the part, and otherwise a price kept for the site in one new table that
  every on-site money figure reads through the one price rule. Three drawings: the list priced in
  place, one name at a time, and a table grouped by where the price comes from.
next: The owner opens the mock-up, picks a drawing (A is recommended) and answers the eight calls. Then PR 1, the offers, which needs no migration.
size: M · M · S as a train of three (the offers · a price of the site's own · the keyboard and the end)
blocker: The owner's pick. Nothing else.
opinion: build — drawing A, PR 1 first; it turns 34 rows into one press each with no migration, and shows on the real site how often the first offer is right before anything is saved in a new place
---

# A site's materials: price what has no price (#342)

This card follows **A site's materials on one screen** (#330, `to-dos/site-materials-view/README.md`),
whose PR 4 (v2.7078) built the **Worth** figure and **This is a parts-book part**. It leans on
**Every supply house bill's lines as rows** (#298, `to-dos/supply-bill-lines/README.md`), which
made every bill's lines readable, and on the Parts Book's prices. It closes part of the open gap
on **Materials on site** (#209): a price typed off an invoice lives on the device that read it.

Every name, job, house, price and count on the mock-up is made up. The site is Juniper Ridge, as
on #330's mock-up. The counts in *The measure* below are the real site's, as counts only.

## The ask

The owner, 2026-11-13, looking at a site's materials (Materials → On site → the site):

> The summary describes the pricing. I want to click that pricing and see all the items that are
> unpriced, and for it to be really easy to price them.

## What the screen does today (read 2026-11-13)

Read in `src/components/materials/SiteMaterialsView.tsx`, `src/lib/materials/siteWorth.ts`,
`siteRollup.ts`, `bookPrice.ts`, `bookSearchIo.ts` and `onSiteStore.ts`, then on the real site.

- **The summary is the ninth tile, Worth**, drawn for the roles that read the desk's money
  (`showMoney`). `worthWords` writes *$2,310.00 known* over *9 of 118 lines have a price · 2 on a
  price older than 90 days*, or *No price yet*. The cover never leaves the figure.
- **A press on the tile already narrows the list** to the rows with a line that has no price,
  most pieces first (`siteWorth().unpriced`). A line over the list says *the rows with a line that
  has no price, most pieces first*. Each row gains a grey chip, *no price*. That is all the press does.
- **Pricing one row is three presses and a search.** Open the row, press **This is a parts-book
  part**, then pick from an inline picker that searches the parts book for every word of the
  name (`searchBookParts`, at most 20 hits). The pick writes one `same` tie in `on_site_part_ties`,
  and the row then reads the book's name and price. A tie is the only way to price a row here.
- **A typed name has one other price, and the screen cannot set it.** `priceLookup` gives a typed
  name the price the office read off the invoice that landed it. That price is kept in the
  browser's own storage on the device that read it (`rememberPrice`), so no other device sees it.
- **One rule prices everything on site.** `priceLookup(book, invoice, today)`: a parts-book price
  checked inside 90 days, else the invoice price, else a stale book price, flagged. The Worth, a
  job's Missing table and the desk's *Missing this week* all read `priceFor` in the store.
- **A tie is read by the site's screen alone.** The job page still prices each spelling as before.
- **Who may tie**: `on_site_can_tie_parts`, the roles that read the desk with its money (the
  owner's role, the assistant, the controller, a primary and the dev). A superintendent sees the
  screen with no money and no tile.

**Counted in presses:** the 96 rows of the real site are about 290 presses and 96 searches today,
and for 60 of the 94 typed names the search answers nothing.

## The measure, on the real site

Read 2026-11-13 as the dev on a local copy of the app, with the app's own rules (`sitePartRows`,
`siteWorth`, `sameWordsKey`, `searchBookParts`) run over the real rows. Reads only. The real
names and the dollar figures are in the session's notes, outside the repo.

### The shape

| | |
|---|---|
| Rows, lines on hand, pieces | 100 rows · 116 lines · 2,230 pieces, in 94 boxes on 2 jobs |
| What the Worth says | 3 of 116 lines have a price, and all 3 are on a price older than 90 days |
| What the press lists | 96 rows · 113 lines · 2,127 pieces. Nineteen pieces in twenty have no price |
| Typed names against parts-book parts | 94 typed names (2,009 pieces) · 2 parts-book parts with no price in the book (118 pieces) |
| Names that repeat | None across the site's two jobs · 12 rows sit in more than one box · 5 rows fold more than one spelling |
| Where the pieces are | The 10 biggest rows hold half of the unpriced pieces, the 25 biggest hold three quarters · 39 rows hold five pieces or fewer, 19 hold one |
| Rows that are not one part | About 20, under a hundred pieces together: a mixed box, scrap, tools, paint, a count written inside the name |
| Fixtures and equipment | About 15 rows: sinks, toilets, pumps, valves. Few pieces, and probably most of the dollars |
| Ties made so far | None |
| Deliveries that name their invoice | 0 of 121. Nothing joins a line on hand to the bill that bought it |

### Where a price could come from, cheapest first

The 94 typed rows, counted by reading. *Fit* means every word of the name, as the screen's own
same-words fold reads it, is a word of the other name.

| Source | Rows it would clear | Can the code do it today? |
|---|---|---|
| **1 · A parts-book part whose price is missing** | 2 rows, 118 pieces. The book has no price row for either | No. The fix is a price in the Parts Book. A bill line fits both by words |
| **1b · A parts-book price that is stale** | 3 rows, 103 pieces, the three the cover names | The Parts Book's **Check prices**, on its own page |
| **2 · A typed name that fits a parts-book part: the picker's own search** | A hit on 34 rows. Exactly one hit on 8, and at least 3 of those 8 are a different thing. No hit on 60 rows, 1,358 pieces | Yes, at three presses a row, and only where the raw words happen to be in the book's name |
| **2b · The same, by the screen's same-words fold** | A priced book part on **34 rows, 1,208 pieces**: exactly one on 10, two to five on 18, six or more on 6. A price checked inside 90 days on 14 rows | New read: the book's 2,471 names against the fold. The tie it ends in exists |
| **2c · A name already tied to a name with a price** | 0. No tie exists yet | Yes, by itself, once ties exist |
| **3 · A bill line on the same job or site** | **1 row.** The site's 25 jobs have 11 bills with 45 part lines, none on the two jobs that hold the boxes | New read. It clears almost nothing here |
| **3b · A bill line on any bill the company has** | **39 rows, 1,357 pieces**, from 3,859 priced part lines over a year: one house code on 6 rows, two to five on 15, six or more on 18 | New read, and a new place to keep the price: a typed name has none on the server |
| **3c · The house's code matched to a book part** | 0. No bill line is matched to a part yet (#298's *Codes with no part* is unworked) | By itself later: a tied name reads the book, and the book learns from the bills |
| **4 · A price the same name has on another job or site** | 0. One other job has boxes and shares no name, and a typed name's price never left its device | Nothing to read today |
| **5 · Nothing: a person types it** | **48 rows, 446 pieces**: the 20 that are not a part, the 15 fixtures, and names the fold cannot read | No. The screen has no price box |

**Taken together:** the book or a bill fits **46 of the 94 rows, 1,563 pieces**, three quarters of
the typed pieces. 27 rows have a fit in both. 38 rows have a short list, one to five, in at
least one source.

### What the measure changed

1. **The site's own bills do not explain what is in its cages.** The material was counted in on a
   first walk, and no delivery names an invoice. So the offer reads every bill the company has,
   and says which house and which day.
2. **Almost every fit is a list, not an answer.** A crew writes a size and an angle and leaves the
   material out. That name fits a PVC part, a copper one and a PEX one. On one row the bill
   prices that fit ran from under a dollar to several hundred. The fits agree within a quarter
   on 8 rows only. **So nothing is accepted for the owner**, and no batch press accepts a guess.
3. **One hit is not a sure hit.** Three of the eight names the picker answered with a single
   part were answered with a different thing altogether. Even a lone offer waits for a press.
4. **Half the rows need a typed price or no price.** A price box and a way to say *this is not a
   part* matter as much as the offers.
5. **Most pieces first is the wrong order for dollars.** The fittings hold the pieces and the
   fixtures hold the money, and the screen cannot know that before a price exists. The list
   keeps its order and gains a chip that lists the rows with nothing found, where the fixtures are.
6. **A tie beats a typed price.** A tied name keeps reading the book, so **Check prices**, a price
   sheet and, later, #298's price offered from a bill all refresh it with no press here.

## Thinking it through

### What *priced* means

Three words, and the screen never mixes them.

- **Known.** A price the one rule returns today, or a price a person accepted here. It is in the
  dollar figure and in *9 of 118 lines have a price*.
- **Offered.** The app found a fit. It is drawn with a dashed edge and the word *offer*, with its
  source and its day: *offer · parts book · 1" PEX TEE BRASS · $2.86 · checked Oct 3*. It is
  never added to anything. The row still reads *no price*. The tile counts rows, not dollars:
  *41 rows have an offer*. There is no *about $9,000 if the offers hold*: the offers are too
  wide for a sum to mean anything.
- **Left out.** A person said the row is not a part to price: scrap, tools, a mixed box. It
  leaves the cover's count and is named beside it, *19 left out*, so the cover can reach the end.

A price a person accepted is known, whoever offered it. The row says where it came from in the
words the screen already uses: *parts book · checked Oct 3*, *Pecan Supply's bill · Oct 21*,
*typed by Dana · Nov 13*.

### Where an accepted price is saved

By the answer, in this order of preference.

1. **This is that parts-book part**: one `same` tie in `on_site_part_ties`, the table that
   exists. The price is the book's, read through `priceLookup`. Nothing new is stored.
2. **Use this bill's price**, or a price typed in the box: one row in a new table of the site's
   own prices, `on_site_prices`. It holds the site or the job (as a tie does), the row's key, the
   price for one, where it came from (the bill line, its house and its day, or *typed*), who and
   when. Insert and delete, never update. The store hands these rows to `priceLookup` as its
   second argument, beside the device's invoice prices. The rule does not change: a fresh book
   price first, then this, then a stale book price. A row keyed on a book part may carry one too,
   which is how a newer bill price outranks a stale book price.
3. **A parts-book part with no price** (2 rows) belongs to the book. The row offers the bill's
   price as the site's own, as above, and a door to the part in the Parts Book.

**What that does outside this screen.** Every on-site money figure reads `priceFor`, so a price
of the site's own shows in a job's Missing table, in the desk's *Missing this week* and on the
week's missing money, on every device. PR 2 also lets the store read the site's ties, so a tied
name is priced on the job's page as on the site's. A part that goes missing next week then has a
dollar figure where it reads $0.00 today. Nothing outside On site changes: the Parts Book, a
bid, a purchase order and a job's costs are not written and do not read this table.

### Who may price

The roles that may tie today (`on_site_can_tie_parts`). The new table takes the same two gates as
the ties: read by whoever may read the site's ties, written by those roles. A superintendent
still sees no money and no press. Nobody new reads a price.

### How a wrong price is undone

- A row just priced stays in the list, in green, with **Undo**, until the list is narrowed again.
- The open row lists **Priced here** with the source, who and when, and **Undo**, beside *Names
  joined here*. Undo deletes the one row, and the line reads what it read before.
- A second price for the same row is a new row and the newest wins, so Undo steps back one.
- **Not a part** has **Bring back** on the *Left out* chip's list.

### The cover and its 90 days

Every accepted price has a day: a book price its checked day, a bill price the bill's day, a
typed price the day it was typed. Past 90 days it stays in *known* and is counted in *on a price
older than 90 days*, as a book price is today. So a bill from last winter accepted today is amber
at once, which is the truth. The amber half of the cover becomes a press of its own: the rows on
an old price, each with a newer bill beside it where one exists. The tile then holds two lists,
*no price* and *an old price*, and reads done when both are empty.

### Two traps the drawing has to respect

- **The unit.** A count on site is pieces. A bill sells pipe by the foot and small fittings by the
  hundred (77 of the bill lines). An offer shows the bill's own unit and the price for one, and the
  box is labelled *for one, as counted*.
- **Speed must not hide the source.** Enter takes the first offer only when the row shows it, and
  the answer names what it took.

## The drawings

`mockup.html`, at a desk's width and a phone's. The summary as it is today, then three ways the
press could open.

- **A · In place (recommended).** The press narrows the list as today, and each row now carries
  its offers as one-press answers, a price box and **Not a part**. Enter saves and moves down.
  Chips over the list: every row, has an offer, nothing found, left out.
- **B · One at a time.** A window with one name, its boxes, its offers as large numbered answers,
  a price box, **Skip** and **Not a part**, and a count that ticks down.
- **C · By source.** One table in sections: one fit in the parts book, one bill has it, more than
  one fit, nothing found. A counted press acts on the ticked rows of the first two sections and
  lists what it held with the reason (`batchWords`).

The mock-up also draws the summary's words changing as rows are priced, the row after an answer
with its **Undo**, and the end: *Nothing waiting on a price on this site.*

**Recommended: A.** He asked to see all of them, and the press already makes that list. A puts
the answer on the row he is looking at, it is the smallest step from what is built, and the
measure says a row needs a choice among a few offers far more often than it needs a batch.

## The plan

| PR | What | Lets the owner | Size |
|---|---|---|---|
| 1 · the offers | A pure kernel `src/lib/materials/priceOffers.ts` (a row's same-words fold against the book's names and the bill lines, ranked, each with its source, price for one, day and house) with tests. One read `priceOffersIo.ts`: the book's names and prices and the priced bill lines, paged past the 1,000-row cap, asked once when the tile is pressed. The narrowed list draws each row's offers. A parts-book offer is one press, **Use this part**, the tie that exists. A bill offer is shown, with its door to What we buy, and no press yet. The tile says how many rows have an offer. The picker opens on the folded words. **No migration.** | Price the 34 rows the book fits at one press each, and see what a bill paid for 39 | M |
| | **Stop and look on the real site.** Count how often the first offer was the right one. | | |
| 2 · a price of the site's own | The migration `on_site_prices` (opens with `SET lock_timeout = '3s';`, numbered from `origin/main` and claimed, idempotent, the four `apply_*` fence calls, its `docs/migrations/` page, pushed right after the merge since the client reads what it makes). The store reads the site's prices and ties into `priceFor`. **Use this price** on a bill offer, the price box, **Not a part**, **Priced here** with **Undo**. `worthWords` gains *left out*. `PricePick` gains the site's own source and its words. | Price every row, from any device, and see it on the job's Missing table | M |
| 3 · the keyboard and the end | Enter saves and moves to the next row. The chips. The line that counts down. The empty state. The press on *older than 90 days*. The phone's layout. | Work the list in one sitting | S |

Each PR ships its release note, fragment and guide (`src/content/help/`, the site's materials
guide), and updates `docs/MATERIALS_ON_SITE_ARCHITECTURE.md`. PR 2 updates `ACCESS_CONTROL.md`.

**New reads, named.** PR 1: `material_parts` (id, name, manufacturer), `material_part_prices` and
`supply_purchase_lines` (part lines with a unit price), each read whole in pages. About 2,500,
2,600 and 3,900 rows today, asked only on the press. One SQL function that returns a site's
offers is the better read once the bills pass about ten thousand lines. PR 2: `on_site_prices`
for the site, with the ties.

**Where it plugs in:** `SiteMaterialsView.tsx` (the tile, the narrowed list, the row),
`siteWorth.ts` (`worthWords`, the left-out count), `siteRollup.ts` (`sameWordsKey`), `bookPrice.ts`
(`priceLookup`, `PricePick`, `priceWords`), `onSiteStore.ts` (`priceFor`, the invoice prices),
`partTies.ts` and `usePartTies` (the tie), `bookSearchIo.ts` (the picker), `batchWords.ts` (drawing
C only), and #298's `supply_purchase_lines` view.

## What I would leave out

- **A press that accepts guesses in bulk.** Not before PR 1 shows how often the first offer is right.
- **A guessed total for the site.** The offers are too wide.
- **Writing the Parts Book from here.** A price from a bill into the book is #298's PR 2b.
- **A new parts-book part made from a typed name.** The book would fill with crew spellings.
- **A price that travels to another site as accepted.** It can be offered there once a second site has boxes.
- **Pricing from the phone's On site tab.** The crew counts. The office prices.
- **Fixture prices as a source.** The fixtures' price list holds one row today.
- **A unit on the on-site line** (feet against sticks). That is #209's, and the box says *for one, as counted* until then.

## The owner's calls

Each takes a word. My pick is first.

| Call | Recommended | Also possible |
|---|---|---|
| 1 · Which drawing? | **A**, in place | B, one at a time · C, by source |
| 2 · May an offer come from any bill the company has? | **Yes.** The site's own bills fit one row | Only this site's bills |
| 3 · Does an offer ever count in *known*? | **No.** Only a price a person accepted | Yes, as a second figure |
| 4 · Does **Not a part** take a row out of the cover? | **Yes**, and the cover says how many were left out | No, it stays as *no price* |
| 5 · Does a typed or bill price go stale after 90 days? | **Yes**, like a book price | No, it is what was paid |
| 6 · Does a price belong to the site? | **Yes**, as a tie does | To the whole company |
| 7 · Who may price? | **The roles that tie today** | The office only |
| 8 · Does a price set here also price the job's Missing table and the desk? | **Yes.** One rule, one price | The site's screen only |

## Where it stands

Designed and measured 2026-11-13. Nothing is built, no migration is written and nothing was
written to prod. The measure was run as the dev on a local copy of the app, reads only.

## How to verify (when it is built)

- Dev server from a worktree, `/dev-login?as=1`. Prod is the only database: PR 1's offers are
  reads, so its walk is the real site. The one write of PR 1 is the tie, which a render test holds.
- PR 1: the kernel's tests hold a name with no material to a list and never to one answer, a
  different size to no offer, and a bill priced by the hundred to its price for one.
- PR 2: the migration on a throwaway Postgres before the push. A price set on the ZZ test job's
  boxes, read on a second browser and on the job's Missing table, then undone.
- The mock-up was checked at 375 and 1400 wide, light and dark, with no sideways scroll.
- Made-up names, jobs, houses, prices and counts only, in the repo, the PRs and every screenshot.
