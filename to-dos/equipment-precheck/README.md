---
name: "Equipment pre-use check: check it off, slide the levels, take the photos, then run the machine"
number: 270
group: gated
status: written up 2026-11-05 from the owner's drill-checklist video; waits on his two trigger picks
summary: >
  Before a crew runs a machine (an excavator, a directional drill, a trencher), the phone walks them
  around it the way the owner's video does: a short list of Yes / No / Not here checks, one open at
  a time, then the levels as sliders (fuel, hydraulic oil, engine oil, coolant) and the hour meter
  typed off the dash, then four photos that file into the job's Drive folder, then one press that
  says the machine is safe to run. A No on a check that matters holds the machine and tells
  Dispatch. The sheet is the stage checklist sheet the crews already fill, with a levels row and a
  photo row; the machine is a card on the fleet board with hours for miles and a job as its holder;
  the photos go the way a job photo goes. Two doors: a line on the Job Mode card once the tech is
  here, and a label on the machine that opens the same sheet.
next: The owner's two picks (where it triggers for a job, where the machine lives), then PR 1 (the machine on the fleet board) can go alone
size: M as a train of seven (the machine on the board, the questions, the sheet, the photos, the hold, the label, ran unchecked); each PR S or M
blocker: Micah's two picks — (1) the trigger for a job, the Job Mode card's line after I'm here as recommended, or a stage question, Dispatch's hand-off, the label alone or the clock-in; (2) where the machine lives, a card on the fleet board as recommended, or an Equipment register beside Vehicles, or the Materials on site ledger. Nothing else: the sheet, the photo path, the Dispatch inbox and the fleet board are all there.
opinion: build PR 1 and PR 3 first (the machine on the board, the sheet from the Job Mode line); that is the video's check on the phone, and the hold, the photos and the label each go alone after.
mockup: to-dos/equipment-precheck/mockup.html
---

# Equipment pre-use check (#270)

## The ask

Micah, 2026-11-05, with a 52-second video of a crew's morning "Drill Checklist" on a directional
drill:

> when it comes to managing equipment, offer something like this where our users can check off,
> drag sliders to set levels in an intuitive way, and take photos that end up in a google drive
> folder of the equipment before using large machinery … I am not sure where and when to trigger it
> for jobs just like I'm not sure where to trigger it for the equipment we're running.

Two open questions, then: **where and when the check triggers for a job**, and **where it triggers
for the equipment itself**. Both are put to him below as options with a recommendation.

## What the video shows

Fifty-two seconds, portrait, first person, a worker in hi-vis on a residential street at dawn. The
title card reads *Drill Checklist* and stays up for the first twelve seconds. In order:

1. **The truck and the cones.** The flatbed with the drill on it, cones already out on the street.
   The worker opens the locator case on the truck bed (a walkover locator and its transmitter in
   foam) and checks the locator works. The first words are about traffic flying down the street,
   not the drill: the cones come before the machine.
2. **The walk to the drill.** *Let me do my drill checklist.* The machine is a tracked directional
   drill, the engine cover lifted.
3. **Hydraulics.** The sight glass on the hydraulic tank: *hydraulics a bit low, it might need to
   fill her up.* A judgement by eye against a line on a glass, not a number.
4. **Grease.** The grease points: *yes, I'll grease it today.* The worker taps the phone after
   saying it.
5. **The hour meter.** The dash readout: *let's see, 742 hours.* The worker types the number into
   the phone, the keyboard up.
6. **Engine oil.** The dipstick pulled and held up: *check the oil, yes, a little runny.*
7. **The air filter.** *The thing with the air filter is that it's all the way back in there.* The
   phone's camera light goes into the engine bay to see the indicator. *The only possible way to
   check it is …* a photo, in practice.
8. **The drill's own parts.** *Subs are checked, vise dies checked, just cleaned them, they're
   good.* The sub savers and the vise dies on the rod loader, items no truck checklist has.
9. **Close the cover.** The phone is put away; the last frames are the drill with its cover down.

