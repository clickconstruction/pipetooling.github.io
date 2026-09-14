# Demand letter, itemized — the letter reads the bill, and carries it as Exhibit A

Status: **not started** · planned 2026-09-14 · 3 owner decisions + 3 attorney questions open (below) · mock-up: [`mockup.html`](./mockup.html) (today on job 867, the law, Draft A, the critique, Refined B, the plan; also a Claude artifact 2026-09-14) · surface: Lien instruments → Demand letter (`LienInstrumentsModal`, `src/lib/jobsDocuments/demandLetter.ts`, v2.2640)

## The ask, in the owner's words

> I am seeing on these pages that this may be confusing on the demand letter, should we have it match the line items more? Please research the law, also we'll need to attach the unpaid invoice to the demand letter and that should show up here.

Seen on job 867 (Service Visit — 628 Terrell Rd): the letter's *Details of Debt* read "Service provided: Service Visit — 628 Terrell Rd (HCP 867) · Invoice total $1,710" under "Invoice #1c915885", while the bill the customer got read "Service Visit (HCP #867) Additional gas install and sidewalk bore under patio · Qty 1 · $1,710.00", Invoice #867-2608180928, to RMC- Dudley Mason.

## The reading (code)

- `buildDemandLetterPrefill` (`demandLetter.ts`) fills `serviceDescription` from `job.job_name` and `invoiceNumber` from `hcp_number` else the first eight characters of the invoice row's id — the "#1c915885". The debt block is four free-text fields (`Service provided / Invoice total / Payments received / Outstanding`), all editable, none read from the invoice's line items.
- The recipient (`LienInstrumentsModal.tsx` ~line 322) is the covered line's `bill_to_name` else the job customer. It does not use `effectiveInvoiceParty` (`supabase/functions/_shared/billToParty.ts`), the who-pays rule the bill itself used — so on 867 the bill went to the GC and the letter addressed the homeowner.
- The invoice already has a document model and PDF: `buildPhysicalInvoiceDocument` (`src/lib/physicalInvoiceDocument.ts`: `invoiceNumberDisplay`, service/material lines, payment history, memo, dates) and `buildPhysicalInvoicePdfBlob` (`physicalInvoicePdf.ts`). `pdf-lib` is a dependency (used by `testReportPdfLib.ts`), so the letter PDF and the invoice PDF can be merged into one file.
- `job_demand_letters` already has `invoice_ids`; the letter is record-only (no edge function), by the v2.2640 "keep the legal path physical" reading. The § 53.056 notice, by contrast, emails through `send-lien-filing-email`.
- The deadline defaults to +10 business days (`addBusinessDays`), a number borrowed from Penal Code § 31.04, whose line is switched off.

## The reading (law) — verified against the statute text 2026-09-14

