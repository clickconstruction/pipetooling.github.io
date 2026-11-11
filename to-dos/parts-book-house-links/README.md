---
name: "The parts book filled from Reece and Ferguson, with a page on every price so it can be checked again"
number: 311
group: gated
status: asked 2026-11-11 by the estimator · the parts book, the house numbers table, the matcher and card #308 read on main at v2.6929 the same day · the book counted in prod through the dev seat, reads only · each house's robots file read once and its terms of use read by a research pass · a sample of twenty parts already in the book checked with no page opened and nothing written · nothing built, no page of either house read by a tool, no bulk run
mockup: to-dos/parts-book-house-links/mockup.html
summary: >
  The estimator asked to scrape Reece's and Ferguson's websites to fill the parts book, and to keep
  a link on every part so prices can be checked and updated from time to time. Ferguson's terms of
  use forbid robots, scraping and any tool that reads its pages, signed in or not, so no scraper is
  built for Ferguson. Reece's terms say nothing of robots, and its robots file allows every page,
  but they allow copying for personal use only, so a price book built from its pages needs Reece's
  written word first. Both houses have a sanctioned way: Reece's account has a list that downloads
  with pricing, and Ferguson has price lists, system links and lists that print with the account's
  price. The pick is the houses' own lists read by the price sheet reader that shipped under #308,
  and a page kept beside each house's own number for a part, so one press opens the right page and
  a check knows which house it is checking. The book already holds 113 Reece pages and 7 Ferguson
  pages pasted by hand, and their addresses carry the house's number, so the first PR teaches those
  with no page opened at all.
next: The owner's calls 1 to 5 below, then the estimator's first list — one list downloaded from the Reece account with pricing, and one Ferguson list printed to a PDF with the account's price, both read privately to measure. PR 1 needs neither and can start on the owner's word.
size: L as a train of six (S · M · S · M · S · S); a seventh (M) waits on a supply house's written word
blocker: the owner's calls on the route for each house, and a first real list from each account; reading either house's pages with a tool waits on that house's written word, and Ferguson's terms forbid it today
opinion: build, without a scraper — use each house's own list, and keep the page beside the house's number; the address of a page already says the house's number, so the 120 pages on file teach themselves
---

# The parts book filled from Reece and Ferguson, with a page on every price (#311)

## The ask

The estimator, 2026-11-11, in her words:

> scrape the reece and fergison website to fill out our parts book

> to make it worth the amount of processing power it would be very important to make sure it is
> filling in the link category when inputting parts, that way prices can be checked and updated
> periodically

So she asks three things:

1. **Fill the parts book** from the two houses the office buys from most.
2. **Keep a link on every part**, so the page a price came from is one press away.
3. **Check prices again from time to time**, and make the work worth what it costs.

This card plans it and proves it small. Nothing was built, nothing was written to the book, and no
bulk run was made.

## What is there today (read on main at v2.6929, 2026-11-11)

- **One link per part.** `material_parts.link` is a single field on the part form. It does not say
  which house it belongs to, and a second house has nowhere to go.
- **Prices are per house.** `material_part_prices` holds one row per part and house, with a price,
  a date (`effective_date`) and, since #308, the paper line it came from (`source_line_id`).
- **House numbers have a table and no rows.** `supply_part_codes` (v2.6901) keeps what each house
  calls a part, with a unit factor. It is the first key the matcher tries
  (`matchRow` in `src/lib/materials/partMatch.ts`). Prod holds no row for any house yet.
- **A price can already be filed as read from a website.** `price_row_file` takes `came_by` of
  `website`, and Price History then says *From its website*. It keeps a small paper, teaches the
  house's number and can be undone.
- **Check 20 prices** (v2.4392, `CheckPricesWindow`) lists the 20 parts with the most spend,
  oldest check first. **Same** sets the price's date to today and Price History logs *Checked*. A
  typed price sets both. It has no link to open.
