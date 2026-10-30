---
name: "Supply-house bill capture: the PDF fills in today's form, and a person saves it"
number: 179
group: ready
status: approved 2026-10-29 as the second redraw · building on claude/179-bill-capture-* · PR 1 the card and its mock-up
summary: >
  Every supply-house bill is typed today. The office finds the PDF in the mail, saves it to Drive,
  opens Materials → Supply houses, expands the house and types nine fields the paper already
  prints, then pairs the credit by hand. The first draft proposed a Bills inbox with its own
  Approve. Taunya's word on 2026-10-29: augment the manual entry, never replace it. So the Add
  invoice window stays the one way a bill is recorded, and what is new is where it starts: the
  bill's PDF, picked from the house's thread or dropped in, fills the fields the way a browser
  fills an address, and the form points at the two or three it had to guess. Nothing is written
  until Save invoice, as today. Two doors open the form from where the PDF already sits: the
  house's thread in Messages, and the house's row on the Supply houses tab.
next: PR 2, the fill behind a switch (bill-read, the kernels, the read kept on the invoice row), then PR 3, the form and the two doors.
size: M as a train of three PRs (S · M · S)
blocker: After PR 2, the migration's push and bill-read's deploy, and the model key on Settings → Phone and texts → Model keys if the owner has not added one.
ver: proposed
opinion: build — the form keeps its one write path and looks like itself, the fill is a model call behind a switch that ships off, and every guess asks for a look in a sentence before Save
---

# Supply-house bill capture: the PDF fills in today's form, and a person saves it (#179)

## The ask

On 2026-10-24 the owner compared the app with fifteen trade apps. On 2026-10-26 a holistic look
at the user experience named *replace typed notes with read state* as a lens, and supply-house
bills as its clearest case. The comparison found that Jobber reads the job number off a
supply-house PDF and drafts an expense, Buildertrend's Cost Inbox drafts bills that wait for
review before they reach job cost, ServiceTitan's AP Inbox drafts bills and matches them to POs,
and BuildOps scans a vendor PDF into a PO. The owner, the same day:

> help me mockup what adding supply-house bill capture, a draft from the forwarded PDF that a
> person approves could look like if we built it before and after? I can't imagine it at this
> moment so you would need to show me.

The first draft of this card (2026-10-26) drew three shapes and picked A, a Bills inbox on
Materials with one Approve per card. The decision below is what came of showing it.

## The decision

Taunya reviewed the five big cards on the canvas of 2026-10-29. On this one:

> 179 should not replace the manual entry, it should only augment it. Show me a revised mockup
> before we move forward.

The first redraw kept the form and put a *Read the paper* strip on it with every field badged
read, guessed or typed. She read it as not intuitive: *what does read mean*. The second redraw
took the machine's words off the screen, and she approved it (*Approve the revision*). It is
what this card now describes and what [`mockup.html`](./mockup.html) draws:

- **The Add invoice window stays the one way a bill is recorded**, with the same sections in the
  same order and **Save invoice** the only write. A person can still type the whole bill with no
  PDF at all.
- **The bill is the form's first question.** A new first section, *The bill*, asks *Start from:*
  the PDFs on this house's thread that are not yet on an invoice row, *Another file…*, or *No PDF,
  I will type it*. Picking one fills the form.
- **The fields fill like an autofill.** A field from the paper is tinted green with a green left
  border and carries no label. A guess is amber with one sentence saying why and a **Yes** and
  **Pick another** beside it. A field the paper cannot answer stays plain and reads *yours to set*.
  One line under the picker counts what is left. A small legend names the three looks.
- **The fill never writes over a field the person typed**, and nothing is written until Save.
  The words *read*, *guessed* and *typed* live in the database only, on the row, so a wrong guess
  can be found later; they never show on the screen.
- **The checks are sentences under the field**, like the PO hint today, and Save still works.
- **Two doors into that form, where the PDF already sits:** *Record this bill* and *Not a bill*
  on the house's thread, the same shape as the thread's *File this as their certificate*; and
  *N bills to record* with *Record them* on the house's row.
- **Not built, by her word:** the Bills inbox deck, its Approve, *Approve the N ready* and the
  held cards; the *Read the paper* strip and its badges. Option C's PO match stays a later idea
  on the same form, a sentence under the PO field at most.

The four calls the canvas put beside the drawing were taken as recommended: the team box the app
already reads feeds the thread (no bills box); our copy becomes the row's link with *Use a Drive
link instead* for anyone who wants the AP folder's copy; `claude-sonnet-5-5` does the fill with
`claude-haiku-5-5` tried on the same made-up test set; the key is the one the Model keys card
already holds, and the function caps the fills a day.

