---
name: "Task cards: % done instead of a tick, Done when… lines, photos filed in a Tasks folder in Drive, and the Monday email of your people's week"
number: 273
group: close
status: card and mock-up 2026-11-06 on worktree-task-cards-progress · Taunya took the six picks as recommended the same day · the second look that evening revised the photo pick, gave a % its words and drew the office's Dashboard section as a question for her · on her "Build it all" the whole train was built the same day on one branch, PR 1 the ground (v2.6592, #7144, merged, its migration pushed), then v2.6595 the Done when… lines, v2.6597 the ring, v2.6598 the Roadmap's fractions, v2.6600 Your people on the Dashboard, v2.6601 the Tasks folder in Drive, v2.6602 the photos on a card, v2.6603 the Monday email of your people's week (its migration pushed and `people-week-email`, `photo-save` and `job-drive-folders` deployed right after their merges) and v2.6605 the docs · nothing left on the card
summary: >
  A task card is done or not done today: a tick on Checklist → Today, the Dashboard's My Inbox and
  the Roadmap's task card. Taunya wants the card to carry how far along it is, what done means, and
  the proof. The decided shape: the tick becomes a ring with a % (one-off and roadmap cards; a
  repeating card keeps the tick); whoever writes the card may list Done when… lines, each a tick,
  and a card with lines derives its % from them; a photo is offered at each new % and required at
  the finish, filed by the photo sweep into PipeTooling Tasks, a folder the app makes beside Jobs in
  its Shared Drive, one folder per card; and a Monday email a person subscribes to lists the people
  they picked and what each moved that week, the cards, the roadmap and the jobs. Two migrations,
  three function deploys, a train of six.
next: nothing on the card · Taunya's first week with the ring, the photos and the Monday email says what it missed
size: L as a train of six (M · M · M · M · L · S), built as nine PRs
blocker: none · shipped 2026-11-06
opinion: build PRs 1 to 3 in one sitting, since one migration carries all three and the card reads wrong with a percent column and no ring; the photos and the email each stand alone after that
mockup: to-dos/task-cards-progress/mockup.html
---

# Task cards: % done, Done when…, photos in Drive, the Monday people email (#273)

## The ask

Taunya, 2026-11-06, on the Roadmap and Checklist pages:

> Can you please take a look at the roadmap page with me and the checklist page. I would like to
> build a [spike] with you that will overhaul much of these two pages. by the end I want to
>
> 1) Have a see their to do cards on the dashboard and instead of marking complete, mark % complete
> 2) I would like for a staff member to be able to upload a photo to a card and have the photo saved
> in a new tooling@clickplumbing folder as well as collect from a user a photos of the task as the
> user marks it a new % complete as well as once once one of all of the success criteria are met
> 3) I would like for the user making a card to have the option to list success criteria on each
> todo card where each optional sucess criteria can be checked off
> 4) I would like to be able to generate weekly email reports that users can subscribe to showing
> each of the people they list and the progress they made on jobs and checklist items in one neat
> report

The same day, on the brief's six decisions: *"Yes, as picked."*

## The decision

The dashboard half of goal 1 was already true: the Dashboard's My Inbox card draws the same cards
as Checklist → Today, and the phone's Today draws them one-handed. What changes is the press on the
card, not where the card lives. All four goals land on one object, the card, plus one email. The
six picks, as the mock-up draws them:

1. **Which cards get the ring.** One-off cards and roadmap cards. A repeating card keeps the tick,
   since a 40%-done *Grease the skid steer* each Sunday means nothing.
2. **The photo: offered or required.** Offered at each new % on every card. Required at the
   finish only on a card that **asks for a photo**, a switch on the card its writer sets, on by
   itself once Done when… lines are written and off on a plain one-off; on such a card a *No photo,
   here is why* line frees the press, so a card is never stuck. *Revised on the second look*: the
   first pick required a photo or a reason on every finish, which would have asked an office card
   like *Check the AAA policy* to explain itself.
3. **The tooling@clickplumbing folder.** The app makes *PipeTooling Tasks* beside the Jobs folder in
   its Shared Drive, the way the Fleet folder is made on Documents → Where files go (v2.6564), and
   the same card takes a pasted folder link from any Drive the app's account can write in. One
   folder per card, `<date> · <title>`; a roadmap card's under `<roadmap> › <stage> › <task>`.