- **The price sheet reader** (#308, v2.6898 to v2.6929) reads a PDF's text layer, a text file or a
  paste into rows, matches each row, and files on a press. It has not yet read a real sheet.
- **A robot house exists.** *🤖 Web Research* holds the robot's web prices, and each robot part
  keeps its source in `material_parts.link`. Those parts are the robot's and stay out of this card.
- **`supply_houses.website_url`** is empty for both houses.

## The counts (prod, 2026-11-11, through the dev seat, reads only)

| What | Count |
| --- | --- |
| Parts in the book | 2,446 (2,326 plumbing, 119 electrical, 1 HVAC), 18 of them the robot's |
| Parts with a link | 148: 130 a person's and 18 the robot's |
| A person's links on reece.com | 113 (112 product pages and 1 search page) |
| A person's links on ferguson.com | 7 |
| A person's links elsewhere | 10 (other sellers, a maker's price list, and one that is a model number, not an address) |
| Parts with a Reece price | 1,156, all plumbing |
| Parts with a Ferguson price | 17 |
| House numbers on file, any house | 0 |
| Parts whose Notes carry Reece's own number, written `MSC-…` | 26 |

- **She is doing this by hand now.** Eleven of the 17 Ferguson prices and at least 14 Reece prices
  are dated 2026-11-10, and the newest pages on file were pasted beside them.
- **About one Reece price in ten has its page.** 113 pages against 1,156 prices.
- **The one link already fails.** One part is priced under Ferguson and its only link is Reece's
  page for it.

## What is allowed, house by house

The order asked for: a sanctioned feed first, then the public pages read politely, then the account.
Each line names where it was read. The terms were read by a research pass on 2026-11-11, and a
person should read the clause before any call rests on it.

### Reece

- **Robots file** (`https://www.reece.com/robots.txt`, read once): every page is allowed to every
  reader, and a sitemap is named.
- **Terms of Access** (`https://www.reece.com/terms-of-access`, read from the copy Reece Group
  links at `https://group.reece.com/terms-and-conditions`, last updated September 24, 2021; the
  live page may be newer): the words robot, spider, scraper, crawler and data mining do not appear.
  Access is for personal, noncommercial use. Copying is allowed for individual reference only, and
  anything else needs the company's written consent. The account holder answers for everything done
  under the password. Neither the Terms of Access nor the Terms of Sale calls account pricing
  confidential.
- **Plainly:** Reece does not forbid automated reading in words. It also does not grant copying its
  pages into a price book. So a tool reading Reece's pages waits on Reece's written word, which the
  branch or the account rep can give in an email.
- **A plain fetch reads nothing anyway.** Reece's pages are drawn by script, and a fetch with no
  browser returns an empty shell. A scheduled function could not read them.
- **The sanctioned feed:** the trade account's **Lists**. The site's own script carries the labels
  *Download*, *Upload* and *Print* for a list, a notice for a large list download that mentions
  pricing, and the columns *Reece Part #*, *MFR #*, *Price* and *Quantity*. Orders carry *Export to
  Excel*. These labels were read in the public script and not in a signed-in session, so the first
  step is a person downloading one list and looking at it.
- **Not found for Reece in the United States:** an API, EDI, punchout, or a price file sent by a
  branch. Not found is not the same as not offered. The rep is the one to ask.
- **Its links to other software** (ServiceTitan, Housecall Pro, FieldPulse) carry account pricing
  into those products. None of them is this app.

### Ferguson

- **Robots file** (`https://www.ferguson.com/robots.txt`, read once): product pages are allowed.
  Search addresses, `/ajax/`, the account, lists and quotes are not.
- **Terms of Site Use** (`https://www.ferguson.com/content/website-info/terms-of-site-use`, last
  updated November 18, 2022): the license leaves out "any use of data mining, scraping, spiders,
  robots, or similar data gathering or extraction tools" (section 2(c)(v)). It also leaves out the
  collection and use of product listings, descriptions or prices, and the copying of content or
  account information. Section 6(b) bars any tool or agent that navigates or reads the site other
  than an ordinary browser. Section 7 bars letting anyone else use the account's sign-in.
- **Plainly:** Ferguson forbids automated reading of its pages, public and signed in, whatever the
  robots file allows. That covers a scheduled function and it covers the AI seat reading pages in a
  browser a person signed in to. **No scraper is built for Ferguson.**
