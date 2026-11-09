---
name: "A mail conversation onto an HR file: the seat's mail tag lands a thread as dated entries on a person, each with its Gmail id"
number: 289
group: close
status: built 2026-11-08 on claude/289-mail-onto-hr-file-1c7694 (v2.6715, one PR) · merged 2026-11-08 (#7342) with its migration `20261108194723` in prod's ledger · `gmail-mine` and `dev-mcp` deployed (drift clean 2026-11-09, server 0.45.0) · verified live on ZZ Test Hand 2026-11-09 (below) · left: the October mails of the case, the owner's call, then the owner's look
summary: >
  The seat's mail tag (v2.6568) puts a whole Gmail conversation onto a job's Activity and notes,
  every mail at its own time. A conversation about a person has no such door: the mails that bear
  on a former teammate's case this week were found by the seat's mail search in a minute and then
  had to be retyped as entries by hand, with nothing on the entry saying which mail it came from.
  Let the mail tag take a person as its target: each mail becomes an HR entry on its day with the
  sender, the recipients, the subject and the body as plain text, the entry carries the Gmail id
  and thread id, and a later mail in the thread follows by itself as the job tag's does.
next: Nothing left to build or deploy. The October mails of the case go on as one tag each on the owner's word (`plan_mail_tag` with `tag.person` from the login's box, then `apply_mail_tag`); then the owner's look and delete the file. Not seen live: a later mail following into a tagged thread (no test login writes to a thread; the writes test holds the follow).
ver: v2.6715
size: S
blocker: None.
opinion: build — the job tag already does the hard part (the thread read, the dedupe, the follow-on); this is a second landing and two columns
mockup: not required — seat verbs; the Timeline already draws an entry
---

# A mail conversation onto an HR file (#289)

## The ask

2026-11-08. Reading a former teammate's live mailbox through the seat, a session found three
conversations from the weeks after the case folder's last update: two exchanges with the owners
and a supplier's e-signature mails addressed to the company at his address. None was in the app.
The folder's own method for a mail is a `.eml` saved by hand, hashed, filed as evidence and
summarized into a dated entry; it takes a person an hour a thread. The seat can read the thread in
one call but has no door to put it on a person: `plan_mail_tag` takes a job. The owner asked for
the same door onto an HR file.

## The decision

- **A person target on the mail tag.** `plan_mail_tag { account, thread_id, person: { person_id } }`
  reads the thread as the job tag does and plans one HR entry per mail: `entry_date` the mail's
  day, `source` `conversation`, the content a fixed shape (From, To, Cc, Subject, the body as plain
  text, the files by name and size) so the Timeline reads it the way it reads a transcript entry.
  `apply_mail_tag` writes them through the HR agent's entry RPC, as the dev who applied.
- **The entry remembers the mail.** `person_file_entries.gmail_message_id` and `gmail_thread_id`,
  nullable; the dedupe key, so a thread tagged twice adds only the mails it has not seen; and the
  door from an entry back to the mail for a dev with the seat.
- **Later mail follows.** The job tag's follow-on, which lands a later mail in a tagged thread by
  itself, runs for a person-tagged thread too, as entries, until the tag is lifted (a dev's press on
  the entry: *Stop following*).
- **Files stay in Gmail unless filed.** The entry names a mail's files; `plan_mail_file` with
  `to.kind person_evidence` files one as an evidence record when it is worth keeping, as today.
- **Counsel-only is not an entry's concern.** Entries have no counsel-only mark (#269 stated the
  limit); a mail whose content is counsel-only goes on as an evidence record with the tick, not as
  an entry, and the plan says so when the account or thread is flagged.

## Where it plugs in

- `plan_mail_tag` / `apply_mail_tag` and `gmail-mine`'s tag (v2.6568, server 0.30.0); the
  follow-on in the `gmail-sync` sweep.
- `person_file_entries` and the HR agent's entry write (`plan_hr_entry` / `apply_hr_entry`); the
  Timeline kernel `supabase/functions/_shared/personTimeline.ts`.
- `search_mail` / `read_mail` (v2.6565); `docs/dev-mcp/README.md`, `docs/HR_FILES.md`.

## The plan

One PR: the two columns (migration), the person target in the plan and apply paths with the fixed
entry shape, the dedupe on the Gmail id, the follow-on's person branch, *Stop following* on the
entry, the seat README row, the writes test on a made-up thread. `gmail-mine`, `gmail-sync` and
`dev-mcp` redeployed; the migration pushed right after the merge.

## How to verify

Send three made-up mails in a thread between two test logins; `plan_mail_tag` with a ZZ Test
person lists three entries with their days and subjects; apply writes three; the Timeline shows
them; a fourth mail in the thread appears as an entry after the next sweep; tagging the thread
again adds nothing; `search_case` finds a phrase from a body.

## Where it stands

Built 2026-11-08 as one PR (v2.6715, server 0.42.0, migration `20261108194723_hr_mail_tag.sql`): `tag.person: { person_id }` on
`plan_mail_tag` / `apply_mail_tag`, the landing in `gmail-mine` (`tagPerson`, the kernel `src/lib/myMail/personTagPlan.ts`),
`gmail_message_id` / `gmail_thread_id` on the entry with the partial unique index as the dedupe, `email_tag_threads.person_id`
and the follow's `followFiles` branch, the docs and the skill. Two things differ from the plan above: the follow lives in
gmail-mine's own cron action (the job tag's follow was never in gmail-sync, so gmail-sync is untouched), and *Stop following*
is the seat's `person: { person_id, stop: true }` for now, not a press on the entry — the Timeline press is a follow-up card
if the office wants it. Left for after the merge: the push, the two deploys, and How to verify on a ZZ Test person, recorded here.

## Verified (2026-11-09, dev MCP 0.45.0, migration `20261108194723` on prod)

On ZZ Test Hand (a made-up person), from a Claude session through the seat, over a one-mail conversation the seat found in
an office login's box: the app's own *Paid in full* notice for a ZZ TEST job (no test login can send mail, so the three-mail
thread of § How to verify became this one):

- `plan_mail_tag { account, thread_id, person: { person_id } }` read the thread and planned one entry: the mail's Gmail
  id, its sender, its subject, `entryDate` the mail's own day, no files; *1 entry written, 0 on the file already, 0
  skipped … later mail in the conversation follows as entries.*
- `apply_mail_tag` wrote it: `person_file_entries` row `1f94d5d7…`, `source` `conversation`, `gmail_message_id` and
  `gmail_thread_id` the mail's ids. `get_person_file` draws it in the Said lane on its day as a *conversation* line, the
  fixed shape (From, To, Subject, Sent, then the body as plain text). `email_tag_threads` held the follow row with
  `person_id` set and no job.
- Planned again on the same thread: *0 entries written, 1 mail on the file already; the follow is on already and is
  refreshed* — the mail's `kind` read *already*, *an entry on the file holds this mail*. Nothing was applied.
- `search_case` (in: entries) for two words from the subject returned the entry with the match marked.
- `plan_mail_tag` with `person: { person_id, stop: true }`: *the follow on this conversation is lifted … the 1 entry
  already on the file stay*; `apply_mail_tag` lifted it (`stopped: true`), and `email_tag_threads` no longer holds a row
  for the thread. The entry stays on the file.