**What is on the phone.** A form titled *Daily Checklist* with a company logo at the top and a list
of questions, each a label with a Yes / No answer under it: *Oil Checked*, *Engine Coolant
Checked*, *Air Filter Check*, and a typed *Hour Meter* box. The worker reads a question, does the
physical check, taps the answer, scrolls to the next. It is a plain form-builder page, not an app:
no stamp of who or when is visible, no photo tiles, nothing that reads the last check.

**What the video does not show.** No sliders: every level in the video is a yes/no tap, and the
only typed value is the hour meter. No photos are taken into the form; the camera light is used to
see, not to record. Nothing holds the machine on a No, and nothing tells anyone. The sliders, the
photos into Drive and the "before using" gate are Micah's asks on top of what the video does, and
they are the three things this card adds to the video's list.

**What the video gets right that the design keeps.** The order is the walk: around the outside,
then under the cover, then the machine's own parts. The hour meter is typed, not slid, because it is
a number off a dash. The questions are the machine's, not the company's: a drill asks about vise
dies and sub savers, an excavator about pins and track tension. And the worker talks to the phone
as a witness: *I'll grease it today* is a promise the form should keep as a note.

## What the app has today (verified 2026-11-05)

- **A machine's record.** There is none. People → Vehicles (`PeopleVehiclesTab.tsx`,
  `docs/PEOPLE_VEHICLES_TAB_ARCHITECTURE.md`) is a card per `vehicles` row (year, make, model,
  trim, VIN, costs, oil thresholds; no kind, no unit number, no hours). A vehicle's holder is the
  open `vehicle_possessions` row, a person or the motor pool (`user_id` null); nothing holds a
  vehicle to a job. The record already has: readings with their history and pace
  (`vehicle_odometer_entries`, `vehicleOdometerHistory.ts`, a backwards reading flagged amber),
  hand-offs, problems with three severities (`vehicle_problem_reports`), maintenance tasks bridged
  to the Checklist (`vehicle_maintenance_tasks`), a service log with intervals
  (`vehicle_service_events`), insurance periods, a replacement value and a ledger with filter
  pills. Every row counts toward the fleet truck rate (`fleet_truck_rate_per_field_hour`).
- **A check-in with questions.** `vehicle_checkins` (`vehicle_id`, `checkin_date`,
  `odometer_entry_id`, `answers jsonb` of `{q, flagged, comment}`, `created_by`) with the questions
  and cadence in the `app_settings` key `vehicle_checkin_settings_v1` (one default question, *Any
  lights on the dash?*). It is the office's check, done from Quickfill's Vehicle check-ins station
  by texting the holder; a flagged box files a *Monitor* problem by itself. Nothing asks the driver
  on the phone, and nothing asks for a level or a photo.
- **The stage checklist sheet.** `StageChecklistSheet.tsx` is the crew's sheet (punch list #237):
  one question open at a time marked *Next*, 44 px Yes / No / Not here presses that save by
  themselves, a stamp of name and time on each row, *Add a note*, *Take the photo* when
  `asks_photo`, *Send to Dispatch* under the open row, the groups *The company's questions* and
  *Added for this job*. Questions live in `stage_checklist_templates` (a CHECK holds `stage_kind` to
  the three stages; a job item carries `job_id` and `fixture_id`), answers one row per question in
  `stage_checklist_answers` with the photo columns, skips in `stage_checklist_skips`. There is no
  question kind: every question is a pick, and #237 keeps *asks for a number with a unit* as a later
  idea. A check sent to Dispatch is a `dispatch_requests` row with `pending_action = 'stage_check'`
  (`stageCheckDispatch.ts`, a pure kernel), pushed through `notify-dispatch-request`, one open row
  per check, and it closes itself when the check is answered, skipped or taken off
  (`stage_check_close_settled`). Since v2.6495 the inbox row opens the check's window with Reply,
  Reply and close, Lower priority and Not now.
