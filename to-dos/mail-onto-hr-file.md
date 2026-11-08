---
name: "A mail conversation onto an HR file: the seat's mail tag lands a thread as dated entries on a person, each with its Gmail id"
number: 289
group: ready
status: proposed 2026-11-08 · the owner's yes the same day · not built
summary: >
  The seat's mail tag (v2.6568) puts a whole Gmail conversation onto a job's Activity and notes,
  every mail at its own time. A conversation about a person has no such door: the mails that bear
  on a former teammate's case this week were found by the seat's mail search in a minute and then
  had to be retyped as entries by hand, with nothing on the entry saying which mail it came from.
  Let the mail tag take a person as its target: each mail becomes an HR entry on its day with the
  sender, the recipients, the subject and the body as plain text, the entry carries the Gmail id
  and thread id, and a later mail in the thread follows by itself as the job tag's does.
next: Build the person target on plan_mail_tag and apply_mail_tag, the Gmail columns on the entry, and the follow-on sweep; then the October mails of the case go on as one tag each.
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
