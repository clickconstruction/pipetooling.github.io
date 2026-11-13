---
name: "A site's materials on one screen: every part across the site's jobs, with the boxes that hold it"
number: 330
group: gated
status: asked 2026-11-12 · the card and the mock-up the same day · nothing built · waits on Grace's go and her calls
mockup: to-dos/site-materials-view/mockup.html
summary: >
  A company manager cannot see all the material on a site on a screen. The desk is one row per job
  with counts, the search lists lines with no total, and the only whole-site reading is a paper of
  about ten pages with one small table per box. The card proposes one screen for a site, read only,
  reached from the desk, the Materials page and the Development page. Its top line says how fresh
  the record is. Under it sit the boxes, what is due a count, what cannot be found, the week's
  missing money, what came in and was used, and what the material is worth with how much of it has
  a price. The list is one row per part across the site's jobs with its total and the boxes that
  hold it. Two spellings of the same words are one row by themselves. Two names that are nearly
  the same ask a person once, Same part or Different, and a name never folds by closeness alone.
  The first PR needs no migration.
next: Grace's go and her six calls, then PR 1 (the screen, read only, no migration), then a look at it on the real site before anything else.
size: L as a train of five (M · S · M · M · S); PR 1 is the whole screen, then a stop to look at it on the site
blocker: Grace's go, and her calls on where it lives, who sees the money and how names fold.
opinion: build PR 1 and PR 2, then look — the screen needs no migration and shows the gaps in the record, and PR 2 stops new spellings before the stickers walk adds a hundred boxes
---

# A site's materials on one screen (#330)

