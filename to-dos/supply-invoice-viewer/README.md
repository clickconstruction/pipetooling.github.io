---
name: "Supply house invoices: flip through them in place, share one by a link, search them"
number: 431
group: ready
status: asked 2026-11-23 · researched in the code and in prod the same day · the mock-up drawn and the owner said build it all the same day · building as a train of seven, one PR at a time
mockup: to-dos/supply-invoice-viewer/mockup.html
summary: >
  The Job Summary lists every supply house invoice on a job, and each invoice number opens its PDF
  in a new browser tab. The owner wants to flip through a job's invoices without leaving the page,
  copy a link to one with a press, search a long list, and find any bill later by what is printed
  on it. The design is a viewer that opens over the list and draws the PDF on the app's own canvas,
  a share icon left of the invoice number that copies an app link, a search box on the list, and
  bills joining the search the app already has: the lines read from each bill, the file index, the
  search by meaning and the header search.
next: PR 1, the search box and the share icon on the Job Summary list, with small cents and the short date.
size: L as a train of seven (S · M · S · S · M · M · S)
blocker: None for the build. Search by meaning turns on with the owner's key, the same key punch list #240 waits on.
opinion: build — the PDF canvas, the Drive read, the lasting file link, the toast and the lines read from every bill all exist; this joins them
---

# Supply house invoices: flip through, share, search (#431)

## The ask, in the owner's words (2026-11-23)

From the Job Summary, looking at one job's **Parts Cost** → **Invoices from Supply Houses**:

> I love that we have all the supply houses available, but I don't love that every time I click on
> one it brings me to a new tab. I would like to be able to flip through them faster. I was also
> thinking it might be nice to be able to search them for big jobs. What kind of features might we
> need to add such that we can index our supply house invoices so that long term they can become
> searchable? I would also like a share button so it's super easy to share an invoice with someone
> else, where a user can click on that share button and it copies a link to the invoice. I think
> that share button should be an icon and it should be to the left side of the invoice, so a user
> can click on it instead of the invoice link, and they can have it show a toast saying link copied
> to clipboard.

Three more words from the same sitting:

- **Small cents.** "I also want to see the cents as smaller than the main number, like we've been
  doing throughout the app elsewhere."
- **The short date.** "I wanted to show the month and day, but not the year, if the year is the
  current year. We only show the year if it is a past year."
- **The size of the search.** "I want to do at least size 2", then, on the recommendation below,
  "I like it, let's build it all."

## The mock-up

[`mockup.html`](./mockup.html), every supply house, invoice number, date, part, code and amount
made up. The same page is on the design canvas:
*Supply Invoice Viewer* — https://claude.ai/artifact/SpDZXshE7KqtBUwnn5Aau6

A bar on top switches each choice. Press an invoice number to open the viewer, press the icon to
its left to copy a link, and type in the box.

- **The list**: the share icon left of each invoice number, a search box with its count and total,
  a chip per supply house, small cents, and the year only on a date from another year.
- **The viewer**: the job's list beside the paper, Previous and Next, the arrow keys and Esc, the
  bill's facts, **Open in Drive**, a bill with no PDF, a bill whose file the app cannot open, and a
  bill that is one page of a longer file.
- **The phone**: the list as two lines a row with a 44 px share press, the viewer as a full sheet
  with Previous and Next at the bottom.
- **What the copied link opens**, for an office teammate, for someone signed out and for anyone else.

## What the code and prod said (2026-11-23, counts only, read as a dev)

- **The invoice link is a Google Drive PDF.** It is `supply_house_invoices.link`, pasted on Add
  invoice. One function draws the list in all five places the Job Summary shows it
  (`renderJobSummarySupplyHouseInvoiceTableContent` in `src/components/jobs/JobsJobSummaryTab.tsx`),
  and it hands the link to `openInExternalBrowser`, which is the new tab.
- **A bill with no link opens the supplier's home page.** The list falls back to the supply house's
  website. 19 bills have no link.
- **The rows come from** `get_invoice_allocation_lines_for_jobs`, which answers the office roles, a
  primary of the job's leader, and a helper or sub on the job's team.
- **About 550 bills are on file.** 28 are held by the bill-lines sweep and wait for a person: on 19
  the number is not in its file, 7 files the app cannot open, 2 are statements.
- **The PDFs live outside the jobs Shared Drive**, in one office login's `_Bills` folder, shared
  with the office and with the app's service account as a viewer (punch list #298, step 0). So
  `file_index` holds none of them and Documents → Search never finds a bill.
- **One file often stands behind several bills.** `supply_papers.page_from` and `page_to` say which
  pages are a bill's own.
- **The lines are already rows.** Punch list #298 reads each bill's lines into `supply_paper_lines`
  within about ten minutes of Save, with the house's code, the maker's number and the description.
  That was 496 of 543 bills on 2026-11-13.