- **The sanctioned feeds**, each on a Ferguson page:
  - **Commodity Pricing Service:** monthly price lists for pipe, valves, fittings and hangers, by
    market, made for estimating software. It is the nearest thing to a price file. Asked for
    through the form on `https://www.ferguson.com/content/pro-services/branch-services/quotation-services/`.
  - **System-to-System:** estimating, purchasing and accounting papers passed between systems, at
    no charge.
  - **PunchOut:** the account's own pricing inside a buying system.
  - **My Lists:** up to 500 products pasted in, shown with *Pro Pricing*, and printed. No
    spreadsheet download is named. A printed PDF has a text layer the price sheet reader can read.
- **Not verified:** a developer program (`https://developer.ferguson.com/` showed only its title),
  and whether a rep will email a full price sheet.

### What a signed-out page shows

Not verified for either house. No public source says, and the browser pane refused every address in
this session, so no page was opened. Reece's script holds the labels *Your price* and *Call Branch
for Pricing*. Ferguson's own tutorial names *Pro Pricing* apart from *List Pricing*. So the
account's price sits behind the sign-in at both, and a signed-out page shows a list price or none.
A person opening one product page in a private window settles it in a minute.

**A person signs in themselves, always.** No session types, reads or copies a password.

## The sample: twenty parts already in the book

**How it was done.** Neither house's pages may be read by a tool without the owner's word, and
Ferguson's may not at all. The fallback was to read pages by hand in the browser pane, and the pane
refused every address in this session. So the sample opened no page. It used what a person already
put in the book: the page pasted on the part. A scratch script parsed each page's address and
checked it against the part's name with the matcher's own `sizesIn` and `modelNumbersIn`. Three
Ferguson parts with no page were looked up with a plain web search, and the pages found were not
opened.

**What an address holds.** A Reece product address ends in the maker's number and then Reece's own
number, the one its pages print as `MSC-…`. A Ferguson product address ends in Ferguson's part
number and then its item number. So the house's number and the page arrive together, and nobody
types either.

**Prices are left off this page.** The book's prices are the account's, and this repo is public.
Each row says the day the price on file is dated. No live price was read, because no page was
opened.

### Reece, ten parts

Every page below is `https://www.reece.com/search/product/` and then the path shown.

| Part in the book | Their number | Maker's number | Their page | Unit | On file | How it matched |
| --- | --- | --- | --- | --- | --- | --- |
| 3IN WYE PVC | MSC-32756 | PDWVYM | `pvc-dwv-fittings/3-pvc-dwv-schedule-40-45-degree-wye-hub/pdwvym/32756` | each | Jul 2 | page on the part, size agrees |
| 3/4IN T COPPER | MSC-68634 | 77387 | `viega/propress-3-4-x-3-4-x-3-4-copper-tee-all-press/77387/68634` | each | Jul 9 | page on the part, size agrees |
| 4IN PVC TUBING | MSC-1687785 | P40BEPP10 | `pvc-pipe/4-x-10-schedule-40-pipe-bell-end/p40bepp10/1687785` | by the foot, sold as a 10 ft length | Jun 12 | page on the part, size agrees |
| 975XL2 | MSC-35289 | 34-975XL2 | `zurn/3-4-bronze-backflow-preventer-valve-fpt/34-975xl2/35289` | each | Nov 3 | page on the part, model number in the address |
| 3/4IN BLACK STEEL THREADED | MSC-90979 | IBPTCA53F | `steel-pipe/3-4-x-21-schedule-40-a53-a-black-steel-pipe-threaded-and-coupled/ibptca53f/90979` | by the foot, sold as a 21 ft length | Sep 14 | page on the part, size agrees |
| 1/2IN 90 COPPER | MSC-68512 | 77317 | `viega/propress-1-2-copper-90-degree-elbow-press/77317/68512` | each | Jul 9 | page on the part, size agrees |
| 1/2IN BALL VALVE | MSC-243557 | 102-623 | `jomar/1-2-brass-gas-ball-valve-fpt/102-623/243557` | each | Jul 2 | page on the part, size agrees |
| 1/2IN PEX TUBING | MSC-286839 | F4240500 | `uponor/1-2-x-100-polyethylene-pex-tubing-red-print/f4240500/286839` | by the foot, sold as a 100 ft coil | Jun 12 | page on the part, size agrees |
| 2IN T CAST IRON | MSC-12604 | NHSTK | `cast-iron/2-cast-iron-straight-sanitary-tee-no-hub/nhstk/12604` | each | Jul 17 | page on the part, size agrees |
| B-0594 | MSC-104005 | B-0594 | `t-s-brass/24-wall-mount-single-handle-pot-filler-kitchen-faucet-polished-chrome/b-0594/104005` | each | Nov 10 | page on the part, model number in the address |

