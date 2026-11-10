---
name: "Bid photos, and a Links column that is always there"
number: 306
group: gated
status: asked 2026-11-10 with a screenshot of the Bid Board's Unsent / Working table and a red box left of a row's folder icon · the Links column, the job photo path, the Drive functions, the bid-to-job path and the role gates read on main the same day · three directions drawn at desktop and phone width with a second look and a pick · nothing built
mockup: to-dos/bid-photos-and-links/mockup.html
summary: >
  The Bid Board's Links column draws an icon only for a link the bid has, so the icons do not line
  up and a bid with nothing shows a dash. The owner asked for a photos icon that is always in its
  place: grey until the bid has a photo folder with photos in it, a press on grey making the folder
  and offering upload tools, the photos kept in Google Drive and managed in the app as a job's are.
  He then asked whether the other link types should follow the same rule. The mock-up draws the
  column with five fixed slots (Photos, Project folder, Plans, CountTooling, Bid submission), blue
  when there and grey when not, and three directions for what a press opens: A, a window per icon
  as asked; B, one Files window per bid that every icon opens; C, the pick, B's one window with
  A's presses, so a blue link still goes straight out and only a grey icon or the photos icon
  opens the window. Half the plumbing exists: a bid's photo already has a landing folder, the
  Drive door already takes a bid, and a won bid's folder already becomes the job's folder. The
  train is eight small PRs with the photos icon first.
next: The owner's word on the direction (call 1) and on where the folder lives (call 3). PR 1, the photo table and its bucket, is the same under every direction and can start on his go.
size: L as a train of eight (S · M · M · S · M · S · S · S); PRs 1 to 3 together are the photos icon and answer the ask
blocker: The owner's go. Call 1 gates PR 5, call 5 gates PR 4, call 3 gates PR 2. None gates PR 1.
opinion: build — PRs 1 to 3 first, so a site walk's photos have a home on the bid; then the column
---

# Bid photos, and a Links column that is always there (#306)

## The ask

The owner, 2026-11-10, with a screenshot of the Bid Board's **Unsent / Working Bids** table and a
red box drawn in the empty slot left of one row's folder icon:

> the same way we have photos on jobs, I would like to expose photos folders for bids. I was
> thinking here where it's always persistent and if no folder has been created yet the icon is grey
> and clicking it opens a modal to confirm you want to make a photo folder and we offer upload
> tools to put in google drive and manage photos here through the app. When there are photos in
> the folder we make, the icon should look like the other links. In fact with this new idea in
> hand, perhaps we should offer the same for the other link types too. Help me come up with a plan
> to add this.

He asked for a plan, not a build. His standing habit applies: a mock-up first, then *is this the
best we can do?* and the alternative drawn. Nothing is built in this card's first PR.

## What is there today (read on main at v2.6849, 2026-11-10)

### The Bid Board's Links column

One function draws it, on the desk's table and on the phone's cards:
`renderBidBoardLinksCluster` in `src/components/bids/BidsBidBoardTab.tsx`. It builds a list of the
links the bid has and draws an icon for each. The icons are Font Awesome paths in
`BID_BOARD_ICON_PATHS` in the same file, drawn in `var(--text-blue-500)`.

| Icon | Title on hover | Where the link is held | A press |
|---|---|---|---|
| Folder | Project folder | `bids.drive_link` | opens it in a new tab |
| Document | Job plans, with the set's name, or *3 sets* | the bid's rows in `bid_plan_sets`, with `bids.plans_link` standing in when no row names it (`src/lib/bids/bidPlanSets.ts`) | one set opens it; two or more show a count and open the picker, `BidPlanSetsModal` |
| Crosshair | CountTooling plans | `bids.count_tooling_plans_link`, and one more crosshair for each further project in the bid's count sources | opens it in a new tab |
| Document with an arrow | Bid submission | `bids.bid_submission_link` | opens it in a new tab |

- **A missing link draws nothing.** The icons that exist are centred in the cell, so the folder on
  one row sits where the plans icon sits on the next. A bid with no link at all shows a dash. The
  phone's card draws no icon row at all for such a bid (`hasLinks`).
- **The same cell also holds chips** on a won bid: the job made from it, a job that matches it by
  value, and the state of its cost estimate. They stay.
