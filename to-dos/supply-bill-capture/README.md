---
name: "Supply-house bill capture: a bill drafted from the forwarded PDF, approved by a person"
number: 179
group: gated
status: proposed 2026-10-26 · the mock-up is drawn · waiting on the owner's pick and five calls
summary: >
  Every supply-house bill is typed today. The office finds the PDF in the mail, saves it to Drive,
  opens Materials → Supply houses, expands the house and types nine fields the paper already
  prints, then pairs the credit by hand. Jobber, Buildertrend, ServiceTitan and BuildOps read the
  PDF and draft the bill for a person to approve. Three ways to do that here, drawn with made-up
  paper: A a Bills inbox on Materials fed by the box the app already reads, one card per PDF with
  every drafted field marked read or guessed and one Approve that writes the invoice as the form
  would, the ones the reader could not settle held with a reason and a door; B no inbox, an Add
  from a PDF press on today's form that fills the fields for the person to check and save; C is A
  with purchase-order matching, the differences line by line and the PO closed on approval. The
  pick is A, built with B as its first PR.
next: The owner picks A, B or C and answers the five calls under Decisions, then PR 2 (the reader and the drafts table).
size: L as a train of four PRs (S · M · M · S); C adds an M later
blocker: The owner's pick. A model key as a function secret, the first in any edge function.
ver: proposed
opinion: build A — the PDF is already in our bucket and the write is the form's own, so the only new thing is the reading, and every field says where it came from before anyone presses Approve
---

# Supply-house bill capture: a bill drafted from the forwarded PDF, approved by a person (#179)

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

So this is screens, not prose: [`mockup.html`](./mockup.html) draws today's form beside three
afters, at desktop and phone width, with every drafted field saying where it came from. The
owner needs to see the trust model, not just the screen.

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
  contact kind (`supply_house`, `contacts/names.ts`), so a house's mail lands on the house's thread,
  and a bill the assistant forwards lands on the house too, with her note as a team note
  (`forwarded.ts`). So a bill emailed or forwarded to a box the app reads is already a PDF in our
  bucket on the house's thread. Nothing reads it.
- **The guess-and-answer pattern.** `message_attachments.paper` is the reader's guess that a
  trade partner's file is a W-9 or a certificate, read from the file's name alone
  (`paperGuess.ts`); `paper_answer` is the office's *filed* or *not it*, stamped by a trigger. The
  thread offers *File this as their certificate* and the app never files a paper by itself.
  That is the trust model this proposal extends: a guess is marked, a person answers, the app
  writes on the answer.
- **How a PDF names its job.** The PO Generator mints a five-digit counter code per job and tech
  (`material_po_generator_entries`, [`GLOSSARY.md`](../../docs/GLOSSARY.md) → PO Generator ledger).
  A job account at a house carries the house's own reference for the job
  (`job_supply_house_accounts.account_ref`, v2.3423). The form already parses a code out of
  whatever the house printed (`parsePoGeneratorCodeFromPurchaseOrderName`) and reads it against the
  ledger, and lists a job's codes near the date when the house printed the job name instead.
- **Purchase orders to match against.** `purchase_orders` with `purchase_order_items`
  (`supply_house_id`, `price_at_time`, `price_confirmed_at`, status draft or finalized), the
  line-item lane from PO Builder, Takeoffs by stage and the Parts Tally. Most counter buys carry
  a PO Generator code and no line-item PO.
- **Plan, then apply.** The dev MCP's cost batches are a dry run first, a `plan_hash` over the
  payload and the before-image, then an apply that re-runs the dry run and writes only when the
  world still answers the same ([`devMcpWrites.ts`](../../supabase/functions/_shared/devMcpWrites.ts),
  [`docs/COST_BATCHES.md`](../../docs/COST_BATCHES.md)). The house pattern for a draft a person
  approves.
- **One card, one press.** The Needs you Fill them in deck (v2.5774, `NeedsYouFillInDeck.tsx`
  over `lib/needsYou/fillIn.ts`) and the Physical inbox deck (v2.5818) are the shape: one row at
  a time, what the app knows in short sentences, the fields, **Save and next**, **Skip**, a trail
  with **Undo**, an end card with the counts.
- **Do what is ready, never all or nothing.** A batch acts on what is clean, lists what it held
  with the reason and its door, and its button says exactly what it will do (v2.5533, `CLAUDE.md`).

## The mock-up

