---
name: "A job's Drive photos in the app, and a checklist per stage"
number: 164
group: gated
status: proposed 2026-10-24 from the trade ERP comparison (gap 4 of 9) · the owner decided the same day that photos always live in Google Drive · mock-up drawn 2026-10-26 · waiting on the questions for each stage
summary: >
  Every one of the fifteen trade apps compared keeps job photos in the app and offers checklists a
  crew fills on site. Ours send photos to Google Drive by design and have no checklist on a job. The
  owner decided that photos always live in Google Drive. The smallest useful version adds one
  checklist per stage (Rough In, Top Out, Trim Set) that the crew fills on the phone, with the
  stage reading not ready until it is filled, and shows the job's photos as a gallery in the app,
  read from the customer's Drive folder and never copied out of it.
next: The owner looks at mockup.html (the Drive gallery on the job window, the stage checklist sheet with placeholder rows), writes the questions for each stage and says whether a stage may be ticked done with one unanswered; then Do, Later or Drop.
size: M to L as a train of five (S · S · M · S · M); one migration (the checklists)
blocker: The questions for each stage.
opinion: build the stage checklists first, then the Drive gallery
---

# A job's Drive photos in the app, and a checklist per stage (#164)

## The ask

The owner, 2026-10-24: *"Draft to-dos in the repo for the top five gaps, each with its smallest
useful version, as one docs PR."* This is gap 4 of the trade ERP comparison the owner ran the same day.
The owner kept its weight at 3 of 3. Its gap is 1, so it scores 3, tied with #165, and comes first on the
tie-break: all fifteen vendors are strong on it.

This is a proposal. Nothing here is built until the owner picks.

## What the comparison found

- Housecall Pro makes branded photo reports with a summary on top, and its checklists take pass,
  flag or fail.
- Workiz can require a checklist before a job closes; Successware can require forms by job class.
- FieldPulse turns a state or county PDF form into fillable fields.
- Procore drafts a daily log from photos and voice notes, and Contractor Foreman checks log photos
  for hazards.

## Today

- **Photos go to Google Drive, on purpose.** A text's photos are saved to the customer's Drive
  folder through `photo-save` (`lib/photos/`, `PhotoSaveTick.tsx`). Quick Estimate field photos
  wait in the `estimate-field-photos` bucket until Quickfill's **Field photos → Drive** station
  files them in Drive and deletes them from app storage (v2.2300). So Drive is the company's home
  for photos, and app storage is a waiting room.
- **Field reports** write `reports` from report templates (`report_templates`,
  `report_template_fields`); test reports write `job_test_reports`. The comparison's capability map
  says a report carries a photos field; PR 1 confirms what it stores.
- **Checklists** on `/checklist` are recurring tasks for people, not questions on a job.
- **Stages** are the job's priced lines (`jobs_ledger_fixtures`, the Stage Plan's `stage_kind`,
  `list_job_stage_progress`), so Rough In, Top Out and Trim Set already exist on every job that
  has them.

## The decision

**Decided 2026-10-24: photos always live in Google Drive.** The owner: *"for 164 it should always
be the google drive."* So the app never keeps its own copy. It lists and shows the photos in the
customer's Drive folder through the Workspace delegation it already uses, and a photo taken in the
app goes to that folder, as a text's photos do through `photo-save`. Keeping them in an app bucket
was the other option, and it is dropped.

**Still open**: the questions on each stage's checklist, in the owner's words, and whether a stage
may be ticked done with a question unanswered.

## The mock-up

[`mockup.html`](./mockup.html) beside this file (drawn 2026-10-26, made-up data): today's job
window with photos only in Drive and a stage ticking bare, then the photo strip read from the
customer's folder (with the no-folder door) and a stage's checklist sheet — its question rows are
placeholders until the owner writes the real ones.

## The smallest useful version

1. **A checklist per stage kind**: a short list of questions for Rough In, Top Out and Trim Set,
   kept once for the company and edited by the office.
2. **Filled on the phone** from Job Mode and the job window: yes, no or not here, a note, and a
   photo where the question asks for one, saved to the customer's Drive folder.
3. **The stage reads not ready** on the Pipeline until its checklist is filled.
4. **The job's photos as a gallery** on the job, read from the customer's Drive folder. A job with no folder link says so, with the door to set it.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The stages | `jobs_ledger_fixtures`, `list_job_stage_progress` | — |
| The questions and answers | — | tables such as `stage_checklist_templates` and `stage_checklist_answers`, the three fences |
| The rules | — | `lib/jobs/stageChecklist.ts`: the template for a stage, the answers, the ready rule; pure and tested |
| Filling it | Job Mode, the job window | the checklist on a stage |
| The not-ready mark | the Pipeline's stage cell | one more state |
| Photos | `photo-save`, `lib/photos/`, the Drive delegation, the customer's folder link | the gallery over the folder, and a checklist photo saved there |

## The plan

1. **The kernel**, and a look at what a report's photos field stores today.
2. **The tables** and the office's editor for each stage's questions.
3. **The checklist on the phone**: Job Mode and the job window.
4. **The Pipeline's not-ready mark.**
5. **The Drive gallery** on the job, and a checklist's photos saved to the folder.

## How to verify

On a ZZ test job with three stages: fill Rough In's checklist on the phone preset and see its
stage read ready on the Pipeline while Top Out reads not ready. Open the gallery and see the job's
photos from its Drive folder, the checklist's photo among them.

## Open questions

- The questions for each stage, and who may edit them.
- Whether a test report counts as a stage's checklist where one exists.
