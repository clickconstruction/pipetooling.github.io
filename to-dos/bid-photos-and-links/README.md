---
name: "Bid photos, and a Links column that is always there"
number: 306
group: gated
status: asked 2026-11-10 with a screenshot of the Bid Board's Unsent / Working table and a red box left of a row's folder icon · the Links column, the job photo path, the Drive functions, the bid-to-job path and the role gates read on main the same day · three directions drawn at desktop and phone width with a second look and a pick · the owner took direction C and PR 1 the same day · PR 1 shipped as v2.6854 and was pushed the same day (the `bid_photos` table and its bucket are live) · the owner answered call 3 the same day: the bid's project folder · PR 2 (the Drive leg) shipped as v2.6856, pushed and its three functions deployed the same day; a live test on the ZZ Test bid filed a photo into Drive · PR 3 (the photos icon and its window) shipped as v2.6860 the same day, with `bid-photos` redeployed for its by-line fix: the ask is answered on the live Bid Board · the owner's two calls of the same day on a bid with a job: keep the bid's and the job's icons apart, lettered B and J, and let estimators see the job's photos; drawn as the mock-up's section 5, not built · a live walk on clicktooling.com the same day and a second look at what shipped, with five fixes in work on `claude/bid-photos-second-look`: every link icon in its own fixed place, a fresh count, readable names, a drop overlay and plainer words
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
  train is nine small PRs with the photos icon first.
next: A bid photo on a plumbing bid, the test of the folders' move into the shared Drive (call 4, made 2026-11-10). The owner's word on who may remove a photo (call 6) before PR 4, and on whether the cameras wear the letters too (call 11) before PR 6. PR 5, the fixed column, needs no further word and can start.
size: L as a train of nine (S · M · M · S · M · M · S · S · S); PRs 1 to 3 together are the photos icon and answer the ask; left: PRs 4 to 9 (S · M · M · S · S · S)
blocker: None for PR 5. Call 6 gates PR 4 and call 11 gates PR 6.
opinion: build — PR 5 next, so every link has its place in the column; then the job's pair
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
- **5 · A bid with a job: B and J**: the owner's call of 2026-11-10, a Won table with a lettered pair for the
  bid and one for the job, on a desk and a phone.
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

**C, and the owner took it on 2026-11-10.** The column exactly as asked, one Files window behind it, blue links straight out, and the
folder made by the first photo. PRs 1 to 3 are the photos icon and its window and are the same
under A, B and C but for the window's title and frame, so they can start before call 1 is
answered.

## The owner's calls

1. **Which direction?** My pick: C. **Answered 2026-11-10: C**, with the go for PR 1.
2. **Is the folder made by a press of its own, or by the first photo?** He asked for a confirm.
   My pick: the first photo, with the button naming the folder it makes. No empty folders, and one
   press fewer.
3. **Where does the photo folder live in Drive?** My pick: **Photos, under Team only, inside the
   bid's project folder**. A picture saved from a text onto a bid already lands there, and the
   folder becomes the job's on a win. When the bid has no project folder the app makes one in the
   shared Drive, as the robots' intake does. The other choice is a Photos folder of the app's own
   in the shared Drive, apart from the estimator's folder, which works for every bid today and
   leaves a bid with two folders.
   **Answered 2026-11-10: the bid's project folder.**