## Today

A supply-house bill reaches the office three ways. Each ends in the same form, the **Add invoice**
window on Materials → Supply houses → Accounts payable → the expanded house → Invoices
([`SupplyHousesTab.tsx`](../../src/components/SupplyHousesTab.tsx), the form's words and checks in
[`supplyHouseInvoiceForm.ts`](../../src/lib/materials/supplyHouseInvoiceForm.ts)). The guides that
walk it are [mark an invoice as on a job account](../../src/content/help/mark-an-invoice-on-a-job-account.md)
and [record a return or credit from a supply house](../../src/content/help/record-a-return-or-credit-from-a-supply-house.md).

**How it arrives.**

1. **By email.** The house's billing system, or the rep, emails the invoice PDF to the office
   mailbox, or a tech forwards what the counter emailed him. The assistant opens the mail,
   downloads the PDF, uploads it to the AP folder on the jobs Shared Drive, and copies its link.
   The scan step happens outside the app.
2. **A PDF or a photo from the counter.** The tech picks up on a PO Generator code or the job
   account. The counter prints a ticket. It comes back in the truck, or the tech photographs it
   and texts it. A text with a photo lands on the tech's Our team thread in Messages since
   v2.5546. The assistant saves the photo to Drive the same way.
3. **On paper.** The mailed invoice, or the monthly statement with the invoices behind it, lands
   in the tray. Since v2.5818 the Physical inbox deck says a paper that takes more than two
   minutes is typed once and pressed once. This one is scanned to Drive first, then the form.

**What is typed, in the form's own order.** Every fact below is printed on the paper.

| # | Section | The person does | Where it goes |
|---|---|---|---|
| 1 | *What the paper is* | presses **Invoice** or **Credit** | `document_kind`; the sign of `amount` follows, never typed (`signedAmountForSave`) |
| 2 | *From the invoice* | types **Invoice #**, **Invoice date**, **Amount** | `invoice_number`, `invoice_date`, `amount` (the total only; the lines are never typed) |
| 3 | | types **Purchase order #** | `purchase_order_number`, plain text. A five-digit code is checked against the PO Generator ledger as typed: *PO 41207 is on the ledger* in green with the job, the tech, the day and what they said they need, or *not on the ledger* in red (`poCodeHint`, `poLedgerEntryCard`, v2.3599). A code whose job is not the invoice's gets an amber line (v2.3724). |
| 4 | *Which job* | types a J#, a name or an address, picks the job; adds a second and types the **%** split | `supply_house_invoice_job_allocations`, delete-then-insert on save. Under the cards the form lists the codes minted for that job at this house within seven days of the date, since most houses print the job name rather than the code (`poLedgerJobMatches`). |
| 5 | | ticks **On the house's job account** | `on_job_account`. Shown only on a single job. The tick defaults on when `job_supply_house_accounts` holds an open row for the job at this house, else the card offers **Mark opened…**. |
| 6 | *Paying it* | reads the **Due date**, prefilled from the house's payment day with the hint, and changes it when the paper says otherwise | `due_date` |
| 7 | | leaves **Not paid yet**, or presses **Paid on** and a day | `is_paid`, `paid_at` |
| 8 | *Paperwork* | pastes the Drive link under **Invoice PDF** | `link`. **View** on the house's list and the Job Summary's Parts Cost lines open it (`get_invoice_allocation_lines_for_jobs` carries it). Apply Payment later files a receipt in `payment_link` and never touches `link` (v2.3843). |
| 9 | the footer | presses **Save invoice** | one `supply_house_invoices` row, then the allocations |

A credit is the same form with **Credit** pressed: a **Credit #**, a **Credit date**, the amount as a
positive number, **Credits invoice…** picked from this house's invoices newest first
(`CreditPairPick`, `credits_invoice_id`, v2.5035), and the sentence *Takes $888.10 off what we owe
Ridgeway Supply, and $888.10 off J1042's parts cost* read before Save.

Counted: two presses before the first field, seven typed fields, one search and pick, a Drive
upload and a link paste outside the form, and a second pass for the credit. Per bill, five to
ten minutes when the job is plain and the PDF is at hand. The lines on the invoice, the parts and
their prices, are never recorded, so nothing in the app can say what a job's copper cost at
Ridgeway Supply this month, and a price that moved since the Parts Book was last updated is
never noticed from a bill.

