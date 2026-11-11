---
name: "A price sheet read into the parts book, with no second copy of a part"
number: 308
group: close
status: asked 2026-11-10 by the estimator through the owner, with a screenshot of the Add Assembly window beside a supply house's quote · the Takeoffs tab, the parts book, the price requests, the bill reader, card #298 and the twin seat's quote tools read on main the same day · the duplicate problem counted in prod through the dev seat, reads and counts only · two directions drawn at desk width, a second look, and a pick (C) · the owner asked three questions the same day (is it easy to pull up, to jump in and out of, and to use for a one-off) and the honest answers were no, half and no, so frames 8 to 10 were drawn and the train reordered with the one-off third · the owner said *build all the PRs* the same day, taking every call's default · PR 1 shipped as v2.6898 (the matcher and the Add Part warning) · PR 2 shipped as v2.6901 (house numbers) and PR 3 as v2.6903 (one price, pasted or typed), each pushed and walked live on a ZZ part and house · PRs 4 to 9 shipped together as v2.6908 to v2.6923 (#7642, merged 2026-11-11): read a sheet, file its rows, place its fixtures, the Parts Book's door and list, merge parts on the Duplicates page, and the pricing twin's draft; their five migrations pushed and `twin-mcp` 1.12.0 deployed the same night · walked live on the ZZ Test bid with a made-up ZZ quote: read, the house asked and answered, two rows filed as the same part, a fixture placed and taken off, the sheet taken back, the Parts Book's list, and two ZZ parts merged, every ZZ row deleted after · the walk found an open sheet reading itself about 220 times a second beside Takeoffs, fixed as v2.6928, and three wording points fixed as v2.6929 · a search of company mail for a real quote to measure on was refused without the owner's word, so the reader is unproven on a real sheet
mockup: to-dos/price-sheet-reader/mockup.html
summary: >
  The estimator reads a supply house's quote fixture by fixture, finds or makes each part, builds an
  assembly for the fixture and types the house's price, about nine moves a fixture. She asked for a
  tool that reads the sheet, knows a part that is already on file, and files every price under the
  right house. Three things half answer her today: the bill reader already reads a paper's rows with
  the house's number and the model number, card #298 has designed the table that maps a house's
  number to a part, and Bids → Pricing can read a quote by fixture but never touches the parts book.
  Nothing knows a part on file, because the book has no place for a model number or a house's number.
  The pick is built from one card: a row as printed, the part it is, how it matched, and the presses
  that answer it. One price is one card, pasted or typed, with no sheet. A sheet is many cards beside
  the takeoff with the house and its reasons on top, the rows that need her first and the ready rows
  folded by fixture. Every press saves itself, the panel folds to a chip and opens where she left
  it, and a file dropped or pasted on Takeoffs is the door. A row is matched by the house's number,
  then the model number, then the words, and a part is only ever made on her press. The first PR is
  the matcher alone, as a warning on the Add Part form.
