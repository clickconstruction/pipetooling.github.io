---
name: "Supply house invoices: flip through them in place, share one by a link, search them"
number: 431
group: close
status: asked 2026-11-23 · built the same day as a train of ten PRs · nine are on main, the last (#9569, bills in the header search) is armed · the migration is pushed, the three functions and the dev seat are deployed, the sweep is keeping each bill's words · walked on real bills on a local server on 2026-11-24 · left: the owner's own look on the live app · looked at live 2026-11-24 on one job's list, where it holds · the card's own recipe walked clean on two made-up ZZ bills the same day, at 1280 and 375 px in dark · left: light, the link signed out, a bill with no PDF, and the owner's own look
mockup: to-dos/supply-invoice-viewer/mockup.html
summary: >
  The Job Summary lists every supply house invoice on a job, and each invoice number opens its PDF
  in a new browser tab. The owner wants to flip through a job's invoices without leaving the page,
  copy a link to one with a press, search a long list, and find any bill later by what is printed
  on it. The design is a viewer that opens over the list and draws the PDF on the app's own canvas,
  a share icon left of the invoice number that copies an app link, a search box on the list, and
  bills joining the search the app already has: the lines read from each bill, the file index, the
  search by meaning and the header search.
next: The owner looks at a job's Invoices from Supply Houses, opens a bill, copies its link and tries Search every bill on the live app, then says whether the card closes. The seven calls built on a default are listed under Where it stands. Checked 2026-11-27: the last of the ten PRs, #9569, merged on 2026-11-24, so all ten are on main.
size: L as a train of ten, built; left: a look (XS)
blocker: A look by the owner. Nothing in the code.
opinion: your call — it is built and walked on real bills; the look and the seven default calls are yours
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
    - Every bill's whole text, kept on the bill's own paper (`supply_papers.page_text`) and read by
      one function, `search_supply_bills`, behind **Search every bill** on Materials → Supply houses
      and behind the header search.
11. **Questions in words are held.** "How much copper did we buy for this job in October" needs a
    model writing a query, and is only safe when every answer shows its rows and its sum. It waits
    until the Parts Book match of #298 covers most of the dollars, as a card of its own.
12. **The words are kept on the paper, not in the file index.** The plan first said the file index.
    Three things changed it while building. One PDF often holds several bills, and the index keeps one
    row a file, so a search for one bill's ship-to would have found every bill scanned with it. Bills
    are the office's to read, the index is read by the estimators too, and the papers table already
    has the right policy. And the bill sweep already opens each PDF, so keeping the words costs no
    model read. What that leaves out: Documents → Search and the search by meaning do not read bills.
    Meaning is weak on bills, which are codes and numbers. Adding bills to the file index as well is
    the owner's call, and is small now that the words are kept.
13. **The search also reads the job a bill is on**, and the PO and order number its paper prints.

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

One PR at a time, smallest first. Each ships its release note, its fragment and its guide. As built,
two of the seven were split so that a function is deployed, and a migration pushed, before any screen
calls it: the bill door ahead of the viewer, and the search function ahead of the search box.

| PR | What | Migration or function | Its check |
| --- | --- | --- | --- |
| 1 | The search box, the share icon, small cents and the short date on the Job Summary list. The link opens the PDF for an office teammate until PR 2 lands. | Neither | The kernel's tests; the list at desk and phone widths; a copied link opened signed in and signed out. |
| 2 | The viewer: opened from a row and from the link, Previous and Next, the keys, the facts, a bill's own pages, the no-PDF and cannot-open states. | A `drive-link` deploy | A ZZ test bill opened, flipped and shared; a bill inside a longer file opens on its own page. |
| 3 | The list's search reaches the lines on the paper, and the viewer marks the line. | Neither | A part typed on a job finds its bills and no other. |
| 4 | The viewer and the share icon on the other lists: Supply houses' bills, the bank link window, What we buy. | Neither | Each list opens the same viewer. |
| 5 | One search across every bill, on Materials → Supply houses: number, house, PO, amount, job, a part, a code. | A migration | A code typed finds every bill that prints it. |
| 6 | Every word of a bill kept on its paper by the bill sweep, as a bill is read and for the bills on file. | The sweep (the column is PR 5's migration) | **Search every bill** finds a bill by a word in its ship-to. |
| 7 | Bills in the header search. | Neither | A bill's number typed in the header opens the viewer. |

## How to verify

- The made-up bills in `src/test/fixtures/bills/` and the ZZ test supply house carry no real paper.
  A ZZ test bill dropped on Add invoice gets a paper and lines within minutes.
- The viewer is walked on a ZZ test job's list at 1,280 and 375 px, in both themes.
- The link is opened three ways: as the dev, signed out, and through View as a helper.
- Counts of bills, links and held bills are read through the dev seat as counts only. No real
  invoice number, supplier, job or amount goes into a file, a PR or a note here.

## Where it stands

**All of it is built and landed (2026-11-24). What is left is the owner's own look.**

| Piece | PR | State on 2026-11-24 |
| --- | --- | --- |
| This card and its mock-up | #9505 | merged |
| PR 1: the list's search box, share icon, small cents, short date | #9521, v2.8391 | merged |
| The bill door, `drive-link` → `read_bill` | #9522, v2.8396 | merged, `drive-link` deployed |
| The search function and `supply_papers.page_text` | #9537, v2.8406 | merged, migration `20261123193100` pushed |
| PR 6: the sweep keeps each paper's words | #9542, v2.8412 | merged, `bill-lines-sweep` deployed |
| PR 2: the viewer and the bill's page | #9546, v2.8399 | merged |
| PR 3: the list's search reaches the paper's lines | #9555, v2.8401 | merged |
| PR 4: the viewer on the supply house's bills, the aging window and Link invoices | #9565, v2.8403 | merged |
| The types and the dev seat's catalog | #9566 | merged, `dev-mcp` redeployed |
| PR 5, the screen: **Search every bill** | #9567, v2.8409 | merged |
| PR 7: bills in the header search | #9569, v2.8414 | armed, the last of the train |

**By hand, done.** `drive-link` and `bill-lines-sweep` deployed from main. The migration pushed and
the ledger checked against the repo. Ten more functions bundle `_shared/driveLink.ts`, which the
bill door's PR changed, so each was redeployed from main and probed.

**What the walk found (2026-11-24).** A headless browser on a local server running the last branch
of the train, signed in as the dev account, reading real bills. Counts and kinds only were written
down.

- **The bill door on the real Drive.** 39 of 40 bills came back as PDFs. The one refusal was a file
  Drive does not share with the app. The `_Bills` name rule holds, so no secret was needed.
- **The viewer.** Eight bills flipped with the arrow key and each drew its pages. Three sit inside a
  longer file and showed their own pages with **See the whole file**. The lines read from the
  paper were listed beside each.
- **The Job Summary.** A job with twelve invoices had the search box, a chip per supply house, a
  share icon on every row and no year on this year's dates. A part word left seven rows, each
  with *On the paper* and the word marked. A month word left that month's rows.
- **The link.** The press showed *Link copied to clipboard*. The link opened the bill's own page
  with the job's list for the dev. Signed out it asked for a sign-in. An estimator read *This
  file is not one you can open.*
- **Search every bill.** A part word listed the first sixty bills, 59 with the line that found
  them. Nothing found offered **Clear the search**. On prod the function found five of five bills
  by their own number and refused a signed-out caller.
- **The whole text of a bill.** The sweep's first run with the column kept 19 papers' words. Ten of
  ten of those bills were then found by a word only their page holds. About 500 papers were left
  to fill, a few files every ten minutes.
- **The header search.** A part word listed five bills after the jobs, and a press opened the
  bill's page.
- **A phone.** At 393 px the search and the viewer filled the screen, nothing scrolled sideways and
  the share press was 44 px.

**Not walked.** The aging window's arrow and **See the bill ›** in Link invoices are held by render
tests and were not pressed on real rows. Nothing was pressed on the live site itself: the look
ran the same code against the same data from a local server.

**Seen and left.** A person with *Tell the dev* switched on has its floating press over the
viewer's bottom left corner, where the line about the arrow keys and Esc sits. The viewer still
works. The press floats over every window by design.

**Calls built on a default, for the owner.**

1. The viewer is the list beside the paper. Arrows alone was the other frame.
2. The icon is a link glyph. A share glyph is one file, `CopyLinkIcon.tsx`.
3. The viewer is the office's. A primary, a helper or a sub who sees the list keeps the Drive link.
4. A date from another year shows four digits. The Supply houses bills card writes two.
5. The bills folder is found by its name, `_Bills`. Setting the secret `BILLS_DRIVE_FOLDER_ID` holds
   it by its id, so a rename does not close the viewer.
6. Bills are not in the file index, so Documents → Search and the search by meaning do not read them.
7. The bills still live in one office login's My Drive. A Shared Drive of their own is the durable move.

No session card was dropped for this work: a hook refuses a worktree session's write into the main
checkout's `.claude/`. The claims on GitHub are the record.

## The live look of 2026-11-24

Looked at on clicktooling.com as the dev, at 1280 px, in dark. No ZZ test bill exists, so one job's list was read for its shapes and counts only.

- **Holds.** Job Summary, a row, Parts Cost, *Invoices from Supply Houses*: the search box, the chips with their counts, a copy-link press and an invoice-number press on each row. A press opens the bill over the page with the job's list beside the paper. It reads its place in the list, **Previous** is dead on the first, **Next** and the right arrow key step on, the paper's lines show, **Close** works, and nothing scrolls sideways.
- **Not walked.** 375 px, the light theme, the link three ways, *Search every bill*, and a bill with no PDF.
- **To walk the rest:** two made-up bills from `src/test/fixtures/bills/` recorded on the ZZ Test supply house against a ZZ test job, then this card's own recipe on those. A walking session has that to do.

## The recipe on two made-up bills (2026-11-24)

Walked on clicktooling.com as the dev, at 1280 and 375 px, in dark. Two made-up bills from `src/test/fixtures/bills/` were recorded on the ZZ Test supply house against the ZZ Test walk job, walked, then deleted: a recorded bill has **Edit**, **Delete** and a confirm. No row is left.

- **Holds.** The viewer with its place in the list, *1 of 2*, and **Previous** and **Next**. The facts and the five lines read from the paper. The copy link, and the link opened as the dev. The link refused to a role that may not open the bill. At 375 px the presses are 44 px. **Search every bill** finds a bill by its number and by a part's words.
- **Not walked.** The light theme. The link opened signed out. A bill with no PDF.
- **Four small things seen, none read in the code.**
  1. Job Summary does not list a job that was never billed, so the walk opened the bills from the supply house's own list. A ZZ job that Job Summary lists would let the card's own door be walked.
  2. The link's page shows the bill alone, with no list beside it and no **Previous** or **Next**. The guide says the job's list sits beside it.
  3. While imitating through View as, the refused page has no **Exit** press. View as is punch list #417's.
  4. The delete's confirm does not say what goes with the bill: the kept PDF and the lines.

