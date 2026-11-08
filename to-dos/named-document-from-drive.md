---
name: "A named document from a Drive file, through the seat: the server reads the bytes, nothing rides through the agent"
number: 286
group: ready
status: proposed 2026-11-08 · the owner's yes the same day · built as v2.6712 the same day (plan_person_doc → apply_person_doc take drive_file_id, server 0.41.0, migration 20261108190000, pushed and deployed 2026-11-08) · verified live on ZZ Test Hand the same evening (below) · left: the changed-bytes refusal, which needs a person to edit the file in Drive
summary: >
  A named document on an HR file is made three ways today: written through the seat (the text in
  the call), picked as a .md or .txt in the app, or pasted. A long document a session wants on the
  file has no door that avoids a person: the two case documents of a quarter-megabyte each waited
  on the office to pick them, because sending them through the seat costs a session more tokens
  than the document is worth. The mail door already does the right thing for a mail's attachment:
  the server reads the bytes and files them, the agent sees only the plan. Give named documents the
  same door for a file already in Drive.
next: Edit zz-test-knowledge-base.md in the People drive (ZZ Test Hand › 2026-11-08 · ZZ TEST #286 Drive document source) and apply plan 844e0d3e4ae7… again from a dev MCP session: it should refuse naming the bytes as they read now. Then close the card.
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

## Verified (2026-11-08, dev MCP 0.41.0, migration 20261108190000 on prod)

On ZZ Test Hand (a made-up person), from a Claude session through the seat's HTTP door:

- A made-up `.md` of 177,592 bytes (60 sections) was filed into the People drive as an evidence record
  (`plan_person_evidence` → `apply_person_evidence`), so the Drive file came from the seat's own door.
- `plan_person_doc { person_id, drive_file_id, title }` read the file on the server: the plan's `source` named
  `zz-test-knowledge-base.md`, text/markdown, 173 KB, sha256 `c75c870f61ba…` (the evidence record's own sha), first
  heading *ZZ TEST knowledge base (made up)*, and the 60 headings with their lines. Nothing crossed the door but the
  file id and the plan.
- `apply_person_doc` with the hash wrote document `845911b5…` with `source.drive_file_id` and `source.sha256` on the
  row (`person_document_index` shows the two columns; the two older documents carry null).
- `get_person_document` by `doc_id` with section *Section 3: Trench notes* read that section alone (2,813 characters).
- The same plan applied again: refused — *already has a document titled … (doc_id 845911b5…); edit it by doc_id*.
  The same file planned onto that doc_id: refused — *nothing changes — the document already reads that way*.
- A one-page made-up PDF filed the same way, then `plan_person_doc` with its id: refused — *zz-test-blank.pdf is a PDF,
  and a named document takes text alone (.md, .txt or a Google Doc). Link the file on an evidence record instead …
  where punch list #285 searches its text as a file.*
- Not run: editing the file in Drive and applying the old plan (the session has no Drive write; the unit test proves
  the hash moves with the text, and the server's refusal names the bytes read now). A person's one edit closes it.
