---
name: "Tag a teammate in a task note"
number: 375
group: ready
status: asked 2026-11-16 · looked at and drawn the same day · the owner settled call 0 and liked the picks for the rest · building since 2026-11-17 · PR A, the easier box (v2.7566), PR 1, the ground (v2.7570, pushed 2026-11-17) PR 2, the @ in a task's note box (v2.7574) PR 3, where a tag lands (v2.7576, open to the team) and PR 4, the notice (v2.7577), shipped · PR 5 built, not merged
summary: >
  Tagging a teammate went live on job notes as #363. The owner asked for the same in task notes, and for
  the box to be easier on a phone. A task note tells nobody today: no notice, no count, no Dashboard line.
  This card puts the same @ list in a task's note box, offering only people who can already open the task.
  A tag lands on the Checklist, as a count above Checklist and a Tagged task notes section on Today, and in
  the one Needs you line that both kinds share. It sends the same phone notice. The box gets easier for job
  and task notes alike: the names show as big presses above the keyboard while you type, the tag is marked
  in your words, and one Backspace takes it off. A tag is still only a tap or Enter, never a typed name.
next: Deploy `notify-note-tag`, if it is not out yet. Merge PR 5. Then the walk as two people on a phone.
size: L as a train of six (M · M · M · M · S · S), PR A and PR 1 to PR 4 done
blocker: None. The notice needs `supabase functions deploy notify-note-tag` after PR 4's merge.
opinion: build — a task note reaches nobody today, and #363 already proved the rules on jobs; one new table, the rest reused
ver: v2.7566 · 7570 · 7574 · 7576 · 7577 · builds on #363 (v2.7384 · v2.7385 · v2.7407 · v2.7410 · v2.7412)
---

# Tag a teammate in a task note (#375)

