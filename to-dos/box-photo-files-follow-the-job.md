---
name: "Box photos: the Drive files follow a job that moved"
number: 297
mockup: box-photo-files-follow-the-job-combine.html — the combine's finish line; the owner chose section 2 on 2026-11-11 (the files start by themselves, a strip shows the count and a held file)
group: ready
status: the seat's move takes the files with it (v2.6885) · any change of job is followed by the sweep, a combine included (v2.6915) · the finish line is left
summary: >
  A box photo's row moves with its box when a job's Materials on site are moved to another job
  (v2.6808) or carried by a whole-job combine (v2.6423), but the file the photo sweep already
  filed stays in the first job's Drive photo folder. Every photo that opened from its box still does, since
  a row names its file by its own Drive id, so nothing is lost. What is off is the folders: the new
  job's Drive folder does not list the photos, and the old job's folder keeps pictures of a site
  that was never its own. The fix is a re-file step in the photo sweep's function that moves each
  file to the folder its row's job now names.
next: Build the finish line of the mock-up's section 2 — the sentence after a combine, the ask opened to the roles that may combine so the app can start it at once, and the strip on Jobs → Materials and the phone's On site tab with its count, a held file's reason and Try again.
size: S
blocker: None.
opinion: build when a move has been applied on prod and the office looks for the photos in the job's Drive folder — the photos work without it, so it is tidiness, not a repair
---

# Box photos: the Drive files follow a job that moved (#297)

## What happens today

- **A photo still waiting** in the `box-photos` bucket (a row with `storage_path` and no `filed_at`) needs nothing. The sweep reads the row's `job_id` when it files, so it lands in the new job's photo folder by itself. The bed `supabase/tests/on_site_move` holds the row's job and its bucket path after a move.
- **A photo already filed** keeps `drive_file_id` and sits where it was filed: the first job's *Team only › Photos* folder, or its Pictures folder. `plan_materials_move` counts these and says in words that they stay (`photos.in_drive`, `photos.words`).
- A row names its file by `drive_file_id`, never by folder, and `box-read` streams the photo by that id, so a photo that showed on its box before a move still does.

## Why it was not built with the move

The move's dry run does the write, reads both jobs and unwinds it, and the plan hash commits to what it read. A Drive move cannot be unwound or dry-run that way. It also has outcomes per file (a name the folder already holds, a folder that cannot be made, a file someone moved by hand), and making the target job's photo folder is itself a write in Drive. `photo-save` takes only the cron secret today, so a seat call needs a gate of its own. That is a function change with its own tests and deploy, not a line in a migration.

## Where it stands

- **v2.6885** (`docs/recent-features/v2.6885.md`): `photo-save` takes `{ refile_box_photos: <job_id> }` from a dev or the cron, and the seat's `apply_materials_move` makes the ask after its rows land (`photos.refiled`). Steps 1 and 2 below.
- **v2.6915** (`docs/recent-features/v2.6915.md`): the engine. The database marks a filed photo due when its job changes, and the sweep moves what is due, so a combine's files follow within minutes with no caller, a failed ask heals, and a held file is tried again a day later. Step 3 below, by the nightly pass's cousin.
- **Left**: the finish line the owner chose from the mock-up on 2026-11-11 (section 2). The one move applied on prod before v2.6885 was re-filed by hand that day, 91 files, so asking alone from the seat is no longer needed.

## The build

1. **`photo-save`: a re-file ask.** `POST { refile_box_photos: <job_id> }` with a dev's JWT (or the cron secret). For each `job_box_photos` row of the job with a `drive_file_id`: read the file's parents; when the job's photo folder (`photoFolderOrWhy`, the sweep's own resolver) is not among them, move it there with Drive's `addParents` / `removeParents` (`moveFolder` in `_shared/jobFolders.ts` is the same call for a folder), taking the next free name when the folder holds the name (`freeName`). A row whose file cannot be moved gets the reason in `fail_why`, as a failed filing does. Do what is ready: one file that fails never stops the rest, and the reply lists moved, already there, and held with the reason each.
2. **The seat.** After `apply_materials_move`'s rows land, the server asks `photo-save` for the target job and adds the reply to its own (`photos.refiled`), the way `apply_person_evidence` asks `hr-evidence-drive` after its rows. A failed ask never undoes the move; the reply says to ask again.
3. **A combine.** The same ask after `migrate_job_ledger_costs_and_delete`, from the client's combine flow or a nightly pass over rows whose file is not in their job's folder. Decide which when building; the nightly pass needs no caller.

## How to verify

- A ZZ job with a filed box photo, moved with the seat to a second ZZ job: the file is in the second job's photo folder, gone from the first's, and the box still shows it.
- A second ask moves nothing and says every file is already there.
- A file trashed in Drive by hand is held with its reason and the others move.

## Where it plugs in

- `supabase/functions/photo-save/index.ts` (`sweepWaiting`, `BOX_SOURCE`), `supabase/functions/_shared/driveJobFolder.ts` (`photoFolderOrWhy`, `freeName`), `supabase/functions/_shared/jobFolders.ts` (`moveFolder`).
- `supabase/functions/dev-mcp/index.ts`, the generic write branch after the RPC, and `docs/dev-mcp/README.md`'s `plan_materials_move` row.
- The map: [`docs/MATERIALS_ON_SITE_ARCHITECTURE.md`](../docs/MATERIALS_ON_SITE_ARCHITECTURE.md) → The gaps → Photos.