All ten are ready: the house's number, the maker's number and the page come out of the address, and
the name agrees with it.

### Ferguson, ten parts

Every page below is `https://www.ferguson.com/product/` and then the path shown.

| Part in the book | Their number | Their page | On file | How it matched |
| --- | --- | --- | --- | --- |
| F1100 | MF1102CTS51, item 9535705 | `mifab-f1100-c-series-2-in.-no-hub-cast-iron-floor-drain-mf1102cts51/9535705.html` | Nov 10 | page on the part, model number in the address |
| LF909 11/2IN CAST COPPER SILICON | WLF909M1QTFSJ, item 10024584 | `watts-series-lf909-1-1%2F2-in-…-wlf909m1qtfsj/10024584.html` | Nov 10 | page on the part, model number and size in the address |
| T-1400-PB | MT1400NPB, item 9960746 | `mifab-t1400-pb-39-1%2F25-in.-trench-drain-mt1400npb/9960746.html` | Nov 10 | page on the part, model number in the address |
| 720A VB | W720AD, item 1131565 | `zurn-wilkins-model-720a-…-vacuum-breaker-w720ad/1131565.html` | Nov 10 | page on the part, the name's 720A in the address |
| SLOAN ROYAL 186-0.125 | S3452643, item 4037642 | `sloan-royal-186-0.125-gpf-sensor-flush-valve-s3452643/4037642.html` | Nov 10 | page on the part, the name's words in the address |
| SC SERIES | PSC2000F, item 3630979 | `precision-plumbing-products-1-in.-brass-npt-water-hammer-arrestor-psc2000f/3630979.html` | Nov 10 | **offered**: the name has no size or model number to check |
| H-5101 | GGBF1909, item 3862907 | `guardian-equipment-…-barrier-free-station-…-ggbf1909/3862907.html` | Nov 10 | **held**: the name's model number is not on the page |
| Z1341XL-PC | none yet | a search finds a family: `…-zz1341xlp12pc/7035699.html` and `…-zz1341xlp34pc/_/R-7035676` | Nov 10 | **held**: the name does not say 1/2 or 3/4, so a person picks |
| LFLM495-1 | none yet | a search finds three LFLM495 valves (sweat, CPVC, PEX) and one LM495-1 | Nov 10 | **held**: four near pages, a person picks |
| LK940BP07T6H | none yet | not found; a search finds only a sister model | Nov 10 | **held**: no page found |

Five are ready, one is offered and four are held. The three with no page show what a search by
model number does: it lands on a family, and the name on file does not say which one.

### What the same check caught on other pages on file

Seven Reece pages looked wrong on a read of the list. The same script held six of them.

| Part in the book | The page on it | What the check said |
| --- | --- | --- |
| 1/2IN T COPPER | the 1/2 copper 90 elbow, MSC-68512 | held: the same page is on *1/2IN 90 COPPER* |
| 11/2IN BLACK STEEL THREADED | the 1 inch pipe, MSC-90987 | held: the name says 1-1/2, the page says 1 |
| 2IN 45 CAST IRON and 2IN 1/8 BEND CAST IRON | one page, MSC-12376 | held: one page on two parts, which are likely one part |
| ZN1440 | ZN1400-4NL, MSC-47412 | held: the name's model number is not on the page |
| EMERGENCY SHUT-OFF VALVE | a search address | held: a search page, not a product page |
| 2IN T BLACK IRON . | a ductile iron coupling, MSC-2051740 | **missed**: the size agrees, and only the words differ |

So the check is worth having and is not enough alone. A page whose size and model number agree is
ready. A page that only agrees by size on a part with a short name is offered for one look.

**The full table**, with the prices on file, is kept outside the repo in this session's notes.

## The mock-up

[`mockup.html`](mockup.html), made-up data throughout (Hillcrest Supply, Borden Pipe & Supply, the
estimator Marisol), at desk width, light and dark. This is desk work and no phone frame is drawn.

- **0 · Today.** One link on the part, none on a price.
- **1 · The row.** Each house's number, its page and the last check beside its price, and the
  part's own page under them.