- **Every link is set in one place**: Edit bid (the gear) → **Files & links** in
  `BidFormModal.tsx`. Project Folder, CountTooling Plans and Bid Submission are a pasted address
  each. Plans has its own section with a Find press and the plan sets field. The board has no
  press that sets or changes a link.
- **The Project Folder label carries three addresses** written into the form: the bid folders for
  plumbing, electrical and HVAC. An estimator makes the bid's folder there by hand and pastes its
  address.

### Does a bid already have a Drive folder?

Yes: `bids.drive_link` is the bid's folder, and three things already treat it as one.

- **`drive-intake`** makes a bid's folder: flat under the jobs root in the *PipeTooling Jobs*
  shared Drive, named by the `drive_bid_folder_pattern` setting, and writes `bids.drive_link` when
  it is empty. Its only caller is the robots' `file_plans` verb. No screen calls it.
- **`file-submittal-package`** files a submittal package into the bid's folder under
  `Submittals`, making the folder by the same rule when the bid has none.
- **A bid's photo already has a landing place.** `drive-link` takes a job as exactly one of
  `bid_id`, `project_id` or `jobs_ledger_id` (`JobRef`, `supabase/functions/_shared/driveLink.ts`).
  For a bid, `landingPath('photos')` is **Team only › Photos** inside the bid's folder, made as
  needed. A picture saved from a text onto a bid lands there today (`photo-save`, the Messages
  source).

**Most plumbing bid folders are not where the app can file.** Card #240 (search) records it: the
hand-made bid folders sit in the owner's My Drive, outside the shared Drive. A service account has
no storage of its own, so it cannot put a file in a personal Drive. `drive-intake` and
`file-submittal-package` get round it with `DRIVE_IMPERSONATE_USER` when that secret is set. The
job folder maker holds such a folder with words (`outside_drive`) and does not move it.

### How a job does photos

| Piece | What it does | For a bid |
|---|---|---|
| **Make the job's Drive folders**, the press on the Job window's Documents tab (`JobWindowDocumentsTab.tsx` → `makeJobDriveFolders` → `job-drive-folders {job_id}`) | Places the job's folder at root › customer › job and makes Customer Pictures, Plans and Team only (with Photos and Sent by us inside). Writes `jobs_ledger.google_drive_link`, `job_pictures_link`, `job_plans_link`. Office roles and the estimator. | Job only: it reads and writes ledger columns. A bid needs far less, one folder and Team only › Photos. |
| `src/lib/materials/photoShrink.ts` | Shrinks a photo to a 1,600 px JPEG before it goes up. | As it is. |
| `src/lib/materials/photoBlobs.ts` | Holds a photo on the phone (IndexedDB) while there is no signal. | As it is. |
| `src/lib/materials/photoShare.ts` | The share sheet, or a download. | As it is. |
| `src/lib/materials/photoUpload.ts` | A box photo: the `box-photos` bucket at `<job_id>/<photo_id>.jpg`, then a `job_box_photos` row. | Job only. The shape is the one to copy. |
| `src/lib/photos/jobPhotoNotesIo.ts` (Job photos) | The closest twin: the `job-photo-notes` bucket and the `job_photo_notes` table, gated by `can_report_stage_progress`. | Job only: the table's `job_id` points at `jobs_ledger`. |
| `photo-save`, the sweep (cron, every 5 minutes) | Nine sources. Each takes the file from its bucket, puts it in the job's Drive photo folder, stamps `drive_file_id` and `filed_at` or a `fail_why`. A held folder never loses a photo: the row waits. | The Messages source already files onto a bid. The other eight write `{jobs_ledger_id}`. A tenth source for bids is one more of the same. |
| `job-photos` (list, thumb, full, files) | Reads the job's photo folders and streams a thumbnail or a full picture through the function, since the folder is not public. Read only. | Takes `job_id` and the job's gate. The thumb and full code is what a bid needs, keyed on a bid. |
| The Documents tab's file list and **Add a file** (`JobDocumentsFolderFiles.tsx`, `JobDocumentsAddFile.tsx`) | Lists the job's folder through `job-photos files`. Adds a file through `drive-link put`, 10 MB at most. | The server side of `put` and `list` takes a bid already. The client helpers write `jobs_ledger_id`. |
| `useShotTiles` (`src/hooks/useShotTiles.ts`) | The camera press (`capture="environment"`), several files at once, tiles while they go up, with the reads and writes handed in. | Usable: its `jobId` is only a key it hands to the io. |
| `uploaded_photos`, the view behind Documents → Photos | One shape over every photo table, with a `bid_id` column already. | A bid photo table is one more branch. |

