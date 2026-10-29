---
name: "A job's Drive photos in the app, and a checklist per stage"
number: 164
group: ready
status: building 2026-10-29 on claude/164-stage-checklists-cbedd2 (one branch per PR) · proposed 2026-10-24 from the trade ERP comparison (gap 4 of 9) · the owner decided the same day that photos always live in Google Drive · mock-up drawn 2026-10-26 · Taunya approved the picks on the review canvas of 2026-10-29 · PR 1 the kernel built as v2.6072
summary: >
  Every one of the fifteen trade apps compared keeps job photos in the app and offers checklists a
  crew fills on site. Ours send photos to Google Drive by design and have no checklist on a job. The
  owner decided that photos always live in Google Drive. The smallest useful version adds one
  checklist per stage (Rough In, Top Out, Trim Set) that the crew fills on the phone, with the
  stage reading not ready until it is filled, and shows the job's photos as a gallery in the app,
  read from the customer's Drive folder and never copied out of it.
next: PR 2, the tables and the office's editor; then the sheet on the phone, the Pipeline's mark and the Drive gallery. The owner types the questions for each stage once the editor ships.
size: M to L as a train of five (S · S · M · S · M); one migration (the checklists)
blocker: None for the build. The questions for each stage are the owner's to type in the editor.
ver: v2.6072
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
  said a report carries a photos field. **It does not** (read 2026-10-29, PR 1): a template field's
  `input_type` is `long_text`, `percent_0_100` or `signature_png`, `reports.field_values` maps a field
  id to text, and a test report keeps its paper as `pdf_path`. Every photo the app keeps waits in a
  bucket until Drive has it: a text's on `message_attachments` (`bucket_path`, then `drive_file_id`), a
  Quick Estimate's in `estimate_field_photos` until the handover row, a box photo in `job_box_photos`
  (`storage_path`, `file_name`, `drive_file_id`, `filed_at`, `fail_why`). A checklist photo follows the
  box photo's shape; #189's PR 5b plans `report_photos` the same way.
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

**Decided 2026-10-29** on the review canvas (Taunya, for the owner), the card's picks as drawn:

1. **A stage reads not ready until every question is answered.** The strict rule, as the mock-up's
   sheet draws it. A stage kind with no questions written has no checklist and reads exactly as today.
2. **The office edits the questions**, once for the company, in the editor PR 2 ships; the crew only
   answers. The owner writes the words himself, so the editor ships with Rough In, Top Out and Trim Set
   listed and empty. No placeholder question reaches prod. The checklists start the day the office types
   the questions.
3. **A test report does not count as a stage's checklist** in this version. The checklist stands on its own.
4. **Order:** the checklists first, the Drive gallery last.

Taken in PR 1, under the strict rule: a question that asks for a photo is answered by its pick and its
photo. Not here needs no photo, since there is nothing there to photograph. The photo counts from the
moment it is taken, before the sweep files it in Drive.

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
| The rules | `lib/jobs/stageChecklist.ts` (v2.6072): the kind from the stage's name, the template for a kind, the picks, the answered rule, the stage's standing, the words, the photo's Drive name | — |
| Filling it | Job Mode, the job window | the checklist on a stage |
| The not-ready mark | the Pipeline's stage cell | one more state |
| Photos | `photo-save`, `lib/photos/`, the Drive delegation, the customer's folder link | the gallery over the folder, and a checklist photo saved there |

## The plan

1. **The kernel**, and a look at what a report's photos field stores today. **Built as v2.6072.**
2. **The tables** and the office's editor for each stage's questions: `stage_checklist_templates` (a
   question per row: kind, order, the words, whether it asks for a photo, retired when taken off) and
   `stage_checklist_answers` (one per job stage and question: the pick, the note, the photo's waiting-room
   path and its Drive id once filed), one additive migration with the three fences, the templates read by
   everyone signed in and written by the office, the answers by whoever may stamp the job's stages
   (`can_report_stage_progress`), and a card under Settings → Jobs & billing where the office keeps the
   questions per stage kind. #189's PR 6 (a photo answers a checklist question) can start once this merges.
3. **The checklist on the phone**: a strip of the job's stages on Job Mode's details and under the job
   window's address, each opening one sheet with Yes, No or Not here per question, a note, and a photo
   where asked, shrunk on the phone, put in a bucket and filed in the customer's Drive folder by the
   `photo-save` sweep as a box photo is.
4. **The Pipeline's not-ready mark**: one more state on the stage's name under the bar.
5. **The Drive gallery** on the job window, read from the customer's folder and never copied out, with
   the checklist's photo among them.

## Where it stands

| PR | What | Version |
|---|---|---|
| 1 | The kernel, and the look at a report's photos | v2.6072 |
| 2 | The tables, the migration and the office's editor | — |
| 3 | The sheet on the phone, the photo to Drive | — |
| 4 | The Pipeline's not-ready mark | — |
| 5 | The Drive gallery on the job window | — |

## How to verify

On a ZZ test job with three stages: fill Rough In's checklist on the phone preset and see its
stage read ready on the Pipeline while Top Out reads not ready. Open the gallery and see the job's
photos from its Drive folder, the checklist's photo among them.

## Left for the owner

- The questions for each stage, typed in the editor once PR 2 ships. Until then every stage reads as today.
