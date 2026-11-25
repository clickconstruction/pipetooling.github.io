---
name: "Tag a teammate in a job note, with a count above Jobs"
number: 363
group: close
status: asked 2026-11-15 by Taunya, who settled its eight calls that day and asked for the whole train · built 2026-11-15 and 16 in six PRs (v2.7384, v2.7385, v2.7400, v2.7407, v2.7410, v2.7412) and one fix (v2.7426) · the job window's Note sheet on a phone tags too since v2.8223, found without tags on the owner's phone walk of 2026-11-21 · both migrations pushed and proved · `notify-note-tag` deployed on her go · live on prod · the sender's side walked on prod on a ZZ Test job, from the Pipeline row and from the job window · the tagged person's side not walked · the tagged person's side walked live 2026-11-24 as a helper at 380 px: it holds inside the Inbox tab, a helper is told nowhere else, and the small presses of Tagged notes are raised in v2.8556 · one more note on the ZZ test job, to measure the raised answer box at a phone's width, was given a yes on 2026-11-25 (UTC) in the managing session, asked again at the time · that note posted and the raised presses measured on the live site the same day, as the sample helper at 380 px: the answer box, **@**, **Post** and **No reply needed** each stand 44 px, and **No reply needed** cleared the tag
summary: >
  Taunya asked to type @name in a job note on a Pipeline row and have it reach that person, on
  their to-do list, in Messages or in a new Tagged Job Notes section in Jobs, with a red count above
  Jobs like the one above Messages. Today a job note reaches nobody: it is one row in a table with
  no reader but the job's own list, and nothing in the app handles a mention. The plan is a name
  picked from a list under the note box, a tag kept as its own row, a Tagged job notes section at
  the top of the Pipeline counted above Jobs, one line on the Dashboard's Needs you card for the
  roles with no Pipeline, an answer box that posts back on the job, and a push.
next: >
  Decide where a helper in Job Mode is told of a tag outside the Inbox tab, and build it. Then walk what the walk of 2026-11-24 left: a person who cannot open the job, the superintendent's side, and the keyboard. Taunya's own look at the tag that waits on her still stands.
size: L as a train of six (S · M · M · M · S · M)
blocker: >
  A call on where a helper is told. The card said the Dashboard line is there for a helper, and in Job Mode it is not.
opinion: build, it is the cheapest way to make a job note reach a person, and the notes are already where the team writes about a job
---

# Tag a teammate in a job note (#363)

## Where it stands (2026-11-16)

**Live.** Everything the card planned is on prod.

| PR | Version | What |
|---|---|---|
| #8268 | v2.7384 | the kernel, `src/lib/jobs/noteTags.ts` |
| #8269 | v2.7385 | `jobs_ledger_note_tags` and its functions, pushed 2026-11-15 |
| #8302 | v2.7400, v2.7407 | the list of names on the Pipeline note boxes, the count above Jobs, the section, the Needs you line, the guide |
| #8303 | v2.7410, v2.7412 | `notify-note-tag`, and tagging from the job window, with the second migration, pushed 2026-11-16 |
| #8313 | v2.7426 | the chip shows the moment a note is posted |
| the phone-walk PR of 2026-11-21 | v2.8223 | the job window's Note sheet on a phone tags as the Activity box does, its row of names in the sheet's flow |

**Walked on prod**, as the dev login, on *ZZ Test Walk Project 2026-11-08*:

- From the Pipeline row: the list on `@` with the crew first, narrowing as letters are typed, the pick by Enter, **Will tag** above the box, the post, the section's You asked line, and the chip with *waiting on Sample*.
- From the job window: the **@** button, the list above the box, the pick and the post. Prod's rows show that tag landed through `land_field_press`.
- The list opens above the row's strip and is not clipped.

**Found on the walk**: the chip did not draw until the page was read again. Fixed in v2.7426.

