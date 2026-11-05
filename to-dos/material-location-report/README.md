---
name: "The material location report: what is at every location across a development, printed to PDF"
number: 268
group: close
status: built 2026-11-04 · the paper drawn two ways and the door two ways in `mockup.html` · the owner's pick the same day, *I would like the option for the user to be able to select either version at their leisure* · one PR v2.6533, the press on the Jobs & bids look with By job and By location as chips the device remembers, walked live on Gun Dog as the dev
summary: >
  The owner, looking at the Gun Dog development, asked for a printable report that shows what
  materials are at all the different locations, called the material location report, printed to
  PDF. Materials on site (#209) already holds the facts: every job's places, its stencilled cages
  and boxes, and the ledger of presses that sums to what is on hand in each. The report folds the
  site's jobs into one Letter paper: by job, then place, then cage or box with its stencil and code,
  each with its lines on hand, the part, the count, the unit and when it was last recorded, and the
  job's Unsorted pile; a header with the site's name, the day and who printed it, a footer that names
  the ledger, page breaks that keep a location's lines together, and plain words where a job has no
  places yet or nothing is on site. The door is a press on the Development page, behind the same gate
  as a job's materials. The PDF is the browser's own Print, Save as PDF.
next: The owner's first print on Gun Dog, then delete this card.
size: M (one PR: the kernel, the site-wide read, the paper, the door, the guide, the maps)
blocker: None.
mockup: to-dos/material-location-report/mockup.html
ver: v2.6533
opinion: build — the ledger, the kernel that sums it, the print root and the Development page's batched reads all exist; the work is one fold of the site's rows into report rows, one batched read, one print window and one press
---

# The material location report (#268)

Mock-up: [`mockup.html`](./mockup.html) — the paper two ways (grouped by job then location, and
grouped by location across jobs), the door two ways (a press on the Development page's Jobs & bids
look, or a seventh Materials look with the same table on screen and Print at its head), the empty
words, the phone, and the calls with a recommendation on each. Made-up data: Harlow Ranch, Ridgeway
Builders, the house's invented crew and parts. Both papers are drawn from one set of rows in the
page's own script, the way the kernel will fold them.

## The ask

The owner, 2026-11-04:

> I am looking at the gun dog development and I would like the ability to print a report that shows
> what materials are at all the different locations And we would call this the material location
> report. … It needs to be able to be printed to pdf.

## What exists today (read off the code and prod, 2026-11-04)

- **The ledger** is Materials on site (punch list #209, [`docs/MATERIALS_ON_SITE_ARCHITECTURE.md`](../../docs/MATERIALS_ON_SITE_ARCHITECTURE.md)): per job, `job_places` (a place on the site a box can stand in), `job_containers` (a cage, box or loose pile with its stencil and its eight-character code), `job_material_movements` (every press: delivered, moved, used, returned, taken, cannot find, damaged, counted) and `job_container_moves`. Nobody types a quantity; what is on hand is the sum of the rows, and `containerLines` in `src/lib/materials/onSite.ts` is the one kernel that sums them.
- **The papers it already prints**: the labels and **Print the manifest** (v2.6366, one Letter page per box, `ManifestPrintModal.tsx` over `containerManifest.ts`). Every print surface portals to `<body>` and prints through `printRootCss` (v2.6432), which takes every other child of `<body>` out of the print layout so the page prints at full size; the window is `data-theme="light"`; the PDF is the browser's own Print → Save as PDF.
- **The Development page** (`/developments/:id`, `DevelopmentPage.tsx`) has six looks. Its site-wide reads batch over the site's job ids and page every read (`useSiteCosts`, `fetchAllRowsChunkedIn` with `parallel`), never one round trip per job and never a bare `.limit()`, which PostgREST cuts at 1,000 rows without a word.
- **The gate** for a job's materials is `on_site_can_touch_job(job_id)`: the caller sees the job in `jobs_ledger` under their own RLS or is on its team. The office door of the Development page (`developmentDoorFor`, the roles with a `jobs_ledger` read) is the same set of readers; an estimator comes in the overview door with no `jobs_ledger` read, and the gate would answer them with nothing.
- **Gun Dog on prod** (read as the dev through the seat, 2026-11-04): 24 jobs, one of which holds containers — JP1091 *Lift stations and site visit, Oct 2026 (Malachi)*, a cage G4 at *Arena* with one line on hand and a box G1 with no place yet. The other 23 jobs have no places and no boxes. The yard job JP972 (98 cages at *Arena* and *Gun dog*) is in no development.

## The two groupings

**A. By job, then place, then cage or box** (recommended). The paper reads the way the app reads: a job's section, its places in name order, each cage or box under its place with its lines, the job's Unsorted pile after the places, the boxes with no place yet last. A reader who walks the site goes job by job; the job window and the phone's On site tab group the same way, so the paper matches the screens, and a job's section can be cut off and handed to its crew.

**B. By location across jobs.** One section per place name, folded across jobs (Gun Dog's two jobs each have an *Arena*), with each job's cages and boxes under it. It answers *what is at the Arena* in one place, but a place is a row of one job and the same name on two jobs is only probably the same spot; the Unsorted piles and the boxes with no place sit in sections of their own; and a job's share is scattered through the paper.

The kernel folds the rows once and both papers are a grouping of the same lines, so the second can be added later as a switch if the first proves wrong.

## The two doors

**A. A press on the Development page's Jobs & bids look** (recommended): **Print the material location report** in the card's head, beside Pair bids with jobs. It opens a window on the paper, read fresh from the site's jobs when pressed (the ledger is not read with the page), with **Print** at its head and Close. The page gains no look and no new read on open; the press is the office door's alone.

**B. A seventh look, Materials**, in the strip: the same table on screen under the strip's chip (*7 boxes · 23 lines*), with Print at its head. The whole site's ledger would then be read with the page for every reader, the strip's six looks become seven on a phone's one row, and the screen table repeats Jobs → Materials, which already shows a job's boxes.

## The paper

- **Head**: *Material location report*, the site's name, the customer and the address, the day it was printed and who printed it, and the count line (*4 jobs with material · 3 places · 7 cages and boxes · 23 lines on hand*).
- **A job**: its number and name; under it each place in name order; under a place each cage or box in stencil order, as *A1 · cage · 7D759246* with its where note, and its lines: the part with its maker, the count on hand, the unit when the delivery named one, and the day something was last recorded on the line with who. An empty box prints one line, *Empty*, so the box is accounted for. Then **Unsorted**, the delivered parts nobody has put away, when it holds any. Then **No place yet** for boxes nobody has placed.
- **Jobs with nothing on site** close the paper in one block, one line each: *J1051 · Water wells: no cages or boxes on this job yet.* and *J1053 · Septic field: S1 at Field edge is empty. Nothing on site.* On Gun Dog that block names 23 jobs, so the material reads first and the paper does not spend a page on each empty job.
- **Foot**, on every page: *Read from the Materials on site ledger, every press on the phone and in the office summed to what is on hand. Printed November 4, 2026 by Dana Example.* and *Page 1 of 2*.
- **Page breaks**: a cage or box and its lines stay together; a job's head and a place's head stay with the first block under them; a table that must split repeats its column heads.
- **Words when the site is empty**: *Nothing on site yet. A job's Materials page is where a cage or box is added, and the crew's phone is where parts are counted into it.*

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The sums | `containerLines`, `partKey`, `compareLabels`, `groupByPlace` in `src/lib/materials/onSite.ts` | — |
| The report's rows | — | `src/lib/materials/siteMaterialsReport.ts`, pure: the site's places, containers and movements folded into jobs → places → containers → lines, the Unsorted pile, the empty words, the count line; tests for an empty site, a job with no places, a container with lines in two places over time, a retired container left out |
| The read | `fetchAllRowsChunkedIn` (`src/lib/supabasePaging.ts`) | `src/lib/materials/siteMaterialsRead.ts`: the four tables over the site's job ids, chunked and paged, `parallel: 4` |
| The paper | `printRootCss` (`src/lib/printRoot.ts`), the manifest's print rules | `src/components/materials/SiteMaterialsReportModal.tsx`, portalled to `<body>`, `data-theme="light"`, Print and Close |
| The door | the Jobs & bids card's right slot on `DevelopmentPage.tsx` | the press, office door only |
| The guide | — | `src/content/help/print-the-material-location-report.md` |
| The maps | `MATERIALS_ON_SITE_ARCHITECTURE.md`, `GLOSSARY.md` (*Development page*, *Materials on site*), `docs/twins/APP_DIRECTORY.md`, `ACCESS_CONTROL.md`, `PROJECT_DOCUMENTATION.md` | a sentence each |

No migration, no edge function. The whole build stays in the lazy DevelopmentPage chunk.

## The plan

One PR: the kernel with its tests, the read, the paper, the door, the guide, the maps, the release note and the fragment.

## How to verify

Dev server from the worktree, signed in as the dev through `/dev-login?as=1&to=%2Fdevelopments%2F7d7b2580-3301-42bd-af10-85d75b941918`, the Browser pane at 1400 wide. Open Gun Dog, press the door, read the paper: JP1091's *Arena* with G4 and its one line, G1 under *No place yet*, and the 23 other jobs in the closing block. Print to PDF with headless Chrome (`--print-to-pdf`) and read the pages with `pdftoppm`: the foot on every page, no block cut across a page. Screenshots at 375 and 1400. Prod is never written from a session: the paper with several jobs and locations is checked on the mock-up's made-up rows and in the kernel's tests.

## Where it stands

2026-11-04: the card claimed (#268), the paper and the door drawn two ways in `mockup.html`, the recommendation A + A made. The owner the same day: *I like what you've built. I would like the option for the user to be able to select either version at their leisure.* Built as v2.6533: the press on the Jobs & bids look, the window with **By job** and **By location** as chips the device remembers, the kernel folding once and each view an order of the same lines. Walked live on Gun Dog as the dev: JP1091's section with G4 at Arena and G1 under No place yet, 23 jobs in the closing block, both views, printed to one Letter sheet. Left: the owner's first print; then delete the folder, the fragment carries the record.