[`mockup.html`](./mockup.html), served at `/to-dos/supply-bill-capture/mockup.html`. Section 0 is
the form as it is today at desktop and phone width with each typed field marked. A, B and C each
draw a desktop frame and a phone frame. A's presses work: Approve writes the card off the deck
and the bar counts, a held card's door makes it ready, **Approve the 4 ready** takes the clean ones
and lists the held. B's **Read it** fills the form with the marks. C's lines show the differences.
Every house, job, person, number and amount is made up: Ridgeway Supply, Cedar Bend Pipe &
Supply, Hill Country Pipe & Supply, jobs J1031, J1042 and J1057, Marisol the assistant, Todd and
Marcus the techs.

**The marks**, the same on every option: **● read** in green, the value is on the paper and the
reader is quoting it; **◐ guessed** in amber, with what it was guessed from, the app worked it
out and a person should look; **○ typed** in blue, a person changed it. A guess is never written
silently. Approve writes what is on the card, whatever the marks, and the row keeps which fields
were read, guessed and typed, so a wrong guess can be found later.

## Options

### A · A Bills inbox on Materials (the pick)

**The first screen.** A **Bills in · 4 ready · 2 held** line at the top of the Supply houses tab,
and a Bills inbox section under it, one card per PDF the reader has drafted, newest first. Each
card is the PDF on the left, its first page drawn, and the drafted fields on the right: the house,
Invoice # or Credit #, the date, the total with the lines under it, the PO text, the job, the due
date, the job-account tick, and the file. Every field carries its mark and, on hover or a press,
the why: *● read from the PDF · "INVOICE S1183420"*, *◐ guessed · the sender ar@ridgeway.example
is Ridgeway Supply's email on file*, *● read · PO 41207 is on the ledger for J1042 · Todd · Oct 21*.
One **Approve** per card. The bar's **Approve the 4 ready** takes every card that is ready and lists
the two held with their reason.

**Where the bills come from.** The box the app reads: a house that emails its invoices lands them
on its own thread, and the assistant forwards the rest from her mailbox with one press. `gmail-sync`
copies the file today; the new part is a hook after the copy. A PDF or a picture on a line whose
contact is a supply house, or on the bills box if the owner wants one, is sent to the reader. The
assistant's note on a forwarded bill, *this is J1057's*, is kept on the card.

**What the person still types.** Nothing on a clean card. A job on a card that names none. A
second job and the split, which the paper never says. A house the app does not know, once. The
due date when the paper's terms beat the house's payment day.

**What is read and what is guessed.** Read: the kind, the number, the date, the lines, the tax,
the total, the PO text, the ship-to, the job-account reference the house printed, a credit's
*RE: invoice* line. Guessed: the house from the sender's address against `supply_houses.email`
and the reps' emails, or from the letterhead when the sender is one of us forwarding; the job
from the PO code against the ledger (read, when the code is on the ledger and its job is one),
else from the account reference against `job_supply_house_accounts`, else from the ship-to
address and job name against the jobs ledger (guessed); the due date from the house's payment
day as the form does today; the job-account tick from the open account row as the form does
today; a credit's pair from the invoice number it references, else the same job within sixty
days. The reader never guesses a total: the lines must add to it, with the tax, to the cent.

**A bill the reader gets wrong.** Four checks hold a card before anyone sees Approve lit:
*No job named* with a job search on the card and the codes minted for the tech that week as
picks; *The lines add to $1,248.10 and the total reads $1,284.10* with both figures as presses;
*A house we do not know: Hill Country Pipe & Supply* with **Add the house** and **It is one of
ours ▾**; *Looks like one we have: S1183420 · Oct 3 · $1,284.10* with **Open it** and **Not the
same**. A statement, several invoices in one PDF, is held as *a statement, not a bill* with the
invoices it lists, each a press to draft on its own. A wrong guess that passed the checks is the
person's to catch on the card, which is why a guessed field is amber and says its source. After
Approve, **Undo** on the trail deletes the row the way the form's Delete does, and the card comes
back. A card nobody wants is **Not a bill**, which marks the attachment and keeps the thread.

**How a credit is paired.** A CREDIT MEMO reads as a credit; its *RE:* or *original invoice*
line names the invoice, matched against this house's rows, and the card shows the pair and the
form's own sentence: *Takes $888.10 off what we owe Ridgeway Supply, and $888.10 off J1042's parts
cost.* A credit that names no invoice is guessed by job and date, or stays *Not paired yet* with
the pick on the card. Approve writes `credits_invoice_id` as the form does, and the pair guard
holds it to the same house.

**Do what is ready.** The bar says *4 ready · 2 held*. **Approve the 4 ready** writes the four and
lists the two held with their reason and door. The button is dead only when nothing is ready. A
hold on one bill never stops the rest.