**Not walked**: the tagged person's screen (the red count, the cards, an answer, No reply needed, the question back), the floating window's box, the tagged side at a phone width, and a notice arriving on a phone. The owner walked the job window at a phone width on 2026-11-21 and found the bar's Note sheet with no row of names, which v2.8223 gave it. The render tests and the `job-note-tags` SQL bed cover the rules; no person has seen those screens with a tag on them.

**Cleaned up**: the walk's two notes on that ZZ job, each tagging the Sample superintendent account, were deleted on 2026-11-16 by one SQL delete on their ids, and their tags went with them. `jobs_ledger_thread_notes` has no delete policy, so the app cannot remove a note.

**Left on prod, on purpose**: one note on that ZZ job tagging Taunya, *ZZ Test: this is the tagging walk for you*, posted at her ask so she sees a tag land on her own screen. Her answer or **No reply needed** clears the tag. The note itself stays on the hidden test job.

**Seen as built**: the ZZ Walk tester account is in training mode, so the list does not offer it. A dev is offered the sample accounts.

## The ask

Taunya, 2026-11-15, with a screenshot of one Pipeline row whose note box held a sentence ending in
`@taunya`:

> I would like to be able to tag "@personName" in cards and have that show up on their to-do list or
> Messages or a new section in jobs called "Tagged Job Notes" where in Jobs there is a red icon with
> the number of unread above jobs just like there is above messages in the header so a user know what
> they need to respond to

"Cards" are the job rows on Jobs → Pipeline, and the tag is typed in the row's note box. The ask has
three parts: a tag typed as `@name`, a place the tagged person finds it, and a red count above
**Jobs** in the header.

[mockup.html](mockup.html) draws all three on made-up data, at desktop and phone width. Its note
box works: type `@ch` and pick a name. Its section works too: answer a tag or press **No reply
needed** and both red numbers drop.

### Her first look, 2026-11-15

Taunya on the first drawing: "this is so great, but 'open the job >' seems redundant to the 'Cedar
Bluff Lofts' in the top left, maybe we can remove open the job >", and "I like that is in Needs you
and not Checklist and not Messages". She then asked whether it was the best we could do. What
changed:

- **Open the job › is gone.** The job's name on the card is the door to the job.
- **Call 1 is settled** as drawn: the section in Jobs and the Needs you line.
- **Call 7 changed.** The asker now learns of an answer by a count, not by a push alone. Asked
  whether an answer should count above Jobs for the asker until they see it, she said "Yes, count
  it" the same day.
- **A question back is one tap.** The answer box carries the @ button, the asker first in its list.
- **The crew's path is drawn**: the Needs you line opens the same list as a window.
- **Smaller:** the oldest tag is on top, the section folds and shows three, and the press reads
  **No reply needed**, the words Messages already uses for the same act.

