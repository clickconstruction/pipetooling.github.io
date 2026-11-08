---
name: "A named document from a Drive file, through the seat: the server reads the bytes, nothing rides through the agent"
number: 286
group: ready
status: proposed 2026-11-08 · the owner's yes the same day · built as v2.6712 the same day (plan_person_doc → apply_person_doc take drive_file_id, server 0.41.0, migration 20261108190000) · the live check on a ZZ TEST person owed after the deploy
summary: >
  A named document on an HR file is made three ways today: written through the seat (the text in
  the call), picked as a .md or .txt in the app, or pasted. A long document a session wants on the
  file has no door that avoids a person: the two case documents of a quarter-megabyte each waited
  on the office to pick them, because sending them through the seat costs a session more tokens
  than the document is worth. The mail door already does the right thing for a mail's attachment:
  the server reads the bytes and files them, the agent sees only the plan. Give named documents the
  same door for a file already in Drive.
next: After the merge, push the migration and deploy dev-mcp; then run How to verify on a ZZ TEST person and record the result here.
ver: v2.6712
size: S
blocker: None.
opinion: build — plan_mail_file is the pattern, the Drive read exists in drive-link, and the named-document write exists in dev_person_doc_write; this joins them
mockup: not required — seat verbs; the Documents view already shows what they write
---

# A named document from a Drive file, through the seat (#286)

## The ask

2026-11-08. Two long documents of a former teammate's case, a company history and a knowledge
base, sat in the People Shared Drive as linked files on evidence records for two days because no
door put their text on the file without a person: the seat's `plan_person_doc` carries the text in
the call, and a 350 KB document costs about a hundred thousand tokens each way, twice (plan and
apply). The office's From a file door works, but it waits on a person at a desk. The owner asked
that the next long document not need one.

## The decision

- **A Drive door beside the mail door.** `plan_person_doc` and `apply_person_doc` take a
  `drive_file_id` (or a Drive url) in place of `markdown`. The server reads the file through the
  service account, as `drive-link` reads a file for the index, and makes or replaces the document
  with its text. The plan reply names the file, its size, its sha256 and the first heading, and
  the plan hash commits to the bytes, so a file changed in Drive between plan and apply refuses.
- **Text files only, with a cap.** `.md`, `.txt` and Google Docs exported as plain text; the cap
  is the document limit (one million characters). A PDF or an image is refused with the reason
  and the pointer to #285, where its text is searched as a file instead.
- **The record remembers where it came from.** `person_documents.source_drive_file_id` and
  `source_sha256`, so a reader knows the document is a copy of a file and which bytes it was,
  and #287 can tie it to the evidence record that links the same file.
- **Counsel-only rides along.** `counsel_only` on the plan marks the document as today.

## Where it plugs in

- `plan_mail_file` / `apply_mail_file` (v2.6568): the shape to copy, bytes read on the server,
  the plan hash over them.
- `drive-link`'s Drive read and the service account's delegation (#236, #240).
- `dev_person_doc_write` (`20261107013000`, `20261107040000`): the write; `plan_person_doc`
  and `apply_person_doc` in `supabase/functions/_shared/devMcpWrites.ts` and `dev-mcp/index.ts`.
- `docs/dev-mcp/README.md`, `docs/HR_FILES.md`.

## The plan

One PR: the two columns (migration), the Drive read in the seat's plan and apply paths, the
refusals (not text, over the cap, file changed), the seat README row and the writes test with a
made-up `.md` in a test folder. `dev-mcp` redeployed; the migration pushed right after the merge.

## How to verify

Put a made-up `.md` of a few hundred kilobytes in a test folder of the People drive; plan with its
id on a ZZ Test person and read the plan's size, sha and first heading; apply; `get_person_document`
reads a section. Edit the file in Drive and apply the old plan again: refused, naming the changed
bytes. Plan a PDF: refused, pointing at #285.
