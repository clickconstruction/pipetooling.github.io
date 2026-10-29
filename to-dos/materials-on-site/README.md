---
name: "Materials on site: cages, boxes and counts"
number: 209
group: close
status: built 2026-10-29 on the owner's go (build all of it and take it to live testing) · PR 1 v2.6039 the ground (migration 20261029010000 pushed, types #6414) · PR 2 v2.6041 the phone · PR 3 v2.6043 the office · PR 4 v2.6045 the photo sweep (migration 20261029020000 pushed) · the live test's fixes v2.6049, v2.6050, v2.6054 (the app makes a job's Drive folders) and v2.6055 · left: the end-to-end photo test on test job 972, then a week of use
mockup: to-dos/materials-on-site/mockup.html
summary: >
  Big jobs leave fittings, pipe and fixtures on site in stencilled cages and boxes (A1, A2, B1 …).
  The app records when a procurement line was delivered and nothing after that: not which cage a
  part is in, how many are left, who took some, or why a number changed. The design is a ledger of
  movements, never a typed-over quantity: a press names what happened to some of a part in a
  container, the number on the screen is the sum, and the loss report is the same rows read a
  second way. The field gets a third tab on the Job Parts Tally, On site, one press from the Job
  Mode card. The office gets a Materials tab on the Jobs page with a door in the Job window, the
  Pipeline's ⋯ tools and the bid's Procure step. Photos of a count are V2 through the Drive path
  the owner chose; engraved parts are V3 on the same table.
next: Finish the end-to-end photo test on test job 972 (clear the hand-made pictures link or share it with the app's account, press Make the job's Drive folders on the Documents tab, and the waiting box photo files on the sweep's next run), then use it for a week; the leftovers under Where it stands are one small PR each, the parts-book price first.
size: L, shipped as four PRs and four fixes; each leftover is S
blocker: none. The owner's live test on test job 972.
ver: v2.6039 · 6041 · 6043 · 6045 · 6049 · 6050 · 6054 · 6055
opinion: your call — the code is done; the live test and the week of use are yours, and the parts-book price is the one leftover worth building before them
---

# Materials on site: cages, boxes and counts (#209)

## The ask

The owner, 2026-10-28: a material tracking system for materials left on big job sites in
stencilled cages and boxes (A1, A2, …). An office page reached from the Jobs pipeline and the Bids
tab where staff see what is where and update quantities with reasons. A field view in Job Mode or
the Dashboard where crews search or browse what is on site and update it easily. Photos of a box or
cage as a point in time (V2). Laser-engraved installed parts (V3). In his words: *"Help me think
through all of this and then help me in a new session come up with mock-ups of what we could build.
Once you've made those mock-ups, look at the app holistically and ask yourself, is this the best we
can do? Are we being as robust and making it as easy as possible for people to update and find
things and then report when they're missing."*

The owner's go came 2026-10-29: build all of it and take it to live testing. A design spike of
2026-10-28/29 built the whole thing against a local store first; the four PRs then put it on the
tables, and the live test's fixes followed the same day (Where it stands).

## What the app has today (verified 2026-10-28)

- **The parts book** is `material_parts` (name, manufacturer, part type, service type, link, notes,
  order increment; no SKU, unit, price or photo column), prices per supply house in
  `material_part_prices` with `material_part_price_history` (old price, new price, who, a note).
  UI `src/pages/Materials.tsx`, tabs in `src/lib/materials/materialsTabs.ts`, search kernel
  `src/lib/materials/materialsFilters.ts`, map `docs/MATERIALS_TABS_ARCHITECTURE.md`. Live, the
  parts book opens on *What your materials cost*, and most bid dollars sit on a price checked
  more than 90 days ago, with a *prices look wrong* box beside it.
- **A job's materials today** run bid → Counts → takeoff part lines → submittal parts
  (`bid_submittal_item_parts`: quantity, part, procure key, stage, supply house) → the procurement
  log (`bid_procurement_items`: ordered, expected, delivered, PO ref, stage, tag, part key; dates,
  no quantity) whose four steps are Waiting on the GC · To order · On order · On site
  (`src/lib/submittals/procurementBoard.ts`, panel `src/components/bids/SubmittalProcurementPanel.tsx`
  with a bulk *Mark N delivered today*, Bids → Submittals step 8 Procure, a side track always open).
  Live, the panel groups its lines by what to do next (Order now · No order-by date yet · On order ·
  Waiting on their answer · Not sent to the GC yet) with *Dates…* and *Mark ordered…* on each.
  Purchase orders (`purchase_orders`, `purchase_order_items` with a quantity) have no job id; the job
  link is `jobs_tally_parts.purchase_order_id`. Supply-house credits and returns are money only.
- **Nothing records where a part is, how many are left, or why a number changed.** No box, cage,
  truck or warehouse; no received, installed, returned or on-hand quantity; no adjustment with a
  reason. Patterns to borrow: `bid_submittal_items.reason_kind` + `reason_note` chips, and the
  price history's old value, new value, who and a note.
- **The field's parts screen is the Job Parts Tally** at `/tally` (`src/pages/JobTally.tsx`, map
  `docs/JOB_TALLY_ARCHITECTURE.md`): one column at 480 px, 48 px targets, already in the
  subcontractor and helpers allowlist (`src/lib/layoutRouteAccess.ts`). Two tabs, filled pills:
  `?tab=transactions` (card purchases) and `?tab=materials` (state `materials-estimate`, the tab
  reads *Materials Estimate*): a trade picker, a job picker in a bottom sheet with *Show my jobs
  only*, *Fixture or tie-in*, *Search part* over `material_parts` by name or manufacturer, a
  quantity with ↓ ↑ and Remove, *Send to Office* → `jobs_tally_parts` + RPC
  `create_po_from_job_tally`. A buy request, not an inventory. A helper on no job's team reads
  *No jobs assigned. Ask your supervisor to add you as a team member on a job.* The map plans to
  extract each tab as its own component, the Materials Estimate tab first.
- **The office's view of a job's parts** is the Jobs page's **Parts** tab
  (`src/components/jobs/JobsPartsTab.tsx`, `/jobs?tab=parts`): the tally parts per job with their
  costs, beside Pipeline, Billing, Team, Subs, Job Summary and Inspections.
- **Job Mode** is the crew's Dashboard (`src/components/jobMode/DashboardJobModeCard.tsx`; the press
  bar `JobModePressBar.tsx` with its rows from `src/lib/jobMode/pressBar.ts`: Turnaway · % done ·
  Clock out, then Leave report and the day's press; footer tabs Dashboard · Schedule · Inbox ·
  Customers in `src/components/dispatchMode/DispatchModeFooter.tsx`). The card's quiet link row
  holds Write up a change and Hand the phone to sign. Live as the sample helper at 375 with no job
  on the schedule, the card reads *No schedule for today* with Clock In, and the Needs you line is
  hidden. Field roles: `helpers` and `subcontractor` (`isSubcontractorLikeRole`).