Looked at and left out: a fold on each card showing the notes before the tagged one (the job's name
is one press to them), one-press answers such as Yes and No, and one summed number on the phone's
menu button (the Messages number is the office's and is rarely zero, so the sum would never clear).

## The view, in short

**Worth building.** The job's notes are where the team already writes about a job, and today a
note reaches nobody. A question sits in the list until its reader happens to open that row.

**Land it in Jobs, with one line on the Dashboard.** Of her three places, the new **Tagged job
notes** section with its own count above Jobs is the right home. The Dashboard's Needs you card
gets one line that opens the same list, because the field has no Pipeline. Messages and the
checklist are the wrong homes, for the reasons under *Call 1*.

**A tag is a pick, not a typed word.** The name comes from a list under the box and is kept as its
own row. The team already types `@` to mean "at".

**The count is what still waits on an answer.** An answer on the job or a **No reply needed**
press clears it. Opening does not. For the person who asked, an answer counts until they have seen
it.

## What exists today

### The note

- A job note is one row of `jobs_ledger_thread_notes`: `id`, `job_id`, `author_user_id`, `body`,
  `created_at`. Nothing else. No reader, no recipient, no read mark.
- A typed note is a plain insert from `submitJobThreadNoteWithBody` in
  `src/hooks/useJobThreadNotes.ts` (and its twin in `useJobThreadNotesForModal.ts`). The Arrived
  and Leaving stamps and the % complete lines ride the same insert with a built body.
- **Two note boxes** write to it. `src/components/jobs/JobActivityView.tsx` is the one-line box on
  the Pipeline row, in the floating window and full screen; it already receives the job's
  `teamMembers`. `src/components/JobThreadNotesPanel.tsx` is the taller box in the job window, Job
  Detail, Job Mode and Quickfill.
- The row's preview and count come from the RPC `jobs_ledger_thread_note_stats`.
- Edge functions and the dev seat also write notes (`send-test-report`, `auto-send-test-reports`,
  `legal-portal`, `dev-mcp`'s `apply_activity_note`). None of them tags anyone, and none changes.
- **Who can read and write a job's notes** (the two policies in
  `supabase/migrations/20261014220000_helper_on_job_thread_notes.sql`, plus the superintendent's in
  `20260902165836`): the office team, the job's master, a helper or sub on the job's crew or its
  schedule this week or last, and a superintendent on a job they can touch. An estimator is outside
  the `jobs_ledger` read policy and cannot open a job at all (`docs/ACCESS_CONTROL.md`).

### Anything like a mention

Nothing. A search of `src/` for mention handling finds none on notes, messages, tasks or reports.
The nearest thing is `bid_mark_requests`: one person marks a bid for a teammate with a note and a
push (`notify-bid-mark`), written only through definer functions and read only by the two people.
It is the pattern to copy.

### The count above Messages

- `src/components/MessagesBadge.tsx`: a pill at the link's top right, `#b91c1c` under white words,
  `99+` past 99, nothing at zero or on a failed read. `Layout.tsx`'s `renderNavLinks` draws the
  link for the desktop bar and for the phone's menu. On a phone the count shows only inside the
  open menu.
- The number is `follow_up_count()`: **one number for the whole office**, the customers and
  contacts waiting on us. It is not per person.
- Nothing clears on opening a thread. An answer, a logged call, *No reply needed* or Done clears a
  contact. So the Messages count already means "still owed an answer", not "unread".
- It reads again live through `useMessagesLive` over one realtime channel and the bus in
  `src/lib/messages/liveReread.ts`.
- No other header link carries a count. The only per-person read mark in the app is
  `user_bid_notes_read_state`, behind the Bid Board's unread bid notes.

### A person's to-do list

- **The Dashboard's Needs you card** (`DashboardNeedsYouCard.tsx` over `buildNeedsYouItems` in
  `src/lib/dashboardNeedsYou.ts`): a closed list of about 75 kinds of row, most of them counts for
  the office. One is a per-person notice open to every role, `while-off`. A new
  kind needs a key, a rank, an actor, a source with its role gate, an input and a door, each in a
  file the typecheck holds.
- **The checklist and tasks** (`checklist_items`, the New task window `ChecklistAddModal`): an
  item has a due day, a repeat, assignees and a tick. It has no job column; a job rides as a link.
  Assigning one sends nothing at the time. The assignee hears at the reminder hour.
- There is no bell and no notices list. `notification_history` logs each push.

### Pushes a teammate already gets

