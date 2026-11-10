---
name: "Every supply house bill's lines as rows: what we buy, how often, at what price"
number: 298
group: gated
status: asked 2026-11-09 · researched in the code and in prod the same day · the owner said build it, so the mock-up was drawn the same day as nine frames A to I · a measurement run on real bills the same evening answered the Drive question (the PDFs are private files in an office login's My Drive, not shared with the app) and reshaped the reader's checks and the order of the PRs · the owner approved the frames and the two gating calls stand on their defaults · split between two sessions, the pipe (PR 1 v2.6817 on main and pushed, then PR 2 and the measure) and the screens (1b v2.6819 on main, its migration pushed, walked live 2026-11-09 on a ZZ test house: a made-up bill filled from its PDF read *7 lines · The subtotal with tax and freight is $36.00 short of the total*, Look drew the paper beside the lines, Count it as read turned the row to *counted as read by Robert*) · step 0 done 2026-11-10 (the bills' folder, kept apart from the jobs Shared Drive by the owner's call, is shared with the app's account as a viewer) · left: PR 2, the measure, then 2a, 2b and the views
mockup: to-dos/supply-bill-lines/mockup.html
summary: >
  A supply house bill is recorded with its total, its job and a link to its PDF. The lines on the
  paper are not rows anywhere, so nobody can ask how many of a part the company buys, how often, or
  what it paid last time. The bill reader already reads the lines and keeps them as JSON nobody
  queries. The design is a table of lines under each paper, filled by the reader from the PDF the
  row already links, and counted only when the lines add up to the paper's subtotal. A crosswalk
  from a house's part code to a part in the parts book is learned once per code and reused. A
  backfill reads the 539 bills on file, about 520 of which link a PDF. Three views follow: what we
  buy by month, price over time, and what to stock. Deliveries on a job and the order log join in
  later stages.
next: PR 2 on the pipe side, now that step 0 is done (2026-11-10): the Drive read as the service account, a bill opened by its link's file id, and the sweep. Then the measure; the office's first real bill saved from its PDF shows the Lines cell on a real paper.
size: XL as a train of about nine (PR 1 M · PR 2 M · then measure · 1b M · 2a M · 2b S · 4a M · 4b M · 4c S), the parsers optional and the joins of stage 5 apart
blocker: None since 2026-11-10. The bills' folder is shared with the app's account as a viewer, so PR 2's sweep can open a bill on file.
opinion: build PR 1 and PR 2 first — the reader, the sum check and the PDFs all exist, and the real lines are what the matching list and the views should be designed from; the rest after a week of measured data
ver: v2.6817 · v2.6819 (PR 1 and 1b) · v2.6088 · v2.6095 (the bill reader this builds on)
---

# Every supply house bill's lines as rows

## The ask

The owner, 2026-11-09: *"Long term I want to index all the materials from all the invoices we get
from supply houses, I see benefits being we can see how many of certain line items we buy and this
helps us gauge what we should stack up on."*

The question this card answers: how does every supply house bill's line items get into the app as
rows, matched to parts, so the office can see what the company buys, how often and at what price,
and decide what to stock?

## The mock-up

[`mockup.html`](./mockup.html), nine frames, every name, code, part, price and count made up. The
same frames are on the design canvas, where each can be switched to the dark theme:
*Supply bill lines mock-up* — https://claude.ai/artifact/4K2iapynV38jpWUuzTYUpc

- **A**: the Supply houses tab today, a bill as a total and a link.
- **B · C**, stage 1: the Lines column on a house's bills (adds up, a gap with *Look*, no PDF,
  reading, a credit); the *Look* window with the paper beside the lines read, the gap in words,
  the missing line typed in, and *Count it as read anyway*.
- **D · E**, stage 2: *Codes with no part* on the Parts Book, by dollars, with the app's offers and
  the four presses; what one *This is it* does (the unit factor, the book's price moved with the
  bill as the note, the lines regrouped) and a tenfold price offered, not written.
- **F**, stage 3: the backfill's screen, read · held · no PDF · ready, each held reason with its
  count and its door, the Drive-link probe first.
- **G · H · I**, stage 4: What we buy, Price over time, What to stock, with the limits on the page.

## The evidence

The same day, one big job's supply paper was indexed by hand outside the app. What it showed, in
general terms:

1. **The paper reads cleanly.** Three suppliers' PDFs have text layers. Two of them are wholesalers
   on the same order system and print one layout; the third prints another. A small parser per
   layout read every line: quantity ordered, quantity shipped, description, part number, unit price
   and extension. The lines summed to each document's subtotal to the cent. A scanned order read
   the same way after OCR.
2. **Part identity is the hard part.** A supplier's description, a supplier's part code, the parts
   book and the names crews type on site share no key. Hand-written patterns matched about 40
   percent of the lines to a part.
3. **Big-box card purchases leave no lines.** There is a bank row and nothing else.
4. **The same goods appear on several papers.** A bid, a quote, an acknowledgement, a ship ticket
   and an invoice can all list one order. Only an invoice and a ship ticket say what was shipped.
   Counting the others counts the goods twice.
5. **A lines table would have caught a short shipment.** One order was paid in full while only part
   of it ever appeared on a ticket.

## What the code and prod say today

Read 2026-11-09. Prod figures are counts through the dev seat, read-only.

### The bill reader already reads the lines

- `supabase/functions/bill-read/index.ts` sends the PDF, or a picture, to the model as a document
  block and asks for one JSON object held to `BILL_SCHEMA` in
  `supabase/functions/_shared/billRead.ts`. The schema already asks for `lines`: a description, a
  quantity, a unit price and an extended price for every item row, with the subtotal, tax and total
  in their own fields.
- **The lines are read and kept, not dropped.** The whole answer lands in
  `supply_bill_reads.answer`. At Save the row keeps it in `supply_house_invoices.bill_read`
  (`BillRowRead.lines` in `src/lib/materials/bills/billRead.ts`, whose comment reads "The form
  never shows them; a later look reads them here"). Both are JSON. Nothing queries them.
- **The sum check exists.** `sumCheck` in `src/lib/materials/bills/billChecks.ts` holds the lines
  plus tax against the total, and the Add invoice window counts an off sum as a check to look at.
- **What the schema does not ask for:** the house's part code, the manufacturer's number, the unit,
  quantity ordered apart from shipped, a back order, the pricing unit (each, per hundred, per
  thousand), freight. `document_kind` is invoice, credit memo, statement or other, so a quote, an
  acknowledgement and a ship ticket all read as *other*. `readBillAnswer` keeps 200 lines at most
  and the call allows 8,192 output tokens, so a long stock order would be cut.
- **Where it reads from:** a file on a house's thread (`message_attachments`) or a file dropped on
  the form, both in the `message-attachments` bucket. It cannot read a Drive link.
- **In prod the reader is on and unused.** `app_settings.bill_read_on_v1` reads `true`.
  `supply_bill_reads` holds 4 rows, all from the two days after it shipped, about 1.2 cents each.
  No invoice row created since carries `bill_read`, and none of the newest 200 carries
  `bill_attachment_id`. The office types each bill and pastes a link, as before.

### How bills arrive, and how many have a PDF

- **The office's Add invoice** (`src/components/SupplyHousesTab.tsx`, kernel
  `src/lib/materials/supplyHouseInvoiceForm.ts`) is the one way a bill is recorded. It writes
  `supply_house_invoices` (house, number, date, amount, `document_kind` invoice or credit,
  `purchase_order_number`, `link`) and `supply_house_invoice_job_allocations` (job, percent).
- **539 rows are on file**, with invoice dates from October 2025. **About 520 carry a Google Drive
  link** in `link`; 19 carry none.
- **One file often stands behind several rows.** Twice, a single Drive file is the link on 19 rows.
  A scan of a stack of bills, or a statement's worth of invoices, is one PDF. The reader must
  expect several bills in a file.
- **The linked PDFs are outside the jobs Shared Drive.** Eight sampled Drive ids have no
  `file_index` row: the index walks the jobs Shared Drive
  (`supabase/functions/file-index-sweep/index.ts`), a person's HR file and a legal matter, and the
  bills are elsewhere. A measurement run on the evening of 2026-11-09 settled where: a folder in
  an office login's My Drive, shared with the office users and, until 2026-11-10, **not with the
  app's service account**. Step 0, below, shared it, so the backfill can open a bill on file; the
  index still never lists one.
- **Mail.** `gmail-sync` puts each mail that reaches the one mailbox it reads on its sender's
  thread, with our copy of each attachment. `src/lib/materials/bills/billsToRecord.ts` offers a
  thread's PDFs under *Start from* on the Add invoice window. Bills that suppliers' billing
  services mail to another mailbox are reached today only through the dev seat (`search_mail`,
  `read_mail_file`, `plan_mail_file`), which files an attachment to a job's folder, a person's file
  or a matter, never to a bill's row.

### How a part is named, place by place

| Place | Table | The part is |
| --- | --- | --- |
| Parts book | `material_parts` | a row: name, manufacturer, part type, service type, order increment |
| Supplier prices | `material_part_prices` | part × house, one price, an effective date; unique on the pair |
| Price history | `material_part_price_history` | a row per change, written by the trigger `track_price_history` |
| Purchase orders | `purchase_order_items` | `part_id`, always a book part, with `price_at_time` |
| Job Parts Tally | `jobs_tally_parts` | `part_id` or null, beside a fixture name |
| Materials on site | `job_material_movements` | `part_id`, or a `part_name` typed on site |
| Order log | `bid_procurement_items` | a submittal tag, or a hand row's words |
| A bill | `supply_house_invoices` | nothing: a total and a PO text |

- **No table holds a supplier's part code.** No column in the schema is named for a SKU, a part
  number, a catalog number or a UPC. The parts book knows a part by its name alone.
- `partKey` in `src/lib/materials/onSite.ts` is a part's one key on a job: `id:<part_id>`, or
  `text:<the typed name, folded>`. `docs/MATERIALS_ON_SITE_ARCHITECTURE.md` says 18 of 282 ledger
  rows carry a `part_id`, so on site the folded name does the matching, not the book.
- The book holds about 2,500 supplier prices. One wholesaler has about 1,100, three more houses
  300 to 500 each. `pickBookPrice` (`src/lib/materials/bookPrice.ts`) flags a price stale past 90
  days.
- **A price change already writes its own history.** Any insert or update on
  `material_part_prices` fires `track_price_history`. A bill that updates a price refreshes the
  history with no new code. The trigger stamps `auth.uid()` and no note, so a change made by a
  background job has no author and no source. Stage 2b fixes that.

### What the file index reads

- `file_index` holds 4,836 files, 2,189 with text. `supabase/functions/_shared/fileText.ts` reads a
  PDF's text layer through unpdf, a page at a time inside a time budget. 1,624 files are held as
  scans, and no file has been read by OCR: `supabase/functions/_shared/ocr.ts` waits on a Document
  AI processor that is not set up.
- **The index's text is not a parser's input.** It is flat, for search: the measurement run found
  a bill's columns come out as separate lists, and one house's quantities run together. The
  reader reads the PDF's bytes. The flat text is good for one thing here, the code check below.

### What the measurement run on real bills found

Read on the evening of 2026-11-09 across the main houses' papers, in general terms:

- **Every house prints its own code on every line**, and most print the manufacturer's number
  too. The crosswalk's key, house plus code, is sound, and the manufacturer's number is a usable
  second key across houses.
- **Kits and bundles.** Two of the main houses print a kit's component lines with no price; one
  prints bundle sub-lines at a zero price under one bundle amount. A per-line arithmetic check that
  does not know a component line marks every such bill off.
- **Pricing units are real**: at least one house prices some lines per hundred or per thousand
  beside each. The column stays.
- `src/lib/materials/manifest.ts` (`parseInvoiceLine`) is a rule-based reader of pasted invoice
  text, built for Materials on site's Deliveries panel. Its own header says the build should send
  the text to a model. It reads a quantity, a name, a unit and a price, and no part code.
- `docs/MATERIALS_ON_SITE_ARCHITECTURE.md` lists *Reading an invoice from the Drive folder* among
  its gaps, and says no delivery in prod names an invoice as its source.

## The design

Five stages. Each PR is small enough to ship alone and has its own live check. Table and column
names are proposals; the builder may rename them.

### Stage 1: the lines table and the reader

**Two tables, because a paper is not always a bill's row.** A ship ticket has no row in
`supply_house_invoices`, and one PDF can hold several bills.

- **`supply_papers`**, one row per document read: the house; the kind (`invoice`, `credit`,
  `ship_ticket`, `acknowledgement`, `quote`, `bid`, `statement`, `other`); its number and date; the
  supplier's order number, which ties an acknowledgement to its tickets and bills; the PO text; the
  file (a Drive file id or a bucket path) and the pages it covers; `invoice_id`, set when the paper
  is a bill on file; the subtotal, tax, freight and total as printed; which reader read it and
  when; the check state and its note.
- **`supply_paper_lines`**, one row per printed line: the paper; the line number; the house's part
  code; the manufacturer's number when printed; the description as printed; the unit; quantity
  ordered, shipped and back ordered; the unit price and its pricing unit (each, per hundred, per
  thousand); the extension in cents; the kind of line (`part`, `charge` for freight, fuel or a
  restock fee, or `component` for a kit's or bundle's sub-line, which belongs to the priced line
  above it); whether the code was read from a text layer or a scan; `part_id` and how it was
  matched, both empty until stage 2.
- **One view says what a purchase is: `supply_purchase_lines`.** It returns the lines of papers
  whose kind is `invoice` or `credit` and whose check is `adds_up` or `accepted`, a credit's lines
  signed negative. Every count and every chart reads this view. A quote cannot be counted because
  no screen ever reads the lines table directly.
- The migration opens with the lock timeout and ends with the four fence calls. Office roles read;
  the service role writes.

**The reader: the model first, a parser per layout after.**

| | A parser per layout | The model reader |
| --- | --- | --- |
| Cost | none | about 1.2 cents a one-page bill today |
| Exactness | exact and repeatable | can misread a digit; the sum check catches most |
| Reach | one per layout; two layouts cover the three main houses | every house, every layout |
| Scans and photos | needs OCR, which is not set up | reads them as they are |
| When a layout changes | fails; the sum check shows it | keeps reading |
| Long bills | no limit | must be read in page ranges past 200 lines |
| Exists today | a hand-built one outside the app, and `manifest.ts`'s rule reader | `bill-read`, deployed, with its key, cap and ledger |

**Recommended:** the model reader, widened, behind one interface `readPaperLines(file) → papers
with lines`, with the five checks below. A read costs about a cent, and the code check gives most of
what a parser's exactness would. Parsers per layout are **optional**, a later PR if the model's
reads keep failing a check on one house's long bills; a second reader that disagrees with the first
would itself be a check. The reader reads the PDF's bytes, never the index's flattened text.

**What changes in the reader (PR 1):**

- `BILL_SCHEMA` gains, per line, the house's part code, the manufacturer's number, the unit,
  quantity ordered, shipped and back ordered, the pricing unit, and a kit-component flag; per
  paper, the order number and freight. `document_kind` gains ship ticket, acknowledgement, quote
  and bid.
- A file may answer with several papers, each with its number and its pages.
- A paper past 200 lines is read in page ranges and joined.
- The office's fill of the Add invoice window is untouched. It reads the same answer.
- PR 2 adds the Drive read: a bill's `link` downloaded as the service account the way the file
  index does (`driveMedia` in `supabase/functions/_shared/driveJobFolder.ts`), once step 0 lets it.

**How a read is verified.** Five checks, held in a pure kernel with tests:

1. Each priced line: quantity shipped × unit price ÷ pricing unit = its extension, within a cent.
   A component line (no price, a kit's or bundle's sub-line) belongs to the priced line above it
   and is not checked on its own.
2. The extensions sum to the printed subtotal.
3. Subtotal + tax + freight = the printed total.
4. For a bill on file, the printed total = the row's `amount`, which a person typed from the paper.
5. **Every house code the model returns is found word for word in the paper's own text**
   (`textFromBytes` on the same bytes), where the PDF has a text layer. The four sums protect the
   money and say nothing about the code, and the code is the crosswalk's key. A scan has no text to
   check against: its codes are marked as read from a scan, and the first time such a code is
   taught to the crosswalk a person confirms it against the picture.

All five hold: the paper `adds_up` and its lines count. Any fails: the paper is `off`, its lines
are kept and **do not count** until a person looks.

**What a person sees when it does not add up (stage 1b).** A bill's row on the Supply houses tab
gains one line: *42 lines · adds up*, or *41 lines · $12.40 short of the subtotal*, with a *Look*
press. *Look* opens the paper beside its lines. The line whose own arithmetic fails is marked. The
gap is stated in words: which sum is off and by how much. The person can fix a line, add the
missing line, or press *Count it as read*, which records `accepted` with their name. A paper never
counts by itself while a sum is off. The window follows the house rules: a failed load on
`OfflineRetryPanel`, errors through `formatErrorMessage`, a confirm button that names its act.

**The reader does not wait for the office to change a habit.** The office does not use the fill
today. So a bill is read from the link already on its row, after Save, by a background sweep. No
one presses anything for the lines to appear.

**The order, for first value and a small gate.** PR 1 and PR 2 draw no screen and need two calls.
Then the real lines are measured (how many codes, how much spend behind each, how often a check
fails and why) **before** the matching list and the views are built, so both are designed from
real data and not from this card's guesses.

| PR | What | Size | Live check |
| --- | --- | --- | --- |
| 1 | The two tables, the view, the check kernel with the five checks, the widened reader schema. No screen. | M | Push the migration, deploy `bill-read`. As a dev, read one real bill from each of the three main houses through the form's upload path. Each has its rows, each `adds_up`, each matches a hand count of the paper's lines, every code is found in the text. A made-up bill with one line removed reads `off` with the right gap; one with a kit reads `adds_up`. |
| 2 | The Drive read as the service account, and the sweep that reads new rows after Save and is also the backfill, with its held list and its own cap. | M | After step 0: the sweep reads twenty real bills on file; each is read or held with a reason; ten picked at random match their PDFs. |
| — | **Measure.** A week of lines: codes by spend, the share the top forty cover, scans against text layers, checks failed by kind. | — | A short note on the card with the counts. The matching list and the views are drawn from it. |
| 1b | The row's line and the *Look* window, with a render smoke and a guide. | M | On a made-up bill that is `off`, fix the line in the window and see the row read *adds up*. On a real bill, open *Look* and compare ten lines to the PDF. |
| opt. | Layout parsers as pure kernels with made-up fixtures, tried before the model, only if the measure shows a house whose long bills keep failing a check. | S | Read the same real bills through the parsers. The rows equal the model's rows line for line. |

### Stage 2: part identity

**The key is the house's own code, not the description.** Patterns over descriptions reached 40
percent by hand. A house's code for a part is stable and printed on every line.

- **`supply_part_codes`**, the crosswalk: house, code, `part_id`, a unit factor (the house sells a
  stick, the book prices a foot), who taught it and when, and the line it was taught on. Unique on
  house and code. A code may also be marked *not a part* (a freight line that prints a code).
- **Learned once, reused everywhere.** Teaching a code matches every past line with that code and
  every future one. Nobody matches the same part twice.
- **How a line finds its part, in order:**
  1. The house and code are in the crosswalk: matched, with no press.
  2. The manufacturer's number is known from another house's crosswalk: offered.
  3. The description resembles a book part's name: offered.
  4. Nothing: the line reads *No part yet*.

  Only the first is written without a person. An offer is a suggestion with a press.
- **How an unmatched line is offered to a person (stage 2a).** A list on the Parts Book: *Codes
  with no part*, one row per house and code, **sorted by dollars spent**, so the first hour of
  matching covers the most money. Each row shows the description as printed, how many times it was
  bought and what was spent, the offers when there are any, and four presses: *This is ‹part›*,
  *New part in the book* (the name and manufacturer filled from the line), *Not a part*, and *Later*.
  The list's batch press says its count (*Match 14 offered codes*) through `batchWords`, acts on
  what is ready and lists what it held. Its empty state is the good one: *Nothing waiting on a
  part*.
- **An unmatched line still counts.** The views group by part when there is one, and by house and
  code when there is not. The owner can see what the company buys on day one, before anyone has
  matched a code.

**A bill refreshes the book's price (stage 2b).** When a line `adds_up`, is matched through the
crosswalk and is newer than the book's price for that part at that house, its unit price (through
the pricing unit and the unit factor) is **offered** as `material_part_prices.price`, with the
bill's date as `effective_date`; for the first month nothing is written without a press, because
the book feeds bid pricing. The existing trigger writes the history row; it is widened to carry a
note (*from a bill*, with the paper's id) and an author for a background change. If the month shows
the offers are always taken, the owner may switch small moves to automatic; a move past a set share
stays an offer either way, because a unit mix-up looks like a tenfold price change.

The book keeps one price per part per house: the last one paid. **The lines themselves are the
real price history**, since every purchase is a point with its date and its quantity. Stage 4's
price view reads the lines.

| PR | What | Size | Live check |
| --- | --- | --- | --- |
| 2a | The crosswalk, the matcher kernel, the list on the Parts Book, the guide. | M | Teach five real codes. Every past line with each code now carries the part. A newly read bill with one of them is matched with no press. |
| 2b | The price refresh, the widened trigger, the offer on a big move. | S | On a ZZ test house and part, a bill with a higher price moves the book's price and writes a history row that names the bill. A tenfold price is offered and not written. |

### Step 0: the owner's door

**Done 2026-11-10.** The bills' PDFs were private files in an office login's My Drive folder,
shared with the office users and not with the app's service account, so the app could not open one
of them. The owner first chose the move into the jobs Shared Drive, then kept the bills apart from
the jobs: the folder stays in that My Drive, renamed `_Bills` so it sorts first, and is shared with
`drive-intake@pipetooling-drive.iam.gserviceaccount.com` as a **viewer** (the sweep only reads),
beside the office users who already had it. Read back the same day from Drive's own permission
list: the folder, two of the newest bills and one of the oldest (March 2026) each name the service
account as a reader. The sweep's probe (below) has not run, since PR 2 is not built.

Two things follow for PR 2. The bills are not in the jobs Shared Drive, so `file-index-sweep` never
lists one and the sweep opens each bill by the file id in its `link`. And the files are owned by an
office login, so they last as long as that account does; a Shared Drive of their own is the move if
that ever matters, and it changes no file id.

### Stage 3: the backfill

The bills on file, read by the sweep PR 2 built, as a batch that does what is ready.

- **First, a probe.** Before any reading: try to open 20 of the linked files as the service
  account. A file it cannot open (one filed outside the shared folder) reads no, and the screen
  says so with the door.
- **A sweep, not a browser loop.** A cron reads a few files each run inside a time budget, as
  `file-index-sweep` does, newest bills first. The reader's daily cap of 150 is a tripwire for the
  office's fill; the backfill gets its own, higher, stated cap.
- **One screen for the office** on the Supply houses tab: *Lines read on 212 of 520 bills · 14
  held*. Its press names its act and its count (*Read 308 bills*), is dead only when nothing is
  ready, and keeps going past a file that fails.
- **What it holds, each with its reason and its door:**

  | Held because | The door |
  | --- | --- |
  | The row has no PDF (19 today) | *Add the PDF* on the row |
  | The app cannot open the link | Share the file, or paste a link the app can open |
  | The file holds several bills and one has no row | *Add invoice*, filled from that paper |
  | The row's number is not in its file | *Look*, to pick the pages or fix the link |
  | The sums are off | *Look*, stage 1b's window |
  | The paper is a statement | Nothing to do: a statement has no lines of its own |
  | The file is over the reader's size limit | A smaller scan |
  | The model would not read it, or the read was cut | *Read again*, or type the lines |

- **Files with several bills.** The reader answers one paper per bill. Each paper finds its row by
  house and invoice number, exactly. A file is downloaded and read once however many rows link it.
- **The cost** is small: about 540 bills at about a cent each when a bill is one page, more for
  long ones. Once stage 1c is in, the main houses' bills cost nothing.

| PR | What | Size | Live check |
| --- | --- | --- | --- |
| 3 | The progress line and the held list as a screen, over PR 2's sweep. | S | Run it on prod. Every bill is either read or held with a reason. The held list's counts equal a hand count for one house. |

### Stage 4: the views

Drawn as frames G, H and I of the mock-up, as a new tab on Materials, *What we buy*, with the three
views as its own tabs. The owner's critique of those frames comes before the build.

- **4a · What we buy.** Per part, or per house and code where no part is matched: quantity and
  spend by month, how many bills, which houses, which jobs. Filters for a house, a job, a service
  type and a span of months. Sorted by spend, by quantity or by how often.
- **4b · Price over time.** For a part, every purchase as a point: the day, the house, the unit
  price, the quantity. The last price paid at each house beside the book's price, a rise since
  the purchase before, and the cheapest house in the last 90 days.
- **4c · What to stock.** Parts bought on many separate days in small quantities: *bought 23 times
  in 90 days, 2 at a time, for 9 jobs*. Ranked by trips to the counter, not by dollars, since the
  trip is the cost that stock would save. A counter purchase is told from a delivery by the PO
  Generator's counter code (`material_po_generator_entries`) and by a small bill.

**What purchases can and cannot say.** A bill says what was bought, when, from whom and at what
price. It does not say what was installed, what sat on a truck, what moved to another job, what
went back with no credit or what walked away. Usage is Materials on site's *Used* press, not a
bill. So the stocking view answers *what do we keep going back for*, which is the question behind
the ask. It cannot answer *how many did the jobs use*. Three limits are stated on the view itself:

- **Big-box purchases are missing.** They are the small, frequent buys the stocking view most
  wants. Punch list #295 counted about 176 card charges at material houses in 90 days, most at
  big-box stores, with no lines on any.
- **A line's job is the bill's job.** A bill split across jobs by percent cannot say which line
  went where.
- **A part with no match is counted by its house's code**, so the same part bought at two houses
  shows as two rows until someone matches it.

| PR | What | Size | Live check |
| --- | --- | --- | --- |
| 4a | What we buy, with its guide. | M | Pick three parts. Each month's quantity and spend equal a hand sum of that part's lines. |
| 4b | Price over time. | M | For one part, the points equal its bills; the last price equals the newest bill. |
| 4c | What to stock. | S | The top ten rows read true to the person who buys at the counter. |

### Stage 5: the joins to what exists

Later stages, each its own card or PR once stages 1 to 3 are live. None is this card's first build.

- **A bill's lines as a delivery on Materials on site.** Jobs → Materials → Deliveries gains *From
  a bill*: the paper's lines become `delivered` rows into the job's Unsorted, the bill's number as
  the `source`, a matched part by its id and an unmatched one by its printed name. It closes the
  gap the architecture doc names. The price rides on the lines, where today it lives on the device
  that read it.
- **Ordered, shipped, billed, paid.** With ship tickets and acknowledgements read as papers, an
  order's lines can be held four ways: what was ordered, what a ticket shipped, what a bill
  charged, what was paid. A bill paid in full with part of it never on a ticket becomes a line
  on a list. This is finding 5 of the evidence.
- **An order log line marked delivered.** `bid_procurement_items` carries a PO reference. A ticket
  or a bill with that reference offers *Mark delivered* on the Procure step.
- **A purchase order's price confirmed.** `purchase_order_items.price_confirmed_at` can be set from
  the bill that charged the part.
- **A counter ticket's lines.** Punch list #295's photo, read by the same reader into the same
  tables, is how a counter purchase gets lines.

## Out of scope

- **Big-box card purchases with no line data.** A bank row has no lines to read. The door is a
  photo of the receipt, punch list #295.
- **Usage, stock counts and a yard.** What is on a shelf is Materials on site's ledger.
- **Reordering.** The stocking view informs a decision. It orders nothing.
- **A feed from a supplier.** Some houses can export a bill's lines as a file. It would beat
  reading a PDF, and it is a conversation with each house. It is call 9.
- **Bids, quotes and acknowledgements as purchases.** They are read as papers in stage 5 so they
  can be compared. They are never counted.

## The calls that are the owner's

Each has a default. **Two gate PR 1**; the rest can be answered later, and the build goes ahead on
the default where the owner has no preference.

Gating:

1. **Does a bill read by itself?** *Default:* yes. Every bill with a PDF is read after Save, about
   a cent each, with no press. The other choice is a *Read the lines* press on each row.
2. **Does a bill change the book's price by itself?** *Default:* no, for the first month: the
   price is offered, with the bill beside it, because the book feeds bid pricing. After a month of
   offers the owner may switch small moves to automatic.

Later:

3. **The reader.** *Default:* the model reader behind the five checks; parsers per layout only if
   the measure shows a house that needs one.
4. **Who matches codes to parts.** *Default:* whoever keeps the Parts Book, from the list sorted
   by dollars. The office may see the list and not press on it.
5. **How far back the backfill goes.** *Default:* every bill on file, newest first. It is cheap,
   and a year of history is what makes the price view worth opening.
6. **Freight, fuel and fees.** *Default:* counted as spend under *Charges*, never as a part.
7. **Who sees the views.** *Default:* the owner, a dev, the office roles and an estimator. No field
   role.
8. **Ship tickets, quotes and acknowledgements.** *Default:* bills and credits only through stage
   4. The other papers are read in stage 5.
9. **Ask the houses for a file of lines.** *Default:* not now. Ask the house with the most bills
   once the views show what a feed would save.

And step 0, which was not a call but a press, is done: the bills' folder is shared with the app's
account (2026-11-10).

## Where it plugs in

Exists, to reuse:

- The reader, its key, its cap and its ledger: `supabase/functions/bill-read/index.ts`,
  `supabase/functions/_shared/billRead.ts`, `supply_bill_reads`, `_shared/modelKey.ts`.
- The checks and the words: `src/lib/materials/bills/billChecks.ts` (`sumCheck`), `billWords.ts`,
  `billMatch.ts` (the job from a PO code).
- The Drive read and the PDF text: `_shared/driveJobFolder.ts` (`driveMedia`), `_shared/fileText.ts`
  (`textFromBytes`, for the parsers), `_shared/ocr.ts` once a processor is set up.
- The sweep's shape: `supabase/functions/file-index-sweep/index.ts` (a few a run, a stamp, a held
  list with reasons).
