---
name: "One Drive folder per job, under its customer"
number: 236
group: close
status: built 2026-11-01 as v2.6284 (#6719), v2.6287 (#6720) and v2.6288 (#6721), with the boot fix v2.6294 (#6736) · migration 20261101163412 pushed, job-drive-folders and photo-save deployed · the drive moved into clickplumbing.com's Workspace the same day (v2.6293, #6731) · left: the office manager's move of the hand-made folders, the live walk, two casts
summary: >
  Every job gets a Google Drive folder the moment it exists, the folder sits under its customer's
  folder, the back catalogue is brought into the same shape, and the app links straight to the
  customer's folder, the job's folder and its photos. The server rule, the Where files go tab and
  the customer's door are on main and deployed. What is left is the 188 jobs that point at folders
  the office manager made by hand in a My Drive, where the app can make folders but never save a
  photo; those stay held until the folders are dragged into the app's Shared Drive, which since
  v2.6293 sits in the office manager's own Workspace with the office manager as Manager.
next: The office manager drags Click Customers from the My Drive onto the Shared Drive's top level, then the live walk below, on test data.
size: S
blocker: The office manager's drag, which only a person in that account can press; Google's ownership rule may still refuse part of it.
opinion: build — the code is on main; the Drive move and the live walk are what is left
mockup: not required — the screens are built; what is left is a Drive move and a live walk
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

Migration `20261101163412` is pushed (the types in #6735) and `job-drive-folders` and `photo-save` are deployed (`npm run check:migration-drift`, `npm run check:edge-drift`). Neither function could start after the first deploy, until v2.6294 exported what `_shared/jobFolders.ts` imports; `docs/EDGE_FUNCTIONS.md` → job-drive-folders → Status has it. Whether the sweep has stamped rows since, and whether the 188 have moved, was not read for this card: the dev seat's key is refused.

## What is left, in order

1. **The hand-made folders**, below.
2. **The live walk**, on test data only: ZZ job 1088 *ZZ TEST Riders Walk*, whose customer is *ZZ Split Test Claude* and which had no folder. Press **Make the job's Drive folders** on its job window's Documents tab: the folder should appear under the customer's folder in PipeTooling Jobs › Jobs, the line should say *under ZZ Split Test Claude*, and the row should carry `drive_folder_tidied_at`. Open the customer's profile: *Drive folder* should open that folder. On Documents → Where files go, the held line should count the jobs whose folder sits in a My Drive, each with the reason. Afterwards, trash the ZZ folders the walk made and clear the links on the two ZZ rows.
3. **Two casts**: the generated types know the two columns since #6735, so the two `as unknown as WhereFilesGoJob[]` casts in `src/lib/documents/whereFilesGoIo.ts` can go.

## The office manager's hand-made folders (the 188)

Until they are in the Shared Drive, those jobs stay held and their photos wait (Documents → Photos → *Not in Drive yet* lists them with the reason). The plan is for the office manager to drag **Click Customers** from that My Drive onto the drive's top level, beside *Bid plans* and *Jobs*, not inside *Jobs*. After that the sweep adopts each job's folder by its link, renames it and moves it under the customer, with no further step. v2.6293 settled two of Google's three rules by moving the drive into clickplumbing.com's Workspace with the office manager as Manager: a folder leaves a My Drive only under a Manager, and a move inside one organization needs no *Distributing content outside* setting. The third stands:

**Ownership.** A person can move only what they own. A folder holding 25 items, or 10% of its items, that they cannot move will not move at all. Photos someone else put in those folders, and folders the app's service account made inside that tree, count against that.

If the drag is still refused, one way out, not built:

- **The app copies instead of moving**: the service account copies each held job's folder into the job's tree under its customer and rewrites the links; the originals stay where they are. It sidesteps the rule. It is a build of its own.

## The drive today (2026-11-01)

PipeTooling Jobs, in clickplumbing.com's Workspace since v2.6293, holds *Bid plans* and *Jobs* at its top level. Members: the owner and the office manager (Manager) and the app's service account (Content manager). The old drive in douglasmining.com is renamed and holds an empty Jobs folder. The ids are in `docs/DRIVE_INTAKE_SETUP.md`.

## Gotchas met along the way

- The generated database types do not know the two new columns until the types chore, so #6720's first CI run failed its typecheck; its jobs reads now cast through `unknown`.
- The Mac it was built on has no Deno, so the function files were checked for syntax with esbuild and by eye; their types are checked at deploy. That is how a missing export between two `_shared` modules reached prod (v2.6294).
- A customer changed by typing on an existing job's form (the identity autosave) is left to the sweep, which places it within a week or on the Tidy press; the form's two link buttons place it at once.

## Sources

- [Move files & folders into shared drives](https://support.google.com/drive/answer/13045066?hl=en&co=GENIE.Platform%3DDesktop) (Google Drive Help)
- [How file access works in shared drives](https://support.google.com/a/users/answer/12380484?hl=en) (the role table: folders from My Drive, Manager only)
- [Manage shared drives as an admin](https://support.google.com/a/answer/7662202?hl=en) (the *Distributing content outside* setting)