About a dozen functions push a teammate (a Dispatch request, a bid mark, a lien approval, a report,
a customer's reply and more). Each goes through `supabase/functions/_shared/pushHoursSend.ts`,
which holds a push outside the person's own hours (`user_push_hours`) and logs it.

### The size of the need, counted on prod 2026-11-15

Reads only, through the dev seat.

| What | Count |
|---|---|
| Job notes in the week to Nov 15 | 93, by 3 people |
| Of those, Arrived and Leaving stamps | 14 |
| Of those, written by the dev login, most of them lines the app or the dev seat wrote | 30 |
| Job notes in the two weeks before | 139, by 5 people |
| Three weeks together | 232, about 77 a week, 5 writers: the office, a master, a superintendent, the dev login and one sub |
| Notes of the last week that name a teammate in plain words | at least 6 |
| Notes since June 1 with an `@` after a space | 3, each meaning "at" (a time or a price) |
| Notes before today that tag a person with `@` | none |
| Logins | 78: about 20 working people, 19 subs not archived, about 13 sample, twin and test accounts, the rest archived |

What the numbers say. The notes are a log more than a conversation: about fifty typed lines a week,
most of them a status in a few words. So the tags will be few, perhaps a handful a week at first.
The value is not the volume. It is that the one question in fifty no longer waits on luck. Two
logins differ by one letter in the last name, one on the crew and one a sub, so a typed first name
cannot be trusted to find the right person.

## The calls, with a pick for each

All eight are settled by Taunya, 2026-11-15. Calls 1 and 7 are in her own words, under their
headings. Asked whether calls 2 to 6 and 8 stand as the mock-up draws them, she said "Yes, they
stand". Each pick below is the one to build.

### Call 1 · Where the tag lands

**Settled by Taunya, 2026-11-15: a Tagged job notes section at the top of the Pipeline, counted
above Jobs, and one line on the Dashboard's Needs you card.**

- **A new section in Jobs** is the right home. The answer belongs on the job's notes, and Jobs is
  where those notes are. A per-person count above Jobs is new, but the pill is `MessagesBadge`'s.
  The section draws only while something waits on you or on someone you tagged, so an idle
  Pipeline looks as it does today.
- **The section must not bury the Pipeline.** The oldest tag is on top. It shows three, with a
  **Show the rest** press, and **Fold** shuts it to its one line. A card has no link but the
  job's name.
- **The Dashboard line is the second door, not a second list.** A superintendent's Jobs page hides
  the Pipeline, and helpers have no Jobs link. Both open the app on the Dashboard. The Needs you
  card already carries two per-person notices for every role, so a third fits. Its press opens the
  same section as a window, and the push opens that window too.
- **Not Messages.** Its count is one number for the whole office and means customers waiting on
  us. A tag is one teammate waiting on another. Mixing them weakens both numbers. Field roles
  cannot open Messages (`canOpenMessages` is the office team), so a superintendent could never be
  tagged there.
- **Not a checklist task.** A task has a due day, a tick and its own history. A tag as a task is a
  second copy of the note that must be ticked as well as answered. A person who wants a dated task
  out of a tag can still make one by hand.
- One thing on a phone is new: the count would ride on the menu button too. Today the Messages
  count is seen only with the menu open. That is for a person with a Jobs link. The crew's menu
  has no Jobs, so their button carries no number.

### Call 2 · What marks a tag read

**Pick: an answer or a No reply needed press. Opening does not.**

Her words are "so a user know what they need to respond to", so the count is what is still owed.
The Messages count already works this way. An answer is a note the tagged person types on that
job, from the section's box or from the row. A stamp or a % line does not count. **No reply
needed** clears a tag that only needed reading, and the asker sees who pressed it. The words are
the ones Messages uses for the same act.

The other way is to clear on opening, like unread mail. It is simpler, and it loses the tag read
in passing on a phone.

### Call 3 · A tag nobody answers

**Pick: it stays and shows its age, amber after two working days, on both people's screens. No
reminder and no expiry in the first version.**

The sender's note carries *waiting on Dana · 3d*, and the sender's **You asked** fold lists it. A
second push or an expiry can follow once there are real tags to judge by.

### Call 4 · How a name is picked

**Pick: a list under the box, opened by `@` or by an @ button, the job's crew first. Only a picked
name is a tag.**

- Two people can share a first name, and two logins already differ by one letter. The list shows
  the full name and what the person does.
- The team types `@` to mean "at". A tag read from the words would misfire on those notes.
- A pick can be checked against who may open the job before the note is posted.
- On a phone the list opens above the box so the keyboard does not cover it, each name a row 40 px
  tall. The @ button saves finding the key.
- The picked name stays in the words as `@Full Name` and shows above the box until the post, with
  an × to take it off. The tag itself is a row, never parsed back out of the body.

### Call 5 · Who may be tagged

**Pick: anyone with a login who can open that job's notes. The office and the job's crew. Not
subs, not archived people, not sample, twin or test accounts.**

- The list offers only people the notes' own policy lets in, so nobody is tagged on a job they
  cannot see. An estimator cannot open a job today and so is not offered.
- A helper's access to a job ends two weeks after their last day on it. A tag made while they had
  it should still show them that one note. PR 2 settles how (see *Left to settle*).
- Subs see their jobs through their own pages and have no Dashboard like the crew's. Tagging a sub
  needs its own design and waits.

### Call 6 · Whether a tag sends a push

**Pick: yes, one push per tag, held outside the person's push hours like every other. No email.**

The crew does not watch the header. The push reads *Marcus tagged you on Cedar Bluff Lofts* with
the note's first words, and opens the list. A person with no device hears nothing until they open
the app; an email for them can follow.

### Call 7 · Telling the asker

**Settled by Taunya, 2026-11-15 ("Yes, count it"): the answer counts above Jobs for the asker until they have
seen it, then clears by itself. A push too, and a You asked fold under the section.**

- The first pick was a push and the fold, with no count. It leans on pushes being switched on.
  Most of the office works at a desk, and the dev seat cannot read who has a device registered
  (`push_subscriptions` is closed to it), so that reach is unknown.
- One rule each: a question clears when you answer it, an answer clears when you see it. Seen
  means the You asked line has been on the asker's screen. Nothing to press.
- An answer is not a new tag. The asker owes nothing, and the two do not end up clearing each
  other, which is what tagging the asker back by rule would do.
- A question back is a tag like any other. The answer box carries the @ button, and the person
  who asked is first in its list.

### Call 8 · The other places notes are written

**Pick: the Pipeline row's box first, then the taller box the job window, Job Detail, Job Mode and
Quickfill share. Reports, estimate notes and bid notes later.**

The two boxes are two components, so the second is its own small PR. Reports are a form, not a
line of text, and estimates and bids keep their own threads.

## Left out of the first version

- Tagging a sub.
- Email for a person with no device.
- A reminder or an expiry for a tag nobody answers.
- Tags in reports, estimate notes and bid notes.
- Tagging a group, such as the whole office.
- Editing or adding a tag after the note is posted.
- A tag from the dev seat's `apply_activity_note`.

## Where it plugs in

Exists and changes:

| File | Change |
|---|---|
| `src/components/jobs/JobActivityView.tsx` | the list under the one-line box, the @ button, the chips above the box, the chip and the waiting line on a posted note |
| `src/components/JobThreadNotesPanel.tsx` | the same on the taller box (PR 6) |
| `src/hooks/useJobThreadNotes.ts`, `useJobThreadNotesForModal.ts` | a typed note with tags posts through the new RPC; stamps and % lines keep the plain insert |
| `src/components/Layout.tsx` | the Jobs link carries the count, in the bar and in the phone's menu, and the menu button on a phone |
| `src/components/jobs/JobsStagesTab.tsx` | mounts the section above the stages |
| `src/lib/dashboardNeedsYou.ts`, `needsYouActor.ts`, `needsYouSources.ts`, `needsYouDoors.ts`, `src/hooks/useNeedsYouInputs.ts` | the `tagged-notes` row, open to every role |

New:

| Piece | What |
|---|---|
| `jobs_ledger_note_tags` | one row a tag: the note, the job, who is tagged, who tagged, when, when and how it cleared (`answered` with the answering note, or `done`), and when the asker saw that. Cascades with its note. Written only through definer functions, as `bid_mark_requests` is |
| `job_note_post_tagged` | posts a typed note and its tags in one transaction, refuses a person who cannot read the job's notes, and clears the writer's own waiting tags on that job as answered |
| `job_note_tags_mine`, `job_note_tags_count`, `job_note_tag_done`, `job_note_tags_seen` | the section's two lists, the header's number (tags that wait on you and answers you have not seen), the No reply needed press, and the mark that the asker saw an answer |
| `job_note_taggable` | who may be tagged on a job. As built, it does not replay the notes' read policy for a named person. It lists the office and the job's master, crew and this week's or last week's dispatch (helpers, superintendent, primary), over the internal `job_note_people` |
| `job_note_tags_write`, `job_note_caller_sees_test` | two more than planned: the definer half of the post, so the note itself is still inserted under the writer's own policies, and the rule that offers sample and walk-tester logins only to a dev or to another such login |
| `src/lib/jobs/noteTags.ts` | the kernel: the `@` being typed at the caret, the ranked list, which picked names are still in the words, the age words |
| `NoteTagPicker.tsx`, `JobsTagsBadge.tsx`, `TaggedJobNotesSection.tsx` | the list, the pill, the section |
| `notify-note-tag` | the push to the tagged person and to the asker on the answer, through `_shared/pushHoursSend.ts` |
| `src/content/help/tag-a-teammate-in-a-job-note.md` | the guide |

Neighbours on 2026-11-15: #8192 (the Lien desk's Board on the Needs you card) edits the Needs you
files, so PR 4 here is cut after it merges. #8200 touches the stage bar's CSS only. No open PR
edits either note box.

## The plan

Six PRs, smallest first. Each cut from fresh `main`, each with its release note and fragment.

1. **The kernel** (S). `src/lib/jobs/noteTags.ts` with its tests. No screen, no migration. Needs
   call 4 only. **Built: v2.7384.**
2. **The ground** (M). One migration: the table with the four fence calls, the six functions,
   `SET lock_timeout`. `docs/migrations/`, the types PR after the push. No screen. Needs calls 2
   and 5. **Built: v2.7385**, with eight functions and the `job-note-tags` SQL bed. Pushed to
   prod on 2026-11-15 and proved by a read: the table empty with its fences, each function with
   its grants.
3. **The list on the Pipeline row** (M). The picker in `JobActivityView`, the chip and the waiting
   line. The guide starts here. A tag made now is seen by the tagged person on that row only, so
   this PR and the next should land close together. **Built: v2.7400**, in the row's own box
   (`JobsStagesActivityBox`, the one in her screenshot) and in `JobActivityView`. The list is open
   to a dev alone (`canTagInJobNotes`) until PR 4, so no tag is made that lands nowhere. The guide
   moved to PR 4 for the same reason.
4. **Where it lands** (M). The count above Jobs, the section with its answer box and No reply
   needed, the You asked fold with its seen mark, the Needs you line and the window it opens.
   Needs calls 1, 3 and 7. **Built: v2.7407**, with the guide and the list opened to the seven
   roles the list holds. The count, the section and the Needs you line follow one read per tab. `PROJECT_DOCUMENTATION.md`,
   `GLOSSARY.md` and `ACCESS_CONTROL.md` take their lines here.
5. **The push** (S). `notify-note-tag`, deployed after the merge, its section in
   `docs/EDGE_FUNCTIONS.md`. Needs call 6. **Built: v2.7410.** Three pushes: to the tagged, to the
   asker on an answer, and to the asker on No reply needed.
6. **The second box** (M, was S). `JobThreadNotesPanel`, which covers the job window, Job Detail, Job Mode
   and Quickfill. Needs call 8. Found in PR 3: this box posts through the outbox
   (`pressThroughOutbox`, kind `job-note`), so a note typed with no signal is kept. That path never
   reaches `job_note_post_tagged`. The server side of the press needs a migration to write tags and
   to answer the writer's waiting tags. **Built: v2.7412.** `land_field_press` writes the tags of a
   typed note, and `job_note_tags_write` takes a transaction-local marker in place of its
   two-minute rule, since a kept note lands with the time it was pressed.

## Left to settle while building

- **A tagged person who loses the job.** Settled in PR 2: `job_note_tags_mine` hands them the note
  they were tagged in whatever they can read of the job. PR 4 draws the job's name as plain words
  and not as a link when the job is closed to them.
- **Who else sees a tag.** Settled in PR 2: anyone who can read the note reads its tag rows, so
  the row says who it waits on.
- **A person renamed after the note.** Settled in PR 2: the tag row keeps `tagged_name`, the name
  as it was written, and the chip is drawn from that.
- **An account in training mode.** Settled in PR 2: it is not offered, since it could neither
  answer nor press No reply needed. PR 4 calls `job_note_tags_seen` only when an unseen answer is
  on screen, because the training-mode trigger refuses even a write that changes no row.
- **Live re-read.** Settled in PR 4: no realtime channel. One read per tab, again when a tag
  changes in the tab, on focus and every 90 seconds while the tab is on screen.
- **An answer from the row.** A typed note on the job clears the writer's own waiting tags there,
  wherever it is typed. A status sweep such as *on going* would clear a tag too. That is accepted
  for the first version, and the asker still reads the answer.

## How to verify

Two logins and one test job, nothing live:

1. On a `ZZ Test` job, as the dev, type `@` in the row's box, pick the walk tester and post.
2. As the walk tester (`node scripts/dev-pane-login.mjs`), see 1 above Jobs, the section, and the
   Needs you line. Open the row: the count holds.
3. Answer from the section: the note is on the job, the count is gone, the dev's You asked reads
   *answered*.
4. Tag again, press **No reply needed**: the count is gone and the dev's side names who pressed it.
5. View as a superintendent and a helper: the Dashboard line is there and opens the list.
6. Try to tag a person who cannot open the job: the name is not offered.
7. At 375 wide: the list sits above the keyboard, the menu button carries the count.
8. Delete every `ZZ Test` note and tag made.

## The tagged side, walked live (2026-11-24)

Walked on clicktooling.com on the ZZ Test Walk Project job, as the dev and, through **View as**, as the sample helper at 380 px.

**Holds.** The dev tags the helper from the job window, and the note reads *waiting on* with the name. As the helper, the Inbox tab reads *Needs you 1* with one job note tagged, and **Open**. Tagged notes fills the screen. An answer posts and the line clears. A second tag clears with **No reply needed**, and the dev's note says so.

**Not walked.** A person who cannot open the job, the superintendent's side, and the keyboard.

**A fault found, read in the code the same day: a helper is told only inside the Inbox tab.**

- This card says *the Dashboard line is there* for a helper. That was wrong when it was written. A helper opens the app in Job Mode, and Job Mode's own Dashboard draws no *Needs you* card (`Dashboard.tsx`, the Job Mode branch).
- The door that stands in for it shows only on a phone with the new phone layout turned on (`needsYouJobModeDoor`).
- The menu button's count leaves helpers out on purpose (`Layout.tsx`). The Job Mode bottom bar's Inbox tab can carry a count and is handed none (`DispatchModeFooter`, `inboxBadgeCount`).
- So a tagged helper sees nothing until they open Inbox.

**What would mend it,** not built, and the pick is open. My pick is the first: the Inbox tab of Job Mode's bottom bar carries the count of tags that wait. It is the client alone, size S, and the bar already takes a count. The other way is a line on Job Mode's own Dashboard.

**Mended: the small presses.** At 380 px the answer box was 22 px high, **@** 20, **Post** 26 and **No reply needed** 30. v2.8556 stands each a thumb tall on a phone, in the window, on the Pipeline and on the Checklist.

**The measure of that mend has a yes of 2026-11-25 (UTC), given in the managing session.** Asked *May the walker post one note on the ZZ test job tagged to the sample helper, to re-measure the answer box at phone width? A posted note cannot be deleted.*, the answer was "Yes, one note", quoted from that session's record of the user's answers. It is history: the note is a row on prod that nothing deletes, so the yes is asked again at the time. It would be a fourth note left on that job. Not posted.

**A posted note cannot be deleted,** so the walk's last step, deleting its notes, could not be done. Three notes are left on that ZZ job. It is on the list of presses nothing takes back (#443).