4. **The hand-made bid folders in a personal Drive.** This is card #240's call 4, and it gates this
   card's Drive leg for most plumbing bids. `DRIVE_IMPERSONATE_USER` is not set on prod, so until the
   folders move a photo on such a bid waits in the app with its reason. My pick: move them.
   **Answered 2026-11-10: move the folders, and moved the same evening.** The owner asked the session to make
   the move. It was made in his own Chrome, signed in as the folders' owner, through Drive's Move window, one
   folder at a time with the smallest first.
   - **What moved**: *Bids-HVAC (Ryan)* (58 items), *Bids-Electrical (Bryan & Wendi)* (131 items) and
     *Bids-Plumbing (Wendi)* (5,199 items), to the top of the shared Drive **PipeTooling Jobs**, beside its
     **Jobs** folder. Each kept its id, so every bid's Project Folder link and the form's three links work.
   - **What did not move**: one folder, *ZZ Dev Seat Check 2026-10-31*, a test folder the app's service account
     made inside the plumbing folder. Drive cannot move an item owned outside the company, so it left a shortcut
     in its place and the folder itself now sits in the service account's own Drive.
   - **Who can open them**: read before and after. Everyone who could open a folder before still can, the three
     addresses that are not members of the shared Drive among them, since Drive carried each folder's own
     sharing. Members of the shared Drive who were not on a folder before can now open it.
   - **The app**: `bid-photos` asked about a plumbing bid made that day answers with its folder in the shared
     Drive and no hold. Nothing was written by that read.
   - **Not walked**: a photo added to a real plumbing bid and filed. The first one is the test. The folder
     maker will now move a won bid's folder under its customer, and may place up to fifteen open jobs made
     from a bid the same way on its ten-minute sweep; that was not watched.
5. **When a bid is won, what happens to its photos?** My pick: nothing moves. The folder is the
   job's by then, and the photos are in its Team only › Photos. A later PR shows them in the job's
   photo window as *from the bid*. Customer Pictures stays the job's own.
   One thing to know: a job whose Customer Pictures link is not set lands its own photos in the same
   Team only › Photos, and the bid's window adopts whatever pictures that folder holds.
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