**Where every typed fact already is.** The house is the sender. The number, the date, the lines,
the tax and the total are printed. The job is printed as the PO Generator code the office read to
the counter, as the job account's reference, or as the ship-to address and job name the house
keeps on the account. The due terms are printed, or they are the house's payment day the app
already holds. The kind is printed in the header: INVOICE or CREDIT MEMO, and a credit names the
invoice it credits. The only thing the paper does not carry is the split across two jobs, which
is rare and is the office's call.

**What goes wrong today.** A bill typed under the wrong job costs the wrong job, and nothing
catches it unless the PO code's ledger row disagrees. A number typed with a digit off makes
Apply Payment and the house's statement disagree. A credit left on *Not paired yet* leaves two
rows that look like a duplicate. A forwarded bill that nobody typed is the common case: the
Held for suppliers tab and the aging heat map read what was typed, never what the house sent.

## What already exists to build on

- **The box the app reads.** `gmail-sync` reads bids@ and the team box under the Workspace
  delegation every minute ([`docs/EDGE_FUNCTIONS.md`](../../docs/EDGE_FUNCTIONS.md) → gmail-sync;
  the kernels in [`src/lib/emailIn/`](../../src/lib/emailIn/)). Every file up to 25 MB on a mail it
  takes is copied into the private `message-attachments` bucket and gets a `message_attachments`
  row with its name, mime, size and bucket path (`emailLine.ts`, v2.5354). A supply house is a
  contact kind (`supply_house`, `contacts/names.ts`; `contacts.supply_house_id` names the house),
  so a house's mail lands on the house's thread, and a bill the assistant forwards lands on the
  house too, with her note as a team note (`forwarded.ts`). So a bill emailed or forwarded to a
  box the app reads is already a PDF in our bucket on the house's thread. Nothing reads it.
- **The guess-and-answer pattern.** `message_attachments.paper` is the reader's guess that a
  trade partner's file is a W-9 or a certificate, read from the file's name alone
  (`paperGuess.ts`); `paper_answer` is the office's *filed* or *not it*, stamped by a trigger.
  The thread offers *File this as their certificate* under the line (`PaperOffers.tsx`,
  `paperOffer` in `lineFiles.ts`, `answerPaper` in `messagesIo.ts`), and the app never files a
  paper by itself. That is the trust model this card extends: the app offers, a person answers,
  and the app writes on the answer.
- **The app's lasting link to a kept file.** `/files/messages/<attachment id>`
  (`fileRoute.ts`, `FileOpen.tsx`) opens our copy for someone signed in who may read it, through
  a link signed for a minute, so a record can hold the app's own address and the file is never
  public. The W-9 door files that address on the paper.
- **The model key, already in the app.** `report-draft` (v2.5916, the field report drafted from
  what a tech said) calls Claude through `_shared/modelKey.ts`: Vault first, filled from
  Settings → Phone and texts → **Model keys** through `model-config`, then the function's own
  `ANTHROPIC_API_KEY`. So `bill-read` is not the first model call in an edge function, and the
  owner adds the key on that card, not in a terminal, if it is not there already.
- **How a PDF names its job.** The PO Generator mints a five-digit counter code per job and tech
  (`material_po_generator_entries`, [`GLOSSARY.md`](../../docs/GLOSSARY.md) → PO Generator ledger).
  A job account at a house carries the house's own reference for the job
  (`job_supply_house_accounts.account_ref`, v2.3423). The form already parses a code out of
  whatever the house printed (`parsePoGeneratorCodeFromPurchaseOrderName`) and reads it against the
  ledger, and lists a job's codes near the date when the house printed the job name instead.
- **The PDF on the screen.** The pdf.js assets the build already copies (`dist/pdfjs/`,
  `pdfjsAssets.ts`) and the Form Studio's `PdfPageCanvas` draw a page of a PDF from its bytes.
- **The form's switches.** An `app_settings` row read by every signed-in user and written by the
  owner or a dev through a key-scoped policy (`messages_texts_on_v1`, migration
  `20261014160000`) is how a surface ships off and is turned on after its live test.

## The mock-up

[`mockup.html`](./mockup.html), served at `/to-dos/supply-bill-capture/mockup.html`, redrawn
2026-10-29 to the approved second redraw. Section 0 is the form as it is today, which stays.
Section 1 is the same form started from the PDF, at desktop width with the paper beside the
fields and at phone width with the picker first and the paper as a strip above the fields. Its
presses work: picking a bill fills the form, **Yes, J1042** settles the guess and the count line
follows, **No PDF, I will type it** empties the fields, a field you type into keeps what you
typed when you pick again, and **Save invoice** says where the row went. Section 2 draws the
five checks as the sentences they are. Section 3 draws the two doors; **Not a bill** takes a bill
off the house's count. Section 4 lists what was dropped. Every house, job, person, number and
amount is made up: Ridgeway Supply, Cedar Bend Pipe & Supply, job J1042 Oakmont Dental
build-out, Marisol the assistant, Todd the tech, invoice S1183420 and credit memo CM-20991.