**What it costs to build.** M to L, four PRs. A migration for `supply_bill_drafts` (one row per
attachment: the read JSON, each field's value and source, the matches, the checks, the state
ready · held · approved · not_a_bill, the invoice it became) with RLS for the office roles and
the three block calls. A new edge function `bill-read`: it fetches the file from the bucket, sends
it to the model and stores the draft. **The reading itself is a model call**: Claude through the
Messages API, the PDF as a document block or a photo as an image block, the answer forced into a
fixed shape with a tool schema (house name, number, date, kind, lines, tax, total, PO text,
ship-to, account reference, referenced invoice), so the function never parses prose. It needs an
`ANTHROPIC_API_KEY` as a Supabase secret, the first model key in any edge function (the robots are
Claude sessions that call twin-mcp, the other direction), and about a cent a page on
`claude-haiku-5-5`, a few cents on `claude-sonnet-5-5`; the read is one call per PDF, run once. The
matching, the checks and the draft's words are pure kernels with tests, no model: `billRead.ts`
(the answer to a draft), `billMatch.ts` (the house, the job, the pair), `billChecks.ts` (the sum,
the duplicate, the statement). The write is the form's own, lifted into `supplyInvoiceWrite.ts`
so the form and the inbox share one money path, which the Materials map already lists as the
untested one. The hook in `gmail-sync` is a dozen lines after the copy. The inbox is one component
in the Fill them in deck's shape. Docs, a guide, a release note per PR.

Is this the best we can do? Every field says where it came from, a guess is never written
silently, Approve is a person's press, and the write is the form's own, so Job Summary, Held for
suppliers, the aging heat map and the Lien desk read an approved draft exactly as a typed
invoice. The PDF is already in our bucket under a scope Google already granted, so no new
permission. The lines are kept, which today's form throws away, so a later PR can show what a
job's parts cost at a house and when a price moved. The risks are named: a misread digit is caught
by the sum check, a re-forwarded bill by the duplicate check, and a wrong job is the one that can
pass, which is why the job is amber unless a code or an account reference read exact. Left out on
purpose: approving a card with no person (a later owner call, once the drafts show how often the
reader is right), reading paper from the tray (a **Scan** press on the Physical inbox deck is a
small later PR that feeds the same function), paying the bill, and matching the bank charge
(`mercury_transaction_supply_house_invoice_links` already links a card charge to an invoice).

### B · Add from a PDF on today's form

**The first screen.** Today's **Add invoice** window with one new press at the top: **Add from a
PDF**. Drop the file, pick it, or paste the Drive link and press **Read it**. The reader fills the
fields in place, each with its mark, the PDF opens beside the form, and the person checks and
presses **Save invoice** as today. The file is kept in our bucket and becomes the row's link, so
the Drive step ends.

**What the person still types.** The house, since the form opens from the house. The job when
the paper names none. The split. Anything the person disagrees with, by typing over it, which
turns the mark blue.

**What is read and what is guessed.** The same reader, the same marks. The house is not guessed:
the form knows it. A paper whose letterhead is not this house gets a red line, *This reads as a
bill from Cedar Bend Pipe & Supply, not Ridgeway Supply*.

**A bill the reader gets wrong.** Nothing is written until Save. The person sees the field beside
the paper and retypes it. The sum check and the duplicate check show as the form's existing hint
lines, in red, and Save still works, as it does today for a code not on the ledger.

**How a credit is paired.** The kind switches to Credit when the paper reads CREDIT MEMO and the
**Credits invoice…** pick is guessed from the referenced number, marked guessed.

**Do what is ready.** One paper at a time. The form is the bar.

**What it costs to build.** S to M, two PRs. The same `bill-read` function and the same model key
and kernels, a storage upload from the form, the fill with marks, no new table (the read is kept
on the row as a jsonb of sources, or not at all). It is A's PR 2 and PR 3 with no inbox.

Is this the best we can do? No. It reads the paper, but the person still carries it: finds the
mail, saves the file, opens the house, presses the button, one bill at a time. The box the app
already reads stays unread. It changes nothing until someone acts, which is its virtue, and it is
the right first PR of A, because every read is checked by a person on a familiar screen before an
inbox collects anything.

### C · A, plus purchase-order matching