10. **On a won bid with a job, does the row offer the job's side too?** The owner's question of 2026-11-10:
    *should we offer the job folder as well with a "J" on the front of the folder icon*, then *J is short for
    the job folder, B would be the bid folder, should we instead combine them?* I picked one combined folder
    icon and one combined camera. **Answered 2026-11-10: keep J and B.** The bid's icons wear a B and the job's
    wear a J, each in its own slot. The same day: **estimators should be able to see job photos as well.**
    - What the code says, for whoever builds it: for a job made from a bid the two folders are one folder, since
      the job folder maker adopts the bid's (`FolderTree.placeJob`). They differ when a job had a folder of its
      own before it was linked to the bid (the board's *matches by value · Link* press). The photos are in two
      places either way: the bid's in Team only › Photos, the job's own in Customer Pictures.
    - What an estimator can do today: `job-photos` already answers one (`can_report_stage_progress` names the
      role), so the job's photos read in the app. What an estimator cannot do is learn which job a bid became:
      the board's job index reads `jobs_ledger` for dev, master, assistant and controller only
      (`canSeeBidBoardJobLinks`), and no `jobs_ledger` policy lets an estimator read a row.
    - A J folder opens Drive as the person. An estimator who is not a member of the shared Drive is asked by
      Drive to request access. The J camera reads through the app and works without Drive access.
11. **Do the cameras wear the letters too, or only the folders?** The owner asked for a J on the folder. My
    pick: both pairs wear them, a B camera and folder and a J camera and folder, since the J camera is the door
    that shows an estimator the job's photos whatever their Drive access. The smaller build is the two folders
    alone, with the job's photos reached through Drive.

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

Nine PRs, the photos icon first. Each client PR ships its release note and
`docs/recent-features/` fragment, with a version from `npm run claim`.

**PR 1 · the photo table and its bucket (S). Shipped, v2.6854, pushed 2026-11-10.** No client code.
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

**PR 2 · the Drive leg (M). Shipped, v2.6856, pushed and deployed 2026-11-10.** Edge, and one small migration.
- *Migration*: `bid_photos.tried_at` (a photo the sweep could not file is left alone for an hour, since
  a held bid folder is the common case today), the unfiled index remade to leave a removed photo out,
  and the `photo-save` cron re-scheduled with every earlier clause and a tenth for a bid photo due a try.
- *Edge functions*: new **`bid-photos`** (`list`: where the photos go, why they are held if they are,
  and the bid's photos, after any picture in the folder with no row is adopted as one, so a file
  dragged in through Drive or saved from a text counts; `make`: the bid's folder by `drive-intake`'s
  rule, now in `_shared/bidFolder.ts`, then Team only › Photos; `thumb` and `full`, as `job-photos`
  streams them). Gate: the caller can read the bid, checked with the caller's own token; twins and
  training accounts read only. **`photo-save`** gains its tenth source, `bid_photos`: it files as itself
  in the shared Drive and as the person in `DRIVE_IMPERSONATE_USER` in a personal Drive, marks each
  file with its row's id so the listing never adopts it twice, and writes `fail_why` when it cannot
  file. **`drive-intake`** names its folder through the shared rule. `supabase functions deploy` for
  the three after the push.
- *Docs*: `docs/EDGE_FUNCTIONS.md` (a new `bid-photos` section and its TOC line; the `photo-save`
  section's tenth source); `docs/migrations/`; `docs/ACCESS_CONTROL.md` (who may call it).

**PR 3 · the photos icon and its window (M). Shipped, v2.6860, 2026-11-10; `bid-photos` redeployed.** The PR that answers the ask.
- *Client*: the photos slot (`photosSlot` in `src/lib/bids/bidPhotoWindow.ts`, tested): a camera first in the Links
  cluster on the table and the phone's card, grey or blue with its count, read with the board's other per-bid
  maps (`useBidPhotoCountsByBid`). The photos window, `BidPhotosWindow.tsx`: add by pick, drop and camera through
  the job photos' shot-tile engine with the bid's io, a name on each tile, the press that names the folder the
  first time, the grid, a photo opened large, the held state with its reason; a render test.
- *Migration*: none.
- *Edge functions*: `bid-photos` adopts a picture the app filed itself under nobody's name, where it read the
  service account's address.
- *Docs*: a help guide, `src/content/help/add-photos-to-a-bid.md`; `docs/BIDS_SYSTEM.md` (the Links column);
  `docs/PROJECT_DOCUMENTATION.md`, `docs/GLOSSARY.md` and `docs/ACCESS_CONTROL.md` (the window).
- *Left for PR 5*: the other four link icons still draw only when the link exists, so the camera does not line up
  down the column yet.

**PR 4 · rename and remove (S).** Gated by call 6.
- *Edge functions*: `bid-photos` gains `rename`, `remove` (Drive's trash, `removed_at` on the row)
  and `restore`. Redeploy.
- *Client*: rename in place, the ⋯ menu, Select with *Remove 2 photos* from `countedLabel`, the
  Undo.
- *Docs*: `docs/EDGE_FUNCTIONS.md` (the section amended); `docs/ACCESS_CONTROL.md` (who may
  remove); the guide.

**PR 5 · the column (M).** Gated by call 1. The second look gave every link its fixed place already, so what is left here is the grey icon for a missing link and the Files window it opens.
- *Client*: the kernel returns all five slots in order; the table and the phone's card draw them,
  grey where missing; the photos window becomes the first row of `BidFilesModal`; a grey icon
  opens the window on its row, each row reading its state with **Open ↗**.
- *Migration*: none. *Edge functions*: none.
- *Docs*: `docs/BIDS_SYSTEM.md`; the guide; `docs/GLOSSARY.md` (Files window).

**PR 6 · B and J: the job's pair beside the bid's (M).** Gated by call 11. The owner's calls of 2026-11-10.
- *Migration*: a read for the board that an estimator may call, `bid_board_job_doors(p_bid_ids uuid[])`,
  a definer that answers only for bids the caller can read (the same sub-select on `bids` the photo table
  uses, run as the caller before the definer part) and returns, for each, its job's id, number, Drive folder
  link and how many photos the job has. Nothing else of the job leaves it: no money, no customer. No policy on
  `jobs_ledger` changes, so an estimator still opens no job.
- *Client*: the kernel's slots become Photos B · Folder B · Photos J · Folder J · Plans · CountTooling · Bid
  submission; the B letter on the bid's pair, the J pair once the bid has a job and empty until then; the J
  camera opens the Job photos window (`JobPhotosWindow.tsx`, its Drive read through `job-photos`), the J
  folder opens the job's folder; the board's job index for every role that reads the board comes from the new
  read, and the job's green chip keeps its own gate, since it opens the Jobs page.
- *To settle in the build*: the Job photos window lays its own rows (`uploaded_photos`) over the Drive
  listing, and that view joins `jobs_ledger` under the reader's policies, so an estimator sees the job's
  photos by file name, without the words. Widening the view is a second decision.
- *Edge functions*: none. `job-photos` already answers an estimator.
- *Docs*: `docs/migrations/`; `docs/ACCESS_CONTROL.md` (the estimator and job photos: the line that says the
  crews' photos are for the office is amended); `docs/BIDS_SYSTEM.md`; the guides `add-photos-to-a-bid` and
  `add-a-photo-to-a-job`.

**PR 7 · set or change a link from the window (S).**
- *Client*: Project folder (paste, or **Make the project folder**), Plans (**Add a set**, the form's
  own field reused), CountTooling and Bid submission (paste). Writes the columns the form writes.
- *Edge functions*: `bid-photos make` is reused for the project folder. No new function.
- *Docs*: the guide `keep-more-than-one-set-of-plans-on-a-bid` and a new one for the window;
  `docs/BIDS_SYSTEM.md`.

**PR 8 · a photo taken with no signal (S).**
- *Client*: `photoBlobs` holds the photo on the phone and sends it when the signal is back, as a
  box photo does.
- *Docs*: the guide.

**PR 9 · the bid's photos after the win, and on Documents → Photos (S).**
- *Migration*: `CREATE OR REPLACE VIEW uploaded_photos` with a `bid_photos` branch (the live
  definition dumped first, never rebuilt from the baseline). The branch leaves out a
  row whose Drive file a text's attachment already carries, since the window adopts those too.
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
- **The win** (PR 9): make a ZZ Test job from the bid and see the folder adopted, with Team only ›
  Photos inside the job's folder.
- **The column** (PR 5): at 1,400 wide and at 375, in both themes, a bid with nothing shows five
  grey icons and every row's icons line up.

## The second look at what shipped (2026-11-10)

The owner asked *have you tested it live and do you think it is the best we can do?* The live walk was on
clicktooling.com as the dev login, on the ZZ Test bid, at desk and phone width: the camera on all 85 rows, the
window reading the bid's Drive folder, a photo added and filed by the sweep five minutes later. It was not the
best we could do. What the walk showed, and what was done:

- **The camera was always there and not always in the same place.** Measured on the live board, its left edge sat
  at seven positions in the first twenty rows, because the column centred whatever icons a row had. Fixed: every
  link kind has its own slot, so each icon lines up down the column on every row.
- **Five photos read the same**, *2026-11-01 Robert …*, since a picture the app filed is named by day and sender
  first and the tile cut off the caption. Fixed: such a name reads as its caption, with its sender as who.
- **The board's count stayed behind** after the window took on pictures from the Drive folder. Fixed.
- **A drop on a full window showed its target at the bottom of the grid.** Fixed: the whole window is the target.
- **The words when Drive is silent named an Edge Function.** Fixed: plain words.

What it did not fix, and is the owner's:

- **`DRIVE_IMPERSONATE_USER` is not set on prod** (read from the secrets' names, 2026-11-10). So a bid whose
  project folder sits in a personal Drive keeps its photos in the app: they show, they count, and they do not
  reach Drive until the folder moves into the shared Drive or the secret is set (`docs/DRIVE_INTAKE_SETUP.md`).
  Most hand-made plumbing bid folders are such folders (card #240, call 4). This state has not been walked live:
  no ZZ Test folder sits in a personal Drive. **The owner chose the move, and the three bid folders were moved
  into the shared Drive the same evening**; what moved and what was checked are under call 4.
- **A grey camera on 84 of 85 rows is a lot of grey.** It is what was asked, and it reads as a to-do on every bid.
  Once the fixed column lands with grey for every missing link (PR 5) the owner may want the grey fainter.

## Found in passing, not fixed

- **A superintendent and the Bid Board.** `canOpenBids` lets the role open the page, and no policy
  on `bids` names it. What the board shows them was not walked live.
- **`drive-intake` has no caller on a screen.** The form's Project Folder is paste only, so every
  hand-made bid folder lands where the estimator made it. PR 7's **Make the project folder** is
  the first press for it.