- **2 · The check.** The house's list beside the book, the moves, and the one press with its count.
- **3 · The fill.** A house's list matched to the book before anything is made.

## The data shape, as questions with a pick

### 1. Where a house's page lives

**The pick: on `supply_part_codes`, beside the house's own number.** Three new columns: the page's
address, what the last look found (fine, moved, gone, no price shown), and when it was last looked
at.

- The page is the house's page for its number. It is identity, like the number, and it exists
  before any price does.
- The unit factor already lives there. A coil's page price needs it to be booked by the foot.
- A part may carry two numbers at one house, and then two pages. A price row cannot hold that.
- A pasted page teaches the number in the same press, because the address carries it.

**Not on `material_part_prices`,** because a price row is replaced by the next paper and a page
outlives it. **The last checked day stays where it is:** the price's own date. *Same* already sets
it to today and logs *Checked*. A second date would only disagree with the first.

### 2. What `material_parts.link` then means

**The pick: the part's own page**, the maker's page or a cut sheet, for no house in particular. The
robot's parts keep using it for their source. Where a part's link is a supply house's product page,
the app offers to teach it to that house, and the link stays on the part too, so nothing is lost.
The form's label becomes *Part's own page*.

### 3. What "fill out the parts book" covers

**The pick, in this order:**

- **A. Parts already in the book and priced by the house.** They gain the house's number, its page
  and a fresh price. Reece has 1,156 and Ferguson 17.
- **B. Parts already in the book with no price from that house.** Found at the house by the maker's
  number, and offered. Never taken.
- **C. New parts, only on a person's press, one at a time**, through `matchRow` so no second copy
  is made. This is the price sheet reader's own rule.

**Not a category poured in.** A house's catalog is far larger than what the shop bids. The book
grows by about 250 parts a month from real bids, and 664 parts already sit two characters from
another part. Parts nobody bids make search worse and twins likelier. **The robot's parts are never
matched and never touched.**

### 4. How a check runs, and how often

**The pick: the house's own list, on a round trip, and no crawler.**

1. The app makes a list for one house: the maker's numbers of the parts whose price is due.
2. A person uploads it to the house's list, signed in themselves, and downloads it with pricing.
3. They drop the file on the Parts Book. The price sheet reader reads it. Every row known by the
   house's number is ready with no press.
4. **File ‹n› prices** files what is ready. A move past 25% waits alone with **File** and **Keep**.
   A row that fails is named and the rest go on. **Take this check back** returns every price.

- **How often:** monthly for parts on open bids and the parts with the most spend, and once a
  quarter for a whole house. The book calls a price fresh for 90 days.
- **What is due** is counted when the Parts Book opens, beside *What your materials cost*. No
  scheduled function is needed for that. A monthly notice can follow if nobody opens it.
- **A page that moved or is gone** is said on the price line with **Find it again…**. The price is
  kept as it was. This state is only ever set by a look, a person's or a sanctioned one.
- **A check never changes a price by itself.** It leaves what it read beside what is on file, the
  way the pricing twin leaves a draft sheet. A person's press files it, as *From its website* or
  from the list, with its day in Price History.
- **The one-off stays easy.** Check 20 prices gains **Open their page ↗** on each row, so a person
  walks twenty pages in a few minutes.

**A scheduled function that reads pages is not picked,** for three reasons. Ferguson forbids it.
Reece's pages return an empty shell to a plain fetch. And the account's price is behind a sign-in
that no function may hold.

### 5. What it costs

These are estimates. PR 4 measures the first real list and replaces them.

| Way | Pages a tool reads | Model use | A person's time |
| --- | --- | --- | --- |
| The house's list, round trip (the pick) | none | none for a spreadsheet or a PDF with a text layer | about ten minutes a house a check |
| A person with **Open their page ↗** | none | none | about 20 seconds a part: twenty parts in seven minutes, all 1,156 Reece prices in about six hours |
| The AI seat in a browser a person signed in to, on Reece's written word only | one a part: 1,156 for a full pass, about 200 for a monthly pass | a few thousand tokens a page, so several million for a full pass | a sign-in, then a look at what waits |
| The first teaching of the 120 pages on file (PR 1 and 2) | none | none | one look at about ten held rows |

The list costs almost nothing and reads the account's own price. The seat costs the most and is the
only way that needs a house's permission. So the estimator's point holds: the processing is only
worth it where the link is kept, and with the list the link is free.