**The three looks**, on every field: green with a green left border, *from the paper*, the value
is printed and the fill is quoting it; amber with a sentence and a **Yes**, *a guess, check it*,
the app worked it out and says from what; plain, *yours to set*, the paper cannot answer it.
Nothing on the screen says read, guessed or typed. The row keeps those words.

## What is kept, and what was dropped

**Kept from the first draft:** the reading as a model call with a fixed answer shape, so the
function never parses prose; the matching, the checks and the words as pure kernels with tests;
the write lifted out of the form so there is one money path; the lines kept on the row; the
guess-and-answer trust model; the team box as the feed. All of option B's shape, with the words
a first-timer reads.

**Dropped, by Taunya's word:** option A's Bills inbox deck on Materials, its one Approve per
card, the bar's *Approve the N ready* and the end card, the held cards with their reasons and
doors, Undo after Approve, the `supply_bill_drafts` table and the hook in `gmail-sync` that fed
it, and the first redraw's *Read the paper* strip with its read · guessed · typed badges. They
replaced the manual entry, or read as the machine's words on a form that should look like the
form. Decision 3 of the first draft, the batch press, no longer applies: one bill at a time,
through the form.

**Dropped as a later idea:** option C's purchase-order match. Most counter buys carry a PO
Generator code and no line-item PO, so the match would fire on a minority of bills. If the owner
ever wants it, it is one sentence under the PO field on this same form, read from the lines the
row now keeps. Nothing is re-read.

## Where it plugs in

- **The columns (new, one additive migration with `lock_timeout`, PR 2):**
  `supply_house_invoices.bill_read jsonb`, the read as the row keeps it: the file (our bucket
  path, its name and mime, the attachment it was when it came off the thread), the model and
  when, each field's value with its source *read* · *guessed* · *typed* and the why, the lines
  as the paper printed them, and the checks as they stood at Save;
  `supply_house_invoices.bill_attachment_id uuid` → `message_attachments`, so the house's count
  and the picker know a thread file is on a row; the switch `app_settings.bill_read_on_v1`,
  `'false'` as it ships, with the master-or-dev UPDATE policy the other switches have; and
  `supply_bill_reads`, one row per fill (who, when, the file, the house, the model, the tokens
  and cents, the answer), written by the service role and read by the office roles, because the
  cap of so many fills a day needs a count that outlives the form, and because it is where a
  later look at how often the reader is right will read. RLS and the three block calls for the
  new table; `docs/migrations/<version>_supply_bill_read.md`.