**The first screen.** A's inbox. A card whose house has a finalized purchase order open within
thirty days, with no invoice on it yet, shows **Matches PO 2026-0412 · 3 of 5 lines agree** and,
unfolded, the lines side by side: the PO's part, quantity and `price_at_time` against the bill's,
a difference in amber (qty 12 for 10, $48.10 for $46.90), a bill line not on the PO in red, a PO
line not on the bill in grey. **Approve** writes the invoice as in A and also closes the PO: a
`received_at`, the invoice's id, and the agreeing lines' `price_confirmed_at` stamped, so the Parts
Book's price confirmation (`materialPOUtils.ts`) reads the bill as the confirmation.

**What the person still types.** As A. On a match, nothing more; the differences are read, and
a person decides whether a price that moved updates the Parts Book, a second press, never
automatic.

**What is read and what is guessed.** As A. The match itself is guessed from the house, the
date and the PO text, and marked so, with the PO's lines as the evidence.

**A bill the reader gets wrong.** As A. A match to the wrong PO is **Not this PO ▾** on the card,
which lists the house's other open POs or *no PO*, and Approve then writes the invoice alone.

**How a credit is paired.** As A. A credit never closes a PO.

**Do what is ready.** As A. A card with a match that has differences is still ready: the
differences are facts, not holds. Only the four checks hold.

**What it costs to build.** A plus M: three columns on `purchase_orders`, a `billPoMatch.ts`
kernel and tests, the lines screen, and a decision on what *open* means for a PO, which today
has no received or closed state.

Is this the best we can do? It is ServiceTitan's shape and the one with the most value per bill
when a line-item PO exists, because it is the only place a price moving is seen on the day. But
most counter buys carry a PO Generator code and no line-item PO, so C's match fires on a minority
of cards and the rest are A. Build A, keep the lines on the draft, and add the match when the
drafts show how many cards have a PO to match. Nothing is re-read.

### Side by side

| | Today | A · Bills inbox | B · Add from a PDF | C · A with PO matching |
|---|---|---|---|---|
| The first screen | the house, then **Add Invoice** | the inbox: one card per PDF | today's form with **Add from a PDF** | A's inbox with the PO's lines on a matched card |
| What is typed on a clean bill | seven fields, a search, a link | nothing | the house is the form's; the rest checked | nothing |
| Where the PDF comes from | Drive, by hand | the box the app reads, or a forward | a drop, a pick or a link | as A |
| Where the scan link goes | a Drive URL typed under Paperwork | our bucket, the row's link | our bucket, the row's link | as A |
| A wrong read | a wrong row, found later | held with a reason and a door, or amber on the card; Undo after | retyped before Save | as A, plus **Not this PO** |
| A credit | the same form, the pair picked by hand | drafted as a credit, the pair read from *RE:* | the kind switches, the pair guessed | as A |
| Do what is ready | one at a time | **Approve the N ready**, the held listed | one at a time | as A |
| The lines | never recorded | kept on the draft | kept on the row | compared to the PO |
| Cost | — | M to L, four PRs | S to M, two PRs | A plus M |

## Decisions for the owner

1. **Which option:** A, B or C. The recommendation is A, built with B as its first visible PR.
2. **Which box.** The team box the app reads today, so a house's bills land on its own thread
   and the assistant forwards the rest; or a bills box of its own that houses are told to email
   directly, which keeps bills off the Messages page. A third box is one `readerBoxes.ts` row and
   a dev-typed setting today, since no Settings card holds the addresses yet. The recommendation
   is the team box first, and a bills box when the owner has told a house to use it.
3. **The batch press.** Whether **Approve the N ready** exists at all, or every card is approved
   one at a time. The recommendation is the batch press, with *ready* meaning every field read or
   guessed with the four checks clean, which is *do what is ready* as the rule reads.
4. **Where the PDF lives after approval.** Our bucket, served to the office team as the thread
   serves it, so the Drive upload ends; or copied to the Drive AP folder as well. The
   recommendation is the bucket, with the Drive copy as a later toggle if the office misses it.
5. **The model and the key.** `claude-sonnet-5-5` for the read, with `claude-haiku-5-5` tried on
   the same test set, the key as a Supabase secret, and a cap of so many reads a day in the
   function. The cost is cents a bill. The owner adds the key; nothing in the repo holds it.

## Where it plugs in