Beside **Tag a teammate in a job note** (#363, `to-dos/tagged-job-notes/README.md`), whose rules this reuses,
and **Task Mode: the refresh and the doer's tools** (#369, `to-dos/task-mode-refresh/README.md`), which was
being built when this was written and redraws the screens this card touches.

The mock-up is [mockup.html](mockup.html). Its section **Try the box** holds a working note box, and its
script is the reference for how PR A behaves. The same page was shown to the owner as
*Tag a teammate in a task note* — https://claude.ai/artifact/YCmWfmVeVZ8H5Es6QVRkT4.

## The ask, in the owner's words

2026-11-16:

> can you please take a look at task notes. right now there are features for a user to be able to tag
> someone in a job or bids activity and I would like to extend that tagging to tasks. can you take a look at
> the app holistically and how it works and help me come up with a solution for this?

After the first mock-up:

> I like this but I would like it to be more fluid where if I was to type " @[personname]" and have it tag
> someone in line. would this be possible? could we also make it reactive where when someone starts typing
> it shows people and the user can click on one easily on mobile

Asked whether a name typed after @ should tag by itself when exactly one person fits, he answered **Tap or
Enter only**. Then: "i like your picks, add this to the punchlist to build", and "I don't want to build it,
I want it added to the punchlist".

## What the look found

### Tagging on a job today (#363)

- It is on **job notes only**: the Pipeline row's box (`JobsStagesActivityBox`), the floating window and
  full screen (`JobActivityView`), the taller box of the job window, Job Mode and Quickfill
  (`JobThreadNotesPanel`, which posts through the outbox), and the answer box of the Tagged job notes
  section. **Bid and estimate notes have no tagging.** `JobThreadNotesPanel` draws the @ only when it is
  handed `tagJobId` and `onSubmitTagged`, and the estimate mounts pass neither. The owner's ask names bids,
  so call 4 below says when they come.
- A tag is a name picked from the list at the box (`useNoteTagBox`, `src/components/jobs/NoteTagBox.tsx`;
  the rules in `src/lib/jobs/noteTags.ts`). It is kept as a row of `jobs_ledger_note_tags`, written only by
  `job_note_post_tagged` and `job_note_tags_write`, and by `land_field_press` for a note the phone kept.
- Who can be tagged is `job_note_people`: the office (dev, master technician, assistant, controller), and
  the job's crew when their role is helpers, superintendent or primary. Never a sub, an estimator, an
  archived person, a digital twin or an account in training mode.
- The tagged person gets a push from `notify-note-tag`, held outside their Push me hours, a red count above
  Jobs (`JobsTagsBadge`), the Tagged job notes section on the Pipeline (`TaggedJobNotesSection`), and the
  Needs you line `tagged-notes`, which opens the same section as a window (`TaggedJobNotesWindow`). One read,
  `useMyNoteTags` over `job_note_tags_mine`, feeds all four.
- A tag clears on any typed note its person posts on that job, or on **No reply needed**. Reading clears
  nothing. The asker's answer counts above Jobs until it has been on their screen.
- Walked from the sender's side on 2026-11-15 and 16. The tagged person's screens have not been walked.

### Task notes today

- A note is a `checklist_instance_events` row with `event_type = 'comment'`, inserted straight from the
  client. No note goes through the outbox.
- **It tells nobody.** No edge function reads the table, no trigger fires on its insert, and the two readers
  that look at a task's events leave notes out (`useDashboardYourPeople`, the people week email).
- One composer, `ChecklistItemActivity.postComment`, serves Today and Still open, so Task Mode too. It also
  serves Review → Outstanding by person, Manage, People → Vehicles tasks, and the My Inbox cards on the
  Dashboard, Job Mode, Dispatch Mode and Quickfill. Three more boxes write a note:
  - History (`ChecklistHistoryLedger`): a free note, and the required reason of **Reopen**.
  - The Roadmap task card (`useTechTreeTaskMutations.postInstanceComment`), with its one-tap *On it* and
    *Problem*.
  - Review's sign-off queue (`ChecklistReviewInboxSection`): the required comment of **Reopen with comment**.
- The card's own `<input>` thread (`postCardComment` in `Checklist.tsx` and `DashboardMyInboxCard.tsx`) looks
  unreachable, since every mount of `ChecklistInstanceCard` passes `fullHistory`. Read from the props, not
  seen in the app.
- Who can open a task: its assignees, the person who gave it (`created_by_user_id`), and
  `is_dev_or_master_or_assistant()`, which is dev, master technician, assistant, controller and primary.
  The person named only in `notify_on_complete_user_id` cannot open it unless they are one of those.
- A task has no job column. A job rides in the title and `links[0]` (`checklistJobPreset.ts`, drawn as a
  chip by `checklistJobChip.ts`), or inside a Bridge to-do's `source_tag`. So a job's crew cannot be offered
  on a task by rule.
- Forward on the Checklist page copies the task and deletes the first day row, so the day row's notes go
  with it. #369's step C7 (#8459, open when this was written) turns both of the page's Forward windows into
  `task_hand_on`, which swaps who the task is for and keeps it whole. My Inbox's own Forward still copies and
  deletes.

### The size of the need

Read on prod through the dev seat on 2026-11-16, counts only. 10 task notes had been typed since late
August, and 1 of them in the last 30 days. In those 30 days, 21 tasks were ticked done. 151 tasks had ever
been made, 143 of them one-offs. 106 tell someone when they are done, and 130 belong to one person. One job
note tag stood on prod, the walk's own.

People tick tasks and almost never write on them. A note that reaches nobody gives no reason to write one,
so the tag is less an add-on here than what makes a task note worth typing.

## The decision

### The owner's calls, 2026-11-16

0. **A tag is a tap or Enter, never a typed word.** Asked whether a name typed after @ should tag by itself
   when exactly one person fits, he answered *Tap or Enter only*. #363's rule stands, on jobs and on tasks,
   so `@will call` can never tag someone named Will.

He liked the picks for the rest:

1. **Who can be tagged on a task: only people who can already open it.** The task's own people come first:
   whoever gave it, and whoever has it on the day row and on the task. Then the office as #363 counts it:
   dev, master technician, assistant, controller. A primary, a helper or a superintendent is offered when
   they gave the task or have it. Never a sub, an estimator, an archived person, a digital twin or an
   account in training mode. The writer must be on the same list to tag. **A tag never opens a task to
   someone new.**
2. **Where it lands: the Checklist.** A count above Checklist and a **Tagged task notes** section at the top
   of Today, both for task tags. The Needs you line that exists for job tags counts both kinds, and its
   window lists both, oldest first. In Task Mode the Checklist section holds job tags too, since no other
   page is open there.
3. **A plain note with no tag still tells nobody.** The task's own people are the first names offered, one
   tap away.
4. **Bid and estimate notes come after tasks**, as their own small train.
5. **The notice shows the note's first words**, as on a job.

### The hard cases, each with its pick

| Case | Pick |
|---|---|
| Tagging someone who cannot open the task | The list does not offer them. To bring a teammate in, give them the task. |
| A private or HR-flavoured task | A tag never widens who can read. The office can open every task today, tagged or not. |
| A task that repeats | The tag stays with the task, not the day. The note stays on its day. A note on any day of the same task answers it. |
| A task already done, or waiting on review | Tagging still works and nothing reopens. A sign-off clears no tag. |
| Ticking the task while a tag waits on you | The tick clears nothing. **✓ Post & complete** with words typed does, since a note was typed. |
| Review's **Reopen with comment** | Left as it is, with no @. Its comment is a typed note, so it answers a tag that waited on the reviewer. |
| #369's thread lines: moved, stuck, unstuck, dropped, handed, map, skipped | They answer nothing, even when they carry words. Only a `comment` answers. One word in the rule changes it if the owner later wants *Can't do it* to answer. |
| A task handed on, or forwarded | Its tags go with it. After #369's C7, the Checklist page's Forward keeps the task whole. My Inbox's older Forward deletes the day row and its notes. Until it moves to `task_hand_on`, its window says a question is open before it goes. |
| The person told when the task is done | Offered only when they can open the task. That gap is older than tags and is not this card's to fix. |
| A task the person has muted | The tag's notice still goes. Mute quiets the task's reminders, sent by `send-checklist-notification`. A tag goes through `notify-note-tag`. |
| A tagged person who is away | Offered. The notice is held to their Push me hours. The asker sees amber after two working days. |
| A person who has left | Not offered. An old tag on them reads *has left* under You asked, on jobs too. Today such a tag waits forever. |
| Training mode and digital twins | Not offered, and they cannot tag. They could neither answer nor press No reply needed. |
| One person tagged on a job note and a task note about the same thing | Two tags, side by side in one list. Each clears on its own answer. |
| A sub or an estimator | Not offered, as on a job. Tagging a sub needs its own design. |

## The easier box (PR A, job and task notes alike)

What changes in `useNoteTagBox`:

- **The names are presses.** They show as a row of presses above the box, at least 44 px high, with the
  person's role under the name. The row sits clear of a phone's keyboard, and a tap keeps the keyboard up
  (`pointerdown` with `preventDefault`, as the list's `onMouseDown` does today).
- **The row narrows as you type.** It follows each letter after @, and it stays up through a space while the
  words still start a name, so `@chris b` still offers Chris Bell and Chris Bellamy. Today
  `tagQueryAtCaret` closes the list at the first space. The new rule needs the names, so it is a second
  function in `noteTags.ts` beside the first, with tests.
- **A tap or Enter tags** (call 0). It writes `@Full Name ` where the @ was. Tab picks too, the arrows move,
  and Escape shuts the row. A name only typed stays plain words, and the row keeps offering while the caret
  is in it.
- **Some names are offered before a letter is typed.** On a task, its own people, three at most. In an
  answer box, the person who asked. A job's own box offers nobody until @ is typed or the @ button is
  pressed, since a crew can be ten names.
- **The tag is marked in the words** while you write, by a layer under a see-through box that tints each live
  `@Full Name`. The task box and the job window's box are textareas. The Pipeline row's box, the floating
  window's and the answer box are single-line inputs, where the layer must follow the input's `scrollLeft`.
- **One Backspace** right after a tag takes the whole `@Full Name` off, as the × on the *Will tag* line does.
  The line stays.
- The job guide, `tag-a-teammate-in-a-job-note.md`, changes with it.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The rules | `src/lib/jobs/noteTags.ts` and its tests | the query that runs through a space; a group *On this task* |
| The box | `useNoteTagBox`, which reads `job_note_taggable` for a job id | the presses, the mark, Backspace; told a task day row in place of a job, it reads `task_note_taggable` |
| A task's note box | `ChecklistItemActivity`, whose `postComment` inserts straight | a typed note with tags posts through `task_note_post_tagged`; a posted note draws `TaggedNoteBody` |
| The other task boxes | `ChecklistHistoryLedger`; `ChecklistTechTreeTaskCardModal` through `useTechTreeTaskMutations` | the @ in PR 5. Both answer a tag from PR 1, by the rule in the database |
| The tag rows | `jobs_ledger_note_tags` and the `job_note_*` functions, untouched | `task_note_tags` and the `task_note_*` functions |
| What answers a tag | `job_note_tags_write`, on a typed job note | a trigger on `checklist_instance_events`: a `comment` answers its writer's waiting tags on that task |
| One read | `useMyNoteTags` over `job_note_tags_mine` | `note_tags_mine()` and `note_tags_count()`, both kinds with a `kind` column |
| Where it lands | `JobsTagsBadge` on Jobs, `TaggedJobNotesSection`, `TaggedJobNotesWindow`, Needs you `tagged-notes` | a count on the Checklist link (`Layout.tsx`), a Tagged task notes section on Today, the window and the line holding both |
| Review's board | a person's rows with their 💬 counts (`Checklist.tsx`, the Review tab) | *waiting on Dana* beside the count |
| The notice | `notify-note-tag` (`index.ts`, `words.ts`) | `{ task_event_id }` and `{ task_tag_id }`; the words name the task; the door is `/checklist` |
| The guides | `tag-a-teammate-in-a-job-note.md` | `tag-a-teammate-in-a-task-note.md`, linking to it |

### Where it meets #369

#369 redraws Today (`src/lib/tasks/todayPage.ts`) and the card (`ChecklistInstanceCard`'s look `fresh`). It
adds seven kinds of thread line, and it turns Forward into `task_hand_on`. Its card says its first step
leaves room for this card's two pieces: a button in the note box (`ChecklistItemActivity`) and a block above
Today's list. This card does not redraw the task card.

Build PR 2 and PR 3 on the code #369 leaves, not on this card's picture of it. Read Today and the card again
first. Grep for every insert of `event_type: 'comment'`, since #369's finish sheet and its follow-up may add
a box that writes a note.

## The database (PR 1)

One migration. It starts with `SET lock_timeout = '3s';`, takes its number from `origin/main`'s newest file
at build time, and ends with the four fence calls, since it makes a table.

- **`task_note_tags`**: one row for each person tagged in a task note. `event_id` is the note
  (`checklist_instance_events`, cascade), `instance_id` its day row (cascade) and `item_id` the task
  (cascade). Then `tagged_user_id`, `tagged_name`, `tagger_user_id`, `created_at`, `cleared_at`,
  `cleared_how` (`answered` or `done`), `answer_event_id` (set null) and `asker_seen_at`. The checks are the
  job table's: nobody tags themselves, a cleared tag says how, one tag per person per note. The indexes are
  the job table's, keyed on `item_id`.
- **Its read rule**: the two people read their own rows, and anyone else reads a tag when they can read its
  note, by a sub-select on `checklist_instance_events` under their own policies. No write policy and no
  write grant: the functions are the only writers.
- **`task_note_people(item, with_test)`**, internal: who may be tagged. It reads the task's giver, its
  assignees and its day row's assignees, which are the two lists `task_hand_on` swaps, whatever their role
  but sub or estimator. Then the office. It leaves out archived people, twins, training mode, nameless rows,
  and sample and walk-tester accounts unless `with_test`.
- **`task_note_taggable(instance)`**: the list at the box, the task's people first, without the caller. It
  refuses a caller who is not on the list.
- **`task_note_post_tagged(instance, body, tagged[])`**: `SECURITY INVOKER`, so the note goes in under the
  caller's own policies, as the box inserts it today. It sets the marker of
  `20261116190000_job_note_tags_from_the_job_window.sql` and calls the definer half.
- **`task_note_tags_write(event, tagged[])`**: the definer half. Ten tags at most. A person the list does
  not offer is refused by name, and nothing is posted.
- **The rule that a typed note answers**: an `AFTER INSERT` trigger on `checklist_instance_events`, for
  `event_type = 'comment'` alone. It marks the writer's waiting tags on that task, on any day row, as
  answered by the note. A trigger fits here where it did not on jobs, because a task's thread tells a typed
  note from a stamp by its kind. So History, the Roadmap card, Review's Reopen and My Inbox answer a tag
  from the first day, with no client change. Like `log_checklist_instance_transitions`, it never makes the
  insert fail.
- **`task_note_tags_mine()`, `task_note_tags_count()`, `task_note_tag_done(tag)` and
  `task_note_tags_seen()`**: the job functions' twins. Seen stays one function for each kind, since each
  section shows its own kind and the window calls both.
- **`note_tags_mine()` and `note_tags_count()`**: both kinds in one read, with a `kind` column, the job rows
  from `job_note_tags_mine()` unchanged. They carry `tagged_left`, true when the tagged person is archived,
  for the *has left* words.
- **The SQL bed**: `task-note-tags`, in the shape of `job-note-tags` (`scripts/pgtest-job-note-tags.sh`,
  `supabase/tests/job_note_tags/`, a line in `scripts/sql-beds.txt`, `npm run test:pg:task-note-tags`).

## The plan

One small PR per line, each with its release note, fragment and the docs `CLAUDE.md` names: the migration
doc for PR 1, the `docs/EDGE_FUNCTIONS.md` section for PR 4, and `GLOSSARY.md`, `PROJECT_DOCUMENTATION.md`
and `ACCESS_CONTROL.md` for the new section and count in PR 3.

| PR | What lands | Database | Size |
|---|---|---|---|
| A | The easier box: the presses, the row that runs through a space, the mark in the words, one Backspace, the names offered before a letter, the job guide's words. Job notes get it the day it merges. It can go first. | none | M |
| 1 | The ground, alone: `task_note_tags`, its functions, the trigger, the one read for both kinds, the SQL bed. No screen calls it. Pushed right after the merge, then the types PR. | migration | M |
| 2 | The @ in `ChecklistItemActivity`: the list from `task_note_taggable`, the post through `task_note_post_tagged`, the chip and *waiting on* on a posted note. It reaches Today, Task Mode, Review, Manage, vehicle tasks and My Inbox at once. Held to a dev, as #363's PR 3 was, until PR 3 lands. | uses 1 | M |
| 3 | Where it lands: the count above Checklist, Tagged task notes on Today, the Needs you line and window over `note_tags_mine()`, job tags in the Checklist section in Task Mode, *waiting on* on Review's rows, *has left*, and the guide. The list opens to the team here. | uses 1 | M |
| 4 | The notice: `notify-note-tag` learns task notes. Deployed right after the merge. | none | S |
| 5 | History's box and the Roadmap task card's box get the @. My Inbox's older Forward says a question is open, unless it has moved to `task_hand_on` by then. | uses 1 | S |

Then a walk as two people, on a phone, which covers #363's unwalked screens on the tagged side too.

## Left to settle while building

- **A task title's job token.** A title sent from a job reads `{{1:1466 · Cedar Bluff Lofts}} — <task>`
  (`checklistJobPreset.ts`, drawn by `checklistJobChip.ts`). The push and the section must show it as plain
  words. `notify-note-tag` cannot import `src/lib`, so `words.ts` needs its own small reader, with a test.
- **Has left on the note's own line.** The combined read carries `tagged_left` for the sections. The grey
  line under a note reads the tag table straight (`useJobNoteTags`), and that carries no archived mark.
  Whether the line can say *has left* depends on whether the reader may read the person's archived state.
- **Who has the task now.** `task_hand_on` swaps the day row's assignee and, for some tasks, the task's own.
  `task_note_people` reads both lists. Confirm against `task_hand_on` as it landed.
- **A reason from *Can't do it*** answers no tag (the pick above). Revisit only if the owner asks.

## Left out of the first version

- Bid and estimate notes (call 4).
- Tagging a sub or an estimator, and a tag written by one.
- Tagging a group, such as the whole office.
- Adding a tag after the note is posted, or editing one.
- A reminder for a tag nobody answers. Amber after two working days is all, as on a job.
- The person told when the task is done who cannot open it. That is a separate fix.
- An email for a person with no phone notices.

## How to verify

- **The box, after PR A**, on a phone. On a job note, type `@` and a few letters. The row of names narrows.
  Type `@chris b` and both people named Chris stay offered. Tap one: the keyboard stays up and the name is
  marked in the words. Press Backspace right after it: the whole name goes. Type `@dana` and post with no
  tap: no tag.
- **Tags on a task, after PR 3**, on a ZZ test task a dev gives to a sample account. Tag the account in a
  note: the task's people come first in the row, then the office. The note shows the chip and *waiting on*.
- **The tagged side.** As the sample account (`view_as` reads the count and the section, and a phone walk
  needs that account signed in): the count above Checklist, Today's section, the Needs you line, the notice
  after PR 4. Answer from the section: the tag clears, the asker is told, You asked shows *answered*, and the
  asker's count clears once seen. Try **No reply needed**, the next day of a repeating task, a done task, and
  Task Mode with a job tag waiting.
- **Clean up** by deleting the ZZ test task. Its day rows, notes and tags go with it.
- CI runs the SQL bed, `npm run test:pg:task-note-tags`.

## Where it stands

- **PR A, the easier box, shipped as v2.7566** (2026-11-17), client only. Job notes have it. Checked in
  headless Chromium at phone and desk width. Not yet walked in Safari on an iPhone or on an Android keyboard.
  Two things it settled past the mock-up: letters that are nobody's name show no row, where the old list said
  nobody by that name can be tagged, and a pick whose name is changed in the words is dropped, so typing it
  back makes no tag.
- **PR 1, the ground, shipped as v2.7570** (2026-11-17): `20261117160000_task_note_tags.sql` and the
  `task-note-tags` SQL bed. Pushed to prod the same morning, right after its merge. Two things it settled past
  this card. `task_note_people` reads the day row, not the task, so a person who gave away one day of a
  repeating task is not offered on that day. The read of both kinds names its column `source`, since the job
  read already uses `kind`. Its doc is `docs/migrations/20261117160000_task_note_tags.md`.
- **PR 2, the @ in a task's note box, shipped as v2.7574** (2026-11-17), held to a dev until PR 3. The
  task's own people are offered above the box, a tagged note posts in one call, and a posted note shows its
  chip and who it waits on. A caller the task's list refuses gets a plain box.
- **PR 3, where a tag lands, shipped as v2.7576** (2026-11-17), and the @ is open to the seven roles a job's
  is. The count on Checklist, Tagged task notes at the top of Today, both kinds in Task Mode and in the Needs
  you window, *waiting on* on Review's rows, *has left* under You asked, and the guide
  `tag-a-teammate-in-a-task-note`. A task tag's title in the Dashboard's window opens
  `/checklist?tab=today&task=<day row>`, a pick this card had left open. No phone notice yet.
- **PR 4, the notice, shipped as v2.7577** (2026-11-17): `notify-note-tag` takes a task note and a task tag,
  with its own reader of a task title's job token, held to the app's by a test. The tap lands on the
  Checklist for every role. It needs its function deployed after the merge.
- PR 5: built and tested on a branch, going up after PR 4 merges.

The design and the working box are in [mockup.html](mockup.html).
