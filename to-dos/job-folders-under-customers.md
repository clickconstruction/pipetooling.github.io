---
name: "One Drive folder per job, under its customer"
number: 236
group: close
status: built 2026-11-01 as v2.6284 (#6719), v2.6287 (#6720) and v2.6288 (#6721), with the boot fix v2.6294 (#6736) · migration 20261101163412 pushed, job-drive-folders and photo-save deployed · the drive moved into clickplumbing.com's Workspace the same day (v2.6293, #6731) · the owner's four asks after it shipped the same day: the tab lists what each folder holds (v2.6299), the Pipeline row's Job folder icon (v2.6301), Add a file beside each folder row (v2.6303), Find a file on Documents → Search (v2.6305) · by that evening the hand-made folders were in the Shared Drive and all 101 live jobs placed, none held · left: a look at the customer's door on test data, and what to do with the test folders
summary: >
  Every job gets a Google Drive folder the moment it exists, the folder sits under its customer's
  folder, the back catalogue is brought into the same shape, and the app links straight to the
  customer's folder, the job's folder and its photos. The server rule, the Where files go tab and
  the customer's door are on main and deployed. The folders the office manager made by hand in a
  My Drive reached the app's Shared Drive the same evening, and the sweep has placed every live
  job's folder under its customer, with none held. What is left is a look at the customer's door
  on test data and a choice about the test folders.
next: Open ZZ Split Test Claude's customer profile and press Drive folder; it should open the customer's folder with ZZ TEST Riders Walk's folder inside. Then settle the ZZ folders as below.
size: S
blocker: None.
opinion: your call — built, deployed and every live job placed; a look at the customer's door on test data is all that is left
mockup: not required — the screens are built; what is left is a look on test data
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
| [#6719](https://github.com/clickconstruction/pipetooling.github.io/pull/6719) | `claude/folders-under-customers` | The server: `supabase/functions/_shared/jobFolders.ts` (`FolderTree.placeJob`), the rules in `_shared/whereFilesGo.ts` (`placeFolder`, `customerFolderName`, `outsideDriveWords`, `driveFailWords`), the honest write check in `_shared/driveSettings.ts`, `job-drive-folders`' press and new `sweep` verb, `photo-save`'s first photo (`photoFolderOrWhy`), migration `20261101163412_job_folders_tidy` (two stamps on `jobs_ledger` and the cron), docs | merged, v2.6284 |
| [#6720](https://github.com/clickconstruction/pipetooling.github.io/pull/6720) | `claude/folders-tab` | Documents → Where files go: the tree card with the customer level, **Tidy the folders for N live jobs**, the held line read from the rows | merged, v2.6287 |
| [#6721](https://github.com/clickconstruction/pipetooling.github.io/pull/6721) | `claude/folders-customer-window` | The customer profile's *Drive folder* door (`src/lib/customers/customerFolderWords.ts`) and the job form's press (`placeJobFolderSoon` in `JobFormModal.tsx`) | merged, v2.6288 |

Migration `20261101163412` is pushed (the types in #6735) and `job-drive-folders` and `photo-save` are deployed (`npm run check:migration-drift`, `npm run check:edge-drift`). Neither function could start after the first deploy, until v2.6294 exported what `_shared/jobFolders.ts` imports; `docs/EDGE_FUNCTIONS.md` → job-drive-folders → Status has it. A read of `jobs_ledger` and `customers` late on 2026-11-01 found all 101 live jobs placed and none held, and each of the 52 customers with a live job carrying its folder's link; the 16 live jobs with no customer sit under *No customer yet*. The sweep reads live jobs only, so it has not looked at the 775 paid jobs, 181 of them with a folder link, and where those folders sit was not checked.

The owner's four asks after the train shipped on 2026-11-01 as their own PRs: the Documents tab lists what each of the job's folders holds, read live from Drive with where each file came from (v2.6299, #6742); the Pipeline row's **Job folder** icon after Share opens that tab, amber with a folder and grey without (v2.6301, #6747); **Add a file** beside each folder row puts a file from this computer into it through `drive-link` (v2.6303, #6748); **Find a file** on Documents → Search finds a file by the words inside it across every job's and bid's folder (v2.6305, #6751). The live walk below now also reads the new listing: a folder just made says *Nothing in Plans yet*.

## What is left, in order

1. **The live walk's last look**, on test data only: ZZ job 1088 *ZZ TEST Riders Walk*, whose customer is *ZZ Split Test Claude*, got its folder from the Tidy press on 2026-11-01, under the customer's folder in PipeTooling Jobs › Jobs, and its row carries `drive_folder_tidied_at`. Open the customer's profile: *Drive folder* should open that folder, with the job's inside. On Documents → Where files go, no held line should show beside **Tidy the folders**.
2. **The ZZ folders**: the job is live, so the sweep makes its folder again within a week of its links being cleared. Either leave the ZZ folders in the tree, or trash them and clear the links on the two ZZ rows once the ZZ job is no longer live.

## The office manager's hand-made folders (the 188)

They reached the Shared Drive on the evening of 2026-11-01, and the sweep took them from there with no further step. The cron's first runs that afternoon held the live jobs whose folders were still in the My Drive. J1091's photo, the one Google had refused, filed that evening, and a **Tidy the folders** press soon after placed the about 60 live jobs the cron had held or not yet reached. Each folder was adopted by its link, renamed and moved under its customer, its id and so every link to it kept. Who dragged them was not read.

v2.6293 had settled two of Google's three rules by moving the drive into clickplumbing.com's Workspace with the office manager as Manager: a folder leaves a My Drive only under a Manager, and a move inside one organization needs no *Distributing content outside* setting. The third, that a person can move only what they own, stopped no live job's folder. The way out kept in case the drag was refused, the app copying each held job's folder instead of moving it, was not needed and is not built.

## The drive today (2026-11-01)

PipeTooling Jobs, in clickplumbing.com's Workspace since v2.6293, holds *Bid plans* and *Jobs* at its top level; whether the drag left anything beside them, such as what **Click Customers** held besides live jobs' folders, was not checked. Members: the owner and the office manager (Manager) and the app's service account (Content manager). The old drive in douglasmining.com is renamed and holds an empty Jobs folder. The ids are in `docs/DRIVE_INTAKE_SETUP.md`.

## Gotchas met along the way

- The generated database types did not know the two new columns until the types chore (#6735), so #6720's first CI run failed its typecheck; its jobs reads cast through `unknown` until the chore, and the casts went after it.
- The Mac it was built on has no Deno, so the function files were checked for syntax with esbuild and by eye; their types are checked at deploy. That is how a missing export between two `_shared` modules reached prod (v2.6294); since v2.6315 CI links every function (`npm run check:edge-bundles`), so the next one fails the PR.
- A customer changed by typing on an existing job's form (the identity autosave) is left to the sweep, which places it within a week or on the Tidy press; the form's two link buttons place it at once.

## Sources

- [Move files & folders into shared drives](https://support.google.com/drive/answer/13045066?hl=en&co=GENIE.Platform%3DDesktop) (Google Drive Help)
- [How file access works in shared drives](https://support.google.com/a/users/answer/12380484?hl=en) (the role table: folders from My Drive, Manager only)
- [Manage shared drives as an admin](https://support.google.com/a/answer/7662202?hl=en) (the *Distributing content outside* setting)