- **Pipeline doors:** the row icons (`src/components/jobs/StagesRowActionButtons.tsx`: Test report,
  the gavel, Release of lien, G702, Hazmat, at most four a row); the ⋯ tools menu
  (`JobsStagesToolsMenu.tsx`: Lien desk with its count, Legal desk as a link to its page, Put a GC
  on notice…, then sort and filters); the Job window `/jobs?jobDetail=<id>` (`JobWindowModal.tsx`,
  tabs Job · Edit · Bill · Costs · History · Documents from `src/lib/jobs/jobHistoryTab.ts`); deep
  links in `src/lib/jobs/stagesDeepLinks.ts`; the one-door rule in `src/lib/jobs/stagesRowDoors.ts`.
  #182's rule (`to-dos/desks-as-pages/README.md`): a desk is a page with its own address when a
  person stays in it, it has its own sections and the page under it goes unread; a window is for
  one act.
- **Bids:** the per-bid tab registry `src/lib/bids/bidsTabAccess.ts`; a bid reaches its job through
  `jobs_ledger.bid_id`, and `src/components/bids/BidWonJobActions.tsx` has *Open the job*.
- **Photos:** the owner decided 2026-10-24 (#164) that photos always live in Google Drive with no
  app copy; #189 PR 5b designs the path (the phone shrinks the shot, a bucket holds it, the
  `photo-save` sweep moves it to the job's Drive folder and a row keeps `drive_file_id`). No scanner
  exists; QR drawing does (`qrcode.react` in `src/lib/billing/payQr.ts`, `BillQrModal.tsx`).
- **Offline:** no write queue; #163 designs one with a bar at the top of every screen and the rule
  *never queue a money write*; reads keep their last page (`src/lib/keptRead.ts`, `useKeptRead`,
  v2.6031), and `OfflineRetryPanel` draws a failed read.
- **Money hooks nearby:** `gc_superintendent_checks.stored_on_site` + `photo_url` on the GC bill-day
  walk, the *materials presently stored* column in `src/lib/aiaPayApplicationLines.ts`, and #171's
  claim line *materials left on site*.
- No card or doc covers inventory, truck stock, cages, loss, labels or engraving.

## The design

### The idea: a ledger of movements, never a typed-over number

Nobody types a quantity into a box. A press names what happened to some of a part in a container
on a job, and the number on the screen is the sum of the rows. Delivered adds. Used, Can't find,
Moved out, Returned, Taken and Damaged take away. A Count is a point in time that corrects the sum
and leaves the difference on record. Because every change carries a reason, *report when they are
missing* is the same rows read a second way, a count can carry a photo in V2, and an engraved part
in V3 is a movement row that also carries an item id.

### Entities (V1)

- **Container** (`job_containers`): job, label (the stencil: A1, A2, B1 …), kind (cage, box,
  loose), a where line (*level 2 corridor*), retired, a token for its QR. Per job: a cage that
  moves to the next job gets a new row there, so a label means one thing on one site. A nullable
  asset id can come later for the steel itself. The truck and the shop are destinations of a
  movement, not containers, so a job's on hand stays the job's and the note says whose truck.
- **Movement** (`job_material_movements`): job, part (`material_parts.id`, or a free-text name
  the office ties to a book part later), quantity, reason (delivered, moved, used, returned,
  taken, cannot find, damaged, counted), container from (null on a delivery), container to (null
  on used, returned, taken, cannot find, damaged), note, who, when, a source (procurement line or
  PO), a photo row (V2), an item id (V3, nullable from day one). Append only: a wrong press gets a
  correcting row with its own reason.
- **On hand** is a view or kernel over movements per job, container and part: delivered + moved
  in − used − moved out − returned − taken − cannot find − damaged, reset by the last count.
  Expected is the sum without the counts. Missing is expected minus the last count where a count
  exists; a count above expected reads found.

### Where numbers start, without typing anything twice

When the office marks a procurement line delivered (the press it already makes on the Procure
step), the app writes the Delivered movement into the job's **Unsorted** container with the
quantity from the submittal part line behind the procure key or the PO line, and offers *Put them
in a container…* only if the office wants to say. A line with no quantity anywhere is delivered as
*quantity unknown* and the first count on site sets it. A tally request that became a PO seeds its
delivery when the PO is received. A running job with cages already full starts from a first count:
the empty state offers *Add a container*, *Print labels* and *Start from the bid's parts*, which
puts every On site line into Unsorted as quantity unknown so the walk has a list to confirm.

### The field: an On site tab on the tally, one press from the Job Mode card

- **The door:** a link *Materials on site* in the Job Mode card's quiet link row, beside Write up a
  change. It opens `/tally?tab=on-site` on the clocked-in job; with no job it opens on the picker.
  The press bar and the four footer tabs do not change.
- **The first screen:** the job's containers as big cards, the stencil first, with the part count
  and when it was last counted. Amber when a count is due or a line cannot be found. Unsorted holds
  what the office marked delivered until a crew puts it away. A search box finds a part across the
  whole site (*3/4 copper 90* reads A2 14 · Unsorted 25 · B1 6) and a miss offers Short. The tab has
  no trade picker: the job's own trade scopes the parts-book search.
- **A container open:** its lines with the quantity and four presses each: **Used** (the daily
  press: a number sheet with quick presses, then *Mark 4 used*, which says what it will do with its
  count), **Move to…** (one sheet for every destination: another container, the truck, the shop,
  back to the supply house, damaged or scrap, a new container), **Can't find** (flags the line
  amber for the office) and **Short** (a tally request, so what we have and what we need are one
  screen). *Count this box* at the top walks the lines one at a time: the number the app expects,
  a big *14 is right*, or a different number saved as a Count row. *Add a part* finds the parts book
  or takes a typed name, marked free text.