4. **% and Done when… lines.** A card with lines derives its % from the ticks (2 of 3 reads 67) and
   loses the chips; a card without lines keeps the hand chips 0 · 25 · 50 · 75 · 100. One number,
   never two. 100 takes the tick's path today: the completion notice, the Review queue, the next
   repeat.
5. **Who subscribes to whom.** The office roles (dev, master, assistant, controller) pick anyone;
   everyone else may subscribe to their own week only.
6. **The day.** Monday 6 AM Central, for the week just finished (Monday to Sunday).

**Not built, by design:** a % on a repeating card; a photo kept only in the app (Drive holds it,
the app keeps the row and the thumbnail until the sweep has filed it, as every other photo); the
email to anyone outside the company, or about people a non-office role cannot see; two numbers on
one card.

## Is this the best we can do?

Taunya asked it of the first mock-up the same evening. Five things changed (the mock-up's last
section and `before-after.html` carry them):

1. **Done stayed two taps, never three.** The first % sheet put 100 as a chip beside 25, 50 and 75,
   so finishing a plain card was ring, chip, Set. The sheet now carries one green **Done** under the
   chips, and 0 is gone (an untouched card is an empty ring with no digits; Reopen on the thread is
   the way back).
2. **The photo ask became the card's own switch** (pick 2 above), the stage checklists' own
   *Asks for a photo* pattern (v2.6077) rather than a rule for every card.
3. **A % got words.** *What is left?* on the sheet, one optional line kept as the `progress`
   event's body, so *75* reads *75 · "puddy and the glue, Thursday"* on the thread and in the email.
4. **The office's Dashboard got the people.** Goal 1 reads two ways: a person sees their own cards
   (already true), or the person who hands out cards sees their people's. Stop 3b draws the second:
   **Your people** under My Inbox for the office roles, one row per person with their newest-moved
   card and its ring, *moved today* / *stuck 32 days* (Review's own age rule, amber after a week and
   red after a month), 🔔 Remind, and **✉ Get this every Monday**. **Open for Taunya**: keep it or
   drop it.
5. **The email leads with what matters.** A count line up top (*3 cards done · 2 moved · 1 stuck*)
   and a **Stuck** group per person, so the Monday read starts with who needs a nudge, not with
   arithmetic.

Three things held from the first draft. The ring is the tick box's own 48px seat on the card, so
the sunlight pass of v2.1854 (border weight and type size carry the card, not tints) holds and
nothing on the card moves. The lines live on the item (or the roadmap task) and the ticks on the
instance, so a repeating card's lines are asked fresh each day and a one-off's ticks are its
history. And the photo rides the one hook every photo form already takes (`useReportPhotos`,
v2.6453), so a shot with no signal waits on the phone through the outbox as a job photo does
(v2.6370), with nothing new to build for the signal case.

`before-after.html` beside this card draws every stop as today's screen and the change, the
Before panels taken from the live pages.

## Where it plugs in (verified 2026-11-06 against main at v2.6576)

What exists:

