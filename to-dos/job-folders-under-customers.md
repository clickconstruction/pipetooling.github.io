---
name: "One Drive folder per job, under its customer: built, paused for a hand-off"
number: 236
group: close
status: built 2026-11-01 as three PRs (#6719, #6720, #6721), paused the same day with auto-merge off · left: re-arm in order, push the migration, deploy two functions, the live walk, and the office manager's move of her hand-made folders
summary: >
  Every job gets a Google Drive folder the moment it exists, the folder sits under its customer's
  folder, the back catalogue is brought into the same shape, and the app links straight to the
  customer's folder, the job's folder and its photos. The server rule, the Where files go tab and
  the customer's door are built as three stacked PRs, held with auto-merge off because nobody was
  at hand to push the migration and deploy the functions. Separately, 188 jobs point at folders the
  office manager made by hand in her own My Drive, where the app can make folders but never save a
  photo; moving them into the app's Shared Drive needs a role change and a setting in her own
  Google Workspace before Google lets her drag them.
next: Re-arm #6719 only when the person who pushes is at hand, push its migration and deploy job-drive-folders and photo-save, then bring #6720 and #6721 up to date with main and re-arm them.
size: S
blocker: A person at hand to push and deploy. For the 188 hand-made folders, the office manager needs Manager on the drive and her own Workspace's sharing setting.
opinion: build — the code is done; the push, the deploy and the Drive move are the hand-off
mockup: not required — the screens are built in the three open PRs; what is left is a push, a deploy, a Drive move and a live walk
---

# One Drive folder per job, under its customer

## The ask, in the owner's words (2026-11-01)

The Photos tab on the Documents page went live on 2026-11-01 (v2.6270, punch list #232). Its first live walk found two photos that could not reach Drive: J1091's refused by Google (*Service Accounts do not have storage quota*) and J550's waiting because the job had no Drive folder. Asked for a smart way past both, the owner answered:

> I think a reasonable solution for this is every time a new job is created, we make a job folder. And every time a customer is added, we move that job folder under that customer. This will require a bit of a back migration, but it would create a condition where we would manage everything and everything would look very uniform. Most important, it would allow easy linking from the app to these folders. So if I went to a customer, I could find the customer folder quite quickly and if I went to a job, I could really quickly find that job's folder. And if I wanted to see photos, I could really quickly go right to the photos location.

Then: *Just build it.* Later the same day, out of credits: *pause this where we are, and I'm going to have another user on a different computer pick up this problem.*

## Why J1091 failed, and how many jobs share it

The app files photos as a Google service account. A service account can make folders anywhere it has edit rights, but it cannot own a file's bytes in a person's My Drive. Only a folder in a Shared Drive takes its files, which is why the app's own folders live in the **PipeTooling Jobs** Shared Drive (`docs/DRIVE_INTAKE_SETUP.md`). Drive's `capabilities.canAddChildren` says yes for a My Drive folder all the same, so the app's write check said *The app can write here* until the first photo found otherwise.

J1091's pictures folder sits in the office manager's My Drive, under a folder named **Click Customers**. A read of `jobs_ledger` on 2026-11-01 found:

| Live jobs | Count |
|---|---|
| A folder link pasted by hand (made May to October 2026) | 188 |
| No folder link at all | over 200 |

Two customers carried a folder link of their own.

## The decision (built)

- **The tree**: jobs root › *customer* › *job pattern* › the five folders inside (Customer Pictures, Plans, Team only › Photos, Sent by us). The customer's folder is named by the customer; a job with no customer yet sits under **No customer yet** and moves when one is set.
- **The folder follows the job.** A kept folder in the Shared Drive is moved under its customer and renamed to the office's pattern; a bid's folder the same way; a flat folder under the root from before the tree is moved under its customer; otherwise one is made. Drive keeps a folder's id through a move or a rename, so every link on a job, in a bookmark or in an email keeps working.
- **A folder in a My Drive is never moved.** The job is held with the reason on the row (`jobs_ledger.drive_folder_hold`), in the same words the write check and the photo sweep now use.
- **A sweep keeps the tree**: every 10 minutes, the live jobs never placed or last placed over a week ago, 25 a run. The first photo on a job with no folder makes the folder itself, so a photo never waits on a press.
- **Doors**: the customer profile's band gets *Drive folder*; the job window's Documents tab already had the job's three; the press's line says *under the customer*. The job form places a new job's folder at once, and again when the form sets or links a customer.

## Where it stands (2026-11-01)

| PR | Branch | What | State |
|---|---|---|---|
| [#6719](https://github.com/clickconstruction/pipetooling.github.io/pull/6719) | `claude/folders-under-customers` | The server: `supabase/functions/_shared/jobFolders.ts` (`FolderTree.placeJob`), the rules in `_shared/whereFilesGo.ts` (`placeFolder`, `customerFolderName`, `outsideDriveWords`, `driveFailWords`), the honest write check in `_shared/driveSettings.ts`, `job-drive-folders`' press and new `sweep` verb, `photo-save`'s first photo (`photoFolderOrWhy`), migration `20261101163412_job_folders_tidy` (two stamps on `jobs_ledger` and the cron), docs | open, auto-merge off; most checks green when paused |
| [#6720](https://github.com/clickconstruction/pipetooling.github.io/pull/6720) | `claude/folders-tab` | Documents → Where files go: the tree card with the customer level, **Tidy the folders for N live jobs**, the held line read from the rows | open, auto-merge off; stacked on #6719; checks were running after its typecheck fix |
| [#6721](https://github.com/clickconstruction/pipetooling.github.io/pull/6721) | `claude/folders-customer-window` | The customer profile's *Drive folder* door (`src/lib/customers/customerFolderWords.ts`) and the job form's press (`placeJobFolderSoon` in `JobFormModal.tsx`) | open, auto-merge off; stacked on #6720 |

Each PR's title carries the version it claimed. Nothing of the three is on prod: no migration pushed, no function deployed.

## Picking it up, in order

1. **Re-arm #6719** (`gh pr merge 6719 --auto`) only when the person who pushes is at hand.
2. **When it merges**, from a checkout of `main` with `.env.local`:

   ```bash
   bash scripts/db-push.sh
   ```

   ```bash
   bash scripts/deploy-functions.sh job-drive-folders photo-save
   ```

   Push first, deploy right after. The cron the migration schedules starts calling the sweep within 10 minutes; until the deploy the old function refuses those calls, which is harmless. **Once deployed, the sweep starts on its own**: it moves the app-made job folders under their customers, renames them to the pattern and makes folders for the jobs that have none, about 25 jobs every 10 minutes. Then `npm run check:migration-drift` and `npm run check:edge-drift`, and a types chore (`npm run gen-types:linked`), after which the two `as unknown as WhereFilesGoJob[]` casts in `src/lib/documents/whereFilesGoIo.ts` can go.
3. **Bring #6720 up to date with main** (it still carries #6719's commit; merge main in, or the desktop app's sync with base branch), re-arm it. It reads the two new columns, so only after the push. Then #6721 the same way.
4. **The live walk**, on test data only: ZZ job 1088 *ZZ TEST Riders Walk*, whose customer is *ZZ Split Test Claude* and which had no folder. Press **Make the job's Drive folders** on its job window's Documents tab: the folder should appear under the customer's folder in PipeTooling Jobs › Jobs, the line should say *under ZZ Split Test Claude*, and the row should carry `drive_folder_tidied_at`. Open the customer's profile: *Drive folder* should open that folder. On Documents → Where files go, the held line should count the jobs whose folder sits in a My Drive, each with the reason. Afterwards, trash the ZZ folders the walk made and clear the links on the two ZZ rows.

## The office manager's hand-made folders (the 188)

Until they are in the Shared Drive, those jobs stay held and their photos wait (Documents → Photos → *Not in Drive yet* lists them with the reason). The plan was for her to drag **Click Customers** from her My Drive onto the drive's top level, beside *Bid plans* and *Jobs*, not inside *Jobs*. After that the sweep adopts each job's folder by its link, renames it and moves it under the customer, with no further step. Google's rules stand in the way three times:

1. **Her role.** Moving a folder from My Drive into a shared drive takes **Manager**. She was added on 2026-11-01 as **Content manager**, which can move files but not folders. A person signed in as the drive's manager raises her row to Manager in *Manage members*. Claude's auto mode refused that change as a permission grant, so a person presses it.
2. **Her organization.** The drive belongs to the douglasmining.com Google Workspace, whose domains (read in its Admin console on 2026-11-01) are douglasmining.com, colist.io, douglas.lol and eo-tx.com. Her account is in clickplumbing.com, a separate Workspace, so her own admin decides whether she may move content into another organization's drive: clickplumbing.com's Admin console › Apps › Google Workspace › Drive and Docs › Sharing settings › Sharing options › *Distributing content outside of clickplumbing.com* must be **Anyone**. Otherwise Drive refuses with `DIFFERENT_CUSTOMER`. Who administers clickplumbing.com was not checked.
3. **Ownership.** She can move only what she owns. A folder holding 25 items, or 10% of its items, that she cannot move will not move at all. Photos someone else put in her folders, and folders the app's service account made inside her tree, count against that.

If the drag is still refused, two ways out, neither built:

- **The app copies instead of moving**: the service account copies each held job's folder into the job's tree under its customer and rewrites the links; her originals stay where they are. It sidesteps all three rules. It is a build of its own.
- **A Shared Drive inside clickplumbing.com's Workspace**, with the app's service account as Content manager, set as the jobs root on Where files go. Her move is then inside one organization. The folders the app already made stay in PipeTooling Jobs unless someone moves them, so weigh it before choosing.

## The drive today (2026-11-01)

PipeTooling Jobs holds *Bid plans* and *Jobs* at its top level. Members: the douglasmining.com admin account (Manager), the app's service account (Content manager), and two clickplumbing.com accounts, the owner's and the office manager's (Content manager). Its id and the Jobs folder's id are in `docs/DRIVE_INTAKE_SETUP.md`.

## Gotchas met along the way

- The generated database types do not know the two new columns until the types chore, so #6720's first CI run failed its typecheck; its jobs reads now cast through `unknown`.
- The Mac it was built on has no Deno, so the function files were checked for syntax with esbuild and by eye; their types are checked at deploy.
- A customer changed by typing on an existing job's form (the identity autosave) is left to the sweep, which places it within a week or on the Tidy press; the form's two link buttons place it at once.

## Sources

- [Move files & folders into shared drives](https://support.google.com/drive/answer/13045066?hl=en&co=GENIE.Platform%3DDesktop) (Google Drive Help)
- [How file access works in shared drives](https://support.google.com/a/users/answer/12380484?hl=en) (the role table: folders from My Drive, Manager only)
- [Manage shared drives as an admin](https://support.google.com/a/answer/7662202?hl=en) (the *Distributing content outside* setting)