- **No signal:** the tab opens from its kept read with the numbers muted, and a press waits under
  #163's bar and goes out in order. A quantity is not money, so #163's rule allows it (call 6).
- **The gate:** the job's team and the office, the tally's own gate. A container's QR opened by
  someone not on the team reads the lines and offers no press, with the tally's words.
- 48 px targets, one column, the tally's job picker and parts-book search, plain words on every
  line a crew reads, a guide shipped with the tab.

### The office: a Materials tab on the Jobs page, with three doors

The office stays on this screen and it has four sections, so by #182 it is a page with its own
address. The holistic pass moved it from a new route to a **tab of the Jobs page beside Parts**,
`/jobs?tab=materials&job=<id>`, where the office already reads a job's parts. With no job picked
the same tab is the **desk across jobs**: one row per job with containers, lines on site, missing
this week with the money, last counts and credits due. With a job it has four sections: **On site
by container** (A1, A2 … with on hand beside expected, the differing lines amber), **Movements**
(the ledger, filterable by reason, person and container), **Missing** (expected vs the last count
by part, with the money at the supply house's latest price and its checked date, the PO price when
the book price is older than 90 days, and who last touched the container) and **Counts** (when each
container was last walked, by whom). *Print labels* makes a half sheet per container: the stencil
big, the job, and a QR that is a plain link to the container's screen, so the phone's own camera
opens it and the app needs no scanner. *Correct the count* is an office-only press on a line and
writes a Count row like any other. A Returned row carries *credit due* until a credit memo on a
supply-house invoice matches it.

