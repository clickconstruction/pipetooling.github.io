# 20261116100000_jobs_ledger_note_tags.sql (2026-11-15, v2.7385)

Tagging a teammate in a job note: the ground. Punch list #363, PR 2 of six. Taunya asked on 2026-11-15 to tag a teammate with `@name` in a job note and have it reach that person, with a count above Jobs, and settled the card's eight calls the same day. A job note is one row of `jobs_ledger_thread_notes` with no reader and no read mark, so a question in it reaches nobody. This migration makes the tag a row of its own and the functions that write and read it. No screen calls any of it yet.

## What it makes

One table, so the four fence calls close the file. Eight functions.

- **`jobs_ledger_note_tags`**: one row a person tagged in a note. `note_id` and `job_id` (both cascade), `tagged_user_id`, `tagged_name` (the name as it was written in the note, so a later rename does not orphan the chip), `tagger_user_id`, `created_at`, then how it ended: `cleared_at` with `cleared_how` (`answered` or `done`), `answer_note_id` (the answering note, set null if that note goes), and `asker_seen_at`. One tag per person per note. Nobody tags themselves.
- **Its read rule**: the two people read their own rows. Anyone else reads a tag when they can read its note, by a sub-select that runs under their own policies on the notes. There is no insert, update or delete policy and no such grant: the functions are the only writers.
- **`job_note_people(job, with_test)`**, internal: who may be tagged on a job. The office (dev, master technician, assistant, controller), and the job's master, its crew and anyone on its schedule this week or last when their role is helpers, superintendent or primary. Never a subcontractor, an estimator, an archived person, a digital twin or an account in training mode. Sample and walk-tester accounts only when `with_test`.
- **`job_note_caller_sees_test()`**, internal: true for a dev and for a sample or walk-tester account. A walk on a ZZ Test job is whole, and no real teammate is offered a test login.
- **`job_note_taggable(job)`**: the list under the note box, crew first, without the caller. It refuses a caller who is not on that same list.
- **`job_note_post_tagged(job, body, tagged[])`**: posts a typed note and its tags in one transaction and returns the note's id. It is `SECURITY INVOKER` on purpose: the note is inserted under the caller's own policies, exactly as the note box inserts it today. A refused tag posts nothing.
- **`job_note_tags_write(note, tagged[])`**: the definer half of the post. It writes the tag rows for a note its writer posted within the last two minutes, refuses a person the list does not offer by name, and marks the writer's own waiting tags on that job answered by this note. Ten tags a note at most.
- **`job_note_tags_mine()`**: the section in one read. `waiting` rows wait on the caller. `asked` rows are the caller's own tags that still wait, were answered and not yet seen, or cleared within seven days. Each row carries the note and the answer, so a tagged person reads that one note even after they lose the job.
- **`job_note_tags_count()`**: the number above Jobs. Tags that wait on the caller, plus cleared tags the caller asked and has not seen.
- **`job_note_tag_done(tag)`**: No reply needed. **`job_note_tags_seen()`**: the asker has had the answers on screen.

## Rules it settles

- **What clears a tag** (call 2): a typed note posted through `job_note_post_tagged`, or No reply needed. A plain insert into the notes table, which is how a stamp or a % line is written, clears nothing. Reading clears nothing.
- **The asker's count** (call 7): a cleared tag counts for the asker until `job_note_tags_seen()` runs. An answer is not a new tag.
- **Who may be tagged** (call 5): `job_note_people`. A person in training mode is left out because the training-mode trigger would refuse both their answer and their No reply needed press.
- **A person renamed after the note** (the card's *Left to settle*): the row keeps `tagged_name` as written.
- **A tagged person who loses the job** (the card's *Left to settle*): `job_note_tags_mine()` still hands them the note.

## Order and proof

Nothing in the client calls these names, so the push can follow the merge at leisure. PR 3 is the first caller, and it merges only after this is pushed.

Proved by CI's `job-note-tags` bed (`scripts/pgtest-job-note-tags.sh`, `supabase/tests/job_note_tags/`), on the whole schema with the migration applied twice: the office's list and a dev's; a sub, a helper on no job and a signed-out caller refused; a note posted with two tags; four people who cannot be tagged refused by name with no note posted; no tag row written or cleared by hand; a plain insert and a read clearing nothing; an answer and No reply needed clearing one each; the answer counting for the asker until seen; a question back; and a helper taken off the crew still reading the one note he was tagged in. CI was its first run: this Mac has no Docker running.

## Not changed

`jobs_ledger_thread_notes`, its policies and its plain insert. `helper_on_job`, whose two-week span `job_note_people` copies for the schedule.
