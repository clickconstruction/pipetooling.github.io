---
name: "Materials under one story: the whole life of a part on the Materials page"
number: 304
group: gated
status: asked 2026-11-10 with a screenshot of the Parts Book and the empty right end of its tab strip circled · the three places named Materials read on main the same day, every door to the on-site tools listed by role · three directions drawn at desktop and phone width with the phone's On site tab, a second look and a pick · nothing built
mockup: to-dos/materials-one-story/mockup.html
summary: >
  The word Materials names three places: the Materials page (price, buy, pay), Jobs → Materials
  (the office's desk for cages and boxes) and the Tally's On site tab (the crew's phone). No press
  on the Materials page leads to the other two, label printing opens only on the desk, and the
  page's strip is ordered by who may open a tab. The owner could not remember where label printing
  lives. Three directions are drawn: A, three doors at the right end of today's strip; B, the
  strip regrouped in the order a part lives; C, the pick, four stages with a live figure each
  (Price, Buy, Pay, On site) where On site is one page with every job's boxes, one search across
  them and Print labels and Scan a label as presses in its head. The phone's On site tab gets a
  Scan a label press, a search that reaches every job and an empty job that says where the boxes
  are. A's doors ship first inside C.
next: The owner's pick of a direction (call 1). PR 1, the three doors on today's strip, is the same under every direction and can start on his word.
size: L as a train of eight (S · S · S · M · M · M · S · M); PR 1 alone is S and answers the ask
blocker: The owner's pick. Calls 2 to 8 each gate one later PR, none gates PR 1.
opinion: build — PR 1 this week so label printing is one press from the page he looked on; the strip after his pick
---

# Materials under one story (#304)

## The ask

The owner, 2026-11-10, with a screenshot of `/materials?tab=parts-book` and the empty right end of
its tab strip circled in red: should the Materials page carry doors to the on-site materials tools
and to label printing, and is the page ready for a refresh. He could not remember where label
printing lives, and found Materials on site harder to navigate than he expected.

His standing habit applies: a mock-up first, then *is this the best we can do?* and the
alternative drawn. Nothing is built in this card's first PR.

## What is there today (read on main at v2.6842, 2026-11-10)

### Three places share one word

1. **The Materials page**, `/materials`, `src/pages/Materials.tsx` (2,064 lines). Its tabs come
   from `src/lib/materials/materialsTabs.ts`: Supply houses, Held for suppliers and PO Generator
   left of a divider, then Parts Book, Assembly Book, PO Builder and Purchase Orders. The strip is
   ordered by who may open a tab (`OFFICE_ONLY_TABS`, `READER_TABS`, `BUYER_TABS`), not by what a
   person is doing. Nothing on the page names a cage, a box or a label.
2. **Jobs → Materials, the Materials desk**, `/jobs?tab=materials`,
   `src/components/jobs/JobsMaterialsTab.tsx`. With no job picked: every job with a container,
   sorted by what walked away. With `?job=<id>`: the job's flow row (came in, on site, used,
   missing) and its sections, with **Add a container**, **Print labels**, **Print the manifest**
   and a **Label** press on each box.
3. **Tally → On site**, `/tally?tab=on-site`, `src/components/tally/TallyOnSiteTab.tsx`. The
   crew's phone, one job at a time: the job pill, the flow row, a search whose words are *Find a
   part on this job*, the boxes by place, and inside a box Used, Move to…, Can't find, Short and
   Count this box.

Around them: `/b` (Scan a label, `src/pages/BoxScan.tsx`) and `/b/:code` (the box page,
`src/pages/BoxCode.tsx`, card #294), the search's Boxes on site group, the Development page's
material location report and two Needs you lines.

### Who may open what

| | Office (dev, master, assistant, controller) | Estimator | Primary · superintendent | Helper · subcontractor |
|---|---|---|---|---|
| Materials page | all seven tabs | the two books, PO Builder, Purchase Orders, the Supply houses directory | the two books | not theirs |
| Materials desk | yes | no, `/jobs` is not on the estimator's list | no, the Jobs role gate lands them on Reports (a superintendent also keeps Subs) | no |
| On site tab | yes | yes | yes, the jobs they can see | yes, the jobs they are on the team of |
| Print labels | on a job's desk page | no door | no door | no door |

The rows under a job are gated by `on_site_can_touch_job(job_id)` (`docs/ACCESS_CONTROL.md` →
*Materials on site*), so the database already lets anyone who reaches a job read its boxes. The
desk is office-only because the Jobs page is.

### Every door that exists today

**To the Materials desk** (all lead to `/jobs?tab=materials`, some with `&job=<id>`; office only):

1. Jobs → the **Materials** tab in the page strip (`src/pages/Jobs.tsx`).
2. The Pipeline's ⋯ tools → **Materials desk**, with the count of jobs that lost something this
   week (`JobsStagesToolsMenu.tsx`).
3. The Job window → **Materials** tab → the press to the job's desk page
   (`JobWindowMaterialsPanel.tsx`).
4. Bids → Submittals → Procure, the On site step's **Materials on site** press, once the bid is a
   job (`onSiteDoor` in `src/lib/submittals/procurementBoard.ts`).
5. The Dashboard's Needs you card, two lines: boxes due a count, and what walked away this week
   (`src/lib/needsYou/materialsOnSite.ts`).
6. The header's search: the **Materials desk** door (`src/lib/search/doors.ts`, office gate), and
   each box in the **Boxes on site** group, which opens its job's desk page for the office with
   *Open on the phone screen* beside it (`src/lib/materials/boxSearch.ts`).
7. The phone's box screen: **Print the label** and **Print the manifest**, which open the desk in
   a new tab with `&label=<id>` or `&manifest=<id>`.
8. The guide `see-what-is-on-every-job-site-and-what-walked-away`.

**To the On site tab** (`/tally?tab=on-site`; every role that opens the Tally):

1. The Tally page, where On site is the tab it opens on.
2. The Job Mode card's **Materials on site** press, on the clocked-in job
   (`DashboardJobModeCard.tsx`).
3. The header's search: the **On site** door for everyone but the field roles, and for a field
   role each box in Boxes on site, which opens that box.
4. A label's QR: `prts.co/b/<code>` → `/b/:code` → signed in, the box on the On site tab; signed
   out, the public box page with a sign-in link.
5. `/b`, Scan a label, which forwards a signed-in person to the On site tab without showing its
   typed-code field.
6. The box page's not-found screen: **Open On site**.
7. The guide `keep-track-of-the-material-in-the-cages-and-boxes-on-site`.

**To label printing** (`src/components/materials/LabelsPrintModal.tsx`): opened in one place, the
job view of the desk. Three presses reach it there: **Print labels** (every box), **Label** on a
box's panel, and the `?label=<id>` link the phone's box screen writes.

**To Scan a label**: no press inside the app. Bare `prts.co` lands a signed-out person on `/b`.

**To the material location report**: the Development page's Jobs & bids look, for the office.

### Presses to label printing from the Materials page

**None leads there.** The shortest route leaves the page: Jobs in the header, the Materials tab,
the job's row, Print labels, then the window's own press (*Print 6 labels*). Five presses, and the
person has to know that Jobs holds a second Materials.

### Found in passing, not fixed

Each was read in the code on 2026-11-10 and not walked live.

- **The phone's two print presses send everyone outside the office away.** The box screen draws
  Print the label and Print the manifest for every role, and both open `/jobs?tab=materials`. A
  helper or a subcontractor does not have `/jobs`, an estimator does not either, and a primary or
  a superintendent is landed on Reports. PR 2 fixes it either way call 3 goes.
- **The Procure step's Materials on site press** points an estimator at `/jobs`, which is not on
  the estimator's list.
- **The desk still speaks as the spike.** `JobsMaterialsTab.tsx` reads *Spike: rows live on this
  device only.* under Open a job, and its empty line offers *fill it with demo data*; the file
  heads of the desk and the phone tab say the rows stay on the device until the tables land. The
  tables landed with v2.6039.
- **Three names for one tool**: the Jobs tab reads Materials, its head reads Materials desk, the
  phone reads On site, and the Procure press reads Materials on site.

## The mock-up

`to-dos/materials-one-story/mockup.html`. One page, Light and Dark, with a **Viewing as** switch
(Office, Estimator, Primary or superintendent) that redraws every Materials page frame for that
role. Made-up jobs, parts and prices. Green dashes mark what a direction adds.

- **Today**: the strip with its empty end, the three places, the doors by role.
- **A · doors only**: desktop and phone.
- **B · the strip in the order a part lives**: desktop with On site open, and phone.
- **C · the story strip**: desktop with On site open, the search typed, Price open with *Where it
  is now* on a Parts Book row, and phone.
- **The phone's On site tab**: today, the search reaching every job, a job with no boxes, and
  Scan a label pressed.
- **Is this the best we can do?** and **The owner's calls**.

Checked by eye on 2026-11-10 at 1,400 wide and at a phone viewport, in both themes and all three
roles: no frame overflows its width and the page itself does not scroll sideways.

## The three directions

### A · doors only

Today's strip, untouched, with a third group at its right end: **On site ↗**, **Print labels ↗**,
**Scan a label ↗**. On site opens the Materials desk for the office and the Tally's On site tab
for everyone else. Print labels is the office's: it asks *Which job?* with the jobs that hold a
box, then opens that job's labels window. Scan a label opens a small window with the words and a
typed-code field.

For it: one small PR, no tab moves, no address changes. Against it: a tab that leaves the page
looks like a tab that stays; the strip still reads in the order of who may open it; Print labels
needs a job, so its door opens a question; on a phone the doors sit past the strip's scroll, where
the owner did not look.

### B · the strip in the order a part lives

The same tabs under four captions: **Price it** (Parts Book, Assembly Book), **Buy it** (PO
Builder, Purchase Orders, PO Generator), **Pay for it** (Supply houses, Held for suppliers),
**Track it** (On site, Labels, Scan a label). The desk is mounted in the page as the On site tab.
A role sees the groups it may open. On a phone the four captions are chips over the open group's
tabs.

For it: the strip reads as a sentence. Against it: ten tabs and four captions; Labels and Scan a
label are things done to a box, drawn as tabs beside the tab that holds the boxes; Supply houses
is filed under paying though an estimator opens it before buying; the desk gets a second home;
the captions say what a stage is and not which one needs a hand.

### C · the story strip (the pick)

Four stages across the top of the page, each with one live figure and a badge where a hand is
needed: **Price** (parts in the book, prices checked over 90 days ago), **Buy** (orders open, how
many late), **Pay** (held for suppliers, invoices to move), **On site** (pieces on how many jobs,
boxes due a count, and for the office what walked away this week). Pressing a stage shows its
tabs under it. The row is the one the desk and the phone already draw for one job
(`FlowRow`, `src/lib/materials/flowRow.ts`), one level up.

**On site is the fourth stage and one page.** Its head holds one search (*Find a part or a box on
any job*), **Print labels** and **Scan a label**. Under it, every job with a container; a row's
**Labels** press opens that job's labels window, and the job's name opens its desk page with the
sections it has today. For an estimator, a primary or a superintendent the page is a list of
their jobs with boxes, each opening the Tally's On site tab on that job, with no money drawn.

The last PR lets a part carry its own life: a **Where it is now** column on the Parts Book, with
chips for what is on order, what is on site and what went missing, each a door.

## Is this the best we can do?

A answers the question the owner asked. B answers the one under it. Neither says which part of the
page needs him today, and C does.

The second look changed C three ways. My first C was B with figures on its captions. Asking again
took Labels and Scan a label out of the strip, because neither is a place. It added the search,
because *where is this part* was the trouble behind *where is label printing*. And it added the
row for a primary and a superintendent, who have no way from the Materials page to a box today.

What I did not draw: a Materials page that swallows the Tally's On site tab. The crew's screen is
one column with 48 px presses, and it stays where the crew already is.

What C costs that A does not: four figures to read when the page opens (each has an existing
source, listed under the plan), and guides that name a tab by its place in the strip.

| | Today | A | B | C |
|---|---|---|---|---|
| Presses to Print labels from the Materials page | no door; five after leaving | 3 | 3 | 3, or 2 with On site open |
| What the strip's order says | who may open a tab | the same, plus three ways out | the order a part lives | that order, and where a hand is needed |
| Names for the on-site tool | three | three | one, two homes | one |
| A primary or a superintendent | two books | two books, two doors | Price it, Track it | Price, On site, their jobs' boxes |
| One part across every job | the header's search, for boxes the store has read | the same | the same | the page's search and the phone's Every job |
| On a phone | a strip that scrolls | doors past the scroll | four chips, then tabs | four stages on the first screen |
| Size | | S | M | L as a train, A's PR first |

## Recommendation

**C, with A's doors shipped first.** PR 1 puts On site, Print labels and Scan a label on today's
strip, so label printing is three presses from the page the owner looked on, this week, whatever
he picks after. PRs 2 to 4 fix the phone. PRs 5 and 6 turn the three doors into the fourth stage
and draw the strip around it. If the owner picks A, the train stops after PR 4. If he picks B, PR
6 draws captions in place of figures and the rest stands.

## The owner's calls

1. **Which direction?** My pick: C, with A's doors first.
2. **Does the desk move to the Materials page, or live in both places?** My pick: both for one
   release (one component, two mounts), then Jobs → Materials becomes a door to
   `/materials?tab=on-site`.
3. **May anyone who can open a job's boxes print its labels and its manifest?** Today only the
   office can, and the phone's two print presses send everyone else away. My pick: yes. A label
   shows a stencil and a code and the manifest shows parts and counts; neither shows money.
4. **Is Scan a label the phone's camera app plus a typed code, or a camera inside the app?** My
   pick: the camera app and the typed code first, which need no permission and no new library. A
   camera inside the app only if the crew asks.
5. **Does Every job on the phone mean every job the person may open, or only the jobs they are
   on?** My pick: every job they may open, the gate the boxes already use.
6. **Do the stages read Price · Buy · Pay · On site, or Price it · Buy it · Pay for it · Track
   it?** My pick: the short four. On site is the name the crew already knows.
7. **Does what walked away show on the On site stage for the office alone?** My pick: yes, as the
   desk does today.
8. **Where it is now on a Parts Book row: build it, or stop at the search?** My pick: build it
   last, after a week with the search.

## Where it plugs in

- **Exists**: `materialsTabsFor` and its tests (`materialsTabs.ts`); the desk
  (`JobsMaterialsTab.tsx`) and its hook `useOnSiteDesk` over `on_site_job_summary`
  (`src/lib/materials/onSiteStore.ts`); `LabelsPrintModal` and `ManifestPrintModal`, both windows
  on `<body>` that take the containers, lines and places as props; the typed-code helpers
  `boxPageCode`, `typedCodeWords` and `boxPagePath` (`src/lib/materials/boxPage.ts`,
  `boxPageMemory.ts`); `FlowRow`; `boxDeskLink` and `boxOnSiteLink`; `searchLines` and
  `searchContainers` for one job (`src/lib/materials/onSite.ts`); the gate
  `on_site_can_touch_job`.
- **New**: a doors kernel (which door, for which role, to where); a Scan a label window; a
  cross-job find RPC; the `on-site` tab on the Materials page; a stages kernel and its strip; a
  whereabouts read per part.
- **Docs that move with it**: `docs/MATERIALS_TABS_ARCHITECTURE.md`,
  `docs/MATERIALS_ON_SITE_ARCHITECTURE.md`, `docs/ACCESS_CONTROL.md`, `GLOSSARY.md`,
  `PROJECT_DOCUMENTATION.md`, and the two on-site guides plus `track-what-your-materials-cost`.

## The plan

Each PR is cut from main alone, with its release note, its fragment and its guide change.

1. **The three doors on today's strip (S).** `src/lib/materials/materialsDoors.ts` with tests:
   the doors a role gets and where each leads (On site: the desk for the office, the Tally for an
   estimator, a primary and a superintendent; Print labels: the office; Scan a label: everyone).
   `Materials.tsx` draws the group after the last tab. A *Which job?* window lists the jobs
   `useOnSiteDesk` holds and opens `/jobs?tab=materials&job=<id>&labels=all`; the desk's job view
   reads `labels=all` beside today's `label=<id>`. `ScanLabelWindow.tsx`: the words and the typed
   code, opening `/b/<code>`. The search gains a Print labels door. Client only.
2. **The phone prints and scans in place (S).** A **Scan a label** press beside the On site tab's
   search, opening PR 1's window as a sheet. The box screen's Print the label and Print the
   manifest open the two windows in the tab, from the rows it already holds, in place of the link
   to the desk. If call 3 is no, the two presses are drawn for the office alone. Client only.
3. **An empty job says where the boxes are (S).** `otherJobsWithBoxes` over the desk's summary,
   drawn through `EmptyState`: *No containers on JP1071 yet. Your boxes are on 2 other jobs.*,
   the jobs as rows, then **Add a container**. Client only.
4. **The search reaches every job (M).** A read-only RPC, SECURITY INVOKER under the gate: the
   lines on hand whose part, maker or box matches a term, across the jobs the caller may touch,
   capped. The On site tab's search gets **This job · Every job**; this job's boxes come first.
   One migration, pushed after the merge, then the types PR.
5. **On site on the Materials page (M).** `on-site` joins `MATERIALS_TABS` for every reader of
   the page. The office mounts the desk (lifted to `src/components/materials/`, reading its own
   jobs); the other roles get their jobs with boxes as doors to the Tally. The head holds PR 4's
   search, Print labels and Scan a label, and a row's **Labels** press. PR 1's three doors fold
   into the tab.
6. **The story strip (M).** `src/lib/materials/materialsStages.ts` with tests: the stage of each
   tab, the stages a role sees, each stage's figure and badge. Sources: the parts book's count
   and stale prices (the read behind *What your materials cost*), open and late purchase orders,
   the Held for suppliers total (`jobAccountsFlow.ts`), the desk's summary. The tabs become the
   open stage's row. `?tab=` addresses do not change.
7. **Jobs → Materials becomes a door (S).** After one release, on call 2: `/jobs?tab=materials`
   forwards to `/materials?tab=on-site` with its `job`, `label` and `manifest`; `boxDeskLink`
   (and its edge copy, `scripts/edge-kernels.mjs`), `materialsNeedsHref`, the tools menu, the Job
   window's panel and `doors.ts` follow. An estimator's Procure press then lands on a page they
   may open.
8. **Where it is now on a Parts Book row (M).** On call 8. A read per page of parts: on order
   (open purchase order items), on site (the ledger's sum by `part_id`, with the box count),
   missing this week. Chips as doors. A line landed from an invoice with no link to the book
   shows nothing until it is linked.

## How to verify

- **Roles**: the sample account of each role through the dev seat's `view_as`, or the twins'
  dev-login (`/dev-login?as=twin:<role>`), at 1,400 wide and at 375. Each of the nine roles opens
  only doors that land: no press ends on the Dashboard or on Reports.
- **Data**: test job 972 holds the real boxes of #209's week of use, read only. Anything written
  is a `ZZ Test` job with a `ZZ Test` container, deleted before the session ends
  (`AGENTS.md` → *ZZ test rows need no approval*).
- **Labels**: from `/materials`, count the presses to the print dialog. A window that prints is
  checked with the test's print spy and by a headless print to PDF; the browser's own print
  dialog blocks the walking tool.
- **The phone**: a held write flushes when the Browser pane hides, so press and undo in one call
  when walking a count.
- **Gotcha**: `boxDeskLink` is copied to the edge functions; change both copies in PR 7.