- **The card.** `checklist_items` (title, who, when, repeat, reminders, `links`, the job chip,
  `roadmap_group_task_id`) with one `checklist_instances` row per scheduled day; done is
  `completed_at` / `completed_by_user_id`, sign-off is `reviewed_at`. The thread is
  `checklist_instance_events` (`event_type` CHECK `completed | reopened | comment | accepted`,
  migration `20260820010000`; a client inserts `comment` only, in its own name; a trigger writes
  `completed`). The one card component is
  [`ChecklistInstanceCard.tsx`](../../src/components/checklist/ChecklistInstanceCard.tsx)
  (`card` on the phone, `row` on the desk; `onToggleComplete`), mounted by Checklist → Today, the
  Dashboard's [`DashboardMyInboxCard.tsx`](../../src/components/dashboard/DashboardMyInboxCard.tsx)
  and Quickfill. The completion engine lives four times (the architecture map's risk flag):
  Today's `toggleComplete`, Review's `markComplete`, the kernel
  [`checklistCompleteInstance.ts`](../../src/lib/checklistCompleteInstance.ts) and the inbox card's
  own copy; every path ends in `createNextChecklistRepeat` and the `checklist-instance-completed`
  event. The 100% press goes through the kernel, and the ring PR is the moment to point the other
  three at it.
- **The roadmap.** `checklist_tech_tree_group_tasks` (`completed_at`, `pinned_at`,
  `estimated_days`, `sort_index`), stages as groups, edges as arrows; a stage is complete when every
  task has `completed_at` ([`checklistTechTreeGraph.ts`](../../src/lib/checklistTechTreeGraph.ts)
  `computeCompleteGroupIdsWithMilestones`); the goal's bar and the stage ledger read
  [`roadmapGoalsLedger.ts`](../../src/lib/roadmapGoalsLedger.ts) and
  [`GoalsStageStrip.tsx`](../../src/components/checklist/GoalsStageStrip.tsx); the task card's dock
  is [`ChecklistTechTreeTaskCardModal.tsx`](../../src/components/checklist/ChecklistTechTreeTaskCardModal.tsx)
  over [`useTechTreeTaskMutations.ts`](../../src/hooks/useTechTreeTaskMutations.ts)
  `toggleComplete`; the bridge chips read [`roadmapBridge.ts`](../../src/lib/roadmapBridge.ts).
- **The dialogs.** [`ChecklistAddModal.tsx`](../../src/components/ChecklistAddModal.tsx) (global,
  mounted in `Layout.tsx`, opened through `ChecklistAddModalContext`; People, When, Repeats,
  reminders, Links), [`ChecklistItemEditModal.tsx`](../../src/components/ChecklistItemEditModal.tsx),
  and the roadmap's [`ChecklistTechTreeAddTaskModal.tsx`](../../src/components/checklist/ChecklistTechTreeAddTaskModal.tsx).
- **Photos.** `report_photos` is the shape (`by_name`, `caption`, `bytes`, `width`, `height`,
  `taken_at`, `storage_path`, `drive_file_id`, `filed_at`, `fail_why`), its bucket keeps
  `<job_id>/<photo_id>.jpg` at 2 MB with policies that read the job from the path; the one hook is
  [`useReportPhotos.ts`](../../src/hooks/useReportPhotos.ts); the sweep is
  [`photo-save`](../../supabase/functions/photo-save/index.ts) (`sweepWaiting` for a bucket source
  named on its row, `sweepNamedPhotos` for job photos, `sweepMachinePhotos` for the Fleet; the cron
  calls only while a source waits, so a new source re-schedules it with every clause, the
  `20261030070000_photo_save_cron_all_sources.sql` pattern); the Drive name is `photoDriveName`
  (*2026-10-29 Luis Ortega · Rough In.jpg*).
- **Drive folders.** [`whereFilesGo.ts`](../../supabase/functions/_shared/whereFilesGo.ts) holds
  the `app_settings` keys (Jobs root, Company, People, `drive_fleet_root_folder_id`), mirrored by
  [`appSettingsKeys.ts`](../../src/lib/appSettingsKeys.ts);
  [`driveSettings.ts`](../../supabase/functions/_shared/driveSettings.ts) reads the seven;
  [`job-drive-folders`](../../supabase/functions/job-drive-folders/index.ts) `make: 'fleet'` finds
  or makes *PipeTooling Fleet* beside the Jobs root (refusing a My Drive root) and `set.fleet`
  takes a pasted link after `checkFolderWrite`;
  [`DocumentsWhereFilesGo.tsx`](../../src/components/documents/DocumentsWhereFilesGo.tsx) draws the
  Fleet card with **Make the Fleet folder**.
- **The email.** [`docs/REPORT_SUBSCRIPTIONS.md`](../../docs/REPORT_SUBSCRIPTIONS.md): the five
  pieces and *Adding a new stream*. The nearest streams:
  [`gc-money-monday-email`](../../supabase/functions/gc-money-monday-email/index.ts) (a weekly
  request row re-inserting itself +7 days; `preview` and `test_send` modes on the caller's JWT) and
  `crew_day` (a payload rebuilt per recipient). `get_my_email_schedule()` and
  `get_global_email_schedule()` list every stream;
  [`SettingsMyEmailScheduleSection.tsx`](../../src/components/settings/SettingsMyEmailScheduleSection.tsx)
  draws the rows and [`emailScheduleWeek.ts`](../../src/lib/emailSchedule/emailScheduleWeek.ts)
  types the stream union; [`teamEmails.ts`](../../src/lib/teamEmails.ts) is the inventory Settings →
  What the team sees renders; `_shared/resendSendEmail.ts` sends. The jobs half of a person's week:
  `clock_sessions` for the jobs they clocked on, the % done from field reports
  ([`propagateReportPctToJob.ts`](../../src/lib/propagateReportPctToJob.ts),
  [`jobPercentProvenance.ts`](../../src/lib/jobPercentProvenance.ts)) and the stages ticked
  (`list_job_stage_progress`).
- **Access.** A card is written by `is_dev_or_master_or_assistant()`, or by a subcontractor, helper
  or estimator in their own name (`can_define_task_style_checklist_items()`); an instance is read by
  its assignees, its creator and the office; the events' insert policy admits `comment` alone.
- **Offline.** `src/lib/offline/*`, the outbox; a job photo with no signal waits (v2.6370).

What is new:

- **Migration 1** (`SET lock_timeout = '3s'`; idempotent; the four fence calls):
  `checklist_instances.percent_complete smallint NOT NULL DEFAULT 0 CHECK (0..100)` and the same on
  `checklist_tech_tree_group_tasks`; `checklist_items.asks_for_photo boolean NOT NULL DEFAULT
  false` and the same on the roadmap task (the dialogs flip it on when a line is written); the
  events' CHECK widened to `progress` (its `body` the *what is left* words), `criterion` and
  `photo`, and the insert policy to admit those three in the actor's own name; `task_criteria`
  (`id`, `checklist_item_id` or `roadmap_task_id`, exactly one, `body`, `sort_index`, `created_by`,
  `retired_at`); `task_criteria_checks` (`criterion_id`, `instance_id`, `checked_at`, `checked_by`,
  `photo_id`); `task_photos` (`instance_id`, `criterion_id`, `percent_at`, `kind` `progress |
  finish | line`, then `report_photos`' columns) with the bucket `task-photos` (2 MB, images,
  `<instance_id>/<photo_id>.jpg`, policies reading the instance from the path under the card's own
  read gate); a trigger that mirrors an instance's % and 100 onto its roadmap task; the sweep's
  cron re-scheduled with the sixth clause; the key `drive_tasks_folder_id`. One `docs/migrations/`
  page.
- **Kernels** (pure, tested): `src/lib/taskProgress.ts` (which cards take the ring, the chips, %
  from ticks, the thread line's words, the photo-ask rule), `src/lib/taskCriteria.ts` (lines and
  ticks, the copy from a roadmap task to its card), `src/lib/taskPhotos.ts` (the Drive name and the
  folder's path), `src/lib/peopleWeek.ts` (the email's rows from the payload, the *nothing moved*
  words).
- **Migration 2**: `people_week_email_requests` (`recipient_user_id`, `people_user_ids uuid[]`,
  `send_at`, `repeat_weekly`, `sent_at`, `requested_by`; the office may name anyone, others only
  themselves, enforced in the INSERT policy), `get_people_week_payload(recipient, people, week)`
  (`SECURITY DEFINER`, EXECUTE revoked from clients), the two schedule RPCs extended.
- **Functions**: `photo-save` (the sixth source), `job-drive-folders` (`make: 'tasks'`,
  `set.tasks`), new `people-week-email` (cron lane picked from `cron.job`; `preview`, `test_send`,
  the drain).

## The plan

1. **PR 1 · the ground.** Migration 1, the kernels with their tests, the `database.ts` cast note.
   *Push right after the merge*: the card reads a column that only the migration makes, so
   `check:calls-ahead` labels it and the pusher is at hand. Release note, fragment, migration doc,
   ACCESS_CONTROL rows.
2. **PR 2 · Done when…** The three dialogs' section (＋ Add a line; the edit dialog retires a line
   rather than deleting it); the lines as ticks on `ChecklistInstanceCard` (card and row) with the
   stamp under each; the derived %; the `criterion` event on the thread; render tests. Guide *give
   someone a task* (a section) and *check off my daily tasks* (a section).
3. **PR 3 · the ring.** The ring in the tick's seat on `ChecklistInstanceCard` (empty with no
   digits until the card moves), the % sheet with the three chips, *What is left?* and one green
   **Done**, the `progress` event; the inbox card, Today and Review through
   `completeChecklistInstance` at 100; the roadmap task card's **Set the %** bar, the stage's
   fractional slots and the goal bar's fractions; the Pipeline-style `batchWords` untouched. Render
   tests. Guides *check off my daily tasks* and *staff and discuss a roadmap task*.
   **PR 3b · Your people on the Dashboard** (only if Taunya keeps stop 3b): a
   `DashboardYourPeopleSection` for the office roles under My Inbox over a kernel
   `src/lib/dashboardYourPeople.ts` (one row per person, the newest-moved card, Review's age rule
   from `checklistTeamBoard.ts` / `ageState`), **Open Review** and **✉ Get this every Monday**
   opening PR 5's sheet; a `DASHBOARD_SECTIONS_ARCHITECTURE.md` row and a dock chip.