## The calls

**The owner's**

1. **Reece's route.** *Default:* the account's list, downloaded by a person and read by the price
   sheet reader. No tool reads Reece's pages unless Reece says so in writing.
2. **Ferguson's route.** Its terms forbid a tool. *Default:* ask the rep which feed fits a shop this
   size (the Commodity Pricing Service, System-to-System, or a price sheet by email), and use My
   Lists printed with the account's price meanwhile. Only 17 parts are priced there today.
3. **Ask Reece for its written word, or leave it.** *Default:* ask once, in the same email that
   asks about the list. A yes opens PR 7. Nothing waits on the answer.
4. **Where the page lives and what the part's link means.** *Default:* picks 1 and 2 above.
5. **What the fill covers.** *Default:* A, then B, then C on a press, and no category poured in.
6. **How often.** *Default:* monthly for open bids and top spend, quarterly for a whole house.
7. **Who may file a check.** *Default:* the roles that edit the parts book today.
8. **May the AI seat ever file by itself.** *Default:* no, as #308 ruled. It leaves a draft.

**The estimator's**

9. **One list from each account,** for the measure before PR 4: a Reece list downloaded with
   pricing, and a Ferguson list printed to a PDF with *Pro Pricing*. They are read privately and
   never committed.
10. **Which number the houses print.** Does a Reece bill or quote print the `MSC-…` number, and a
    Ferguson bill the part number or the item number? One bill line from each answers it.
11. **Pipe and tubing.** The book prices by the foot and the house sells a length or a coil.
    *Default:* the unit factor is asked once per house number and kept.
12. **The held pages.** About ten parts carry a page that looks wrong. *Default:* she looks at each
    once, in PR 2's offer.

## Where it plugs in

**Exists**

- `material_parts.link`, `material_part_prices` (`effective_date`, `source_line_id`),
  `material_part_price_history` and its trigger `track_price_history`.
- `supply_part_codes` (house, code, folded key, part, `unit_factor`, `taught_from`, `not_a_part`),
  `may_edit_parts_book()`, `supply_houses.website_url`.
- `src/lib/materials/partMatch.ts` (`matchRow`, `sizesIn`, `modelNumbersIn`, `foldCode`,
  `indexHouseCodes`).
- `price_row_file` and `price_row_take_back` with `came_by` of `website`; `price_sheet_take_back` for a whole sheet; `price_source_words`.
- `src/components/PartFormModal.tsx` (the Link field), `TakeoffPartPricesModal.tsx` (*Their
  number*, *From*), `src/components/materials/CheckPricesWindow.tsx` over
  `src/lib/materials/priceCheckIo.ts`, `MaterialPricesCard.tsx`.
- The price sheet reader: `PriceSheetDoor`, `src/lib/materials/priceSheet/` (`sheetText.ts`,
  `pastedRow.ts`, `sheetPlan.ts`, `sheetHouse.ts`), the Parts Book's *Price sheets* list.
- `src/lib/batchWords.ts` for every counted press.

**New**

- `src/lib/materials/housePage.ts`, pure: a page's address into its house, the house's number, the
  maker's number and its words, for the two address shapes; and `pageAgrees`, the name against the
  page by size and model number, with the reason when it holds.
- On `supply_part_codes`: `page_url`, `page_state`, `page_seen_at`, and `taught_from` widened to
  take a page and a list.
- `src/lib/materials/priceSheet/listRows.ts`, pure: a house's downloaded list (a spreadsheet's
  columns, or a printed list's text) into the rows the reader already takes.
- `src/lib/materials/dueList.ts`, pure: the prices due at one house, and the upload file for them.
- **Their page** and **Last checked** on the price line, **Open their page ↗** in Check prices,
  **Make a list for ‹house›** and the due count on the Parts Book.

## The plan

Each PR is cut from main alone, with its release note, its `docs/recent-features/` fragment and its
guide. Supply house prices, customer numbers and real lists stay out of commits, PR text and tests.