The doors: a **Materials** tab in the Job window that shows the summary chips (containers, a count
due, missing with the money, credits due) and *Open the materials page*; a **Materials desk** row
in the Pipeline's ⋯ tools menu with its count, a link to the tab as the Legal desk's row is; and on
the Procure step the On site count's note links to the job's tab once the bid has a job. No new row
icon: the row's four-icon budget is spent and nothing here needs a press on the row. The Needs you
line carries two facts for the office: containers not counted in 14 days, and missing money this
week.

### Robustness

Crews never count everything every day: Used is the daily press and the walk is per container,
weekly or at a stage, and the app flags only the lines whose expected and counted differ. A
free-text line is always allowed. Two crews on one site write two rows and one sum. A cage that
moves is retired with a sheet asking what is left in it. A count that disagrees with a delivery the
office never logged stands as the truth and reads found until the office logs the delivery. The
office sees Missing this week per job with the money and who last touched the container. A count
with a photo (V2) backs the bill-day walk's *stored on site* tick, the pay app's materials-stored
column and #171's claim line.

### V2 and V3

- **V2:** the photo on a count through #189's path (bucket → `photo-save` → Drive, a row with
  `drive_file_id`); the takeoff-based *should be left* guess (takeoff quantity per stage × the
  stage's % done) that asks the crew to confirm only lines that look off; loss by week with money;
  the offline queue as #163's first customer.
- **V3:** engraved items (`material_items` with the engraved id, installed-at on the plans, a
  service history), additive on the same movement table through the item id.

## The owner's six calls

Each is drawn on the mock-up as one spot of the screen, today beside the suggestion, the
recommendation first and the other ways named in a line. The owner's go of 2026-10-29 took them as
recommended, with the exceptions under the table.

| Call | Recommended | Also possible |
|---|---|---|
| 1 · the field view | The tally's On site tab, a link on the Job Mode card | A fifth footer tab (crowds the 375 band #203 is about) · a Dashboard card |
| 2 · the office page | A Jobs-page tab beside Parts, from the Job window's Materials tab, the ⋯ desk and the Procure step | A Job window tab alone |
| 3 · containers | Per job, with the stencil | Company-wide numbered cages that move between jobs |
| 4 · who changes a number | Anyone on the job and the office, by a press with a reason; Correct the count office only | Crews count, the office adjusts |
| 5 · missing money | The supply house's latest price with its checked date, the PO price past 90 days | The PO price first |
| 6 · no signal | The press waits on the phone | Wait for signal, as today |

**As built.** Calls 1 to 4 as recommended: v2.6041 the tally's On site tab and the Job Mode card's
link; v2.6043 the Jobs-page tab beside Parts, the Job window's Materials tab and the Pipeline tools
menu's row (the Procure step's door is not built); v2.6039 containers per job with the stencil, a
place and an eight-character code; the job's team and the office press with a reason, Correct… on
the office page in the office's name. Call 5 is not there yet: missing money is priced off the
invoice the office read until the parts-book price with its checked date lands. Call 6 went the
other way for now: a shot with no signal stays on the phone with Send now, a failed read retries
itself when the signal returns, and a press that writes waits for signal until #163's queue exists.

## Is this the best we can do? (the holistic pass, 2026-10-28)