This card sits beside three others. **Materials on site** (#209, `to-dos/materials-on-site/README.md`)
built the ledger, the cages and boxes, the counts and the photos; nothing in its ledger changes
here. **The material location report** (#268, closed) is the site's paper; it stays, and gains a
third reading in PR 5. **Stickers before boxes** (#329, `to-dos/stickers-before-boxes/README.md`)
makes boxes faster to add; this screen reads every box whatever sticker it carries. Both cards call
a development *the site*.

## The ask

Grace, 2026-11-12, after the stickers card:

> Does the app do a good job giving a company manager a view of all the materials across an entire
> site?

The answer that day was *only in pieces*. This card is the design that follows, for her to decide
on. Every name, job and number on the mock-up is made up (the site is Juniper Ridge, as on #329's
mock-up).

## What the app does today (read 2026-11-12)

Read in the code, then on the real screens through a local copy of the app with every write
refused, as the dev and through **View as** for the Assistant role. Both read the same.

- **The desk is one row per job.** Jobs → Materials and Materials → On site are one component
  mounted twice (`src/components/jobs/JobsMaterialsTab.tsx`, `src/components/materials/MaterialsOnSiteTab.tsx`).
  With no job picked it lists every job with a live container: containers, lines on site, the
  week's missing money, a counts chip, credits due (`jobMaterialsSummaryFor` in
  `src/lib/materials/onSiteSummary.ts`). A site whose boxes sit under two jobs is two rows, and
  nothing says they are one site. Two presses from anywhere.
- **A job's page has four sections**: On site (the boxes by place, with All · Due a count ·
  Can't find), Missing (bought, reported, left, walked away, per part across the one job),
  Deliveries and History. It is the right page for one job and stops at the job.
- **One search finds a part or a box on any job** (`findOnSite` in `src/lib/materials/onSiteFind.ts`).
  It answers a list of lines by box, in the shape *12 lines in 9 boxes on 1 job*, with no total. A search for
  a fitting returns every size and every spelling that holds the word.
- **The material location report is the only whole-site reading, and it is a paper.**
  **Print the material location report** sits in the head of the Development page's Jobs & bids
  look, for the office door only (`src/pages/DevelopmentPage.tsx`, `SiteMaterialsReportModal.tsx`
  over `src/lib/materials/siteMaterialsReport.ts`, read by `siteMaterialsRead.ts`). It lists every
  live box of the site's jobs with its lines, by job or by location. On the real site the window
  is about ten Letter pages, one small table per box. Reaching it takes four presses: a job of the
  site, its development chip, the look, the press. There is no list of developments outside
  Settings.
- **A part's identity on a job is `partKey`** (`src/lib/materials/onSite.ts`): the parts book's id,
  or the typed name trimmed, lower-cased and with spaces collapsed. `containerLines` sums the
  ledger per box and per key, and a count resets its line.
- **Money prices what is missing, never what is on hand.** `src/lib/materials/bookPrice.ts` picks
  the parts book's latest price with its checked day, stale past 90 days; a typed name has no book
  page, so it only ever carries an invoice price, and that price lives on the device that read the
  invoice.
- **A place is a row of one job** (`job_places`), so the report's by-location view folds the same
  name on two jobs by name alone.
- **The phone's Add a part searches the parts book** (`AddPartSheet` in
  `src/components/tally/TallyOnSiteTab.tsx`) and takes a typed name when nothing fits. It does
  not offer the names already on the site.
- **Who gets where** (`src/lib/layoutRouteAccess.ts`, `src/lib/materials/materialsTabs.ts`): the
  Development page opens for the dev, the leader, the assistant, the controller and, with no money
  and no report, the estimator. Jobs → Materials opens for the first four and a primary. A
  superintendent has neither; Materials → On site gives them their jobs as doors to the phone
  screen. The tables' own gate is `on_site_can_touch_job`: whoever sees the job, or is on its team.
- **The reads**: the desk's `loadDesk` reads every job's whole ledger to the device, up to 5,000
  rows a job (`MOVEMENTS_LIMIT` in `onSiteStore.ts`); a job past the cap asks the database for
  `on_site_job_summary(job, since)`, which answers every line, the last counts, the counts' gaps,
  the Can't find presses and the returns in one pass, `SECURITY INVOKER`.
- **Nothing joins two names for one part.** The parts book has a duplicates page and a merge
  (`duplicateParts.ts`, `merge_material_parts`) and `partMatch.ts` finds a book part for a typed
  row by the same words. No table ties a typed name on site to anything.

**What a manager can learn today, and in how many presses:**

| The question | Today |
|---|---|
| How many boxes are on this site? | Two presses to the desk, then add two rows in your head |
| How many of one fitting do we have here? | The search, then add the lines across several spellings by hand |
| What is in every box? | Four presses to a ten-page paper |
| Which boxes are due a count? | A chip per job row that names two and hides the rest in a tooltip |
| What went missing, and what did it cost? | The desk's column, per job, for the week |
| What came in and what was used this week? | One job's flow row; nothing for the site |
| What is the material on this site worth? | Nowhere |
| Is this record still alive? | Nowhere |

## The need, replayed on her site

Read on prod 2026-11-12, read only. Rounded on purpose; the exact figures are in the session's
notes, outside the repo.

- **About a hundred live boxes, nearly all cages, under two jobs** of a development of about
  twenty-five jobs. Nearly all the boxes are on one job.
- **Two place names.** One of them is on both jobs, and it is the same spot. Almost nine boxes in
  ten stand in one place. No box has a map pin.
- **Almost every box holds one line.** About a hundred and fifteen lines, a little over two
  thousand pieces.
- **About a hundred part names, and nearly all were typed on site.** Fewer than one part in ten
  sits in more than one box. No part sits under both jobs.
- **Nothing has been recorded for over a week.** The ledger holds deliveries and counts from the
  first walk and a handful of uses. Almost every box was counted in the same three days, so
  almost every box falls due a count in the same week.
- **About one piece in twenty has a price**, and no price was checked inside 90 days.

**What the replay found, and what it changed:**

1. **The roll-up alone is thin.** A hundred and fifteen lines become about a hundred rows, because
   one box is mostly one part under its own name. A screen that was only the roll-up would be the
   box list again. So the screen leads with the glance, and the search gained a running total of
   the rows shown: type a size and a fitting and read the sum, with no fold at all.
2. **Folding by the same words joins almost nothing.** Case, spaces, punctuation, the inch mark
   written four ways, word order and a plural fold fewer than ten of the hundred names.
3. **Folding by closeness would be wrong.** More than two dozen pairs of names are two letters
   apart and differ only in a size: a 2 inch fitting and its 3 inch twin. Any fold that guesses
   joins them. A handful of pairs do look like one part, a fitting named with and without its material. Those are a
   person's call.
4. **A fold must read the finished lines, never the ledger.** A count resets its line. If two
   spellings in one box were made one key before the sums, the count of one would wipe the pieces
   of the other and report them missing. So each spelling keeps its own line and its own count,
   and the row adds the lines.
5. **About a quarter of the names are not one part**: a mixed box, scrap, tools, or a count written
   inside the name. They stay rows of their own. No fold touches them, and the screen does not
   pretend they are parts.
6. **The first thing a manager needs is how fresh the record is.** On hand is only as true as the
   last press. The top line says when something was last recorded, and how many counts fall due.
7. **A dollar total today would mislead.** It would price one piece in twenty. The value shows only
   with its cover beside it.
8. **A site-wide place is not needed.** Two names, one shared for the same spot.

**What the screen would say on her site**, in its own words with the figures rounded: *About a
hundred boxes on 2 jobs at 2 places. Last recorded over a week ago. A few boxes due a count, and
nearly all the rest fall due this week. A line that cannot be found and a line short at its count.
Nothing came in or was used this week. A few lines of more than a hundred have a price.* Then
about a hundred rows, the 2, 3 and 4 inch fittings in runs of near twins, with **Same part?**
beside a handful of them.

## The design

### 1 · Who the manager is, and where the screen lives

**Who.** The owner (the leader role), the office (assistant, controller) and the dev see the whole
screen with its money. They are the roles that open the Development page today. A primary sees it
for the sites whose jobs they see, money included, since they already read the desk's missing
money. A superintendent sees it for the jobs they are on, with no money column, from the tab they
already have. An estimator does not. The gate stays the tables' own: a job the reader may not
touch adds nothing to the screen, and the head says *2 of 3 jobs shown* when that happens.

**Where.** One screen, three doors.

- **The screen** is a state of the On site tab: `/materials?tab=on-site&site=<development id>`, and
  the same on `/jobs?tab=materials`. It is the desk's own component, so the store, the offline
  panel and both mounts come with it.
- **Door 1, the desk.** The desk groups its job rows under their site. A site is one row with its
  totals, **Juniper Ridge · 2 jobs**, and opens the screen. Its jobs sit under it and open as
  today. A job in no development keeps its own row under *Not on a site*.
- **Door 2, the Development page.** The head of Jobs & bids gains one line beside the print press:
  *96 boxes · 5 due a count · 2 can't find* with **Open the site's materials**. The line is read
  with the two small reads the screen starts with, never the ledger.
- **Door 3, Go anywhere.** A site with boxes is a row in the *Boxes on site* group.

The other way, a seventh look on the Development page that holds the whole list: the page is six
stacked looks already, a primary and a superintendent cannot open it, and the materials store and
its offline panel live on the other page.

### 2 · The roll-up

One row per part across the site's jobs: the name, the total on hand, the boxes that hold it as
chips with each box's count (**R12 · 94**, **R31 · 42**, *+2*), and when it was last counted. A
press opens the row: every box with its place, its job, its count and its last count, each a door
to that box on the job's page. Two readings of the list, remembered on the device: **By part** and
**By place** (the report's own fold, on a screen). The search narrows either, and a line under it
reads *164 pieces in the 4 rows shown*.

**How names fold, in three steps that never guess:**

- **The same words are one row, by themselves.** The fold is `partKey`'s, taken further: curly
  quotes and the inch mark written as a word or glued to its digit, punctuation, word order and a
  plural. `2" 90`, `2 inch 90` and `2inch 90s` are one row. The row shows its spellings when open.
  Nothing is stored and nothing is asked.
- **Nearly the same asks once.** Two rows with the same numbers whose words differ by one, or by a
  letter or two, show **Same part?** on the row, with the two names and each one's boxes. The
  answer is **Same part** or **Different**. Either is kept, so the question is never asked twice.
  A row whose numbers differ is never offered.
- **A typed name can be tied to the parts book**, from the open row: **This is a parts-book part**
  opens the book's picker with `partMatch.ts`'s same-words hits first. A tied name reads the
  book's price.

**The rules a tie follows:**

- **It is a reading of the finished lines.** Each spelling keeps its own line and its own count in
  its own box. The ledger, `containerLines`, the SQL summary, the phone and the paper are
  untouched. The row adds the lines.
- **It belongs to the site where a person saw both names.** `2" 90` is PVC on one site and may be
  copper on the next, so a tie never travels by itself.
- **It can be undone.** The open row lists *Names joined here* with who and when, and **Undo**.
- **Who may tie**: the roles that read the desk with its money.

**At the source.** The cheapest fold is the spelling that is never typed. The phone's Add a part
and the office's delivery lines offer the names already on the site first, then the parts book's,
as the person types (PR 2).

### 3 · The glance

One strip over the list. Every figure is a filter of the list under it.

| Figure | What it reads | Where from |
|---|---|---|
| **Last recorded** | *2 days ago by Priya*; amber past 7 days | the newest ledger row |
| **Boxes** | 96 on 2 jobs at 3 places | the containers and places |
| **On hand** | 118 lines, 1,940 pieces | the summary's lines |
| **Due a count** | 5 now, 12 more this week | the last counts and the 14-day rule |
| **Can't find** | 2 lines since their count | the summary |
| **Missing this week** | 1 line, with its money and the price's checked day | the counts' gaps and `bookPrice.ts` |
| **This week** | 240 came in on 2 invoices, 132 used | the week's rows |
| **Worth** | *$2,310 known · 9 of 118 lines have a price* | `bookPrice.ts`, the cover beside it always |

**How honest the worth can be.** A book part with a price checked inside 90 days is priced. A
stale price is priced and flagged with its day. A typed name with no tie has no price and is
counted in the cover line, never guessed. The figure reads *known*, the cover is never dropped,
and a press on it lists the lines with no price, biggest count first, each with
**This is a parts-book part**. The invoice price a delivery was landed with would raise the cover
at once, and it lives on one device today (#209's open gap); storing it on the delivered row is
that card's PR and this screen reads it when it lands.

**Nothing on the screen writes to the ledger.** A count, a correction and a label stay on the
job's page and the phone, one press away from every box.

### 4 · Places across jobs

Live with a place per job. The screen folds places by name across the site's jobs, as the paper
does, and names the jobs under a place that more than one job uses. On her site that is exactly
right: one name, two jobs, one spot. A site-wide place earns its migration when two jobs use one
name for two spots, or when a box must change place across jobs. Neither has happened. #328's
place on a task is a point on a map for a task and is not this.

### 5 · A job in no development, and every site at once

- **A job in no development: in.** It keeps its row on the desk and its own page. PR 5 gives the
  job's page the same **By part** reading, since the kernel takes any set of jobs.
- **Every site at once: the desk is that view.** It gains a total row, and the search across jobs
  gains the running total. A part roll-up across sites is out: one site has boxes today, and no
  part on it sits under two jobs.

### 6 · Scale, and the reads behind it

The screen never reads a ledger to the device.

1. `job_containers` and `job_places` over the site's job ids, chunked and paged as
   `siteMaterialsRead.ts` already does. Two reads, whatever the site's size.
2. `on_site_job_summary(job, since)` for each job that has a live box. Two round trips on her
   site, not one per job of the development. It answers every line, the last counts, the gaps and the Can't find
   presses, so the 5,000-row cap does not matter here.
3. The week's rows for those jobs, three columns, for *came in* and *used*.
4. The parts book's prices for the book parts named, as the store reads them today.

**No new SQL function yet.** One function over an array of jobs would be one round trip in place
of one per job with boxes. It is worth its migration when a site passes about ten jobs with
boxes, or when the roll-up across sites is wanted. The kernel takes lines, so the read can change
under it.

**What needs a migration, per `CLAUDE.md`:** PR 1 and PR 2 none. PR 3 one: a table of ties
(`on_site_part_ties`: the site or the job it belongs to, the two keys, *same* or *different*, who
and when; insert and delete, never update). It opens with `SET lock_timeout = '3s';`, is numbered
from `origin/main` and claimed, is idempotent, ends with the four `apply_*` fence calls since it
creates a table, gets its `docs/migrations/` page, and is pushed right after the merge because
the client reads what it makes. PR 4 writes the same table and needs none.

## The plan

| PR | What | Size |
|---|---|---|
| 1 · the screen | The kernel `src/lib/materials/siteRollup.ts` (lines into part rows, the same-words fold after the sums, the glance, the search's total) with tests; the read; the screen as `?site=` on both mounts, desk and phone; the desk grouped by site; the Development page's line and door; the Go anywhere row; the guide, the release note, the docs. No migration. | M |
| | **Stop here and look at it on the real site.** | |
| 2 · names at the source | Add a part and the delivery lines offer the site's own names first, then the parts book's. No migration. Lands before the stickers walk adds its hundred boxes. | S |
| 3 · Same part? | The migration; **Same part?** with **Same part** and **Different**; *Names joined here* with **Undo**; the search and the paper read the ties. | M |
| 4 · the parts book and the worth | **This is a parts-book part** from a row; the worth with its cover and the list of lines with no price. | M |
| 5 · the paper and the job | **By part** as a third reading of the material location report, and on one job's page. | S |

Each PR ships its release note, fragment and guide, and updates
`docs/MATERIALS_ON_SITE_ARCHITECTURE.md`; PR 1 also `ACCESS_CONTROL.md`, `GLOSSARY.md` (the site's
materials) and `PROJECT_DOCUMENTATION.md`. No page is added, so `docs/twins/APP_DIRECTORY.md`
changes only its On site entry.

**Where it plugs in:** `onSite.ts` (`partKey`, the line's shape), `onSiteServerSummary.ts` (the
summary into the kernel's shapes), `siteMaterialsRead.ts` and `siteMaterialsReport.ts` (the site's
read and the by-place fold; #329's PR 3 reads the same file for its match list, so whichever lands
second builds on the first), `onSiteFind.ts` (the search and its words), `bookPrice.ts` and the
store's `priceFor`, `JobsMaterialsTab.tsx` (the desk and the new state), `MaterialsOnSiteTab.tsx`,
`DevelopmentPage.tsx` (the line beside the print press), `materialsTabs.ts` (who gets the state),
`boxSearch.ts` (the Go anywhere row), `TallyOnSiteTab.tsx` (`AddPartSheet`, PR 2), `partMatch.ts`
(PR 4), `SiteMaterialsReportModal.tsx` (PR 5).

## What I would not build

- **A fold by closeness.** More than two dozen near twins on one site differ only in a size.
- **A tie that rewrites the ledger**, or one that travels to another site by itself.
- **A site-wide place table**, until two jobs use one name for two spots.
- **A roll-up across every site**, until a second site has boxes.
- **A dollar total with no cover**, or a guessed price for a typed name.
- **A new summary function**, until a site passes about ten jobs with boxes.
- **Any write on this screen**: no count, no correction, no move. Those have their pages.
- **A seventh look on the Development page.** One line and a door.
- **A category for each part** (pipe, fittings, fixtures). It would be a guess over typed names;
  the parts book's own groups arrive with a tie.

## Is this the best we can do?

For *seeing*, yes, with what the ledger holds. One screen answers the eight questions in the table
above, it needs no migration, and it is true the day it merges.

For *the numbers behind it*, no, and no screen can fix that alone. On her site nothing was
recorded for over a week, a few uses were ever pressed, a quarter of the names are not one part
and one piece in twenty has a price. A total on hand of two thousand pieces is the first walk's
count, not today's shelf. The design's answer is to say so first: the freshness leads, the cover
sits beside the worth, and nothing is folded on a guess. What would make the numbers better is
upstream and mostly on other cards: names offered at the source (PR 2 here), deliveries landed from
invoices so a line arrives with a book part, a unit and a price (#209's gaps), and a count that is
a walk of a place, not a hundred boxes falling due on one day.

What a second pass changed: the glance came before the roll-up; the search gained its total; the
fold moved from the ledger to the finished lines; closeness stopped folding anything; a tie became
the site's own; the worth gained its cover; the site-wide place was dropped.

## Grace's calls

Each is one spot on the mock-up, today beside the suggestion.

| Call | Recommended | Also possible |
|---|---|---|
| 1 · where it lives | One screen on the On site tab, with doors from the desk, the Development page and Go anywhere | A seventh look on the Development page |
| 2 · who sees it | The owner, the office and a primary with money; a superintendent with no money | The office and the owner only |
| 3 · how names fold | The same words by themselves; nearly the same asks once, for that site | No fold; or every tie company-wide |
| 4 · the worth | What is known, with its cover beside it | Hidden until half the lines have a price |
| 5 · places | A place per job, folded by name on the screen | A site-wide place, with its migration |
| 6 · the order | PR 1, look on the site, then PR 2 before the stickers walk | The whole train at once |

## How to verify

- Dev server from a worktree, `/dev-login?as=1`. Prod is the only database: read, never write.
  PR 1 writes nothing, so its walk is the real site itself, read only, as the dev and through
  **View as** for the Assistant, the Primary and the Superintendent.
- PR 1: the kernel's tests hold the roll-up's totals equal to the sum of `containerLines` over the
  same ledger, with two spellings in one box each keeping its count; the site's totals on the
  screen equal the paper's counts line; the screen at 375, 768 and 1400, light and dark.
- PR 2 and later, where something is written: the ZZ test job's boxes (ZZ1, ZZ2).
- PR 3: the migration on a throwaway Postgres before the push; a tie made, read on a second
  browser, undone.
- The mock-up was checked at 375, 768 and 1400 wide, light and dark, with no sideways scroll.
- Made-up names, jobs, numbers and counts only, in the repo, the PRs and every screenshot.