- **The table (new):** `supply_bill_drafts`: id, `attachment_id` → `message_attachments`,
  `supply_house_id` (nullable until known), `read` jsonb (the model's answer as given, never
  edited), `fields` jsonb (each field's value, source `read` · `guessed` · `typed`, and the why),
  `job_matches` jsonb, `checks` jsonb (sum, duplicate, statement, house), `state` (`ready` ·
  `held` · `approved` · `not_a_bill`), `held_reason`, `invoice_id` → `supply_house_invoices`,
  `approved_by`, `approved_at`, `model`, `read_at`. One additive migration with `lock_timeout`,
  RLS for the roles that see the Supply houses tab, the three block calls at the end,
  `docs/migrations/<version>_supply_bill_drafts.md`.
- **The function (new):** `supabase/functions/bill-read/`: `POST { attachment_id }` from
  `gmail-sync`'s hook or a dev; reads the file from `message-attachments`, calls the model with
  the fixed tool schema, runs the kernels, writes the draft. Secrets: `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`. Its `docs/EDGE_FUNCTIONS.md`
  section and TOC line; the dev-mcp catalog regenerated so `check_edge_boot` probes it.
- **The hook:** in `gmail-sync` after `email_write_line`, for a file whose mime is a PDF or a
  picture on a line whose contact kind is `supply_house`, or on the bills box: one call to
  `bill-read`, best effort, never stopping the run.
- **The kernels (new, `src/lib/materials/bills/`):** `billRead.ts` (the schema and the draft's
  fields with sources), `billMatch.ts` (the house from the sender or the letterhead, the job
  from the code, the account reference, the ship-to; the credit's pair), `billChecks.ts` (the sum
  to the cent, the duplicate by house and number, a statement, an unknown house), `billWords.ts`
  (the card's lines, the held reasons, the bar's words), each with tests. Mirrored into
  `_shared/gcKernels/` by `scripts/edge-kernels.mjs` for the function.
- **The write:** `saveInvoice` in `SupplyHousesTab.tsx` lifted into
  `src/lib/materials/supplyInvoiceWrite.ts` (the row, the signed amount, the allocations, the
  pair patch, the paid payload) and tested; the form and the inbox call it.
- **The screens:** `BillsInbox.tsx` under `src/components/materials/` in the Fill them in deck's
  shape (the bar, the cards, Approve, Undo, the held doors, the end card); the Supply houses
  tab mounts it over Accounts payable for the office roles. Under B, `Add from a PDF` on the form
  and a `BillPdfPane`. Under C, `BillPoMatch.tsx` and three columns on `purchase_orders`.
- **The PDF:** drawn from the bucket with the pdf.js assets the build already copies
  (`dist/pdfjs/`), first page on the card, the whole file on a press.
- **Words and docs:** a guide *approve a supply-house bill from the inbox* (plain words); the
  two guides above amended; `GLOSSARY.md` → Materials System (a Bills inbox entry, the marks),
  `MATERIALS_TABS_ARCHITECTURE.md` (the tab's new region), `PROJECT_DOCUMENTATION.md` §11,
  `ACCESS_CONTROL.md` (who approves), `docs/twins/APP_DIRECTORY.md` if the inbox gets a path of
  its own.

## The plan

1. **PR 1, this folder** (docs only).
2. **PR 2, the reader** (one version): the migration, `bill-read` with the tool schema, the four
   kernels and their tests over a set of made-up PDFs in `src/test/fixtures/bills/`, the hook in
   `gmail-sync` behind a switch `bill_read_on_v1` that ships off, the function deployed, the key
   added by the owner. Nothing on a screen yet; `read_rows` on the drafts table shows the reads.
3. **PR 3, Add from a PDF** (one version, B): the form's press, the upload, the fill with marks,
   the lifted write. The first screen a person sees, one bill at a time, every field checked.
4. **PR 4, the inbox** (one version, A): the bar, the cards, Approve, Undo, the held reasons and
   doors, Not a bill, the guide, the switch turned on for the office.
5. **PR 5, the batch** (one version): **Approve the N ready**, the end card, the daily cap's words.
6. **Later, C:** the PO match, once the drafts say how many cards have a PO.

## How to verify

PR 2: `bill-read` on a made-up PDF from the fixtures as the dev, then `read_rows` on
`supply_bill_drafts`: every field's source is `read` or `guessed`, the sum check passes, and a
PDF with a wrong total is held with the reason. PR 3: on a ZZ test house, press **Add from a
PDF** with the fixture, read the marks beside the paper, change one field and see it turn blue,
Save, and find the row on the house's list with **View** opening our copy. PR 4: forward the
fixture to the team box from the owner's phone with a note, wait a minute, open Materials →
Supply houses and read the card with the note on it; Approve it on the ZZ house; open Job
Summary's Parts Cost for the ZZ job and find the line; press Undo and find it gone. PR 5: two
clean cards and one held, press **Approve the 2 ready**, read the held one listed with its
reason. On the phone preset one card is one screen, the PDF a strip at the top, Approve at the
bottom, no sideways scroll. Nothing approved on prod from a real house's bill until the owner
has looked.