- The parts book and its prices: `material_parts`, `material_part_prices`, `track_price_history`,
  `src/lib/materials/bookPrice.ts`.
- The bill's row and its window: `src/components/SupplyHousesTab.tsx`,
  `docs/MATERIALS_TABS_ARCHITECTURE.md`.
- The batch rules: `src/lib/batchWords.ts`, `EmptyState`, `OfflineRetryPanel`,
  `formatErrorMessage`.
- For stage 5: `src/lib/materials/onSite.ts` (`partKey`), `src/lib/materials/manifest.ts`, the dev
  seat's `plan_delivery`, `bid_procurement_items`.

New:

- `supply_papers`, `supply_paper_lines`, the view `supply_purchase_lines`, `supply_part_codes`,
  each migration with its `docs/migrations/` page.
- `src/lib/materials/lines/`: the check kernel, the paper-to-row matcher, the part matcher, the
  layout parsers, the three views' sums. Pure, with tests.
- The sweep (a new function or a mode of `bill-read`), with its `docs/EDGE_FUNCTIONS.md` section.
- The row's line, the *Look* window, the *Codes with no part* list, the backfill's screen, the
  three views, each with a render smoke and a guide.

## How to verify

- **Made-up bills for tests and smokes.** `scripts/bill-read-compare.mjs` and the reader's test set
  already use made-up paper. The parsers' fixtures are made-up bills in the two layouts' shapes,
  with invented parts, codes and prices. No real bill goes in the repo.