- **A photo from the phone.** `useShotTileEngine` (`src/hooks/useShotTiles.ts`, v2.6453) is the one
  engine under the job photos window and the report forms: a hidden file input with
  `capture="environment"`, the shrink in a worker to the office's long edge, the camera's time read
  from EXIF before the shrink (`photoTakenAt.ts`), the bytes staged in a private bucket per source,
  the row upserted. With no signal the shrunk bytes wait in IndexedDB (`pipetooling-outbox`,
  `keptPhotos.ts`) and the press in the outbox (`job-photos` kind), replayed by `useOutboxReplay`.
  The `photo-save` sweep (pg_cron, every five minutes) files each source's rows into the job's
  Drive folder (`photoFolderOrWhy` → the customer's `job_pictures_link`, else Team only › Photos),
  writes `drive_file_id` and `filed_at`, deletes the bucket copy. **Every photo table requires a
  `job_id`**: `job_photo_notes`, `report_photos`, `job_box_photos` and the checklist answer. No
  photo table points at a vehicle, and no vehicle surface files anything into Drive. The
  `uploaded_photos` view unions the sources for Documents → Photos, the job photos window and the
  Development page.
- **The Job Mode card.** `DashboardJobModeCard.tsx` on `/dashboard`; the day press is picked by
  `pickJobModeDayPress` (`pressBar.ts`): *I'm here* while the leg is on the way, *On my way* for the
  next job, *Clock In* with no schedule, *Wrap Up Day* on the last. *I'm here* stamps
  `clock_sessions.arrived_at` (`jobModeOnMyWayIo.ts`); `legOf` reads *on-site* from it. There is no
  hook between the presses and no checklist slot; the card's details already draw the stage
  checklist strip (`JobStageChecklistStrip.tsx`) and the *Photos · N* line
  (`JobModePhotosLine.tsx`), so a line per machine sits naturally beside them.
- **Dispatch's assignment.** `job_schedule_blocks` puts a person on a job for a day; nothing puts a
  vehicle or a machine on a job or a day.
- **The morning clock-in.** The Clock In modal asks a job and a plan; the first clock-in of the day
  opens the daily goals gate (`DailyGoalsGateOverlay.tsx`), every line ticked before Continue. A
  precedent for a gate at the start of the day, and the wrong moment for a machine check.
- **The on-site box label.** `job_containers.code` (eight characters from the id) prints on the
  box's label as a QR to `prts.co/b/<code>`, which forwards to `/b/:code` (`BoxCode.tsx`) and on to
  the box on the tally. The phone's own camera scans it; the app has no scanner.
- **Training.** `training_courses` with `required_roles` and a yearly pass; no surface checks a
  pass before an action. The OSHA refresher's capstone is an excavator case, and its lesson 24 says
  *perform a pre-trip inspection*, which is the words a crew already knows this check by.

## The decision

The machine is a card on the fleet board, with hours for miles and a job as a holder. The check is
the stage checklist sheet with a levels row and a photo row, written on the vehicle check-in row.
The photos are job photos that also know their machine. The hold is a Dispatch request of a new
kind that closes itself. Two doors open the same sheet: the Job Mode card's line once the tech is
here, and a label on the machine.

### Micah's two calls

Each is drawn on the mock-up, the recommendation first and the other ways named with why not.

| Call | Recommended | Also possible |
|---|---|---|
| 1 · where and when it triggers for a job | **The Job Mode card, once the tech is here**: a line per machine on the job, amber *Not checked today · Check it ›*, green once anyone on the job has checked it, red while held. Asked, never forced; the day's presses stay. | A stage checklist question of the kind *equipment check* (a stage's questions are answered once per stage, a pre-use check is once per machine per day; the sheet is reused whole, and a stage may carry *Was the excavator checked today?* that reads the day's check) · Dispatch's hand-off of the machine to the job (the source of the line, not the moment of the check) · the label alone (kept as the second door) · before I'm here (the walk needs the machine, which is on site) · the morning clock-in (at the shop, and the day may not run the machine) |
| 2 · where it triggers for the equipment itself | **A card on the fleet board, and a label on the machine that opens its check**: the board already holds a holder, a reading with its history, problems, tasks, service, insurance and a ledger; a machine adds a kind, hours for miles and a job as a holder. | An Equipment register beside Vehicles (a second table with the same six things and a second place to look; a *Machines* group beside Active and Inactive is the fix if the board crowds) · the Materials on site ledger (a machine is not a part in a box; its label, its code route and its phone-first sheet are borrowed, its tables are not) |

### The parts

1. **The machine.** `vehicles.kind` (`truck` as every row is today, or `machine`),
   `vehicles.machine_kind` (excavator, directional drill, trencher, skid steer, compactor, trailer,
   other), `vehicles.unit_label` (E-12, D-3; the name the crew says), `vehicles.meter` (`miles` or
   `hours`; the reading's label and the service interval's unit follow it) and `vehicles.code` (the
   label's eight characters, minted as a box's is). `vehicle_possessions.job_id` beside `user_id`,
   one or the other or neither: a machine is handed to a job on the fleet board the way a truck is
   handed to a person, and the card reads *On JP1042 · Oak Hollow C since Mon*. A machine's rows
   stay out of the fleet truck rate by kind until the owner says otherwise (a trencher's wear is a
   job cost, the question the Fuel is a job cost card asks, not the trucks').
2. **The questions.** `machine_check_questions`: `machine_kind` or `vehicle_id` (the kind's list,
   or one machine's extra), `words`, `holds_machine` (a No on this one holds it), `asks_photo`,
   `sort_order`, `retired_at`, who wrote it. Written under Settings → Jobs & billing beside the stage
   checklists, the same card shape, by the same roles. The seed is the video's walk: tracks and
   undercarriage, hoses and cylinders, pins and teeth, lights, horn and alarm, seat belt and ROPS,
   fire extinguisher, grease points greased today, air filter indicator; the drill's extras are the
   rod box, the vise dies and sub savers, the strike alert and the stakes.
3. **The check.** `vehicle_checkins` grows `kind` (`office` as today, or `pre_use`), `job_id`,
   `by_name`, `started_at`, `signed_at`, `verdict` (`safe`, `held`, `unfinished`) and `levels
   jsonb` (`{fuel: 0–4, hydraulic: 0–2, engine_oil: 0–2, coolant: 0–2}`, each level's marks the
   gauge's own); `answers` keeps its shape with `pick` and `holds` beside `q` and `comment`; the
   hour reading is the `odometer_entry_id` it already carries. One row per machine per day per
   person who signs; the card's line reads the day's newest. A No on a holding question sets
   `verdict = 'held'`; a level below its line files a *Monitor* problem (hydraulic oil a *Needs
   service*) as a flagged office check-in does today; a No on any question files a problem with the
   note and the photo.
4. **The sheet.** `MachineCheckSheet.tsx`, the stage checklist sheet's shape (one open row marked
   *Next*, the three presses, the stamp, *Add a note*, *Send to Dispatch*) with two sections after
   the walk: **Levels**, four range inputs with the gauge's marks as ticks (E ¼ ½ ¾ F; Below · On
   the line · Full), yesterday's level as a faint tick and a word when low; and **Hour meter**, a
   number box with yesterday's reading under it and an amber line when the number went backwards
   (saved either way, flagged on the ledger as a backwards odometer reading is). Then **Photos**,
   then **Sign**: one line in the first person naming the machine, and the press *E-12 is safe to
   run* (green) or *Finish the walk, D-3 stays held* (amber). *Finish later, keep what I did* leaves
   the row `unfinished` and the card's line amber.
5. **The photos.** Four tiles the camera opens in turn (the hour meter, the front, one side, the
   back) and a fifth *Anything wrong*, through `useShotTileEngine` as the job photos window has
   them. Each shot is a `job_photo_notes` row with two new nullable columns, `vehicle_id` and
   `checkin_id`, so it is a job photo (the sweep files it into the job's Photos folder under
   *2026-11-05 E-12 pre-use · Mateo · hour meter*, no new folder rule) and the machine's record
   reads its photos by `vehicle_id`. The `uploaded_photos` view carries `vehicle_id`. A per-machine
   Drive folder is a second copy for later if the office asks; Settings → Where files go knows no
   fleet root today.
6. **Who signs.** Whoever runs it first: anyone `can_report_stage_progress` on the job, or the
   machine's holder when it is held by a person. The row carries the name as the checklist answer
   does. A second person on the job sees the first one's check on the line and may open it to read;
   a second check the same day is allowed (a second operator, a shift change) and the line reads the
   newest.
7. **A failed item.** A No on a holding question: the machine's line goes red on the card and on
   the fleet board (*Held · hydraulic leak · with Dispatch since 7:44*), one `dispatch_requests` row
   with `pending_action = 'machine_held'` and the payload `{vehicle_id, checkin_id, question,
   words, photo}` is sent by itself through `createDispatchRequest` and the existing push, and a
   *Needs service* problem is filed on the machine with the photo beside it. The inbox row wears a
   *Pre-use check* tag with *Open the machine*, *Open the job* and *Open the check*, the three
   presses a stage check's row has, and one more, **Run it anyway**, which lifts the hold in
   Dispatch's name and writes it on the ledger. The request closes itself when the problem is
   resolved on the machine's record or Run it anyway is pressed, the way a stage check closes on its
   answer. A No on a non-holding question files a problem and the machine still reads safe to run.
8. **A machine that ran unchecked.** At the day's end a machine whose hour reading moved, or whose
   job clocked hours, with no `pre_use` row that day is one line on the office's Needs you card and
   a row on the fleet board's Needs attention list, *E-12 ran unchecked on JP1042*, so the habit is
   seen without anyone being stopped at the machine. Read from the rows, nothing written.
9. **The second door.** The label: the machine's `unit_label`, a QR to `prts.co/m/<code>` and the
   words *check it before you run it*, printed from the machine's record with the box label's
   `printRootCss`. `/m/:code` (`MachineCode.tsx`) looks the machine up and opens the sheet, pointed
   at the job the phone is clocked into, else at the job Dispatch handed the machine to, else a
   job pick (the photos file on the job picked; a rental at the yard files on the company's yard
   job, as Materials on site's company stock does). A code with no row offers *Add this machine*
   with make and model, and Dispatch sees the new row on the board to keep or let go.

### Alternatives weighed

- **Reuse `stage_checklist_templates` and `stage_checklist_answers` with a fourth stage kind.**
  Rejected: an answer row is keyed by the stage line (`fixture_id`), a question by the stage, and the
  sheet counts toward *ready* on the Pipeline; a machine's check is per machine per day and must
  never hold a stage. The sheet component is reused; the tables are not.
- **A new `machine_checks` table instead of growing `vehicle_checkins`.** Rejected: the check-in
  row already has the vehicle, the day, the reading and the answers, and the ledger already draws
  it under the *Check-ins* pill; a `kind` keeps the office's check and the crew's apart.
- **Force the check before I'm here, or before the clock-in lands.** Rejected: the owner's rule on
  the Job Mode card is that the day's press is never held on the crew (the outbox lands it later);
  a forced gate at the machine gets a check filled from the truck. The line is asked, the ledger
  says who skipped it.
- **Sliders for the hour meter too.** Rejected: a number off a dash is typed, as the video does; a
  slider over four digits is a thumb's guess. Yesterday's reading under the box catches the slip.
- **A per-machine Drive folder as the home of the photos.** Deferred: every photo table and sweep
  is per job, the GC sees a day's machine photos beside the day's work, and a damage claim is a job
  question. The machine's record reads its photos by `vehicle_id` either way.
- **A camera API or an in-app scanner for the label.** Rejected: the box label works with the
  phone's own camera and a URL, and the sheet's photos work with the file input every other surface
  uses.

## Is this the best we can do? The second pass

- **The questions are the machine's.** The video's drill asks about vise dies; the office's check
  asks about dash lights. A list per `machine_kind` with one machine's extras is the smallest shape
  that keeps a drill's list from asking an excavator about rods.
- **The level that matters is the change.** A sight glass *a bit low* means nothing until it is
  lower than yesterday. The slider carries yesterday's tick, and the ledger row reads *fuel ¼,
  hydraulic oil below the line*, so the office sees a machine drinking oil before it stops.
- **The promise is a note.** *I'll grease it today* on the video is a thing the form should keep:
  a Yes on *grease points greased today* is the answer, and a No with the note *will grease at
  lunch* is the promise, stamped. Nothing new for that; the note is the stage checklist's.
- **Held is Dispatch's word, not the crew's.** The crew says No and why; the hold follows from the
  question's flag, set where the question is written. *Run it anyway* is Dispatch's press from the
  inbox, never on the crew's sheet, and the ledger keeps who said so.
- **Nothing stops the day.** Every press waits on the phone with no signal (the outbox, the kept
  photos) and the sign press lands later with the check marked *on its way*; a machine with no check
  still runs, and the office sees it at the day's end.

## Where it plugs in

**Exists, reused as is:** `StageChecklistSheet.tsx`'s shape and presses; `useShotTileEngine` and
the kept-photo outbox; the `photo-save` sweep and `photoFolderOrWhy` (a job photo files as today);
`vehicle_odometer_entries` and `vehicleOdometerHistory.ts` (hours as the reading);
`vehicle_problem_reports` and the ledger (`buildVehicleLedger`); `createDispatchRequest`,
`notify-dispatch-request` and `DispatchInboxSection.tsx`; `JobStageChecklistStrip.tsx`'s place on
the Job Mode card; `labels.ts`'s `printRootCss` and the `/b/:code` pattern; `StageChecklistSettingsCard.tsx`'s
shape for the questions.

**New:**

- Migration 1: `vehicles.kind`, `machine_kind`, `unit_label`, `meter`, `code`;
  `vehicle_possessions.job_id` with a CHECK (one of `user_id`, `job_id`, neither);
  `fleet_truck_rate_per_field_hour` reads `kind = 'truck'`.
- Migration 2: `machine_check_questions` (RLS as the stage templates: the office writes, anyone
  signed in reads), with the seed.
- Migration 3: `vehicle_checkins.kind`, `job_id`, `by_name`, `started_at`, `signed_at`, `verdict`,
  `levels`; RLS so the job's crew and the holder may insert a `pre_use` row;
  `job_photo_notes.vehicle_id`, `checkin_id`; the `uploaded_photos` view regenerated;
  `dispatch_requests.pending_action = 'machine_held'` and the self-close trigger on a problem's
  resolve.
- Kernels (pure, with tests): `src/lib/machines/machineCheckLine.ts` (the card's line state from the
  day's rows: unchecked, checked, held, unfinished), `machineCheckSheet.ts` (the walk's order, the
  next open row, the verdict from the answers and the flags), `machineLevels.ts` (the marks per
  level, the word when low, the change from yesterday), `machineHeldDispatch.ts` (the request row,
  the twin of `stageCheckDispatch.ts`), `ranUnchecked.ts` (the day-end read).
- Components: `MachineCheckSheet.tsx`, `JobModeMachinesLine.tsx`, `MachineCodePage` at `/m/:code`,
  the fleet card's kind chip and hours label, *Hand off* with a job as a holder, *Print the label*,
  the Settings card for the questions, the inbox row's tag and *Run it anyway*.
- Edge functions: none new. `photo-save` files the new rows as job photos unchanged;
  `notify-dispatch-request` pushes the new kind unchanged (its words come from the row's title).
- Docs: `docs/PEOPLE_VEHICLES_TAB_ARCHITECTURE.md` (a machine on the board), `docs/twins/APP_DIRECTORY.md`
  (`/m/:code`, the card's line), `docs/GLOSSARY.md` (pre-use check, held), `docs/ACCESS_CONTROL.md`
  (who signs, who lifts a hold), a migration page each. Guides: *check a machine before you run it*
  (Field Work), the fleet guide's new section *machines on the board*, the Dispatch guide's
  *answer a held machine*.

## The plan

Smallest shippable first; each PR a release note and a fragment.

1. **The machine on the fleet board** (S). Migration 1; the card's *Machine · excavator* chip, the
   reading labelled *h* when `meter = hours`, *Hand off* offering a job as the holder, the Needs
   attention counts leaving machines out of insurance and registration; the guide's section. No
   phone change. Ships alone and is useful alone: the office knows which machine is on which job.
2. **The questions** (S). Migration 2 and the Settings card beside Stage checklists, with the seed
   per kind and *for this machine only*; the *holds the machine* tick. Ships with nothing reading
   it yet.
3. **The sheet from the Job Mode line** (M). Migration 3's check-in columns and RLS; the kernels
   `machineCheckLine`, `machineCheckSheet`, `machineLevels`; `JobModeMachinesLine.tsx` under the
   stage checklist strip; `MachineCheckSheet.tsx` with the walk, the levels, the hour meter and the
   sign press, every write through the outbox; the problems filed from a No and a low level; the
   ledger row. The guide *check a machine before you run it*. This is the video on the phone.
4. **The photos** (S/M). `job_photo_notes.vehicle_id` and `checkin_id`, the four tiles and the
   fifth, the machine's record reading its photos, the view; the Drive name words. The guide's
   *Take the four photos* section.
5. **The hold** (S/M). `machine_held` on `dispatch_requests`, `machineHeldDispatch.ts`, the inbox
   row's tag, doors and *Run it anyway*, the self-close on resolve, the red line on the card and the
   board. The Dispatch guide's section.
6. **The label and the second door** (S). `vehicles.code`, *Print the label*, `/m/:code`, the job
   pick when the phone is not clocked in, *Add this machine* for a rental.
7. **Ran unchecked** (S). `ranUnchecked.ts`, the Needs you line and the Needs attention row.

## How to verify

- **Test rows.** A `ZZ Test` machine on the fleet board (`kind = machine`, `machine_kind =
  excavator`, `unit_label = ZZ-1`, `meter = hours`) handed to test job 972 (the yard job Materials
  on site already uses); the dev's own login as the crew with Job Mode on.
- **PR 1.** The card reads *Machine · excavator · On JP972 since today*; a reading of 1,000 saves
  and reads *1,000 h*; the fleet facts line and the truck rate do not move when the machine is
  added (compare `fleet_truck_rate_per_field_hour` before and after).
- **PR 3.** Clock in on 972 on the phone; the line reads *Not checked today · Check it ›*; the walk
  saves each press with the phone in airplane mode and lands when the signal returns (the outbox
  bar); the fuel slider at ¼ files a *Monitor* problem on the machine; the hour box with 900 after
  1,000 shows the amber line and saves flagged; the sign press turns the line green with the name
  and the time; a second login on the job sees the green line.
- **PR 4.** Four shots in airplane mode read *Kept on the phone*; with signal they reach the
  `job-photo-notes` bucket, and on the sweep's next run (five minutes) they are in the job's Drive
  Photos folder named *… ZZ-1 pre-use · hour meter*; the machine's record shows the four; Documents
  → Photos lists them under the job with the machine's words.
- **PR 5.** A No on a holding question with a photo: the line goes red, the Dispatch inbox has the
  row with its tag and three doors within a minute (the push lands on the dev's phone), *Reply*
  reads under the row on the phone, *Run it anyway* turns the line green with Dispatch's name on
  the ledger, and resolving the problem on the record closes the request by itself.
- **PR 6.** Print the label, scan it with the phone's camera signed in: the sheet opens pointed at
  972; signed out, the page asks for a sign-in and comes back to the sheet; a made-up code offers
  *Add this machine*.
- **Gotchas.** `photo-save`'s cron WHERE has one clause per source; a new column on
  `job_photo_notes` needs no change there, but a new source table would. The `uploaded_photos` view
  is `security_invoker`; regenerate `src/types/database.ts` after migration 3. A machine held by a
  job has no person, so the pay-stub read of a holder's insurance must skip `job_id` rows (PR 1's
  test). Delete the ZZ rows after; the Drive photos are in the yard job's folder and can stay.
