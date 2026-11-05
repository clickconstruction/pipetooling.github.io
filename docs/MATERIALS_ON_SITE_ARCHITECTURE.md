# Materials on site — architecture

---
file: docs/MATERIALS_ON_SITE_ARCHITECTURE.md
type: Architecture map
purpose: The objects, the writes and their rules, the screens, the agent's door and the gaps of Materials on site (punch list #209) — what is in the stencilled cages and boxes a crew leaves on a big job site. Read it before touching `src/lib/materials/onSite*.ts`, the On site tab, Jobs → Materials or the dev MCP's on-site verbs.
audience: Developers, AI agents
last_updated: 2026-11-05
sections:
  - The idea
  - The objects
  - The arithmetic
  - The writes and their rules
  - Who may write
  - The screens
  - The agent's door
  - The gaps
---

## The idea

Nobody types a quantity over another. A press names what happened to some of a part in a container on a job, and the number on the screen is the sum of the rows. A count is a row like any other: a point in time that resets the line and leaves the difference on record, so *report when they are missing* is the same rows read a second way. Built 2026-10-29 in four PRs (v2.6039 the ground, v2.6041 the phone, v2.6043 the office, v2.6045 the photo sweep); the card is [`to-dos/materials-on-site/README.md`](../to-dos/materials-on-site/README.md), the owner's six calls and how each went are under its table.

## The objects

Five tables, one migration ([`20261029010000_materials_on_site.sql`](./migrations/20261029010000_materials_on_site.md)), all `ON DELETE CASCADE` from the job. A job combine carries them to the target instead (v2.6423): a place of the same name becomes one, the source's Unsorted folds into the target's with its movements, moves and photos, and a live cage or box whose label the target already holds keeps its row and printed code and takes a numbered label (`A1 (2)`).