- **Real bills for the live checks**, read on prod by a dev, compared by eye to the PDF. Nothing
  from them is pasted into a PR, a commit or this card.
- **A ZZ test house and a ZZ test part** for every check that writes a price.
- The repo is public. This card states the evidence in general terms and names no supplier, part,
  price or bill.

## Where it stands

**PR 1 (v2.6817) and PR 1b (v2.6819) are on main and their migrations on prod** (2026-11-09). The
live walk of 1b ran from a worktree dev server against prod, signed in through dev-login: the
made-up *wrong total* bill from `src/test/fixtures/bills/` through *Another file…* on the ZZ test
house filled the form (7 lines, $1,248.10 against a printed $1,284.10), Save wrote the paper
through `supply_paper_save`, the row read *7 lines · The subtotal with tax and freight is $36.00
short of the total · Look*, Look drew the PDF beside the seven lines with the strip in words and
*Save 7 lines* dead, and *Count it as read anyway* → *Count it as read* turned the row to *7 lines ·
counted as read by Robert*. No console error. What the walk left and found:

- **A made-up test bill stays on the ZZ test house** (S1183455, $1,284.10, accepted). It is not
  deleted because `supply_papers.invoice_id` is ON DELETE SET NULL: deleting the bill would leave an
  accepted paper with no bill, and the purchase view would still count it. The pipe side should
  either cascade the delete or have the view require a bill for an invoice or a credit; the test
  row goes once that rule is in. The views of stage 4 leave ZZ test houses out either way.
- **The made-up fixtures print no part codes** (they were drawn before PR 1's schema), so the Code
  and Unit columns of Look were empty on the walk. A real bill fills them; the fixtures should
  gain codes when the pipe side next touches `scripts/bills-fixtures.mjs`.
- **A narrow price box in Look**: the Price column clips *31.40* to *31* at the window's width. A
  width fix rides with the next screen PR (2a).
- The code-in-text check did not run on this path, as designed: the client has no text layer.

Earlier: a design card with its mock-up. Nothing was built until 2026-11-09 evening. The owner said on 2026-11-09 they want to build
it; the nine frames were drawn the same day for their critique, and a measurement run on real bills
the same evening answered the Drive question and reshaped the checks and the order of the PRs. The
research above was read on 2026-11-09; the prod counts will drift. Two things were not checked and
are named where they matter: how many supplier mails with a bill reach a mailbox the app does not
read, and how much of the spend the top unmatched codes cover, which the measure after PR 2 answers.
