---
name: "Materials under one story: the whole life of a part on the Materials page"
number: 304
group: close
status: asked 2026-11-10 with a screenshot of the Parts Book and the empty right end of its tab strip circled · four directions drawn the same day, D being the owner's own idea (three named groups) · the owner's go the same day (good enough for a pass with live users, build it all) · built the same day as two client-only PRs on the card's picks, v2.6851 the Materials page (the three groups, On site as a tab with one search across jobs, Print labels, Scan a label) and v2.6852 the phone (This job · Every job, an empty job naming the other jobs, Scan a label, the prints in place) · the labels window's tape choice drawn and built the same day on his yes · left: the owner's word on the third word and the order after his pass with live users, the badges on Plan and Purchase, Jobs → Materials as a door, Where it is now on a Parts Book row
mockup: to-dos/materials-one-story/mockup.html
summary: >
  The word Materials names three places: the Materials page (price, buy, pay), Jobs → Materials
  (the office's desk for cages and boxes) and the Tally's On site tab (the crew's phone). No press
  on the Materials page leads to the other two, label printing opens only on the desk, and the
  page's strip is ordered by who may open a tab. The owner could not remember where label printing
  lives. Four directions are drawn: A, three doors at the right end of today's strip; B, the
  strip regrouped in the order a part lives; C, four stages with a live figure each; and D, the
  owner's own idea and the pick, three named groups over the strip (Purchase, Plan and a third
  word, Sort as he gave it) with a badge on a caption where a hand is needed. D keeps C's On site
  page: every job's boxes, one search across them, and Print labels and Scan a label as presses.
  The phone's On site tab gets a Scan a label press, a search that reaches every job and an
  empty job that says where the boxes are. A's doors ship first.
next: The owner's pass with live users. The third word reads Track and Plan comes first, both the card's picks and each one line to change. Then the leftovers under Where it stands, one small PR each.
size: L, shipped as two PRs (M · M); each leftover is S or M
blocker: none. The owner's pass with live users.
ver: v2.6851 · 6852
opinion: your call — the build is live on the card's picks; say the word on Track against Sort and on the order
---

# Materials under one story (#304)

## The ask

The owner, 2026-11-10, with a screenshot of `/materials?tab=parts-book` and the empty right end of
its tab strip circled in red: should the Materials page carry doors to the on-site materials tools
and to label printing, and is the page ready for a refresh. He could not remember where label
printing lives, and found Materials on site harder to navigate than he expected.

His standing habit applies: a mock-up first, then *is this the best we can do?* and the
alternative drawn. Nothing is built in this card's first PR.

## Where it stands

The owner, 2026-11-10, after direction D was drawn: *I think this is good enough for a pass with
live users, please build it all and let me know when live.* He did not answer the calls, so the
build takes the card's picks. Two client-only PRs, no migration and no edge function:

- **v2.6851, the Materials page.** The strip in three named groups (Plan · Purchase · Track), On
  site as a tab for every role that opens the page, one search across every job, the office's
  desk mounted there with a row's **Labels** and **Open on the phone screen**, the other roles'
  jobs with boxes as doors to the Tally, and **Print labels** and **Scan a label** as presses.
  This is the plan's PRs 1, 2 and 6 as one change, since a door built in the morning and replaced
  by a tab in the afternoon is waste.
- **v2.6852, the phone.** **This job · Every job** under the search, an empty job naming the
  other jobs that hold a box, **Scan a label**, and a box's label and manifest printing in the
  tab for every role. This is the plan's PRs 3, 4 and 5.

**The search needed no new read on the server.** The plan's PR 5 named an RPC; the build reads
the on-site store's desk load instead (`lib/materials/onSiteFind.ts`), the read the header's
Boxes on site already makes, loaded on the phone only when Every job is pressed or a job is empty.

**The calls as built** (each the card's pick): 1, D. 3, yes: whoever opens a job's boxes prints
its labels and its manifest. 4, the camera app and the typed code. 5, every job the person may
open. 6, **Track** (`MATERIALS_GROUP_WORDS.track` in `src/lib/materials/materialsGroups.ts`;
the owner wrote Sort). 7, the money for the office alone. 9, **Plan first**, Purchase Orders
under Purchase (the order of `MATERIALS_TABS`).

**Fixed on the way**, of the four found in passing: the phone's two print presses no longer send
anyone away, and the desk's words left from the spike are gone. Still open: the Procure step's
press points an estimator at `/jobs` (it lands once Jobs → Materials is a door).

**Left**, each a small PR on the owner's word after his pass with live users:

1. The third word and the order, if he wants Sort or today's order.
2. Badges on Plan (prices checked over 90 days ago) and Purchase (invoices to move onto a job
   account). Only the third group wears one today.
3. Jobs → Materials becomes a door to `/materials?tab=on-site` (call 2, after a release; the
   plan's PR 7).
4. *Where it is now* on a Parts Book row (call 8; the plan's PR 8).
5. A camera inside the app, only if the crew asks (call 4).

**Asked next, drawn, then built on his yes** (the owner, 2026-11-10, with the Brother PT-D610BT
and tape in hand: should the new view make label printing more apparent).
`tape-labels-before-after.html` drew it and PR #7566 builds it: *Paper sheet* and *Brother tape*
are the labels window's first choice, the three first-time steps sit in the window, **Print 1
test strip** and **None · Every box** are new, and a computer that printed tape opens on tape.
Client only; its release note and fragment carry the detail. Still his: three strips off the
real printer on 18 mm tape (the PT-D610BT printed 24 mm runs straight over USB from Chrome, v2.6865 and v2.6881), and the tape width in the
box, since the app lays out 18 and 24 mm only.

**Walked** on localhost against prod as the dev login, read only, at 1,400 wide and at 375: the
strip, On site with the three real jobs, the search, Print labels through *Which job?* to a ZZ
Test job's labels, Scan a label; on the phone an empty job naming three others, Every job finding
a part on another job, and a box's label and manifest opening in the tab. Nothing was written.
An estimator's, a primary's, a superintendent's and a helper's views were not walked; the render
smokes hold them.

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
  a superintendent is landed on Reports. PR 3 fixes it either way call 3 goes.
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
- **D · Purchase, Plan, Sort**: the owner's three words on today's strip with nothing moved, the
  same words in the order a part lives with On site open, and phone. A switch at the top swaps
  the third word between Sort, Track and Stock in every frame.
- **The phone's On site tab**: today, the search reaching every job, a job with no boxes, and
  Scan a label pressed.
- **Is this the best we can do?** and **The owner's calls**.

Checked by eye on 2026-11-10 at 1,400 wide and at a phone viewport, in both themes and all three
roles, D's frames with each third word: no frame overflows its width and the page itself does
not scroll sideways.

## The four directions

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

### C · the story strip

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

### D · Purchase, Plan, Sort (the owner's idea, the pick)

The owner, 2026-11-10, after seeing A, B and C: *I think we could improve the header into the
groups of Purchase, Plan, Sort*, with today's strip pasted under it. The strip already has three
groups, so naming them moves nothing.

- **Each word is a quiet caption over its group**, small capitals in the muted colour, with a
  hairline between groups in place of the bar. The open tab's group reads in blue.
- **A caption wears a badge only when its group needs a hand**: old prices on Plan, invoices to
  move on Purchase, boxes due a count on the third group, and for the office what walked away.
  That is the one thing C's four figures were for, without a row of tiles to read.
- **On site is a tab that stays on the page**, C's On site page as drawn. **Print labels** and
  **Scan a label** are presses beside it, pills with a glyph, since each does one thing and
  neither is a place.
- **On a phone** the three words are chips in one row with a dot where a hand is needed, and the
  open group's tabs sit under them.

Two frames show the order. **D1** is his list as pasted, today's order: Purchase (Supply houses,
Held for suppliers, PO Generator), Plan (Parts Book, Assembly Book, PO Builder, Purchase Orders),
then the third group. **D2** follows a part: Plan (Parts Book, Assembly Book, PO Builder),
Purchase (Purchase Orders, PO Generator, Supply houses, Held for suppliers), then the third group.

For it: three words in place of four, and Buy against Pay was the weak split in B and C; every
tab stays one press away; nothing to read when the page opens; Plan is a truer word than Price
for the two books and PO Builder; Supply houses lands under Purchase, where an estimator looks
for it. Against it: in D1 the tab named Purchase Orders sits under Plan; D2 moves four tabs, so
the office's first tab changes from Supply houses to Parts Book; the office's strip fills 1,175
of the frame's 1,208 px, so a narrower window scrolls it as today's does; and the third word.

**The third word.** Sort already means something else in the app: on the Tally and in Banking it
is sorting card purchases onto jobs (the search answers *sort purchases* with the Tally and *card
sorting* with Banking). Beside Purchase it can read as that. On site it fits the first step,
where a delivery waits as Unsorted until it is put in a cage, and less the counting and what
walked away. The owner's own words for this tool on 2026-10-28 were *a material tracking
system*. The mock-up draws Sort as asked and swaps in Track or Stock from a switch.

## Is this the best we can do?

A answers the question the owner asked. B answers the one under it. Neither says which part of the
page needs him today. C does, with a row of four tiles. D, the owner's idea, does it with a badge
on a caption and keeps every tab one press away, so D is the pick. It keeps C's On site page,
its search and the two presses.

The second look changed C three ways. My first C was B with figures on its captions. Asking again
took Labels and Scan a label out of the strip, because neither is a place. It added the search,
because *where is this part* was the trouble behind *where is label printing*. And it added the
row for a primary and a superintendent, who have no way from the Materials page to a box today.

What I did not draw: a Materials page that swallows the Tally's On site tab. The crew's screen is
one column with 48 px presses, and it stays where the crew already is.

What C costs that A does not: four figures to read when the page opens, a stage's tabs behind a
press, and guides that name a tab by its place in the strip. D drops the first two.

What the owner's idea changed: his three words beat my four stages. I would change two things in
his list, both his calls: put Plan first (call 9), and weigh the third word (call 6).

| | Today | A | B | C | D |
|---|---|---|---|---|---|
| Presses to Print labels from the Materials page | no door; five after leaving | 3 | 3 | 3, or 2 with On site open | the same as C, and Print labels is a press on the strip |
| What the strip's order says | who may open a tab | the same, plus three ways out | the order a part lives | that order, and where a hand is needed | three named groups, a badge where a hand is needed |
| Names for the on-site tool | three | three | one, two homes | one | one |
| A primary or a superintendent | two books | two books, two doors | Price it, Track it | Price, On site, their jobs' boxes | Plan and the third group, the same boxes |
| One part across every job | the header's search, for boxes the store has read | the same | the same | the page's search and the phone's Every job | the same search, on the On site tab |
| On a phone | a strip that scrolls | doors past the scroll | four chips, then tabs | four stages on the first screen | three chips in one row, then tabs |
| Size | | S | M | L as a train, A's PR first | L as a train with a smaller strip PR, A's PR first |

## Recommendation

**D, the owner's three groups, with A's doors shipped first.** PR 1 puts On site, Print labels and
Scan a label on today's strip, so label printing is three presses from the page the owner looked
on, this week. PR 2 names the three groups and draws the two presses as presses. PRs 3 to 5 fix
the phone. PR 6 makes On site a tab of the page with its search. My two changes to his list are
his to take or leave: Plan first, and Track for the third word.

## The owner's calls

1. **Which direction?** My pick: D, the owner's three groups, with A's doors first.
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
6. **Is the third word Sort, Track or Stock?** Sort already names sorting card purchases on the
   Tally and in Banking. My pick: Track, the owner's own word for this tool. Sort is drawn as he
   asked.
7. **Does what walked away show on the On site stage for the office alone?** My pick: yes, as the
   desk does today.
8. **Where it is now on a Parts Book row: build it, or stop at the search?** My pick: build it
   last, after a week with the search.
9. **Do the groups keep today's order (Purchase · Plan · Sort) or follow a part (Plan · Purchase ·
   Sort)?** My pick: Plan first, with Purchase Orders under Purchase. The page then opens on its
   first tab, and a primary's two groups read left to right.

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
  groups kernel and the captioned strip; a cross-job find RPC; the `on-site` tab on the
  Materials page; a whereabouts read per part.
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
2. **The three groups on the strip (S).** `src/lib/materials/materialsGroups.ts` with tests: the
   group of each tab, the groups a role sees, the order (call 9) and each group's badge.
   `Materials.tsx` draws a caption over each group with a hairline between, and Print labels and
   Scan a label as presses. A phone gets the three chips over the open group's tabs. Badges read
   what the page already loads: prices checked over 90 days ago (the read behind *What your
   materials cost*), invoices to move onto a job account (the Supply houses tab's worked list),
   boxes due a count and what walked away (the desk's summary). `?tab=` addresses do not change.
   The third word is one constant (call 6). Client only.
3. **The phone prints and scans in place (S).** A **Scan a label** press beside the On site tab's
   search, opening PR 1's window as a sheet. The box screen's Print the label and Print the
   manifest open the two windows in the tab, from the rows it already holds, in place of the link
   to the desk. If call 3 is no, the two presses are drawn for the office alone. Client only.
4. **An empty job says where the boxes are (S).** `otherJobsWithBoxes` over the desk's summary,
   drawn through `EmptyState`: *No containers on JP1071 yet. Your boxes are on 2 other jobs.*,
   the jobs as rows, then **Add a container**. Client only.
5. **The search reaches every job (M).** A read-only RPC, SECURITY INVOKER under the gate: the
   lines on hand whose part, maker or box matches a term, across the jobs the caller may touch,
   capped. The On site tab's search gets **This job · Every job**; this job's boxes come first.
   One migration, pushed after the merge, then the types PR.
6. **On site on the Materials page (M).** `on-site` joins `MATERIALS_TABS` for every reader of
   the page, in the third group. The office mounts the desk (lifted to
   `src/components/materials/`, reading its own jobs); the other roles get their jobs with boxes
   as doors to the Tally. The head holds PR 5's search, and a row's **Labels** press. PR 1's On
   site door becomes the tab.
7. **Jobs → Materials becomes a door (S).** After one release, on call 2: `/jobs?tab=materials`
   forwards to `/materials?tab=on-site` with its `job`, `label` and `manifest`; `boxDeskLink`
   (and its edge copy, `scripts/edge-kernels.mjs`), `materialsNeedsHref`, the tools menu, the Job
   window's panel and `doors.ts` follow. An estimator's Procure press then lands on a page they
   may open.
8. **Where it is now on a Parts Book row (M).** On call 8. A read per page of parts: on order
   (open purchase order items), on site (the ledger's sum by `part_id`, with the box count),
   missing this week. Chips as doors. A line landed from an invoice with no link to the book
   shows nothing until it is linked.

C's four tiles are not in the plan. If the owner asks for them later, they are one PR over the
groups kernel.

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