**Not there at all, for a job or a bid:** renaming a Drive file from the app, removing one, and
drag and drop onto a photo window. Nothing in the app removes anything from Drive today.

### When a bid becomes a job

- There is no database step. **Won → New job** opens the job form with the bid's id
  (`BidWonJobActions.tsx` → `useJobFormImport.ts`). The form copies `bids.drive_link` to the job's
  `google_drive_link` and `bids.plans_link` to `job_plans_link`, each only where the job's field
  is empty. The job points back with `jobs_ledger.bid_id`.
- After the save the job folder maker runs (`placeJobFolderSoon`). `FolderTree.placeJob`
  (`supabase/functions/_shared/jobFolders.ts`) **adopts the bid's folder as the job's folder**: it
  moves and renames it to root › customer › job, then adds Customer Pictures, Plans and Team only.
- So a bid's **Team only › Photos** is already inside the job's folder after the win, with nothing
  to move. It is not Customer Pictures, and the job's photo strip reads Customer Pictures.
- A bid folder in a personal Drive is held, not moved, until someone moves it.

### Who sees the Bid Board, and who may write

| | dev · master · assistant · controller | estimator | primary | superintendent | helper · subcontractor | a digital twin | a training account |
|---|---|---|---|---|---|---|---|
| Opens the Bid Board | yes | yes | yes, the bids they estimate, manage or made (`primary_scope_bids`) | the page opens (`canOpenBids`); no `bids` policy names the role, so what the board shows them wants a live look | no | its own bids | reads |
| Edits a bid (RLS on `bids`) | yes | yes | yes, those same bids | no | no | bids it made or estimates | no |
| `drive-link` (list, put) | yes | yes | no | no | no | refused | reads only |
| Makes a job's Drive folders | yes | yes | no | no | no | refused | refused |

So the people who can edit a bid and the people the Drive door lets in differ by one role: the
**primary**, who is often the one on the site walk.

## The mock-up

`to-dos/bid-photos-and-links/mockup.html`. One page, Light and Dark. Made-up bids, builders,
people and counts. The photos are drawn tiles. Green dashes mark what is new.

- **Today**: the column with its ragged icons, the dash and the red box.
- **1 · The column, always there**: desk and phone.
- **2 · A grey photos icon is pressed**, as asked: the window that says what will be made and
  where, then the upload tools, on a desk and on a phone; and the bid whose folder the app cannot
  file into.
- **3 · The same window when photos are there**: the grid, a rename in place, the ⋯ menu, Remove
  with its Undo, and Select on the phone.
- **4 · The other four links under the same rule**: one small window each.
- **Is this the best we can do?**, then **B · one window per bid** and **C · the pick**, a table
  side by side, and **The owner's calls**.

Checked by eye on 2026-11-10 at 1,400 wide and at a phone viewport, in both themes: no frame
overflows its width and the page itself does not scroll sideways.

## The column, under every direction

Five slots in one fixed order: **Photos · Project folder · Plans · CountTooling · Bid submission**.
Photos is first, where the owner drew the box.

- **Blue** means it is there. **Grey** means it is not yet, and a press starts it.
- **A count** rides on Photos (how many) and on Plans (two or more sets, as today).
- A second CountTooling project still draws one more crosshair, so that slot alone can grow.
- A won bid's chips sit on their own line above the icons.
- On the phone every card draws the row, each slot 46 by 40.
- The name on hover says the state: *No photos yet · Add photos*, *12 photos*.

What it costs: a row with nothing shows five faint grey icons where a dash stood, and the column
grows from about 110 px to about 190 px.

## The three directions

### A · a window per icon (as asked)