next: The estimator drops her first real quote on a bid's Takeoffs, and what it misreads decides the next fix. Left for later, each its own small PR when asked for — the mail's door (*Read as a price sheet* on a mail's file), the price request's door (*Read this quote*), the dev seat's pair, a reader for scans and photos (today only a PDF with a text layer, a text file or a paste is read), and *Fill from a price sheet…* in Add Assembly.
size: L as a train of nine (S · M · M · M · M · M · S · M · M); PR 1 alone stops a second copy at the part form, and PR 3 is one price in two presses
blocker: the measure on a real sheet, which is the estimator's: the first real quote she drops is it.
opinion: built — live since 2026-11-11; the words-only match was tightened after the real book showed letter-closeness pairs black with galvanized
---

# A price sheet read into the parts book, with no second copy of a part (#308)

## The ask

The owner, 2026-11-10, with a request from the company's estimator and one question of his own:
*"What can we do to give her tools to be successful?"* Her words, in full:

> WE NEED A TOOL FOR THE AI TO ENTER PRICING IN FROM THE PRICE SHEET. WE WANT IT TO BE ABLE TO
> IDENTIFY WHEN AN ITEM IS ALREADY IN OUR DATABASE SO THAT IT IS NOT MAKING DUPLICATES AND HARMING
> THE DATABASE WE HAVE BUILT. SHOULD BE ABLE TO CLASSIFY WHERE NUMBERS ARE COMING FROM AS WELL SO
> THAT IT CAN ASSIGN ITEMS TO THE CORRECT PARTS HOUSE.

Her screenshot shows the work by hand. On the left, Bids → Takeoffs: a list of fixtures, a side
panel reading *Costed fixtures 11 of 84* and *75 fixtures carry no material cost*, and an open
**Add Assembly** window. The assembly is named for one fixture, holds two parts picked from the
search, and carries one supply house's price for the whole assembly under **Bundle prices** with
*Use for takeoff*. On the right, the house's quote, six pages: for each fixture tag a heading, then
rows of quantity, the house's item number and a description, then a *Subtotal … EACH* line.

So she asks three things:

1. **Read the sheet** and enter its prices.
2. **Know a part that is on file**, so nothing is made twice.
3. **Know which supply house** the numbers came from, and file them there.

## What she can use today

- **Bids → Pricing → Supply house prices.** *Plug in quotes* takes a pasted reply or a dropped PDF,
  and *Price it with the robot* has the pricing twin read the quote's PDFs. Both read a quote by
  fixture, each kit at its EACH subtotal, and *Apply picks to costs* puts a material cost on each
  fixture row. It never touches the parts book, so it makes no duplicates and builds nothing she
  can reuse. The Takeoffs count does not move. Prod holds one quote read this way.
- **The Duplicates page** (`/duplicates`), which an estimator opens. It groups parts with the same
  name, or a near name whose numbers all agree. Its only press is Delete.
- **The Notes field on a part.** Search reads it, so a house's item number typed there finds the
  part. 178 parts carry one already, and PR 2 reads them as a start.

None of the three is the tool she asked for. They are named so nobody builds them twice.

## What is there today (read on main at v2.6880, 2026-11-10)

### Ask 1, reading the sheet: half answered, in three places

- **The bill reader** (`supabase/functions/bill-read/`, `_shared/billRead.ts`) reads a PDF or a photo
  with a model and returns each row's kind (part, charge or kit component), the house's code, the
  maker's number, the description, the unit, the quantity, the unit price to four places and the
  pricing unit (each, per hundred, per thousand). Its paper kinds already include *quote*. It keeps
  200 rows at most and knows nothing of a fixture heading or a fixture's subtotal.
- **Card #298** (`to-dos/supply-bill-lines/`, in build today) put the rows on main as
  `supply_papers` and `supply_paper_lines` (v2.6817, v2.6819). A line already has `house_code`,
  `mfr_number`, `part_id` and `matched_how`; the last two are empty until #298's stage 2. A paper's
  kind may be `quote`, and #298 leaves quotes to its stage 5.
- **Bids → Pricing** has a full quote path: `bid_rfqs`, `bid_quotes`, `bid_quote_lines`,
  `supply_house_fixture_prices`, the vendor's token page, `parseVendorReply`, a dropped file's text
  layer (`src/lib/rfq/extractReplyText.ts`) and the pricing twin (`get_quote_documents`,
  `put_quote`). Every row is keyed by a fixture's name. No row has a part or a house's item number,
  and `docs/SUPPLY_HOUSE_RFQ_PLAN.md` defers parts book prices because *the name to part bridge does
  not exist*.

### Ask 2, knowing a part on file: not answered

- **The parts book has no place for a number.** `material_parts` is a name, a maker, a part type,
  notes and a link. No column in the schema holds a model number, a house's item number or a unit.
  The name is the only key, and nothing makes it unique.
- **Search is a substring match** on the name, the maker, the part type and the notes
  (`src/lib/materials/materialsFilters.ts`). A model number typed with its dashes does not find the
  same number saved without them.
- **The Add Part form warns of nothing** (`src/components/PartFormModal.tsx`). Only the name is
  required.
- **`src/lib/materials/duplicateParts.ts`** has the two rules worth keeping: a folded name, and
  `numericSignature`, which pairs two names only when every number in them agrees. Only the
  Duplicates page calls it.
- **No merge exists.** The page's own error says a delete is refused while an assembly, a purchase
  order or a price points at the part.
- **#298 designed the missing table** and has not built it: `supply_part_codes`, a house and its
  code mapped to a part, with a unit factor and a *not a part* mark, and a matcher in the order
  code, then maker's number, then description (its *Stage 2: part identity*).

### Ask 3, the right house: a quarter answered

- The bill reader copies the letterhead's name, and `houseMatch`
  (`src/lib/materials/bills/billMatch.ts`) compares it with the house the caller passed. It flags a
  mismatch and never picks.
- A price request knows the house it went to (`bid_rfqs.supply_house_id`).
- Mail reaches a house only through a contact's exact address (`contacts.supply_house_id`).
  `rfqForMessage` (`src/lib/rfq/messageToRfq.ts`) can match a mail to a price request and nothing
  calls it.
- A filed price says nothing of where it came from. `material_part_prices` is a part, a house, a
  price and a date.

### The seats

- **The twin seat** (`supabase/functions/twin-mcp/`) writes quotes to Pricing (`put_quote`) and
  fixture prices to the robot's own price book (`extend_robot_book`). No twin tool writes
  `material_parts`, `material_part_prices` or an assembly, and a write fence keeps a twin to robot
  rows.
- **The dev seat** (`dev-mcp`) reads the parts book and has no verb that changes it.

## The counts (prod, 2026-11-10, through the dev seat, reads only)

**Parts.** 2,418 parts, 18 of them the robot's. About 250 are made a month.

| What | Count |
| --- | --- |
| Parts with a maker filled in | 1,516 of 2,400 |
| Parts whose name carries something shaped like a model number | 911 |
| Names that begin with a house's item number | 179 (164 different numbers) |
| Parts with a number of that shape in Notes | 178 |
| Parts with *Sold in* set | 1 |
| Same name twice, ignoring case and spacing | 8 pairs |
| Same name twice, ignoring punctuation too | 12 pairs |
| Same model number in two or more names | 61 groups, 136 parts; about 40 groups are real on a hand read |
| Names within two characters of another name | 1,152 pairs across 664 parts |

**Prices.** 2,529 price rows. No part has two rows for one house, so that rule holds.

| What | Count |
| --- | --- |
| Parts with no price | 706 |
| Parts priced by one house | 1,229 |
| Parts priced by two houses | 136 |
| Parts priced by three or more | 329 |
| Supply houses on file, and how many hold a part price | 23, and 11 |
| Share of all price rows held by the largest house | 45% |
| Price rows with no date | 171 |
| Price rows older than the 90 days the book calls fresh | about three in four |
| Price changes on file | 132 |
| Changes past 25% | 35 |
| Changes that look like a tenfold unit slip | 6 |

**The twins' prices.** In 45 of the 61 same-model groups, both copies carry a price from the same
house, so one house's price lives in two places. In 21 groups, more than one copy sits in an
assembly.

**Assemblies.** 386, about 70 made a month since August.

| What | Count |
| --- | --- |
| Named for a fixture tag | 252 |
| Carrying a bundle price | 350 |
| Carrying a bundle price from two houses | 2 |
| Holding exactly the same items and quantities as another | 44, in 20 groups |
| Sharing a name with another | 33, in 16 groups |

**Takeoffs and quotes.** 2,532 takeoff lines on 85 bids; 480 of them are one line at an assembly's
bundle price. 39 price requests on 19 bids, 38 marked as sent outside the app and 15 with a quote
link. One quote and fifteen quote lines stored.

### What the counts say

- **The duplicate problem is real and small.** About 40 true twins and a dozen same-name pairs, under
  2% of the book. The harm is the split price, not the count. **A clean-up belongs on the card, as a
  merge**, and it is the last PR, not the first.
- **The words alone cannot match a part.** 664 parts sit within two characters of another part, and
  nearly all of those are a different size or material. About 20 of the 61 same-model groups are
  sizes too. So a match by words is only ever offered, never taken, and never offered when a size
  differs.
- **The house's number is the sound key**, as #298's measure on real bills found: every house prints
  its own code on every line. The model number is the second key, across houses.
- **Her assemblies are her quote store.** Two in three are named for a fixture and nine in ten carry
  a bundle price. Many rows on a quote have no price of their own, so the fixture's subtotal is the
  only price there is. The tool must make that same thing for her, and reuse an assembly where one
  with the same items exists.
- **The quote path on Pricing is not where she works.** The requests go out and the answers come
  back, and the answers are typed into Takeoffs by hand.
- **Units need a question.** One part in 2,400 says how it is sold, and six price changes look like a
  hundred taken for one.

## The mock-up

[`mockup.html`](mockup.html), made-up data throughout (Hillcrest Supply, bid B-1042, the estimator
Marisol), at desk width, light and dark. This is desk work and no phone frame is drawn.

- **0 · Today.** The Add Assembly window beside the paper, and the nine moves.
- **A · Row by row.** One window, the paper beside every row.
- **B · Fixture by fixture.** Offers under the takeoff's own rows.
- **Is this the best we can do?** Eight findings.
- **C · The pick**, in seven frames: which house; what needs her; what is ready and the one press;
  a sheet read twice; the four doors; the first PR; the clean-up.
- **Three questions from the owner**, then three more frames: **8 · Pull it up**, **9 · In and
  out**, **10 · One price, with no sheet**.

## The two directions

**A. Row by row, with the paper beside it.** Every row shows where it came from, which is the right
way to catch a misread. It makes her read 71 rows to find the 14 that need her, shows a percent that
explains nothing, offers a 1/2 inch part for a 3/4 inch one at 74%, loses the fixture, and saves all
or nothing.

**B. Fixture by fixture, on the takeoff.** It is her screen and her unit, and one press takes the
ready fixtures. The rows that need her are scattered down a long page, the paper is never beside the
row, nobody checks the house, and a sheet with no bid has no door.

## Is this the best we can do?

The first draft of the pick was A's window with B's fixture groups and a Save. The second look found
eight things, each redrawn:

1. **She read every row.** The window opens on what needs her. Ready rows fold to a line a fixture.
2. **A percent explained nothing.** The match says how: *same house number*, *same model number*,
   *words only*. Only the first is ready with no press.
3. **The house was a dropdown already filled in.** It is now a sentence with its reasons, and it
   asks when the reasons disagree.
4. **Every fixture made a new assembly.** An assembly with the same items is reused.
5. **A row with no price taught nothing.** A confirmed row keeps the house's number on the part even
   when it has no price, so the next sheet matches more by itself.
6. **There was no way back.** *Take this sheet back* returns each price to what it was.
7. **An old sheet could overwrite a newer price.** The newest dated paper wins.
8. **A price said nothing of its source.** Each filed price names its sheet, page and good-until day.

The render then showed two more. A house's first sheet has no known numbers, so the window says what
the first sheet looked like and the model-number rows are confirmed together in one look. And the
green dashes that mark what is new were on every card, so they now mark only what is new inside a
screen the app has today.

## The owner's three questions (2026-11-10)

The owner read frames 1 to 7 and asked: *Do we make it easy for a user to pull this up? Do we make
it easy for a user to jump in and jump out while they are entering prices? Do we make it easy for a
user to do one-off events? Is this the best we can do?* Checked against the code and the frames,
the honest answers were no, half and no.

| The question | Frames 1 to 7, honestly | Redrawn as |
| --- | --- | --- |
| Is it easy to pull up? | **No.** The Takeoffs door sat in the *Needs a price* panel, which only the Sheet view draws, below two other panels. Takeoffs opens on One at a time. The reply's door was three levels down in Edit Bid. Nothing on Takeoffs takes a drop or a paste. | **Price sheet** in the tab's title row, beside the view pills and Print, in both views. A file dropped anywhere on the tab, or pasted. A chip while a sheet on the bid has rows waiting. A press on the mail's own file. Frame 8. |
| Is it easy to jump in and out? | **Half.** A read was kept and could be finished later. It was a window over the takeoff, her answers waited on one big press, and the way back was the Parts Book. | A panel **beside** the takeoff, which stays live. Every press saves itself and offers Undo. The panel folds to the chip and opens on the card she left. A ready fixture is offered on its own takeoff row. Frame 9. |
| Is a one-off easy? | **No.** Nothing was drawn. One price by phone, one row out of a mail or one fixture revised went through the whole sheet, or back to typing by hand. | **One card, no sheet.** Paste a row, a fixture's block or a screenshot, or type it on the part. Two presses. Frame 10. |

What changed underneath: **the card is the unit.** One price is one card. A sheet is many cards with
a house on top and the ready ones folded. So the one-off is built first, as PR 3, and the sheet is
built from it. She has a tool two PRs sooner, and the sheet reader has less left to build.

## The pick: C, built from one card

**One matcher, one card, one reader. A sheet is many cards beside the takeoff.**

### How a sheet is read

- A PDF, a photo or pasted text. A PDF's text layer is read first, since it costs nothing and its
  digits are exact; the model reads a scan or a photo a page at a time, because a six-page quote
  passes the bill reader's 200 rows.
- The reader returns what the bill reader returns, plus the fixture each row sits under (the tag and
  its words), the fixture's EACH subtotal and the quote's good-until day.
- #298's checks carry over: a fixture's priced rows must add to its subtotal, and a code the model
  read must appear in the text layer when there is one. A fixture that fails is held alone.
- The sheet is saved as a `supply_papers` row of kind `quote` with its lines. A quote is never
  counted as a purchase, as #298 already rules.

### How a row finds its part

In this order, and the window says which:

1. **The house's own number** is in the table of house numbers: matched, ready with no press.
2. **The model number** in the row is on exactly one part: offered. All such rows are confirmed
   together after one look.
3. **The words** resemble one part's name **and every size in the two names agrees**: offered singly.
4. **Nothing**: the row reads *Nothing on file* and offers **New part in the book…**, the part form
   filled from the row.

A part is only ever made on a person's press. Every confirmed row writes the house's number to the
table, so the same row is ready by itself on the next sheet.

### Which house

Four reasons, in the order they are trusted: the price request the sheet answers, the letterhead,
the share of its item numbers already known under a house, and the contact the mail came from. When
they agree the window says so and shows them. When they disagree, or only a weak one is there, it
asks, and nothing is filed until the house is settled. A name that matches no house on file sends
her to Supply houses and keeps the rows.

### What the press does

**Every press saves itself.** A card she answers is filed then, with Undo beside it. There is no
Save, so leaving loses nothing.

**File ‹n› rows and place ‹m› fixtures** is the one batch press, for the rows that were ready when
the sheet opened. It acts on what is ready, lists what it held with each reason, keeps going past a
row that fails and names it afterwards, per the repo's rule.

- A row with its own price: `material_part_prices` for that part and house, dated by the sheet.
- A fixture whose rows are all ready: an assembly with the same items is reused, or one is made; the
  subtotal becomes that house's bundle price; one bundle line lands on the bid's fixture, as *Use
  for takeoff* does today.
- A sheet with no bid files part prices only.
- The newest dated paper wins. A price on file that is newer than the sheet is kept, and the line
  says so.
- **Take this sheet back** returns each price to what it replaced and lifts its lines off the
  takeoff. A price changed since is left alone and named.
- **The takeoff wins a tie.** A fixture she costed by hand is never overwritten. Its row says what
  the sheet holds and offers **Use the sheet's**.

### One price, with no sheet

- **A pasted row.** She pastes a line from a mail. The card asks the house, with the houses this
  bid asked first, finds the part by that house's number and offers **File $18.40**.
- **A price by phone.** The part's Prices window, as today, with two fields more: *Their number*
  and *From* (Phone, Counter, Mail, Website). A move past the limit asks before it saves.
- **One fixture revised.** She pastes the fixture's block. The card says the new subtotal and the
  old one, and **Use $54.10** updates the bundle price and the bid's line.
- **A screenshot or a photo** of a few rows goes through the reader and comes back as cards.

Typed or pasted text needs no model. Each one-off is kept as its own small paper with where it came
from, so it can be undone, the Prices window can say *by phone, Nov 10*, and the house's number is
learned from it too.

### In and out

- The sheet is a panel on the right of the takeoff. The takeoff stays live beside it.
- **Fold** leaves a chip in the tab's title row, *‹house› sheet · 13 wait*. The chip opens the panel
  on the card she left.
- A ready fixture is offered on its own takeoff row with **Use**, so she can take one without
  opening the panel.
- The arrow keys move between cards, Enter takes the blue press and Esc folds.
- A read belongs to the bid. Anyone who may file can open the chip and carry on, and each filed row
  says who pressed.
- On a window narrower than about 1,100 the panel opens over the takeoff, as frames 2 and 3 draw.

### The hard cases

| Case | What the window does |
| --- | --- |
| The same part under two houses' numbers | Matched by the model number and offered; on her press the part gains the second house's number. One part, two numbers, each house's price on its own line. |
| One house number that fits two of our parts | *Two parts on file*: both shown with their prices and where they are used, **Use this one** on each, and **They are one part. Merge them…** |
| A MISC CHARGE row | The house's catch-all code is marked *not a part* and never matched. The row stays inside its fixture's bundle price, with no press. **Name one of them…** is there if she wants it. |
| A description over several lines | Read as one row, with a chip that says so. **Join two rows** and **Split a row** sit on the open fixture. |
| A unit that differs | *Priced by the hundred. The book prices it each.* **File $0.38 each** or **It is $38.40 each**. The answer is kept with the house's number as its unit factor. |
| A price that moved a lot | Past 25% the row waits: the old price with its date, the new one, the change, **File** or **Keep**. |
| A sheet read twice | The same file opens its earlier read. A later copy of the same quote number shows only the rows that changed. |
| A fixture that does not add up | That fixture is held with both sums and **Look at page ‹n›**. The rest go. |
| A fixture tag the bid does not have | **It is ‹the bid's tag›** or **File its prices only**. |
| A price on file newer than the sheet | Kept, and said on the fixture's line. |

### Where it lives

1. **Takeoffs**, the first door, because that is where she works and the bid is known. **Price
   sheet ▾** sits in the tab's title row beside the view pills and Print, in both views: read a
   file, paste a row or a screenshot, type one price, or open a sheet that waits. A file dropped on
   the tab, or pasted, opens the same thing. The chip beside it is the way back.
2. **The windows she already has open.** *Fill from a price sheet…* in Add Assembly, and *Paste a
   price…* in a part's Prices window.
3. **The mail the quote came on**: *Read as a price sheet* on the mail's file. The house is known
   from the contact and the bid from its price request.
4. **The price request's reply**: *Read this quote* on the request's row. The house is the one that
   was asked.
5. **The Parts Book**: a *Price sheets* list of every read with what still waits, and a read with no
   bid for a house's general list.
6. **The AI seat**: the twin reads a sheet and leaves it in that same list as a draft with its
   matches. It never files a price, makes a part or changes an assembly. Her press does.

## The calls

**The owner's**

1. **Who builds the table of house numbers.** `supply_part_codes` is #298's stage 2a, not yet
   built. *Default:* this card's PR 2 builds it to #298's own spec, and #298's 2a then adds only its
   list. A quote teaches sixty numbers in one sitting, and a bill teaches them a few at a time.
2. **Does a quote's price go into the parts book.** A quote is a promise for one bid, and a bill is
   what was paid. *Default:* yes, marked as quoted with its good-until day, since she files quoted
   prices by hand today. The newest dated paper wins, so a later bill replaces it.
3. **Who may file.** *Default:* the roles that edit the parts book today.
4. **May the AI seat file by itself.** *Default:* no. It reads and leaves a draft. Look again after
   a month, for rows matched by the house's own number whose price moved under the limit.
5. **The cost of a read.** *Default:* the sheet reader shares the bill reader's switch and its 150
   reads a day. A six-page scan is up to six reads, and a PDF with a text layer may need none.
6. **The clean-up.** *Default:* on this card as PR 9, a merge and nothing wider. About 40 groups.

**The estimator's**

7. **An assembly for each fixture, or only a price on the takeoff.** *Default:* an assembly, reused
   when one has the same items, as she works today.
8. **The name of an assembly the tool makes.** *Default:* the tag, the fixture's words and the
   house, with no bid in it since it is reused.
9. **What a big move is.** *Default:* 25%.
10. **MISC CHARGE rows.** *Default:* they stay in the bundle and are not named.
11. **Three to five real sheets from her main houses**, for the measure before PR 5. They are read
    privately and never committed.
12. **Which one-off she meets most**: a price by phone, a row in a mail, or a fixture revised.
    *Default:* the pasted row first, since it needs the least typing.

## Where it plugs in

**Exists**

- `src/components/bids/BidsTakeoffTab.tsx` (the title row with `TakeoffViewPills` and Print; the two
  views, `TakeoffFocusView` for One at a time, the default, and `TakeoffCostRailView` for Sheet),
  `TakeoffAssemblyAuthoringModals.tsx` (Add Assembly, bundle prices), `TakeoffPartPricesModal.tsx`
  (Prices).
- A file on a mail: `message_attachments`, which the bill reader already reads from a thread. No
  press on a mail's file opens a reader today; the bill's doors are the Supply Houses tab and
  Quickfill.
- `src/components/PartFormModal.tsx`; `src/pages/Duplicates.tsx`;
  `src/lib/materials/duplicateParts.ts` (`normalizePartName`, `numericSignature`).
- `material_parts`, `material_part_prices` (unique on part and house), `material_part_price_history`
  and its trigger `track_price_history`, `material_templates`, `material_template_items`,
  `material_template_prices` (unique on assembly and house), `bids_takeoff_rough_part_lines`.
- `supply_papers`, `supply_paper_lines`, `supply_bill_reads`; `supabase/functions/bill-read/`,
  `_shared/billRead.ts`, `_shared/modelKey.ts`, `_shared/fileText.ts`;
  `src/lib/materials/lines/paperChecks.ts` (`checkPaper`, `codeInText`, `PRICING_UNIT_DIVISOR`);
  `src/lib/materials/bills/billMatch.ts` (`houseMatch`).
- `bid_rfqs`, `contacts.supply_house_id`, `src/lib/rfq/messageToRfq.ts`,
  `src/lib/rfq/extractReplyText.ts`, `src/lib/submittals/houseFileParts.ts` (a house's file read into
  tag, maker and model).
- `src/lib/batchWords.ts` (`batchWords`, `countedLabel`, `batchOutcomeWords`).

**New**

- `src/lib/materials/partMatch.ts`: `modelNumbersIn`, `sizesAgree`, `matchRow`.
- `supply_part_codes` (to #298's spec), with who taught a code, when and on which line.
- On `supply_papers`: the bid, the good-until day and the file's hash. On `supply_paper_lines`: the
  fixture's tag and words, why a row is held, when it was filed and the price it replaced. A small
  table of a sheet's fixtures with each subtotal, the bid's row and the assembly used.
- `price-sheet-read` (an edge function beside `bill-read`, sharing its `_shared` pieces, so the two
  sessions do not edit one file), the RPCs `price_sheet_file` and `price_sheet_take_back`, and
  `merge_material_parts`.
- `src/lib/materials/priceSheet/sheetPlan.ts`, the pure plan: rows, book, codes and the bid's
  fixtures in; ready and held rows with their reasons out.
- The card (one component for a row, used alone and in the panel), the panel, the title row's press,
  chip, drop and paste, the *Price sheets* list, `put_price_sheet` on the twin seat and
  `plan_price_sheet` → `apply_price_sheet` on the dev seat.
- `src/lib/materials/priceSheet/pastedRow.ts`, pure: a pasted line or block split into the house's
  number, the model number, the words, the price and its unit, with no model call.

## The plan

Each PR is cut from main alone, with its release note, its `docs/recent-features/` fragment and its
guide. The table is the plan as drawn. What shipped, and when, is the status line above; what was
left out is the *next* line.

| PR | What | Touches | Size | Live check |
| --- | --- | --- | --- | --- |
| 1 | **The matcher, and a warning on the Add Part form.** A name whose model number is on a part in the book says *Already in the book* with **Use that part** and **Mine is different**. | `partMatch.ts` and its tests (the hard cases above), `PartFormModal.tsx`, the guide `add-a-part-and-its-prices-fast`. No migration. | S | Type a ZZ part's model number with and without its dashes. The warning names the ZZ part both times. A name that differs only by a size raises nothing. |
| 2 | **House numbers.** The table, *Their number* beside each house's price in the Prices window and the part form, and a one-time offer of the numbers already in names and Notes, each on a press. | A migration for `supply_part_codes` with the four fence calls, `TakeoffPartPricesModal.tsx`, `PartFormModal.tsx`, the matcher, `docs/migrations/`, #298's card amended to point here. | M | Give a ZZ part a ZZ house's number. The matcher finds the part by it. The offer list shows only rows where one house prices the part. |
| 3 | **One price, with no sheet.** The card, alone. A pasted row or a fixture's block, *Paste a price…* in the Prices window with *Their number* and *From*, *Fill from a price sheet…* in Add Assembly. Each files on its press with Undo and its holds. | `pastedRow.ts`, the card, `price_sheet_file` and `price_sheet_take_back` for one row, the trigger widened to carry a note and an author (shared with #298's 2b, whichever lands first), a migration for the sheet's columns, `TakeoffPartPricesModal.tsx`, `TakeoffAssemblyAuthoringModals.tsx`. No model call. | M | Paste a ZZ row: the card names the ZZ part by the ZZ house's number and files in two presses. A 46% move asks. Undo returns the price. |
| 4 | **Read a sheet, in the panel, with nothing filed from it.** The reader, the house by letterhead and price request, the cards and the folded fixtures beside the takeoff. **Price sheet ▾** in the title row, a drop and a paste on the tab, the chip. | `price-sheet-read`, `sheetPlan.ts`, the panel, `BidsTakeoffTab.tsx`, `docs/EDGE_FUNCTIONS.md`. | M | Drop a made-up six-page ZZ quote on BP398's Takeoffs in each view. It reads to the row and fixture counts counted by hand. Fold it, reload, and the chip opens on the same card. The book is unchanged. |
| 5 | **File a sheet's rows.** The batch press for what is ready, a card's own press, New part on a press, the holds, Take this sheet back, the Prices window's *From*. | `price_sheet_file` for many rows, the panel, `batchWords`. | M | On the ZZ house and parts: ready rows file, a per-hundred row asks, a failed row is named. Close the tab mid-way and nothing answered is lost. Take it back and every price reads as before. |
| 6 | **Fixtures onto the takeoff.** The tag match, the assembly reused or made, the bundle price, the bundle line, the offer on a fixture's own row, and *Costed by hand* never overwritten. | `sheetPlan.ts`, `price_sheet_file`, `BidsTakeoffTab.tsx` and its two views. | M | On BP398 the costed count rises by the ready fixtures. **Use** on one row places that fixture alone. A fixture costed by hand keeps its lines. Take it back and the count returns. |
| 7 | **The house's other reasons, a sheet read twice, and the mail's door.** The share of known numbers, the mail's contact, the file's hash, a later copy of one quote, *Read as a price sheet* on a mail's file. | `sheetPlan.ts`, the panel, the Messages thread's file row. | S | The same file opens its earlier read. A letterhead that disagrees with the request asks. A ZZ contact's mail opens the reader with its house named. |
| 8 | **The other doors.** *Read this quote* on a price request, the Parts Book's *Price sheets* and a read with no bid, the twin's draft, the dev seat's pair. | `twin-mcp`, `dev-mcp`, the Parts Book, Edit Bid's price requests, `docs/twins/`. | M | A twin's draft appears in the list and files nothing. A read with no bid files part prices and makes no assembly. |
| 9 | **The clean-up.** *Same model number* on the Duplicates page, **Merge into the first…**, *Not the same* remembered, the old name kept as another name. | `merge_material_parts`, `Duplicates.tsx`, a migration. | M | Merge two ZZ parts. The prices, assembly items, takeoff lines and house numbers sit on the part that stays, and a search by the old name finds it. |

**The measure, before PR 5.** PR 4 reads the estimator's three to five real sheets and files
nothing. The share of rows ready by number, by model number and by words, and every misread, decide
PR 5's limits. The sheets and their rows stay out of the repo.

## How to verify

- **Where.** The ZZ Test bid (BP398), a ZZ test supply house and ZZ parts, as #298's walk used. Prod
  has no staging, so nothing is pressed on a real part, price or assembly.
- **The sheet.** A made-up six-page quote PDF built for the walk, with BP398's own fixture tags, a
  MISC CHARGE row, a description over three lines, a per-hundred row, a price 46% above the one on
  file, one row whose model number is on two ZZ parts, and one fixture whose rows do not add up.
- **PR 1** changes no data. In a local preview as the dev, type the names and close the form.
- **After each walk**, take the sheet back, then delete the ZZ sheet, parts, numbers and assemblies.
  BP398 is shared by other sessions, so the walk leaves its fixtures as it found them.
- **In and out.** In each walk from PR 4 on, fold the panel, switch bids, reload and come back. The
  chip must open on the card that was left, with nothing answered lost.
- **The counts** above are the before. Run them again after PR 9: the same-model groups should fall
  and the parts made a month should not rise. On 2026-11-11, the night PR 9 went live, the
  Duplicates page's *Same model number* tab listed 42 groups of real parts whose sizes agree, none
  merged yet: each waits for a person's **Keep this one**.

## Found in passing, not fixed

- The Duplicates page's delete window says a part's prices go with it, and its error says a price
  blocks the delete. One of the two is wrong, and which was not checked.
- `rfqForMessage` matches a mail to a price request and has no caller outside its own test.
- 171 price rows have no date, and about three in four are older than 90 days.
- The parts search does not fold dashes or spaces, so a model number finds its part only when typed
  as it was saved. PR 1's fold could serve the search too.
- 38 of 39 price requests are marked as sent outside the app.