| PR | What | Touches | Size | Live check |
| --- | --- | --- | --- | --- |
| 1 | **The address kernel, and Their page on a price line read from the part's link.** A part's link that is a house's product page shows as **Open their page ↗** beside that house's price. No data changes. | `housePage.ts` and its tests (the hard cases in the sample above, with made-up addresses), `TakeoffPartPricesModal.tsx`, the guide `add-a-part-and-its-prices-fast`. No migration. | S | On a ZZ part with a made-up page on ZZ Test Supply's site, the price line shows the press and it opens the page. A search address shows nothing. |
| 2 | **The page kept with the house's number, and the offer.** The three columns. *Their page* in the Prices window and the part form, where a pasted page fills *Their number*. A one-time offer on House numbers: the pages on parts, taught to their house on a press, the held ones listed with their reason. The form's label becomes *Part's own page*. | A migration on `supply_part_codes`, `docs/migrations/`, `PartFormModal.tsx`, `TakeoffPartPricesModal.tsx`, `HouseNumbersWindow.tsx`, the guide `keep-a-supply-houses-number-on-a-part`, `GLOSSARY.md` (*House number*). | M | Paste a ZZ page on a ZZ part: the number fills itself. The offer lists a ZZ part whose size disagrees as held and files the rest. |
| 3 | **Check prices with a page on each row.** **Open their page ↗**, the house as a filter, and the unit said when the factor is not one. | `CheckPricesWindow.tsx`, `priceCheckIo.ts`, the guide `track-what-your-materials-cost`. | S | A ZZ price with a page opens it. **Same** dates it today and Price History says *Checked*. |
| 4 | **A house's list read as a price sheet.** A spreadsheet's columns or a printed list's text become rows. Rows known by the house's number are ready. Each filed row keeps its page when the list carries one. | `listRows.ts`, `sheetText.ts`, `PriceSheetDoor`, the Parts Book's door, the guide `read-a-supply-houses-price-sheet`. | M | A made-up ZZ list of forty rows reads to its count. Known rows are ready, a 40% move waits, a failed row is named. Take it back and every price reads as before. |
| 5 | **Make a list for a house.** The prices due at one house as a file of maker's numbers the house's list takes. | `dueList.ts`, the Parts Book. | S | The file for ZZ Test Supply lists only ZZ parts past the limit, with no robot part in it. |
| 6 | **What is due, said on the Parts Book.** The count by house beside *What your materials cost*, with the press that makes the list. A monthly notice only if asked for. | `MaterialPricesCard.tsx`, `materialPriceIndex.ts`. | S | With a ZZ price dated 120 days back, the card counts it under its house. |
| 7 | **The seat's check, on a house's written word only.** A recipe for a session in a browser a person signed in to: the due pages for one house, a cap of 100 pages a sitting, a pause between pages, a draft check left with nothing filed. Never for Ferguson while its terms stand. | The dev seat's pair for a draft check, `docs/`. | M | Blocked. Opens on the owner's word with the house's email on file. |

**The measure, before PR 4.** The estimator's two lists are read privately and nothing is filed.
The share of rows ready by the house's number, by the maker's number and by words, and whether the
Reece download carries the number its pages print, decide PR 4's column map.

## How to verify

- **Where.** ZZ Test Supply and ZZ parts, as #308's walks used. Prod has no staging, so nothing is
  pressed on a real part, price or house number.
- **The addresses in tests are made up**, in the two real shapes. No real supply house's page is
  fetched by a test, a script or a walk.
- **PR 1** changes no data. In a local preview as the dev, open a ZZ part's prices and close them.
- **After each walk**, take the check back, then delete the ZZ list, house numbers and prices.
- **The counts above are the before.** After PR 2's offer is pressed, house numbers on file should
  be about 105 for Reece and 6 for Ferguson, and no part should carry one page twice.

## Found in passing, not fixed

- Two cast iron parts, *2IN 45* and *2IN 1/8 BEND*, carry one Reece page, and two copper caps carry
  another. Each pair is likely one part. The Duplicates page does not group by a shared page.
- One part's link is a bare model number, and one is a search address.
- `supply_houses.website_url` is empty for both houses, and the one house that has it holds a maps
  address.
- No house number is on file yet. The one-time offer of the numbers in names and Notes (#308's
  PR 2) has not been pressed.
- The price sheet reader takes a house's item number of 4 to 9 digits only. Ferguson's part numbers
  carry letters, and Reece's prints with `MSC-` before it.
- The browser pane refused every address in this session, so nothing here was seen on a live page.