- **Grey Photos** opens a window that says the bid has no photo folder, names the folder and
  where it will be made, and offers **Make the photo folder**. Once made, the same window shows
  the upload tools: drop, **Pick files**, and on a phone **Take a photo** and **Pick from this
  phone**.
- **Blue Photos** opens the photos: a grid, newest first, with who added each and when. A name is
  renamed in place. **⋯** holds Rename, Open in Drive, Download and Remove. Remove sends the file
  to Drive's trash and offers Undo. **Select** turns the button into *Remove 2 photos*.
- **The other four**: blue opens the link, as today. Grey opens a small window of its own: paste
  the address, or for the project folder **Make the project folder**.

Against it: five windows to build and learn, four of them one field and one button. No press on
the board changes a blue link. And step 1 is a press that only makes an empty folder.

### B · one window per bid

Every icon, blue or grey, opens one **Files** window for the bid, with the pressed row open.
Each row shows its state with its **Open ↗** and its **Change**.

For it: one window, and changing a link has a home on the board. Against it: opening the plans
takes two presses where it takes one today, many times a day.

### C · A's presses, B's window (the pick)

- A **blue link** goes straight out, as today.
- A **grey icon** opens the bid's Files window on its row.
- The **photos icon** always opens the window, grey or blue, because photos live in the app.
- **The first photo makes the folder.** The confirm the owner asked for is the button that adds
  the photos, and it names the folder: *Make the folder and add 3 photos*. After the first time it
  reads *Add 3 photos*.

## Is this the best we can do?

The column holds up on a second look. The windows behind it are where the second look paid.

- **Five windows became one.** A person who sets the folder often sets the plans next.
- **A wrong link can be fixed from the board**, on its row in the window.
- **The yes-only step went.** A person who says Not now has learned nothing, and a person who
  says yes and closes the window leaves an empty folder in Drive.
- **No press was added to opening the plans.** That is the one thing B got wrong.
- **A photo never waits on Drive.** My first draft sent each photo straight to Drive. Reading the
  job path changed it: a photo goes into the app first and the sweep files it, so a folder the app
  cannot write to costs a delay and never a photo. The mock-up draws that state.

| | Today | A | B | C |
|---|---|---|---|---|
| Presses to open the plans | 1 | 1 | 2 | 1 |
| From a grey photos icon to the first photo going up | no door | 3 | 2 | 2, then the button that names the folder |
| Change a link that is wrong | the gear, then the form | the gear, then the form | Change, on its row | the photos icon, then Change on its row |
| Windows to build | | five | one | one |
| An empty folder left in Drive | | yes | no | no |
| What it costs | | four windows of one field | a press on every open | a blue plans icon leaves the app and a blue photos icon stays in it |

What I did not draw: photos as a tab of the bid's own page. The board is where he asked for it,
and the window can be opened from the bid's preview later with no new work.

## Recommendation

**C.** The column exactly as asked, one Files window behind it, blue links straight out, and the
folder made by the first photo. PRs 1 to 3 are the photos icon and its window and are the same
under A, B and C but for the window's title and frame, so they can start before call 1 is
answered.

## The owner's calls

1. **Which direction?** My pick: C.
2. **Is the folder made by a press of its own, or by the first photo?** He asked for a confirm.
   My pick: the first photo, with the button naming the folder it makes. No empty folders, and one
   press fewer.
3. **Where does the photo folder live in Drive?** My pick: **Photos, under Team only, inside the
   bid's project folder**. A picture saved from a text onto a bid already lands there, and the
   folder becomes the job's on a win. When the bid has no project folder the app makes one in the
   shared Drive, as the robots' intake does. The other choice is a Photos folder of the app's own
   in the shared Drive, apart from the estimator's folder, which works for every bid today and
   leaves a bid with two folders.
4. **The hand-made bid folders in a personal Drive.** This is card #240's call 4, and it now
   gates this card's Drive leg for most plumbing bids. Until the folders move into the shared
   Drive, a bid photo files through `DRIVE_IMPERSONATE_USER` where that is set, or waits in the
   app with its reason. My pick: move them, once the estimators are members of the shared Drive.
5. **When a bid is won, what happens to its photos?** My pick: nothing moves. The folder is the
   job's by then, and the photos are in its Team only › Photos. A later PR shows them in the job's
   photo window as *from the bid*. Customer Pictures stays the job's own.