- **The function (new, PR 2):** `supabase/functions/bill-read/`, called by the signed-in office
  user (`verify_jwt = false`; the function checks the bearer, the role, a real account that is
  not read-only, the switch and the day's cap). `POST { attachment_id }` for a file on the
  house's thread, or `POST { file: { name, mime, base64 } }` for *Another file…*, which the
  function puts in the bucket under `bills/<house>/<uuid>/<name>` as the service role. It fetches
  the bytes, sends the PDF as a document block or the picture as an image block to
  `claude-sonnet-5-5` with a fixed JSON schema (house name, document kind, number, date, lines
  with their extended prices, tax, total, PO text, ship-to, account reference, the invoice a
  credit references, terms, the page count and whether the paper lists several invoices), writes
  the ledger row and answers the read with the file's place and what it cost. A dev may pass
  `model: 'claude-haiku-5-5'` for the comparison on the made-up set. It never writes an invoice.
  Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; the key through
  `loadModelKey`. Its `docs/EDGE_FUNCTIONS.md` section and TOC line; the dev-mcp catalog
  regenerated so `check_edge_boot` probes it.
- **The kernels (new, `src/lib/materials/bills/`, PR 2):** `billRead.ts`, the schema the function
  asks with and the answer read into fields with their sources (the shared part lives in
  `_shared/billRead.ts`, which the src file re-exports, the way `folderName.ts` re-exports
  `whereFilesGo.ts`); `billMatch.ts`, the house from the letterhead against the house the form
  is open on, the job from the PO code against the ledger (a code whose ledger row names one job
  reads exact), else the account reference against `job_supply_house_accounts`, else the ship-to
  address and job name against the jobs the form can search (a guess), the job-account tick from
  the open account row as the form does today, the credit's pair from the *RE:* number against
  this house's rows; `billChecks.ts`, the lines to the total with the tax to the cent, the
  duplicate by house and number, a statement with several invoices, a letterhead that is not this
  house; `billWords.ts`, every sentence the form shows, from the count line to the legend;
  `billFill.ts`, the fill into the form's state that never writes over a field the person typed.
  Tests over the made-up set in `src/test/fixtures/bills/`: each fixture a PDF drawn with
  `pdf-lib` from made-up data and the answer the model should give for it, so the kernels are
  tested on the answers and the two models are compared on the PDFs once the key is in.
- **The write (PR 2):** `saveInvoice` in `SupplyHousesTab.tsx` lifted into
  `src/lib/materials/supplyInvoiceWrite.ts` (the row, the signed amount, the allocations, the
  pair patch, the paid payload, now the read and the attachment) and tested, so the form keeps one
  money path whether the bill was typed or filled.
- **The screens (PR 3):** *The bill* as the form's first section in `SupplyHousesTab.tsx`, the
  picker reading this house's thread files through `billsToRecordIo.ts` (the PDFs and pictures on
  `message_attachments` whose message's contact is this house, not answered *not it*, not on an
  invoice row); the fill and the tints; the PDF pane beside the fields on `PdfPageCanvas`, a strip
  above them on a phone; *Use a Drive link instead* under Paperwork. The thread's `PaperOffers`
  gains the bill's offer for a `supply_house` contact: *Record this bill* goes to
  `/materials?tab=supply-houses&house=<id>&bill=<attachment id>`, which `Materials.tsx` hands the
  tab as `autoOpenHouseId` and a new `openBill`, and *Not a bill* writes `paper_answer = 'not_it'`
  through `answerPaper` as the W-9's *It is not* does. The house's row on the Supply houses tab
  gets *N bills to record* with *Record them*. The switch gates the picker and the doors; off, the
  form is exactly today's.
- **Roles:** the roles that see the Supply houses tab and its Add Invoice, the office (dev,
  master_technician, assistant, controller). The function refuses every other role and a
  read-only account.
- **Words and docs (PR 3):** a new guide *record a supply-house bill from its PDF* in plain
  words; the two guides above amended; `GLOSSARY.md` → Materials System (the bill's three looks,
  bills to record), `MATERIALS_TABS_ARCHITECTURE.md` (the form's new section and the tab's new
  data), `PROJECT_DOCUMENTATION.md` §11, `ACCESS_CONTROL.md` (who records a bill).

## The plan

1. **PR 1, this folder** (docs only): the card rewritten to the approved shape and
   [`mockup.html`](./mockup.html) redrawn to it, at desktop and phone width, on the card's
   made-up data.
2. **PR 2, the fill behind a switch** (one version): the migration, `bill-read` with the fixed
   schema and the daily cap, the kernels and their tests over the made-up PDFs, the write lifted
   into `supplyInvoiceWrite.ts`, the switch `bill_read_on_v1` shipping off, the function's docs
   section and the catalog regenerated. Nothing on a screen yet. The push, the deploy and the
   key are the user's steps.
3. **PR 3, the form and the two doors** (one version): *The bill* section with the picker, the
   fill, the tints, the guesses' sentences, the count line, the PDF pane and the Drive-link
   alternative; *Record this bill* and *Not a bill* on the thread; *N bills to record* on the
   house's row; the switch turned on for the office roles; the guides and the docs; this folder
   deleted.

## How to verify

PR 2: `bill-read` on a made-up PDF from the fixtures as the dev, then `read_rows` on
`supply_bill_reads`: the answer carries every field with its source *read*, the lines add to the
total, and a fixture with a wrong total comes back with the sum check failing in the kernel's
test. PR 3: on a ZZ test house, open **Add Invoice**, pick a fixture PDF under *Start from*, read
the green fields and the two amber guesses beside the paper, change one field and see it keep what
you typed, press **Save invoice**, and find the row on the house's list with **View** opening our
copy and the lines kept on the row. Forward a fixture to the team box from the owner's phone,
wait a minute, and find *Record this bill* on the house's thread and *1 bill to record* on the
house's row; mark one *Not a bill* and see the count fall. On the phone preset the picker is
first, the PDF a strip above the fields, no sideways scroll. Nothing saved on prod from a real
house's bill until the owner has looked.

## Where it stands

- 2026-10-26: the first draft, three options and the pick of A, drawn and proposed.
- 2026-10-29: Taunya's word, augment and never replace; the first redraw read as not intuitive;
  the second redraw approved. PR 1, this card and its mock-up redrawn, opened the same day.
