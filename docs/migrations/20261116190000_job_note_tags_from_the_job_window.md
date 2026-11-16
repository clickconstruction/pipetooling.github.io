# 20261116190000_job_note_tags_from_the_job_window.sql (2026-11-15, v2.7412)

Tagged job notes from the job window. Punch list #363, PR 6 of six. The job window, Job Mode and Quickfill post a note through the outbox (`land_field_press`, kind `job_note`), so a note typed on a phone with no signal is kept and sent later. That path never reached `job_note_post_tagged`, so a note typed there made no tag and answered none. This migration lets it.

## What it changes

No table, so no fence call is owed. Three functions restated, each from its newest definition.

- **`job_note_tags_write`**, from 20261116100000: the two-minute rule becomes a marker. The function that has just inserted the note sets `pt.note_just_posted` to its id, local to the transaction, and the tags are written only for that note. The rule it replaces compared the note's time with now, and a note the phone kept for an hour lands with its pressed time. No client can set the marker: each request is its own transaction, and `set_config` is not exposed through the API. The refusal's words are the same.
- **`job_note_post_tagged`**, from 20261116100000: sets the marker before it asks for the tags. Nothing else changed.
- **`land_field_press`**, from 20261030040000: its `job_note` branch sets the marker and calls `job_note_tags_write` when the payload says `typed: true`, with the ids in `tagged`. A press with no `typed` key, which is every press an older client queued, a stamp and a % line, writes and answers nothing. A person who cannot be tagged refuses the whole press, so no note lands without the tag it was written with. The clock kinds, the report and the record of the landing are the same text. Prod's body compared equal to the repo's on 2026-11-15 before it was restated.

## Order and proof

Push before the client that sends `typed` and `tagged` deploys. The old body ignores both keys, so a client ahead of this push posts the note with no tag, which is what it does today. Nothing breaks either way.

Proved by CI's `job-note-tags` bed, which now re-applies both migrations and adds the job window's cases: a note pressed three hours ago lands with its tag; a press that tags a sub is refused and leaves no note; a press with no typed mark answers nothing; a typed one answers both waiting tags; the same press landed twice answers once. The refusal of a tag on a note ten minutes old still holds, by the marker now.

## Not changed

`jobs_ledger_note_tags`, its policy and the other `job_note_*` functions. `field_presses` and the other three kinds of press.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111); `database.ts` on `main` carries `job_note_tags_write`, `job_note_post_tagged`, `land_field_press`.
