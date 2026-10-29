---
name: "Where files go: the office sets the jobs root and how a job's folder is named, on Documents"
number: 211
group: ready
status: mock-up drawn 2026-10-29 from the owner's ask, picked the same day · the build handed to its own session the same evening, expecting a hand-off mid-build
mockup: to-dos/where-files-go/mockup.html
summary: >
  Now that the app makes a job's Drive folders (#209, v2.6054 and v2.6055), the office should own
  the two things about them that matter and see the rest. Today the root the app files under is a
  secret a developer sets on the functions, and a job's folder link is pasted by hand into Edit job,
  one job at a time, with nothing saying whether the app can write there. The design is a third tab
  on Documents, Where files go, with three cards: the jobs root with a live write check, the name of
  a job's folder as a pattern of chips with a real example, and the tree inside with one choice, up
  front or as needed. Two presses under them make the folders for every job without one and check a
  single job's folder. The five folder names inside stay fixed, because the sweeps file by them.
next: PR 1, the settings and the kernel; then PR 2, the section; then PR 3, the bids' intake names by the same pattern.
size: M as a train of three (S · M · S)
blocker: none
ver: v2.6055
opinion: build — the owner picked it; the root and the naming are the safe levers, and the Check press is the cure for the 403 the photo sweep met on job 972
---

# Where files go (#211)

## The ask

The owner, 2026-10-29, after the app began making a job's Drive folders: *"it may be smart to show the
user in the Documents page a configuration page to set where folders are made and their naming schema
… let's talk about what we could add that feels native."* The talk settled on the mock-up beside this
card, and the owner said: *"I like it. Please save it to the to-dos and then start the build."*

## What is wrong today

- The root the app files under is `DRIVE_JOBS_FOLDER_ID`, a secret on the edge functions. Moving it
  takes a developer and a deploy.
- A job's folder is a link pasted into Edit job (`google_drive_link`, `job_pictures_link`), one job at a
  time, and nothing checks that the app can write there. Test job 972's pictures folder was made by hand
  and never shared with the service account, so the photo sweep met a 403 that only the row could tell.
- The name of a job's folder is whatever the press or the bids' intake chooses; the office has no say.

## The design (the mock-up)

A third tab on Documents, **Where files go**, one line under it, three cards left to right:

1. **The jobs root.** The folder by name with its path and owner, the count of job folders inside, a
   field to paste a new link, and **Check**: the same write test the photo sweep runs, answered in the
   same words, *The app can write here.* or Drive's refusal.
2. **How a job's folder is named.** A pattern of chips in order, Job number · Job name, a dashed tray
   of pieces to add, Customer, Address, Year, and the live example from a real job underneath,
   *972 · Oak Hollow Bldg C*. The same row for a bid's folder, Project name today.
3. **What is inside.** The tree, Customer Pictures, Plans, Team only with Photos and Sent by us, and
   one choice: make all of it when the job is made, or each folder when something first lands in it.
   The five names stay fixed: the sweeps, the sent-copies path and the plans intake read them in about
   sixty places.

Under the cards, **Make the folders for N jobs without one** names its count and lists what it held,
and **Check a job's folder** runs the write test on one job. An amber held line counts the jobs whose
pasted folder the app cannot write to. A change applies to folders made from then on; nothing that
exists is moved or renamed. At 375 the cards stack, the chips wrap, the tree stays.

## Where it plugs in

- **Settings**: `app_settings` keys in `src/lib/appSettingsKeys.ts`: `drive_jobs_root_folder_id`,
  `drive_job_folder_pattern` (a JSON list of pieces, `["number","name"]`), `drive_folders_made`
  (`upfront` or `as-needed`). The functions read them through the service client and fall back to the
  env while a setting is empty.
- **Functions**: `job-drive-folders` (v2.6054) makes the job's folders and writes the links; `drive-intake`
  names a bid's folder under the root; `_shared/driveJobFolder.ts` (`jobFolder`, `childFolder`,
  `landingFolder`, `photoFolderFor`) and `_shared/driveUpload.ts` (`googleAccessToken`,
  `findOrCreateFolder`) are the Drive helpers. The Check press is a verb of `job-drive-folders` that
  tries a write under a folder id and answers in words; `photo-save` already carries the words.
- **The page**: `src/pages/Documents.tsx` (the contract library and quick-send; roles staff, estimator,
  primary, super); the new tab is for the office roles.
- **The batch**: the backfill press of #6419 on the Materials desk moves here (or both doors lead to one
  act); its button takes its count from `batchWords` / `countedLabel`.

## The plan

1. **PR 1, the settings and the kernel.** The three keys; a pure `folderName(pattern, job)` in
   `src/lib/documents/folderName.ts` with tests (the pieces, the separator, a job with no name); the
   functions read the root and the pattern from the settings with the env as the fallback; the Check verb.
   Release note, fragment, `docs/EDGE_FUNCTIONS.md`.
2. **PR 2, the section.** The tab and the three cards as drawn, the two presses, the held line; the guide
   *set where a job's files go* (Office, plain words); `docs/twins/APP_DIRECTORY.md` → `/documents`,
   `docs/PROJECT_DOCUMENTATION.md`, the Glossary; release note and fragment.
3. **PR 3, the bids' folder.** `drive-intake` names a bid's folder by the bid pattern.

## How to verify

Dev server, `/dev-login?as=1`, Documents → Where files go. Paste the owner's real jobs root and press
Check: *The app can write here.* Paste a folder the service account is not on: Drive's refusal in the
amber line. Change the pattern and read the example change. Press Make the folders for N jobs without
one on a test job (972 is the owner's): the links land on the job and the tree is in Drive. Screenshots
at 375, 768 and 1,280 in light and dark. Real names and folders stay out of the repo and the mock-up.

## Picking this up

The hand-off note with the same plan and the context of the evening is in the shared session notes,
`211-where-files-go-handoff.md`. The Materials on site stream (#209) is live from v2.6039 to v2.6055;
its card is `to-dos/materials-on-site/README.md`.