| Rule | What it asks of the letter | Cite |
|---|---|---|
| Sworn account | The account must show "with reasonable certainty the name, date, and charge for each item" with all payments and credits allowed; itemized billing statements + affidavit satisfy it. The letter's debt section should be that record and the invoice should ride along. | Tex. R. Civ. P. 185; *Panditi v. Apostle*, 180 S.W.3d 924, 926 (Tex. App.—Dallas 2006) |
| Attorney's fees | Fees on a claim for services / labor / materials / sworn account / contract need the claim *presented* and unpaid 30 days after. No form; a letter stating the debt and asking for payment is presentment. | CPRC § 38.001(b), § 38.002; *Jones v. Kelley*, 614 S.W.2d 95 (Tex. 1981) |
| Excessive demand | Demanding more than is owed (or refusing tender of the true amount) forfeits fees. Demand the bill's exact balance. | *Findlay v. Cave*, 611 S.W.2d 57 (Tex. 1981) |
| Debt collection | Binds the original creditor, for a *consumer* debt (a homeowner, not a GC). Forbids threatening a criminal charge over a payment dispute, threatening an action prohibited by law, collecting interest/charges not authorized by agreement or statute, misrepresenting the amount, saying fees "will" be added. Threatening civil suit or a lien is expressly permitted. | Fin. Code § 392.001, § 392.301(a)(2),(6),(8), (b)(2), § 392.303(a)(2), § 392.304(a)(8),(12),(13) |
| Interest basis | Prompt Payment covers every contract to improve real property — **no residential owner–contractor carve-out** (§ 28.003 is only the good-faith-dispute withholding rule). A written payment request is due by the 35th day; from the day after, 1.5 % a month; fees at the court's discretion. Fallback with no written request: the legal rate, 6 % a year from the 30th day after due. | Prop. Code § 28.001, § 28.002(a), § 28.003, § 28.004, § 28.005; Fin. Code § 302.002 |
| Who is demanded of | The demand goes to the party in contract. On a GC job the owner gets the § 53.056 form notice (which may include the invoice, (a-3)) and may withhold from the GC (§ 53.081); the old § 53.083 demand to the owner was **repealed** for contracts from 2022-01-01. | Prop. Code § 53.056(a-2),(a-3), § 53.081, § 53.084; HB 2237 (87th Leg.) § 36(8) |
| Theft of service | The presumption of intent needs a written demand by certified/registered mail RRR or commercial delivery to the address on the service agreement, unpaid 10 days after receipt. Stays off until the attorney package. | Penal Code § 31.04(a)(4), (b)(2), (c) |
| Justice court | Claims to $20,000 exclusive of interest. | Gov't Code § 27.031(a)(1) |
| Delivery | Certified mail is required only for chapter 53 notices (§ 53.003) and the § 31.04 presumption; for presentment it is optional but evidentiary. | Prop. Code § 53.003 |

Unverified: TRCP 500.3's treatment of fees in the justice-court amount; the Texas Supreme Court on ch. 392 reaching original creditors (the Fifth Circuit's *Miller v. BAC*, 726 F.3d 717, does).

## The decision (Refined B in the mock-up)

Three changes of principle:

1. **The debtor and the debt come from the invoice and are not editable on the letter.** Recipient = `effectiveInvoiceParty` of the covered invoice(s), shown as *Who owes it · from the bill*; on a GC job the block says the homeowner gets the § 53.056 notice instead, with the door to the Lien desk. The debt block is a *statement of account* — one block per invoice: display number, sent/due dates, each line (qty · description · amount), payments and credits, balance; a total when several. Something wrong → **Fix the bill ›**; the letter re-reads. (Rule 185 record; *Findlay* exact-amount rule.)
2. **The invoice is always Exhibit A, and the preview shows it.** The app's physical-invoice PDF, stamped EXHIBIT A, merged behind the letter with pdf-lib — one file, one print, page count in the footer. Optional Exhibit B (the signed agreement when one exists) and Exhibit C (the delivery record: sent / opened / re-sent). The letter's enclosure line names them.
3. **Every legal line names its basis or is not offered.** The 30-day fee-clock sentence with its date, always on ("we will seek", never "will be added"). Interest from the facts: the agreement's rate → § 28.004 (1.5 % a month from the day after the 35th day after the bill was received; owner or GC) → § 302.002 (6 % a year) only when no written request exists. The lien line only while the filing window is open and the property is not a homestead, with the reason shown when greyed. "Justice court" with the limit. § 31.04 stays off.

Plus **Email with the PDF…** as a second channel, certified mail still the default and the modal says why. The record gains `debtor_party`, `exhibits jsonb`, `fee_clock_date`, the interest basis; `invoice_ids` always set; the Legal desk's Paper tab reads them.

Rejected: Draft A (an editable table of lines + an "attach invoice" checkbox — still demands from the wrong party, still lets the letter drift from the bill, still lets a letter go out without its evidence); a per-letter free-text charge (goes on the bill first); the Stripe-hosted rendering as the exhibit (not a document the app can print; the physical PDF has the same rows).