After the first drawing, the real screens on a dev server from this worktree: `/tally?tab=materials`
as the dev and as the sample helper (View as), `/dashboard` as the sample helper at 375,
`/jobs?tab=stages` with its ⋯ tools, `/materials`, and the ZZ test bid's `/bids?tab=submittals`
with its Procure panel, all at 375 or 1,280 as fits. Screenshots stayed out of the repo.

- **Where does the drawing make a crew type or tap more than today's tally for the same act?**
  Nowhere. Today a request for more is six taps and two typed words. Short from a line is three
  presses with nothing typed. Used is two presses. A count is one press a line. The only new
  typing is a container's name and where line, once per cage.
- **Can a first-timer find a part in three presses from the Job Mode card?** Yes: Materials on
  site, the search box with the name typed, the result card. Through a container it is two.
- **No signal:** the tab opens from its kept read and a press waits under #163's bar (call 6).
- **A part not in the book:** a typed name on a line, tied later by the office.
- **A cage that moves to another job:** Retire asks what is left; the next job gets its own row.
- **Two crews on one site:** two rows, one sum.
- **A count that disagrees with a delivery the office never logged:** the count stands, the
  difference reads found, the office logs the delivery and found clears.
- **Does the office learn about a loss the same week, with the money?** Yes, on the tab, the desk
  and the Needs you line. The live parts book shows most bid dollars on a price older than 90 days,
  so the money carries its checked date and falls back to the PO price past 90 days.
- **Would an engraved part in V3 change a V1 table?** No: the nullable item id is on the movement
  from day one.

**What changed because of the pass:** the office page became a Jobs-page tab beside Parts (one
address, two states); the Missing column carries the price's checked date with the PO fallback;
the On site tab lost its trade picker; the Job Mode link shows with no job and opens the picker; a
QR opened by someone not on the job reads but cannot press; the tally's tabs are drawn as the
filled pills they are live and three fit at 375; a line has four presses, with Move to… carrying
the truck, the shop, the return and scrap, and Count per box; the truck and the shop are
destinations, not containers; the Procure frame's note describes the live panel's grouping.

## Where it plugs in

- **New tables:** `job_containers`, `job_material_movements` (nullable `item_id` from day one),
  RLS for the job's team and the office roles, the three `apply_*` calls, `docs/migrations/`.
- **New kernel:** `src/lib/materials/onSite.ts`: on hand, expected, missing and found over
  movements; the reason words; the stale-container rule (14 days); with tests.
- **The tally:** `src/pages/JobTally.tsx` gains the third tab as its own component
  (`src/components/tally/TallyOnSiteTab.tsx`), reusing the job picker, the parts-book search and
  `TOUCH_MIN`; the `?tab=` router in the page; the route is already allowed.
- **Job Mode:** the quiet link in `DashboardJobModeCard.tsx`; no change to `pressBar.ts` or the
  footer.
- **The Jobs page:** a `materials` tab beside `parts` in its tab list, `JobsMaterialsTab.tsx`, the
  search doors in `src/lib/search/doors.ts`.
- **Doors:** `JOB_WINDOW_TABS` in `src/lib/jobs/jobHistoryTab.ts` and `JobWindowModal.tsx`; a row
  in `JobsStagesToolsMenu.tsx` after the Legal desk's; the On site step's note in
  `SubmittalProcurementPanel.tsx`; `dashboardNeedsYou.ts` keys for the stale containers and the
  missing money.
- **Seeding:** `markTicked('delivered_on')` in `SubmittalProcurementPanel.tsx` writes the movement;
  the PO-received path; the first-count start.
- **Labels:** the QR from `payQr.ts`'s drawing, a print window in the light theme as
  `BillQrModal.tsx` prints.
- **Prices:** `material_part_prices` + `material_part_price_history` for the money; the parts
  book's 90-day freshness rule.
- **Docs:** `PROJECT_DOCUMENTATION.md`, `GLOSSARY.md` (container, movement, on hand, Unsorted),
  `ACCESS_CONTROL.md` (who presses what), `docs/twins/APP_DIRECTORY.md` for the new tab, two guides.

## The plan

As drawn, five PRs; it shipped as four on 2026-10-29, the fifth's pieces inside them. Each row
says where it went.

1. **PR 1 · the ground (M)** — shipped as v2.6039: the migration with the tables (`job_places`,
   `job_containers` with its code, `job_container_moves`, `job_material_movements`,
   `job_box_photos`, the `box-photos` bucket, the gate `on_site_can_touch_job`), the kernels, the
   store, the box code's door `/b/:code` behind prts.co; the types regen #6414 after the push.