- **Scans are not the blocker.** 23 papers were read with no text layer, and the reader read them.
- **What exists to join**: `PdfPageCanvas` (pdf.js on a canvas, the bill Look window's pane),
  `drive-link`'s `read` action (a Drive file's bytes for a file in a job's folder), the lasting link
  `/files/bills/<invoice id>` (`src/lib/files/fileRoute.ts`, our own copy only today), the toast
  (`showToast('Link copied.', 'success')` in a dozen places), `AmountSmallCents`, the file index
  with its search by words and by meaning (`search_file_index_meaning`, punch list #240), and the
  header search (`HeaderGlobalSearch`), which finds jobs, bids, customers, estimates, pages and guides.

## The decisions

1. **The viewer draws the PDF itself.** The bytes come through a new `drive-link` action that
   checks the caller can read the bill's row and reads the Drive file as the service account. It
   needs no Google sign-in, works on a phone and opens on the bill's own pages. Google's preview
   frame was rejected: it needs a Google session in that browser and cannot open on a page range.
2. **The viewer's shape is the list beside the paper.** Arrows alone was the other frame. On a
   phone the list is the screen underneath and the viewer is a full sheet.
3. **Previous and Next follow the search.** The viewer flips through the list as it is narrowed.
4. **The share link is the app's own lasting link**, `/files/bills/<invoice id>`, with the job on
   it when it was copied from a job's list so Previous and Next work there too. It is never a public
   file link.
   - A dev, a leader, an assistant or the controller, signed in: the viewer on that invoice.
   - Signed out: *Sign in to open this file.*, then back to the invoice.
   - Anyone else signed in: *This file is not one you can open.*
5. **The icon is a link glyph**, left of the invoice number, with *Copy a link to this invoice* as
   its name. The toast reads *Link copied to clipboard*. A share glyph was the other frame, and the
   glyph is one constant.
6. **The viewer is the office's.** A primary, a helper or a sub who sees the list keeps the Drive
   link, where Google decides. Widening it is the owner's call.
7. **Small cents on every amount** these screens draw, through `AmountSmallCents`. The supplier's
   own PDF is drawn as printed.
8. **The short date**: the month and the day, and the year only when it is not this year, four
   digits (*Nov 16*, *Dec 18, 2025*). The Supply houses bills card writes two digits by the owner's
   earlier word (`billDayName`); two or four here is the owner's to flip.
9. **A bill with no PDF says so** and offers **Open the bill**. Its number no longer opens the
   supplier's home page.
10. **Search, in three steps the owner took whole.**
    - On the list, by supply house, invoice number, date and amount, with no new index.
    - The lines already read: typing a part finds the invoices whose paper lists it.
    - Every bill's whole text in the file index, so Documents → Search finds a bill, and the search
      by meaning covers bills once the owner's key is set. Bills join the header search.
11. **Questions in words are held.** "How much copper did we buy for this job in October" needs a
    model writing a query, and is only safe when every answer shows its rows and its sum. It waits
    until the Parts Book match of #298 covers most of the dollars, as a card of its own.

## How reliable each kind of search is

- **Words are exact.** If the word is on a bill that was read, the bill is found, and what comes
  back can be summed. About nine bills in ten are read today.
- **Meaning is a ranking, not a filter.** It is good on prose and weak on bills, which are mostly
  codes, sizes and numbers. It is never the answer to "every invoice with X" or to a total. Each
  hit by meaning is labelled, under the exact hits.
- **The exact way to get meaning on bills is the Parts Book match** (#298, stage 2): a house's code
  tied to a part once.

## Where it plugs in

| Piece | Exists | New |
| --- | --- | --- |
| The list | `renderJobSummarySupplyHouseInvoiceTableContent`, `useJobSummaryData` | a list component with the box, the icon, the cents and the date |
| The search on the list | | a pure kernel over the loaded rows |
| The paper | `PdfPageCanvas`, `supply_papers.page_from` / `page_to` | the viewer component and its kernel |
| The bytes | `drive-link` `read`, `driveMedia` | a `drive-link` action for a bill's file |
| The link | `/files/bills/<id>`, `FileOpen`, `fileOpenIo` | the page opens the viewer, and knows a Drive-linked bill |
| The lines | `supply_papers`, `supply_paper_lines` | a read of them for a job's bills |
| Every bill | `SupplyHouseBillsCard` | a search function and its box on Materials → Supply houses |
| The index | `file_index`, `file-index-sweep`, `bill-lines-sweep`, `search_file_index_meaning` | bills as a reach of the index, read by the office alone |
| The header | `HeaderGlobalSearch` | bills as a kind of result |

## The plan

One PR at a time, smallest first. Each ships its release note, its fragment and its guide.

| PR | What | Migration or function | Its check |
| --- | --- | --- | --- |
| 1 | The search box, the share icon, small cents and the short date on the Job Summary list. The link opens the PDF for an office teammate until PR 2 lands. | Neither | The kernel's tests; the list at desk and phone widths; a copied link opened signed in and signed out. |
| 2 | The viewer: opened from a row and from the link, Previous and Next, the keys, the facts, a bill's own pages, the no-PDF and cannot-open states. | A `drive-link` deploy | A ZZ test bill opened, flipped and shared; a bill inside a longer file opens on its own page. |
| 3 | The list's search reaches the lines on the paper, and the viewer marks the line. | Neither | A part typed on a job finds its bills and no other. |
| 4 | The viewer and the share icon on the other lists: Supply houses' bills, the bank link window, What we buy. | Neither | Each list opens the same viewer. |
| 5 | One search across every bill, on Materials → Supply houses: number, house, PO, a part, a code. | A migration | A code typed finds every bill that prints it. |
| 6 | Bills into the file index: the whole text, read by the office alone, filled as a bill is read and once for the bills on file. | A migration and the sweep | Documents → Search finds a bill by a word in its ship-to. |
| 7 | Bills in the header search. | Neither | A bill's number typed in the header opens the viewer. |

## How to verify

- The made-up bills in `src/test/fixtures/bills/` and the ZZ test supply house carry no real paper.
  A ZZ test bill dropped on Add invoice gets a paper and lines within minutes.
- The viewer is walked on a ZZ test job's list at 1,280 and 375 px, in both themes.
- The link is opened three ways: as the dev, signed out, and through View as a helper.
- Counts of bills, links and held bills are read through the dev seat as counts only. No real
  invoice number, supplier, job or amount goes into a file, a PR or a note here.

## Where it stands

Designed and approved 2026-11-23. Nothing is built yet. The session that builds it could not drop a
session card from its worktree, so the claims on GitHub are the record of who is in it.
