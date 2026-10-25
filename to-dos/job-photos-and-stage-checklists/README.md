---
name: "Job photos in the app, and a checklist per stage"
number: 164
group: gated
status: proposed 2026-10-24 from the trade ERP comparison (gap 4 of 9) · waiting on where photos live and a mock-up
summary: >
  Every one of the fifteen trade apps compared keeps job photos in the app and offers checklists a
  crew fills on site. Ours send photos to Google Drive by design and have no checklist on a job. The
  smallest useful version adds one checklist per stage (Rough In, Top Out, Trim Set) that the crew
  fills on the phone, with the stage reading not ready until it is filled, and shows a job's photos
  as a gallery in the app, either kept in the app or read from the customer's Drive folder.
next: The owner picks where photos live (in the app, or a gallery over Drive) and the questions on each stage's checklist; then a mock-up of the stage checklist on Job Mode and the job window.
size: M to L as a train of five (S · S · M · S · M); one migration, two if photos move into the app
blocker: Where photos live.
opinion: build the stage checklists first; for photos, a gallery over Drive keeps the company's home for them
---

# Job photos in the app, and a checklist per stage (#164)

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

## The decision (open)

- **Where photos live.**
  - **A. In the app.** A `job-photos` bucket and a `job_photos` table, shown on the job, the
    field report and the customer's portal. Works for #163's offline queue. Costs storage, and
    reverses the v2.2300 choice.
  - **B. A gallery over Drive.** Photos stay in the customer's Drive folder; the app lists and
    shows them through the Workspace delegation it already uses. No new storage; needs the job's
    folder link and a signal.
- **The questions on each stage's checklist**, in the owner's words, and whether a stage may be
  ticked done with a question unanswered.

## The smallest useful version

1. **A checklist per stage kind**: a short list of questions for Rough In, Top Out and Trim Set,
   kept once for the company and edited by the office.
2. **Filled on the phone** from Job Mode and the job window: yes, no or not here, a note, and a
   photo where the question asks for one.
3. **The stage reads not ready** on the Pipeline until its checklist is filled.
4. **The job's photos as a gallery** on the job, by A or B.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The stages | `jobs_ledger_fixtures`, `list_job_stage_progress` | — |
| The questions and answers | — | tables such as `stage_checklist_templates` and `stage_checklist_answers`, the three fences |
| The rules | — | `lib/jobs/stageChecklist.ts`: the template for a stage, the answers, the ready rule; pure and tested |
| Filling it | Job Mode, the job window | the checklist on a stage |
| The not-ready mark | the Pipeline's stage cell | one more state |
| Photos | `photo-save`, `lib/photos/`, the Drive delegation | the gallery (B), or the bucket and table (A) |

## The plan

1. **The kernel**, and a look at what a report's photos field stores today.
2. **The tables** and the office's editor for each stage's questions.
3. **The checklist on the phone**: Job Mode and the job window.
4. **The Pipeline's not-ready mark.**
5. **The gallery**, by the owner's pick.

## How to verify

On a ZZ test job with three stages: fill Rough In's checklist on the phone preset and see its
stage read ready on the Pipeline while Top Out reads not ready. Open the gallery and see the job's
photos.

## Open questions

- A or B for photos.
- The questions for each stage, and who may edit them.
- Whether a test report counts as a stage's checklist where one exists.