4. **PR 4 · photos.** Where files go's **The Tasks folder** card and `job-drive-folders` `make:
   'tasks'`; `task_photos` through `useReportPhotos` on the % sheet (offered) and the finish sheet
   (required, with the reason line); `photo-save`'s sixth source filing into `<Tasks> › <card>`;
   the strip on the card and Review's sign-off row; the outbox for a shot with no signal. Deploy
   both functions after the merge. Guide *add a photo to a task card* (new). EDGE_FUNCTIONS
   sections.
5. **PR 5 · the Monday email.** Migration 2 (push right after the merge), `people-week-email`,
   the subscribe sheet on Checklist → Review (**✉ Email me their week**) and the row on Settings →
   My email schedule, the sample on What the team sees, the inventory row in
   REPORT_SUBSCRIPTIONS. Deploy the function after the push. Guide *get a Monday email of your
   people's week* (new).
6. **PR 6 · docs.** APP_DIRECTORY, PROJECT_DOCUMENTATION, GLOSSARY (ring, Done when…, the Tasks
   folder, people's week), this card deleted.

Branch each PR from `origin/main`; PRs 2 and 3 may stack on PR 1 while its push waits.

## How to verify

On the dev server, signed in as dev, at 1280, 768 and 375, on ZZ test cards only (every one deleted
before the session ends):

1. Send a one-off *ZZ Test · tools home* to yourself with three Done when… lines; *Asks for a
   photo at the finish* came on by itself. On Today the ring is empty and the lines are open. Tick
   two: the ring reads 67, the thread holds two `criterion` lines with the stamp. Tick the third:
   the finish sheet asks for the photo, the press reads *Photo first*; type a reason, the card is
   done, Review's sign-off row shows it.
2. Send a one-off with no lines; tap the ring, pick 50, type *what is left*, skip the photo: the
   thread reads *· 50% · "…"* and the Dashboard row reads 50. Tap the ring, press **Done**: no
   photo sheet (the switch is off), the completion notice, the Review row, the next repeat for a
   *days after done* card.
2b. If stop 3b is kept: as dev, the Dashboard's **Your people** section lists the ZZ assignee
   with the card's ring and *moved today*; a card 8 days old with no move reads amber, 31 days
   red, matching Review's chip.
3. A weekly ZZ repeat keeps the tick box.
4. On a ZZ roadmap, add a task with two lines; unlock its stage; the card on Today carries the
   lines; tick one; the stage's slot is half-filled and the goal bar's fraction moved.
5. Documents → Where files go → **Make the Tasks folder**; take a photo on the % sheet; within five
   minutes the sweep files it (`photo-save` answers `taskPhotos: { saved: 1 }`) under
   *PipeTooling Tasks › <date> · ZZ Test · tools home* and the card's strip shows it; delete the
   Drive files after.
6. Checklist → Review → **✉ Email me their week** for yourself: **Email me a test** lands within a
   minute with the ZZ cards' moves, the roadmap line and a job you clocked on; the row sits on
   Settings → My email schedule; Cancel clears it. What the team sees shows the sample.
7. At 375, every sheet is one thumb's reach and no card scrolls sideways.

Gotchas: the hidden browser pane reads as a phone until `resize_window` sets a size; the dev
server reads prod, so nothing with a new column runs live before PR 1's push; the sweep's cron
calls only while a source waits, so a quiet run answers nothing.

## Where it stands

2026-11-06: the brief, the six picks and this card with its mock-up. Nothing built.
