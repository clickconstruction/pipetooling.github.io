---
name: "Submittals: the second holistic look, seven fixes and four trims"
number: 89
group: ready
status: >
  found 2026-10-06 on a read-only walk of BP375 (Rev 1 answered by email), BP398 (a shared room with
  orders on the log), the GC's review page for BP398 and BP375 at phone width, at `2efef6cca` ·
  nothing built · the owner: "save all 7 of these to the punchlist, I want to have another session do them all"
summary: >
  The tab works end to end, and these are the places where what it says is wrong or said too
  often: a draft's parts are called "waiting on the GC" when nobody has sent them; lead times are
  typed nowhere, so the calendar never appears; a revision the GC answered by email still reads
  "draft"; the same answer door is offered three times; two "Next:" lines on one page; the GC's
  page still shows the counting the log dropped; the fold rule opens five screens before the log.
  Then four trims: the arrow's contrast in the dark theme, tall phone cards, a robot ask eight
  days old, one sentence said twice.
next: >
  One PR per item, in the order below: 1, 3 and 6 first (words that are false today, and the GC's
  page), then 2 (draw it first), then 4, 5 and 7, then the trims as one PR.
mockup: not required — items 1, 3–7 and the trims are words and rules on screens that exist; the builder draws item 2 (where a lead time comes from) before building it and shows the owner.
size: M (seven PRs of S, one of M; item 2 may add a column or a table)
blocker: None to start. Item 2's design wants the owner's eye before it is built; item 3 adds a column (a migration).
opinion: build — 1, 3 and 6 are sentences a first-timer will take as true and act on; 2 decides whether the calendar is ever used.
---

# Submittals: the second holistic look

## The ask, in the owner's words

2026-10-06: "take a look at submittals holistically for me, do you think there is anything we can do better?" and, on the findings: "help me save all 7 of these to the punchlist, I want to have another session do them all".

The first holistic look was 2026-10-03 ([`submittals/README.md`](./submittals/README.md), twelve findings, all shipped by v2.4543). This one came after the procurement log redraw (v2.4581–v2.4600), the grading of takeoff rows (v2.4609) and the next-revision arrow (v2.4605).

## How the look was made

A signed-in local dev server at `2efef6cca` (`/dev-login?as=1&to=/bids?tab=submittals&bidId=…`), reading only:

- **BP375** SPACEX BA-02N, `7e5ea6e5-1eff-4130-b18c-89e33b9465fb`: Rev 1 is a draft the GC answered by email (4 rows sent back, 9 with no answer, 1 with no product), 47 lines on the log, no lead times, a job with no stage dates. The *Today* picture.
- **BP398** ZZ Test, `a5a3a840-0a7b-4c67-8b59-3e95d0d80150`: Rev 2 shared Sep 15 with a room, Rev 3 answered, Rev 4 a draft; three POs on the log, so the calendar draws. The bid to write on.
- The GC's page for BP398 (`/submittal?t=<the room's token>`, read from `bid_submittal_rooms`).
- BP375 at 375 px.

## The findings

Each one is a place where the question *is this the best we can do?* got the answer no, with what to build instead.

### 1. The log calls a draft's parts "Waiting on the GC" when they are waiting on us

**Seen.** BP398, Rev 4 is a draft nobody has shared. The log's first step reads *Waiting on the GC · 11*, its section reads *Waiting on their answer · 2 fixtures · not ordered until they approve*, and each fixture offers **Their answer…**. The GC has never seen Rev 4. Someone reading that waits for an answer that cannot come. Every fresh draft reads the same way.

**Build.** A line on a revision that has not been shared stands on a step of its own words. The status already exists: `not_submitted` (the row's `submittal === 'none'`, `shared: false` on the `ProcurementItemSource`) against `awaiting` (shared, no call). So:

- `procurementSteps` (`src/lib/submittals/procurementBoard.ts`): the first step reads **Not sent yet** with its count when every line waiting is `not_submitted`, **Waiting on the GC** when any is `awaiting`; the note under it says *send Rev 4 first* or *5 sent back*.
- `procurementNextLine`: *Nothing can be ordered until the GC answers. Share Rev 4 first: 11 parts have not been sent.* when the waiting lines are all unsent.
- `orderSections` (`procurementOrders.ts`): the waiting section's title is **Not sent to the GC yet** for `not_submitted` lines (a separate section when a revision mixes carried approved rows with new ones), note *share Rev 4 to get an answer*, and no **Their answer…** door on its fixtures (`answerItemId: null`); the right-hand words read *on Rev 4, not sent*.
- The panel's `groupRight` draws no door for that section. `groupDateWords` says nothing for it.
- Tests: the two SpaceX fixtures hold `awaiting` lines; add a case with `not_submitted` lines and assert the words and the absent door. The panel test's phone case already uses an unshared draft (`shared: false`) and will move with the words.

### 2. Lead times are typed nowhere, so the calendar never appears

**Seen.** BP375: *43 parts have no lead time*. Order-by dates, the day the GC must answer by and the calendar all hang on lead times, and the only ways in are per part (the Edit window) or **Set…**, which puts one number on all 43. Nobody will do either on every bid, so the log mostly reads *No dates to draw yet*.

**Build.** A lead time is a fact about a product from a house, not about this bid. Draw first, then:

- When a part lands on a row (`procurementItemsFrom` is a read; the write is at row build in `candidateToItemInserts` / `insertItemParts`, and in `saveItemParts` when a part is typed), take the lead time last set for the same maker and model (`normalizeModel` in `productStatus.ts`) on any bid, newest first; failing that, the house's default.
- The house's default: a column on `supply_houses` (`default_lead_time_days`), set on Find a supply house and its rep's form; the `houses` prop already reaches the panel.
- The Edit window (`SubmittalPartsEditor`, `partsEditorGroups.ts`) shows where a number came from in a quiet line: *2 wk, as last time* · *3 wk, National Wholesale's usual*, and a typed number wins.
- **Set…** stays for the leftovers.
- A migration for the column; the read of earlier parts is a query on `bid_submittal_item_parts` by label, or a small `product_lead_times` table written on every save. The builder decides after measuring how many distinct products BP375 and the last five bids share.

### 3. A revision the GC answered by email still says "draft"

**Seen.** BP375's header reads *Rev 1 · draft · Sep 29* while four of its parts are rejected. Step 5 explains (*Not shared from the app · answers typed in*), but the header, the pill and the revision chips are what a reader sees first, and *draft* means unsent.

**Build.** A revision knows a third state. Not a new `status` value (every reader of `status` would need the case); a column `sent_outside_at` on `bid_submittals`, set the first time an answer is entered on a draft row (`saveAnswer` / `approveAll` in the tab) and by a **Sent by email on…** button on step 5 for the office to say so first. Then `describeRevisionChip` and the header's `revision-line` (`submittalRevision.ts`) read *Rev 1 · sent by email · Sep 29*; the journey's stage 5 reads *sent outside the app*; the GC's page is unchanged (it never saw it). Migration + `docs/migrations` page; `get-submittal-room` need not change.

### 4. The same door is offered three times

**Seen.** BP375: **Their answer** on 14 rows in step 3, 9 fixture buttons in step 6, 14 **Their answer…** links on the log's waiting fixtures in step 8. The most repeated thing on the page is a link to something one step away.

**Build.** Step 6 is the door's home. Keep the row's door inside its ⋯ menu (`SubmittalRowsTable`: the menu already exists; the inline button goes), and drop the link from the log's waiting fixtures (`groupRight`'s fixture case in the panel; the kernel's `answerItemId` can stay for the tab's own use). Item 1 removes it from unsent fixtures already; this removes it from the rest. The guide's *The procurement log* section loses the sentence about the door.

### 5. Two "Next:" lines on one page

**Seen.** The strip reads *Next: … Start a Rev 2 draft*. The log reads *Next: Nothing can be ordered until the GC answers*. Both are right; a page with two Nexts has none.

**Build.** The log's line keeps its sentences and loses the bold *Next:* (`procurement-next` in the panel). One line in the guide.

### 6. The GC's page still shows the counting the log dropped

**Seen.** The review room's PROCUREMENT block reads *2 released · 1 ordered · 0 delivered · 1 sent back* (the double count v2.4581 removed from the office's log: a delivered part counted as ordered too) and *Required dates fill in once the job's stage schedule is set*.

**Build.** The GC reads the same four steps and the same sentence as the office. `procurementSteps` and `procurementNextLine` are client kernels; the function needs them under `supabase/functions/_shared/` (one kernel in `_shared` and an `export *` shim at the old path, as `twinSeatGate` and the money kernels did). `get-submittal-room` (`supabase/functions/get-submittal-room/index.ts` ~L172) builds `RoomProcurement`; it hands the steps and the line; `SubmittalRoomView.tsx` draws them in the GC's words (no PO, no house, as today). Redeploy the function; `docs/EDGE_FUNCTIONS.md` section.

### 7. The page is long, and the fold rule opens the wrong step

**Seen.** BP375 at step 7 opens steps 3, 6 and 8 at once: five screens before the log. The rule (`readsFrom` in `BidsSubmittalsTab.tsx` ~L2115: `resubmit: ['rows', 'review']`) opens step 3's fourteen rows because step 7 "reads from" them.

**Build.** Step 7 opens step 6 only (`resubmit: ['review']`); the Resubmit button's line already names the rows sent back. *Open every stage* stays for the rest. One line and one tab test (the fold cases exist).

## The trims (one PR)

- **The Next revision arrow in the dark theme**: `.submittal-road-loop` (`src/index.css` ~L4733) is a 2 px dashed `#2563eb` on the dark surface and reads faint; try the brighter blue the dark theme uses for links, or 2.5 px.
- **Tall phone cards** (BP375 at 375 px: DWH-1's card is a screen): a takeoff row's parts fold under its first part on a phone, as the orders view folds them (`SubmittalRowProducts`).
- **A robot ask eight days old**: step 1 reads *🤖 Asked Sep 28 · not picked up yet*. `staleAsk` (`robotOffer.ts`) knows the age; past seven days the line should say so and offer **Withdraw the ask** (a `cancelled` status on the task).
- **Said twice**: *Every part comes from National Wholesale* sits in step 3's line and on the log's lens row. Keep the log's; the rows table says it only when it differs from the log (or the step's line drops it).

## How to verify

- BP375 is live: read it, never write to it. BP398 is the bid for writes; its Rev 4 draft is where item 1's words show, and a **Share** there makes the `awaiting` case.
- A fresh worktree's dev server needs `.env` and `.env.local` from the main checkout; `/dev-login?as=1&to=…`.
- Item 6: open the GC's page for BP398 beside the office's log and read the two sets of words together; they must be the same sentence.
- Item 2: measure before building. Count the distinct maker-and-model strings on BP375's parts and on the last five bids' parts, and how many repeat; if few repeat, the house default carries the load and the per-product memory can wait.
- Item 3: BP375 is the case (answers entered on a draft); after the migration its header should read *sent by email* with no click.