2. **PR 2 · the office tab (M)** — shipped as v2.6043 (PR 3 of the built train): Jobs → Materials
   with the desk and the job's four sections, Correct…, the Job window's Materials tab, the tools
   menu's row, the labels and the box search in Go anywhere; the guide *see what is on every job
   site and what walked away*.
3. **PR 3 · seeding (S)** — not built as drawn: a delivery comes in through Deliveries on the
   office page (the job's Drive folder first, or pasted invoice text read into lines, then Add N
   lines to Unsorted); Mark delivered on the Procure step writes no movement, and Start from the
   bid's parts is not there.
4. **PR 4 · the field tab (M)** — shipped as v2.6041 (PR 2 of the built train): the On site tab
   with the containers, the search, the presses and their sheets, Add a part, the map, the photo
   press and the Job Mode link; the guide *keep track of the material in the cages and boxes on
   site*. The Short press is out until the tally request behind it is real.
5. **PR 5 · counts, labels, the line (S)** — the counts and Retire shipped in v2.6041, the labels
   with the QR in v2.6043; the Needs you line for stale containers and missing money and the
   Procure step's link are not built.
6. **V2** — the photo on a count shipped first, as v2.6045 (the photo sweep's second source,
   migration 20261029020000) with the live test's fixes v2.6049, v2.6050, v2.6054 and v2.6055; the
   takeoff guess, loss by week and the queue wait as drawn (after #189 PR 5b and #163). **V3:**
   engraved items, as drawn.

## How to verify

- Dev server from a worktree, `/dev-login?as=1`, then `/settings` → **View as…** → Helper for the
  field screens at 375 and 320; the dev at 1,280 for the office tab, the Job window, the ⋯ menu and
  a bid's Procure step. Prod data is real: read, never write; ZZ test jobs are hidden from the
  Pipeline even by search, so a walk that writes uses a ZZ bid's job opened from Bids.
- The sample helper is on no job's team, so the On site tab reads the tally's *No jobs assigned*
  line until the office adds them to a job.
- The mock-up was checked at 320, 375, 768 and 1,280 in light and dark with `data-theme` set
  explicitly: no sideways scroll at any width; the pick tables scroll inside their own box at 320.
- Made-up names, jobs, counts and prices only, in the repo, the PR and every screenshot.

## Where it stands

Built 2026-10-29. The owner's go came the morning after the mock-up: build all of it and take it
to live testing. The four PRs are on main and live (v2.6039 the ground, v2.6041 the phone, v2.6043
the office, v2.6045 the photo sweep); both migrations (20261029010000, 20261029020000) are pushed,
and `photo-save`, `job-drive-folders` and `dev-mcp` are deployed (`npm run check:edge-drift` read
every function current on 2026-10-29). The six calls are answered under their table above.

**The live test** runs on test job 972 (the recipe in v2.6054's fragment, Test). The end-to-end
photo test stopped at Drive three times, each a fix the same day: a photo the sweep could not file
said nothing (v2.6049, the row keeps its reason), then said only a missing folder (v2.6050, every
reason), then met a 403 on the job's hand-made pictures folder (v2.6054, the app makes a job's
Drive folders under the jobs folder from the Documents tab, with a backfill; v2.6055, the press is
offered while any of the job's three links is missing, not only the job folder). What is left of
the test: clear the hand-made pictures link or share it with the app's account, press Make the
job's Drive folders, and the waiting box photo files on the sweep's next run. Then a week of use.

**Left, each one small PR** (the fragments' own lists):

- prices from the parts book for the missing money, with its checked date (call 5), instead of the
  ones remembered off an invoice on the device;
- the dev-mcp verbs `read_on_site`, `plan_delivery` → `apply_delivery`, `plan_count` →
  `apply_count` (the Deliveries panel names them as coming, not as there);
- the Needs you line for stale containers and missing money, and the Procure step's door;
- the Short press as a tally request; reading an invoice from the Drive folder with the model;
- a summary RPC for a job past 5,000 ledger rows; the Drive thumbnail on the office panel once the
  bucket copy is gone;
- the real-phone checks: the camera scan of a printed label and the share sheet on iPhone and
  Android.

**V2 and V3** stay as drawn, less the photo on a count, which shipped first. The jobs root and the
name of a job's folder, which the live test raised, are #211 (`where-files-go/`).