6. **Who may add a photo, and who may remove one?** My pick: anyone who can edit the bid may add,
   a primary on their own bids included. The person who added it and the office (dev, master,
   assistant, controller) may remove. A removal goes to Drive's trash with an Undo. It would be
   the first thing the app removes from Drive.
7. **Is the Bid submission slot drawn on an unsent bid?** My pick: yes, grey. Five slots on every
   row keep the column straight.
8. **Photos only, or videos too?** My pick: photos first. A video is held with its reason and can
   go in through Drive.
9. **Does the Files window replace Files & links in the bid's form?** My pick: not yet. Both write
   the same columns. Retire the form's section after a month of use.

## Where it plugs in

- **Exists**: the cluster and its icons (`BidsBidBoardTab.tsx`); the plan sets kernel and picker
  (`bidPlanSets.ts`, `BidPlanSetsModal.tsx`, `BidPlanSetsField.tsx`); `JobRef` with `bid_id`, the
  landing path and `photoFolderOrWhy` (`_shared/driveLink.ts`, `_shared/driveJobFolder.ts`); the
  bid folder rule (`drive-intake`); the sweep (`photo-save`); the thumb and full reads
  (`job-photos`); `shrinkPhoto`, `photoBlobs`, `useShotTiles`; the `uploaded_photos` view;
  `batchWords` and `countedLabel` for the counted buttons; `EmptyState`; `formatErrorMessage`.
- **New**: a `bid_photos` table and a `bid-photos` bucket; a `bid-photos` edge function; a tenth
  source in `photo-save`; a kernel `src/lib/bids/bidBoardLinkSlots.ts` that turns a bid into its
  five slots; `BidFilesModal.tsx` with a photos row; a help guide.

## The plan

Eight PRs, the photos icon first. Each client PR ships its release note and
`docs/recent-features/` fragment, with a version from `npm run claim`.

**PR 1 · the photo table and its bucket (S).** No client code.
- *Migration* (stamp from `npm run claim -- --migration`, opened with `SET lock_timeout = '3s';`,
  idempotent): `CREATE TABLE bid_photos` (`id`, `bid_id` → `bids`, `storage_path`, `name`,
  `bytes`, `by_user_id`, `taken_at`, `drive_file_id`, `filed_at`, `fail_why`, `removed_at`,
  `removed_by`), an index on `bid_id`, RLS, and the `bid-photos` storage bucket with its
  policies. Read: anyone who can read the bid, by a sub-select on `bids` so a primary's scope
  carries. Insert: the same people, as themselves. Update: the adder and the office. No delete.
  Ends with the four fence calls. `bids` itself is not altered.
- *Edge functions*: none.
- *Docs*: `docs/migrations/<stamp>_bid_photos.md`; `docs/ACCESS_CONTROL.md` (a `bid_photos` line
  beside `job_photo_notes`, and the bucket); `docs/PROJECT_DOCUMENTATION.md` → Database Schema.
- Then `supabase db push` from a main checkout, the `chore(types)` PR, and the dev-mcp catalog
  rebuilt with it.

**PR 2 · the Drive leg (M).** Edge only. Nothing calls it yet.
- *Migration*: none.
- *Edge functions*: new **`bid-photos`** (`make`: the bid's folder by `drive-intake`'s rule, moved
  into `_shared`, then Team only › Photos; `list`: the table's rows, and any picture in the folder
  with no row is adopted as one, so a file dragged in through Drive or saved from a text counts;
  `thumb` and `full`, as `job-photos` streams them). Gate: the caller can read the bid, checked
  with the caller's own token; twins and training accounts read only. **`photo-save`** gains its
  tenth source, `bid_photos`, with `{ bid_id }` as the job, the impersonated token when the folder
  is outside the shared Drive, and `fail_why` when it cannot file. `supabase functions deploy` for
  both after the merge.
