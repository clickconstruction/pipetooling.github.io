---
name: "Accounting export: Banking's month in a file QuickBooks reads"
number: 161
group: gated
status: proposed 2026-10-24 from the trade ERP comparison (gap 1 of 9) · waiting on what the CPA needs
summary: >
  Banking's labels and rules are the company's books, and nothing leaves the app for an accounting
  system. Fourteen of the fifteen trade apps compared on 2026-10-24 sync with QuickBooks. The
  smallest useful version is a monthly export from Banking, built from Banking's own labels and
  pressed by the money team, in a shape QuickBooks Online imports. A push through QuickBooks'
  API comes later, and only if the CPA wants the books daily.
next: The owner asks the CPA which file they want (bank lines per account, or a month's journal entry) and whether they need it monthly or daily; then a mock-up of the export window.
size: M as a train of three (S · S · S); one migration (the label to ledger account map)
blocker: What the CPA needs.
opinion: build A or B, whichever the CPA asks for; C only if the CPA wants daily books
---

# Accounting export: Banking's month in a file QuickBooks reads (#161)

## The ask

The owner, 2026-10-24, after a research plan to compare the app with other trade ERP apps
("compare our app to other ERP apps on the internet for Pluming, Electrical, and HVAC") and a run
of research agents over fifteen of them: *"Draft to-dos in the repo for the top five gaps, each
with its smallest useful version, as one docs PR."* The owner weighted this gap medium (2 of 3; the
suggestion was 3). Its gap is 2, so it scores 4, tied with #162 and #163, and comes first on the
tie-break because the most vendors are strong on it.

This is a proposal. Nothing here is built until the owner picks.

## What the comparison found

- Fourteen of fifteen vendors treat accounting sync as standard. ServiceTitan syncs with
  QuickBooks Online and Desktop, Sage Intacct, Xero and NetSuite, and pushes journal entries every
  few minutes for QuickBooks Online. Knowify and Contractor Foreman run a two-way QuickBooks Online
  sync. Procore has native connectors for many ERPs.
- Successware is the exception. It keeps its own general ledger on purpose, as we do today.
- Sync is also one of the complaints reviewers repeat: sync errors, double exports, duplicate
  customer lists and invoice-number clashes from one-way syncs. A file a person presses and checks
  avoids most of that.

## Today

- **Banking is the books.** Every Mercury line is labeled in Banking (`mercury_transactions`,
  the labels in `mercury_drag_sort_labels`, the rules in `mercury_accounting_label_rules`;
  [`BANKING_TABS_ARCHITECTURE.md`](../../docs/BANKING_TABS_ARCHITECTURE.md)). Who may label is
  ACCESS_CONTROL's *Banking attributors*.
- **QuickBooks reaches us one way only.** Banking reads a QuickBooks register CSV in
  ([`MercuryImportCsvModal.tsx`](../../src/components/banking/MercuryImportCsvModal.tsx) over
  [`parseBankingImportCsv.ts`](../../src/lib/parseBankingImportCsv.ts)), so the column shape is
  known. Nothing goes out.
- **Stripe** bills and payments live on `jobs_ledger_invoices`; the deposits land in the Mercury
  feed as lines like any other.
- `docs/BIDS_SYSTEM.md` lists a QuickBooks export of won bids as an idea, not a plan.

## The decision (open)

What the CPA needs decides the shape:

- **A. Bank lines per account.** One CSV per Mercury account per month in the shape QuickBooks
  Online's bank upload reads (date, description, amount), each line's account named from its
  label. The CPA uploads and accepts.
- **B. One journal entry per month.** One CSV of debits and credits, one line per label and
  account, that the CPA imports as a journal entry. Less for the CPA to click, more to get right.
- **C. A push through QuickBooks Online's API.** An OAuth connection, the token kept in Vault,
  an edge function that sends the month (or the day). This is what the vendors do, and what their
  reviewers complain about. Only if the CPA wants the books daily.

Either A or B needs the same new piece: a map from each Banking label to a ledger account name.

## The smallest useful version

1. A **map** from each Banking label to the ledger account the CPA uses, kept in one table and
   filled once by the money team.
2. An **Export the month** press on Banking, for the money team: pick the month, get the file.
3. The export **sends what is ready**: every labeled line goes in the file; an unlabeled line, or
   one whose label has no account yet, is listed under the press with its reason and a door to
   label it, and the press says how many lines it will write.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The month's lines and labels | `mercury_transactions`, the label tables, Banking's reads | — |
| The file's columns | the import's parser, for the shape | `lib/banking/accountingExport.ts`, the month's lines to rows, pure and tested |
| Label to account | — | a table such as `banking_label_ledger_accounts`, RLS as the labels, the three fences |
| The press | Banking's Ledger tab | the export window, its month picker and the held lines |
| Who | *Banking attributors* | the same people, or dev and controller only (the owner's call) |

## The plan

1. **The kernel.** The month's rows to export lines in shape A or B, the held lines with their
   reasons, the totals per account that must match Banking's own month. Tests only.
2. **The map.** The migration (`SET lock_timeout`, the three fences), the map's window on
   Banking listing every label with its account box, and the release note.
3. **The press.** Export the month, the held list, the file, a help guide.
4. **Later, only if asked.** The QuickBooks Online push (C), its connection card in Settings.

## How to verify

Export a past month. Each account's total in the file equals Banking's total for that label and
month. The CPA imports it into their own QuickBooks company or a sandbox they set up; nobody here
signs up for one. A held line names its reason and opens the line on Banking.

## Open questions

- Which file the CPA wants, and how often.
- Whether Stripe bills should be exported as invoices too, or only the deposits the bank saw.
- Who may press it: the attributors, or the dev and the controller only.