| Object | Table | What one row is | Changes |
|---|---|---|---|
| **Place** | `job_places` | A place on the site a box can stand in: *Level 2*, *the laydown yard*. One per (job, name), case-insensitive. | insert only |
| **Container** | `job_containers` | A **cage**, **box** or **loose** pile with its **stencil** (`label`: A1, B7 — one live label per job), a `where_note` in the crew's words, its `place_id`, a map pin (`lat`, `lng`), `retired_at`. The generated eight-character `code` (the id's first hex characters, upper-cased) is the short address a printed label's QR carries: `prts.co/b/<code>` → `/b/:code`. The job's **Unsorted** row (`kind = 'unsorted'`, label *Unsorted*) is where a delivery lands until a crew presses *Put in…*; the app makes it on first use. | insert; update (a move, a pin, a retirement) |
| **Container move** | `job_container_moves` | The box itself moved from one place to another, by whom and when — the box's own history, apart from its parts. | insert only |
| **Movement** | `job_material_movements` | **The ledger.** One row per press: the part (`part_id` into `material_parts`, or `part_name` typed on site with `part_id` null), `manufacturer`, a positive `quantity`, a `reason` of eight (`delivered`, `moved`, `used`, `returned`, `taken`, `cannot_find`, `damaged`, `counted`), `from_container_id` and `to_container_id`, a `note` (a taken part's destination, a delivery's unit, *office correction*), a `source` (the invoice or PO behind a delivery), `by_user_id` and `by_name`, `at`, and `item_id` (V3's engraved item, null from day one). Checks: a delivery has a `to`, a count has a `from`, only a count may be zero. | **insert only — never edited; a wrong press gets a correcting row** |
| **Box photo** | `job_box_photos` | A photo of a box: shrunk on the phone to 1,600 px, named as the sweep names it (*2026-10-29 Jordan · A1 after Count.jpg*), sent to the private `box-photos` bucket as `<job>/<photo>.jpg`; `photo-save` (v2.6045) copies it into the job's Drive photo folder, writes `drive_file_id` and `filed_at`, deletes the bucket copy. `fail_why` carries every reason it could not be filed. | insert; update by the one who took it |

Which rows a reason writes (`reasonSides` in `onSite.ts`):

| Reason | from | to | The press |
|---|---|---|---|
| `delivered` | — | +1 | a line landed by the office (Deliveries), *Add a part* on the phone (note *added on site*), or the agent's `plan_delivery` |
| `moved` | −1 | +1 | *Put in…* from Unsorted, *Move to…* another box |
| `used` | −1 | — | the daily press |
| `returned` | −1 | — | *Back to the supply house*; the office expects a credit |
| `taken` | −1 | — | *Taken* to a truck or the shop, named in the note |
| `cannot_find` | −1 | — | *Can't find*: the line reads amber for the office until the next count |
| `damaged` | −1 | — | *Damaged, scrap* |
| `counted` | reset | — | *Count this box* (Right · a number · Gone), the office's *Correct…*; `quantity` is the number counted, not a change |

## The arithmetic

One pure kernel, [`src/lib/materials/onSite.ts`](../src/lib/materials/onSite.ts) (tests beside it), everything else reads it:

- **`partKey`** — a part's one identity on a job: `id:<part_id>`, or `text:<name folded>` for a typed name (trimmed, lower-cased, spaces collapsed).
- **`containerLines(movements)`** — the lines of every container, from the rows in `(at, id)` order: a `counted` row sets the line to the number counted and records `lastCountDiff = counted − on hand`; every other row adds to its `to` side and takes from its `from` side; `cannotFindSinceCount` sums Can't find presses since the last count. **On hand is the sum. Expected at a count is the sum before it. Missing is a negative difference; found a positive one.**
- **`linesOf(lines, container)`** — what a crew sees: a line with something on hand, a Can't find since the count, or a shortfall at the last count.
- **`countDiffs(movements)`** — every count with its expected, counted and difference, newest first: the Missing section and the money read these.
- **`lastCountedAt`, `countIsDue`, `STALE_COUNT_DAYS = 14`** — a box with no count, or one older than 14 days, is due.
- **Words**: `REASON_WORDS`, `pressLabel` (*Mark 4 used*, *Move 10 to A1*, *Save 12*), `leftWords` (*A2 will have 10 left.*), `containerWords`, `nextLabel` (A1 → A2), `compareLabels` (A1, A2, A10), `groupByPlace` (Unsorted first on its own, then the places in name order, no-place last).
- **Money**: `missingMoney(diff, unitPrice)` prices a shortfall; [`onSiteSummary.ts`](../src/lib/materials/onSiteSummary.ts) gives the desk, the Job window's tab, the ⋯ menu and the Needs you line one job's facts (live containers, lines on site, the week's missing lines and money, the stale boxes, credits due). The price today is one remembered off an invoice on the device (`priceOf` in the store) — call 5, the parts-book price with its checked date, is not built.

The same arithmetic lives once more, in SQL, as `on_site_line_on_hand(container, part_id, part_name)` ([`20261102100000`](./migrations/20261102100000_dev_on_site_write.md)), so the agent's plans can say a line's before and after without a round trip; `read_on_site` reads the kernel, so the two can be held against each other, and on 2026-11-03 they agreed on all 118 live lines of the yard job. Both part arguments default to null since v2.6456, so the seat's `call_read` names just one.

Beside the kernel: [`flowRow.ts`](../src/lib/materials/flowRow.ts) (the four figures came in → on site → used → missing, and the phone's three), [`labels.ts`](../src/lib/materials/labels.ts) (`boxCode`, `PRTS.CO/B/<CODE>`, the label's ruled rows), [`manifest.ts`](../src/lib/materials/manifest.ts) (an invoice's text read into lines; the three-way comparison of bought, reported and left), [`boxSearch.ts`](../src/lib/materials/boxSearch.ts) (the Go anywhere group *Boxes on site*), [`photo.ts`](../src/lib/materials/photo.ts) and [`photoShrink.ts`](../src/lib/materials/photoShrink.ts).

## The writes and their rules

The screens write the tables **directly** through [`onSiteStore.ts`](../src/lib/materials/onSiteStore.ts): a cache of each job (places, containers, moves, movements, photos; `loadJob`, `loadDesk` for every job with a live container, `MOVEMENTS_LIMIT = 5000`), reads as plain functions so a screen renders without waiting, and each write landing in the cache first and going to the table behind it (`afterWrite`: a refusal is said through the screen's toast and the job read again). There is no RPC for a press; **the rules are the tables' own** — the CHECKs above, the gate below, the training-mode blocks and the digital-twin fence — and the store's few shapes:

- `addPlace` (the same name twice is one place), `addContainer` (the stencil upper-cased and trimmed; `created_by` filled by the database since v2.6456), `moveContainer` (the row's `place_id` and a `job_container_moves` row), `pinContainer`, `retireContainer` (`retired_at = now()`; the phone refuses while any line has parts on hand), `unretireContainer` (v2.6406: `retired_at` cleared after `unretireVerdict` in `lib/materials/unretire.ts` finds no live box carrying the stencil), `unsortedContainer` (made on first use), `addMovement` (quantity rounded, never negative), `addPhoto` / `updatePhoto`.
- **The phone caps a press at what the box has** (the number sheet's `max = onHand`); *Add a part* is a `delivered` row into the box; a count writes a row even when the number is right.
- **The office** lands a delivery as one `delivered` row per line into Unsorted with the invoice or PO as `source` and the unit as `note` (Deliveries: the job's Drive folder first, or pasted text read by `manifest.ts`); *Correct…* is a `counted` row in the office's name with the note *office correction*; *Add a container* is a cage with its place.
- **The writer** is the signed-in person: `by_user_id` and `by_name` from the session; the store's `onError` names a refused write.
- **Not built as drawn**: *Mark delivered* on the Procure step writes no movement; *Start from the bid's parts* is not there; the Short press (a tally request) is out until the request behind it is real.

## Who may write

One gate for all five tables, `on_site_can_touch_job(job_id)`, `SECURITY INVOKER` on purpose: the caller may read and write a job's materials when they can see the job in `jobs_ledger` under their own RLS (a primary keeps their job scope, the office its reach) **or** are on the job's team in `jobs_ledger_team_members` (how helpers and subcontractors reach a job). Movements and moves are select + insert only; containers and places allow update; a photo row is updated by its taker. A training account (`users.read_only`) and a digital twin are blocked by the restrictive policies and the statement trigger every new table gets. Depth: [`ACCESS_CONTROL.md`](./ACCESS_CONTROL.md) → *Materials on site*. A box's QR opened by someone not on the team reads the lines and offers no press.

## The screens

- **The phone**: `/tally` → **On site** ([`TallyOnSiteTab.tsx`](../src/components/tally/TallyOnSiteTab.tsx); the Job Mode card's *Materials on site* link opens it on the clocked-in job): the job picker, the flow row (Unsorted → Used → Count), the search by part or stencil, the place chips, the boxes grouped by place; a box open has its lines with Used, Move to… (another box, the supply house, the truck, damaged, a new box), Can't find, the Count this box walk, Add a part, Move this box, Mark on the map, Retire, Photo (`PhotoPress.tsx`; with no signal the shot stays on the phone with *Send now*). `useOnSiteJob` ([`useOnSiteStore.ts`](../src/hooks/useOnSiteStore.ts)) loads and reports for `OfflineRetryPanel`. Guide: *keep track of the material in the cages and boxes on site*. Map: [`JOB_TALLY_ARCHITECTURE.md`](./JOB_TALLY_ARCHITECTURE.md).
- **The office**: Jobs → **Materials** ([`JobsMaterialsTab.tsx`](../src/components/jobs/JobsMaterialsTab.tsx), `/jobs?tab=materials&job=<id>`): with no job the **desk** across every job with a live container, sorted by the week's missing money, plus the *Drive folders* backfill; with a job the flow row, **On site** (boxes by place, the filters All · Due a count · Can't find, Add a container, Correct…, Label), **Missing** (the three-way comparison, Reported this week), **Deliveries** (the Drive-first intake, *Paste the text instead*, *Add N lines to Unsorted*, *Make the job's Drive folders*, Deliveries so far by invoice, and the agent's door *Or have your agent do it via MCP*), **History** (every row with reason and person filters), **Labels** (one Letter sheet per box with the stencil, the QR and the ruled lines, printed at full size since v2.6432). **Print the manifest** (v2.6366) prints one Letter page per box. Both windows portal to `<body>` and print through `printRootCss` ([`lib/printRoot.ts`](../src/lib/printRoot.ts), v2.6432), which takes every other child of `<body>` out of the print layout; before that the page behind, though hidden, widened the layout and Chrome shrank the print to about two thirds. `MANIFEST_MIN_ROWS` is 11, so an empty box's page fits one sheet. Guide: *see what is on every job site and what walked away*.
- **The site's paper** (v2.6533, punch list #268): **Print the material location report** in the head of the Development page's Jobs & bids look ([`SiteMaterialsReportModal.tsx`](../src/components/materials/SiteMaterialsReportModal.tsx) over [`lib/materials/siteMaterialsReport.ts`](../src/lib/materials/siteMaterialsReport.ts), read by [`siteMaterialsRead.ts`](../src/lib/materials/siteMaterialsRead.ts): the three tables over the site's job ids, chunked and paged, when the window opens and never with the page): one Letter paper of every live cage and box across the site's jobs with the lines on hand in each (part, count, the unit the delivery named, the line's last touch), the Unsorted row, the boxes with no place yet, and the jobs with nothing on site as one closing block; read **by job** (a section per job, its places, Unsorted, No place yet) or **by location** (a section per place name folded across jobs, a group per job under it), two chips the device remembers; the head names the site, the day and who printed, the foot every page's ledger; printed alone through `printRootCss`, a box and its lines never split. The office door's press alone, since the gate below answers an estimator with nothing. Guide: *print the material location report*.
- **The doors**: the Job window's **Materials** tab ([`JobWindowMaterialsPanel.tsx`](../src/components/jobs/JobWindowMaterialsPanel.tsx)) with the summary chips and *Open the materials page*; the Pipeline tools menu's **Materials desk** row with the week's count; Go anywhere's *Materials desk*, *On site* and the live group *Boxes on site*; the label's QR through `/b/:code` ([`BoxCode.tsx`](../src/pages/BoxCode.tsx)).

## The agent's door

The dev MCP seat ([`dev-mcp/README.md`](./dev-mcp/README.md)) reads and writes the surface since v2.6367 (server 0.16.0), in its plan → apply grammar:

| Verb | What it does |
|---|---|
| `read_on_site(job)` | The job as the screens read it, through the kernel copy of `onSite.ts` ([`_shared/devMcpComposites.ts`](../supabase/functions/_shared/devMcpComposites.ts) → `getOnSite`): the whole ledger 200 rows a page to the 5,000 cap, then every live box with its stencil, kind, place, code and lines (on hand, last touched, the last count's difference, Can't find since), Unsorted, the retired boxes with v2.6406's Bring back verdict, the boxes due a count, the last 30 days' shortfalls and Can't find presses, the newest 15 rows, and the words of the write verbs. Read it first: a box is named by its stencil as listed. |
| `plan_container` → `apply_container` | A cage or box added (stencil, kind, where, place — made when missing), moved to a place (the row and a `job_container_moves` row), retired when empty (a box with parts in it is refused in the phone's words), or brought back by v2.6406's verdict. Unsorted is never touched here. |
| `plan_delivery` → `apply_delivery` | An invoice's or PO's lines (a book part by id or a typed name, a whole quantity, a unit) into Unsorted — made on first use — or a named box, the source on every row. |
| `plan_movement` → `apply_movement` | One press on a line: `moved` (with `to`; Put in… from Unsorted is this), `used`, `returned`, `taken` (a note says where), `cannot_find`, `damaged`. Capped at what the box has, as the phone caps it; a box with none of the part refuses. |
| `plan_count` → `apply_count` | The Count this box walk or the office's Correct…: for each line named, what is there now. A line left out is not reset; a part not yet in the box may be counted into it. |

All four pairs POST one RPC, `dev_on_site_write(p, p_dry_run)` ([`20261102100000`](./migrations/20261102100000_dev_on_site_write.md)), **`SECURITY INVOKER`** on purpose: there is no office RPC to wrap, the screens write under RLS, so the wrapper runs as the dev and the database stays the judge — the gate, the CHECKs, the training blocks and the twin fence decide every row exactly as for a press on the phone, and a training account or a twin is refused in words first; since v2.6456 the plan and every refusal name the job as the app does (`JP972`, `J1085`, `formatJobLedgerNumberLabel`'s rule), not the bare number. The plan commits to every line's on hand before and after and the box's live row count (a press on the box since the plan makes apply refuse) and carries `now` or the time given, never the clock. Every row reads **`<agent_label> · MCP as <dev>`** in `by_name` with the dev as `by_user_id`, so the crew's History and the office's page say who did it. The server-side grammar is `_shared/devMcpWrites.ts` (`WRITE_VERBS`, `writeRpcBody`), tested in `src/lib/devMcp/devMcpWrites.test.ts`; the wrapper ran on a throwaway Postgres through every action and refusal before it shipped.

twin-mcp has no materials verb and should not: it is the estimator's seat (`docs/TWIN_MCP_SERVER_ARCHITECTURE.md`), and a twin is fenced from these tables.

## What is on prod (read 2026-11-02)

Read as a dev through the seat (`read_rows` on the five tables, two pages of the ledger by `at`), four days after the surface shipped. Numbers are that day's.

- **Two jobs hold containers**, 100 rows between them. JP972 holds 98, every one a cage, 6 retired, 90 at a place named *Arena*, 5 at *Gun dog*, 3 at no place; its stencils are a yard's — `G6` to `G88` with the cage's contents on some (`G76 TOILETS`, `G84 GAS VALVES`), `T`-numbers, `PVC COUNT`, `MISL PILE OF JUNK PIPE`. **The company's own stock is being kept on a paid job**, because the surface has no home for a yard that is not a job; that is a gap the card did not name. JP1091 holds a cage at its own *Arena* and a box at no place.
- **The ledger is 282 rows**, 2026-10-29 to 2026-11-02, two people writing. By reason: 159 `counted`, 121 `delivered`, 1 `used`, 1 `cannot_find`; no `moved`, `returned`, `taken` or `damaged` yet. Every `delivered` row carries `to`, every `counted` row `from`, as the CHECKs require; one count is 0.
- **No Unsorted row exists on any job.** Every delivery so far reads `added on site`: the phone's Add a part straight into a cage. The office's Deliveries panel has landed nothing, so `source` is null on every row and no delivery names an invoice.
- **Typed names outnumber book parts**: 18 of 282 rows carry a `part_id`; the newest 200 rows name 81 distinct parts by text. The kernel's name fold (`partKey`) is doing the matching on this job, not the book.
- **4 container moves, 92 box photos**, all 92 `filed` with words, 90 containers photographed, no `fail_why`.
- **`created_by` was null on all 100 containers.** No screen passes the signed-in user to the store, which sends `created_by: null`. Since v2.6456 a trigger fills it from `auth.uid()` on every new cage, box and place, for every client at once. The rows written before stay null.
- **`code` is the id's first eight characters upper-cased** on every row, as the generated column promises; `prts.co/b/<code>` resolves each.
- **Reading the ledger through the seat**: `read_rows` returns at most 200 rows and cuts its text at 80,000 characters, so a full ledger read pages by `at` with a narrow `select`; `read_on_site` pages 200 at a time inside the server up to the store's 5,000 cap, so an agent reads a job whole in one call.

## The gaps

From the card's Left list and this reading, each one small PR:

- **Money**: the parts-book price with its checked date (call 5), the PO price past 90 days; today the price is remembered off an invoice on the device, so the desk's missing money is only as good as what the office typed there, and an agent reads no price at all.
- **Seeding**: *Mark delivered* on the Procure step writes no movement; *Start from the bid's parts* is not there. A running job starts from a first count, by hand or through `plan_count`.
- **The Needs you line** for stale containers and missing money, and the Procure step's door to the tab.
- **The Short press** as a tally request; reading an invoice from the Drive folder with the model (the Deliveries panel's Drive-first path reads the folder but does not read the PDF).
- **Scale**: a job past 5,000 ledger rows is cut by the store and by `read_on_site` (which says so); the summary RPC the card names is not built.
- **Photos**: `fail_why` is on the row but the office page has no place to read and clear it; the Drive thumbnail waits on the bucket copy being gone.
- **The real-phone checks**: the camera scan of a printed label and the share sheet on iPhone and Android.
- **Offline writes**: a press that writes waits for signal until #163's queue exists (call 6 went the other way for now).
- **A yard that is not a job**: the company's own stock sits on a paid job today (the reading above); the surface wants a home for it — a job of its own kind, or a company place — so a count there is not a count against a customer.
- **A place across jobs**: a place is a row of one job, so the material location report's *by location* view (v2.6533) folds the same place name on two jobs into one section by name alone; a site-wide place is #209's later question.
- **V2 and V3 as drawn**: the takeoff-based *should be left* guess, loss by week with money, engraved items on `item_id`.