## Where it plugs in

| Exists | New |
|---|---|
| `demandLetter.ts` (block model, print/PDF/email HTML, prefill), `LienInstrumentsModal` demand tab, `job_demand_letters` (+ `invoice_ids`), `useDemandDeadlinesNudge` + the `demand-deadline` card, `physicalInvoiceDocument.ts` + `physicalInvoicePdf.ts`, `pdf-lib`, `billToParty.ts` / `_shared/billToParty.ts` (`effectiveInvoiceParty`), `lienDeadlines.ts` (`filingDeadlineForMonth`), `lienProperty.ts` (homestead, kind), `legalPacket.ts` (demand letter lines), `send-lien-filing-email` (the pattern), guide *send a final demand letter* | statement-of-account blocks + a `DemandStatement` type; recipient from the invoice party; the exhibit merge (`demandLetterPacket.ts`); migration `job_demand_letters` + `debtor_party`, `exhibits`, `fee_clock_date`, `interest_basis`; the guarded legal lines; edge function `send-demand-letter-email`; the rewritten guide |

## The plan

1. **PR 1 — the letter reads the bill.** Statement blocks from the invoice document model (one invoice, two, credits, a discount line — tests); recipient from `effectiveInvoiceParty` with the notice pointer on GC jobs; the display invoice number; the four free-text debt fields retired. Client only.
2. **PR 2 — Exhibit A, always.** Invoice PDF via the existing renderer, EXHIBIT A stamp, pdf-lib merge, preview page, page counts; Exhibits B and C as extras; migration (`exhibits`, `debtor_party`; `invoice_ids` always set); Documents → Jobs lists the letter with its exhibits.
3. **PR 3 — every line names its basis.** Fee-clock sentence + `fee_clock_date`; interest basis by the facts; the lien line guarded by window + homestead; "justice court"; the Legal desk reads the new fields. Small migration.
4. **PR 4 — Email with the PDF.** `send-demand-letter-email` on the notice's pattern (letter + exhibits as one attachment, Resend id as tracking), recorded as a send with method `email`; `docs/EDGE_FUNCTIONS.md`; the guide rewritten; a line in *understand how liens work…*.
5. **PR 5 — the invoice on the notice too.** § 53.056(a-3) lets the notice include the invoice: the same Exhibit A machinery on the notice tab and in the Lien desk run packet.

Each PR: release note + `docs/recent-features/` fragment; `GLOSSARY.md` for *statement of account* / *Exhibit A*.

## Open decisions

- **The deadline** (owner): keep 10 business days as the pay-by and state the 30-day fee clock beside it (proposed), or make the one deadline 30 days?
- **Email from the app** (owner): add it as a second channel, certified mail the default (proposed), or keep the demand letter record-only?
- **The homeowner on a GC job** (owner): demand goes to the GC and the owner gets the notice (proposed, per the statute), or keep a switch to address the owner?
- **For the attorney:** does the bill count as chapter 28's "written payment request" on a homeowner job (so 1.5 % a month applies there too, and from which day); should the ch. 38 sentence be on every letter; the § 31.04 line (and whether the letter should meet § 31.04(c) delivery so the presumption is available if ever needed).

## How to verify

Dev login → Jobs → Pipeline → Billed → job 867 → orange lien icon → Demand letter: the recipient reads RMC- Dudley Mason with the notice pointer; the statement shows Invoice #867-2608180928 with the gas-install line and $1,710.00; the preview is three pages with EXHIBIT A on page 2; Download PDF yields one file; Save & record send writes the row with the invoice id, the exhibits and the fee-clock date; Documents → Jobs lists it with its exhibits. A job whose only bill was never sent reads 6 % a year under § 302.002; a homestead greys the lien line with the reason. Prod-safe until Save & record send — use a TEST job for the live pass and void the record after.