- *Docs*: `docs/EDGE_FUNCTIONS.md` (a new `bid-photos` section and its TOC line; the `photo-save`
  section's count of sources amended); `docs/ACCESS_CONTROL.md` (who may call it).

**PR 3 · the photos icon and its window (M).** The PR that answers the ask.
- *Client*: the kernel `bidBoardLinkSlots.ts` with tests, drawing the photos slot only for now
  (grey, or blue with its count, read with the board's other per-bid maps); the photos window: add
  by pick, drop and camera through `shrinkPhoto` and `useShotTiles`, the grid, a photo opened
  large, the held state with its reason; a render smoke.
- *Migration*: none. *Edge functions*: none.
- *Docs*: a help guide, `src/content/help/add-photos-to-a-bid.md`; `docs/BIDS_SYSTEM.md` (the
  Links column); `docs/PROJECT_DOCUMENTATION.md` and `docs/GLOSSARY.md` (the window).

**PR 4 · rename and remove (S).** Gated by call 6.
- *Edge functions*: `bid-photos` gains `rename`, `remove` (Drive's trash, `removed_at` on the row)
  and `restore`. Redeploy.
- *Client*: rename in place, the ⋯ menu, Select with *Remove 2 photos* from `countedLabel`, the
  Undo.
- *Docs*: `docs/EDGE_FUNCTIONS.md` (the section amended); `docs/ACCESS_CONTROL.md` (who may
  remove); the guide.

**PR 5 · the column (M).** Gated by call 1.
- *Client*: the kernel returns all five slots in order; the table and the phone's card draw them,
  grey where missing; the photos window becomes the first row of `BidFilesModal`; a grey icon
  opens the window on its row, each row reading its state with **Open ↗**.
- *Migration*: none. *Edge functions*: none.
- *Docs*: `docs/BIDS_SYSTEM.md`; the guide; `docs/GLOSSARY.md` (Files window).

**PR 6 · set or change a link from the window (S).**
- *Client*: Project folder (paste, or **Make the project folder**), Plans (**Add a set**, the form's
  own field reused), CountTooling and Bid submission (paste). Writes the columns the form writes.
- *Edge functions*: `bid-photos make` is reused for the project folder. No new function.
- *Docs*: the guide `keep-more-than-one-set-of-plans-on-a-bid` and a new one for the window;
  `docs/BIDS_SYSTEM.md`.

**PR 7 · a photo taken with no signal (S).**
- *Client*: `photoBlobs` holds the photo on the phone and sends it when the signal is back, as a
  box photo does.
- *Docs*: the guide.

**PR 8 · the bid's photos after the win, and on Documents → Photos (S).**
- *Migration*: `CREATE OR REPLACE VIEW uploaded_photos` with a `bid_photos` branch (the live
  definition dumped first, never rebuilt from the baseline).
- *Client*: the job's photo window lists the bid's photos as *from the bid*.
- *Docs*: `docs/migrations/`, `docs/ACCESS_CONTROL.md` (the view's line), the guide
  `find-every-photo-that-was-uploaded`.

## How to verify

- **The test bid** is the ZZ Test bid (BP398), which other sessions share. Add photos to it, then
  remove every one before the session ends and name them in the report.
- **PR 2** by hand before any client: call `bid-photos make` on BP398, drop a picture into the
  folder through Drive, call `list` and see it adopted; insert a row with a file in the bucket and
  watch the sweep file it within five minutes.
- **The held state**: point a ZZ Test bid's project folder at a folder in a personal Drive and add
  a photo. The window says why it waits, the board's icon is blue with its count, and the photo
  files once the folder is shared or moved.
- **Roles** (PR 3): the office and an estimator add; a primary adds on a bid of their own and
  does not see another's; a training account sees the photos and a dead Add with its reason; a
  twin reads its own bid's photos.
- **The win** (PR 8): make a ZZ Test job from the bid and see the folder adopted, with Team only ›
  Photos inside the job's folder.
- **The column** (PR 5): at 1,400 wide and at 375, in both themes, a bid with nothing shows five
  grey icons and every row's icons line up.

## Found in passing, not fixed

- **A superintendent and the Bid Board.** `canOpenBids` lets the role open the page, and no policy
  on `bids` names it. What the board shows them was not walked live.
- **`drive-intake` has no caller on a screen.** The form's Project Folder is paste only, so every
  hand-made bid folder lands where the estimator made it. PR 6's **Make the project folder** is
  the first press for it.
