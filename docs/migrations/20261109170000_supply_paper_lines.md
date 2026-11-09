# 20261109170000_supply_paper_lines — every supply house bill's lines as rows (v2.6817, punch list #298 PR 1)

**File**: `supabase/migrations/20261109170000_supply_paper_lines.sql`
**Card**: `to-dos/supply-bill-lines/README.md`

## What it adds

A bill was recorded with its total, its job and a link to its PDF; the lines on the paper were rows nowhere, so the office could not ask what the company buys, how often or at what price. Two tables and one view, nothing in the app writing them yet:

| Object | What it holds |
| --- | --- |
| `supply_papers` | One row per paper a supply house sent, read from its PDF: the house, the kind (`invoice` · `credit` · `ship_ticket` · `acknowledgement` · `quote` · `bid` · `statement` · `other`), its number and date, the supplier's `order_number` that ties an acknowledgement to its tickets and bills, the PO text, where the file is (`drive_file_id` or `file_path`) and which pages, the bill's row (`invoice_id`) when the paper is a bill on file, the printed money (`subtotal_cents`, `tax_cents`, `freight_cents`, `total_cents`), which reader read it (`read_by`, `read_id` → `supply_bill_reads`, `read_at`), and `check_state`: `adds_up` when every sum holds, `off` when one does not (its lines are kept and do not count), `accepted` when a person looked and said count it anyway (`accepted_by`, `accepted_at`, `check_note`). |
| `supply_paper_lines` | One row per printed line: `line_no`, `line_kind` (`part` · `charge` · `component`), the house's own `house_code`, `mfr_number`, `description` as printed, `unit`, `qty_ordered` / `qty_shipped` / `qty_backordered` to three places, `unit_price` in dollars to four places with its `pricing_unit` (`each` · `per_hundred` · `per_thousand`), `extended_cents`, and `part_id` → `material_parts` with `matched_how` once the crosswalk matches it (empty until PR 2a). Unique on `(paper_id, line_no)`; a paper's lines go with it. |
| `supply_purchase_lines` | The one view that says what a purchase is (`security_invoker`): the lines of papers whose kind is `invoice` or `credit` and whose check is `adds_up` or `accepted`, components left out, a credit's `quantity` and `extended_cents` signed negative with `sign` beside them. Every count and chart reads this view and never the tables, so a quote or a ship ticket is never counted. |

The office roles read (`is_office_staff()`); the service role writes, since the reader and the sweep run as it. Additive and idempotent. The migration ends with the four fence appliers (read-only writes, read-only statements, digital twins, archived callers).

## Why the shape

- **The code is the key.** Every house prints its own part code, and the same fitting carries a different code at each house; the parts book (`material_parts`) crosses them. The code is held as printed, and the check kernel asks that every code the reader returned be found in the PDF's own text layer, since the four sums protect the money and not the code.
- **Prices with every decimal.** A wholesaler prices a fitting at 2.159 each and pipe at 0.286 a foot, and prints brass per C and nipples per M; a cents column would lose the arithmetic the check rests on, so `unit_price` is `numeric(14,4)` with `pricing_unit` beside it.
- **Kits.** A toilet is one priced line with its tank and bowl printed under it at no price; those are `component` lines, held so the paper reads whole, skipped by the sum and by the purchase view.
- **Every kind of paper, one view of purchases.** A ship ticket says what arrived, an acknowledgement what was ordered, a quote what was offered; only an invoice and a credit say what was bought. Holding them all in one table lets the `order_number` tie them together, and the view keeps the counts honest.
- **A paper that does not add up still keeps its lines**, so a person can look (`off`) and accept it, and nothing is read twice.

## The check (`src/lib/materials/lines/paperChecks.ts`)

`checkPaper(paper, { rowAmountCents?, text? })`, pure: (1) each counted line's quantity shipped × unit price ÷ pricing unit meets its extension within a cent; (2) the extensions sum to the printed subtotal (or, with no subtotal, meet the total with the tax and freight); (3) subtotal + tax + freight = total; (4) the printed total = the bill's row amount, by size, when the paper is a bill on file; (5) every house code of three characters or more is found in the paper's text layer when there is one, case, whitespace and dashes folded. The answer carries the state, the counted lines, their sum, every problem with its words, and the row's one line (*42 lines · adds up*). `paperFromBillRead` turns the bill reader's answer into the paper it checks.

## The reader (`supabase/functions/_shared/billRead.ts`)

`BILL_SCHEMA` now asks for the paper's own columns on every line (`line_kind`, `house_code`, `mfr_number`, `unit`, `qty_ordered`, `qty_shipped`, `qty_backordered`, `pricing_unit`), the supplier's `order_number` and a `freight` row, and four more kinds (`ship_ticket`, `acknowledgement`, `quote`, `bid`); `readBillAnswer` keeps the unit price whole in `unitPrice` beside the rounded `unitPriceCents`. An older answer still reads: every new field has its empty value. The Add invoice window is unchanged, since it fills from the kind, the number, the date and the total alone, and treats every kind but `credit` as an invoice (`billMatch`).

## What is not here yet

PR 2 reads the PDF a bill's row links and writes these rows: the service account must first be able to open the bills folder in Drive (the owner shares it with the app's account or moves it to the Shared Drive). PR 2a is the crosswalk from `house_code` to the parts book; PR 3 the screen (*What we buy*). Until then the tables are empty and the view answers nothing.

## Deploy

`supabase db push` after the merge. Nothing calls the tables before PR 2, so the order against the Pages deploy does not matter. The widened reader schema takes `bash scripts/deploy-functions.sh bill-read` (and `dev-mcp`, whose catalog names it) when it is next deployed; the old client reads the new answer's extra fields without harm.
