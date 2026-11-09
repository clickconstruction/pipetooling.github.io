---
name: mail-search
description: Search the company's own Gmail mailboxes through the dev seat (search_mail / read_mail) and file a mail's attachment where it belongs (plan_mail_file → apply_mail_file). Use whenever someone asks to find an email, a supplier's bill, a job's thread or a file that came by mail, in any account.
---

You search the company's mail through the PipeTooling dev seat (the `dev-mcp` MCP tools; `docs/dev-mcp/README.md`). Call `whoami` first. You are read-only unless a verb's name starts with `plan_` or `apply_`, and every write is plan first, then apply quoting the plan's `plan_hash`.

## The verbs

- `search_mail(q, accounts?, include_archived?, since?, until?, max?)` runs one Gmail search across the company's own mailboxes under the service account's domain-wide delegation, read-only by scope, and never a mailbox outside the Workspace. `q` is what a person would type in Gmail's search box: `from:ap@supplier.com has:attachment`, `subject:"invoice 4471"`, `filename:pdf "Lot 12"`, `newer_than:60d`. Leave `accounts` out to search every current login, or name people by the name People uses, a local part or an address. Each hit names the account, Gmail's id, From, To, Subject, Date and a snippet, newest first across the mailboxes.
- `read_mail(account, id)` reads one hit whole: the words and its files by name, kind and size.
- `read_mail_file(account, id, name, offset?, length?)` hands one file back as base64 when you need to look at it (10 MB cap). A reply carries at most 54,000 bytes: a larger file comes in pieces, so call again with `offset` set to the reply's `next_offset` until it is null, join the decoded pieces in order and check them against `sha256`.
- `plan_mail_tag(tag)` then `apply_mail_tag(tag, plan_hash)` tags a whole conversation onto a job's Activity and notes: `tag = { account, thread_id (a hit's thread_id), job: { jobs_ledger_id } }`. It runs the My email press's own planner as that person, so every mail lands at its own time, a line already held is tied rather than written twice, and later mail follows by itself. The plan lists each mail and what it becomes; read it before you apply. This is the backfill: for a job, search its number, its address and its customer, then tag each conversation that is plainly about it. Since v2.6715 the same two verbs take `person: { person_id }` (find_person) in place of `job`: each mail of the conversation becomes a dated entry on that person's HR file with its Gmail id, written as you, a mail the file already holds left alone, later mail following as entries; an archived teammate's box may be read for it. `person: { person_id, stop: true }` lifts that follow and keeps the entries. A mail whose content is counsel-only goes on as evidence (`plan_mail_file` with `to.kind person_evidence` and `counsel_only`), never as an entry.
- `plan_mail_file(file)` then `apply_mail_file(file, plan_hash)` takes a named file straight off a hit and files it where it belongs, the bytes never passing through you: `to: { kind: 'job', jobs_ledger_id, where? }` into the job's Drive folder as the Documents tab's Add a file does; `to: { kind: 'person_evidence', person_id, dated_on, title, memo }` onto a person's HR file; `to: { kind: 'matter_document', matter_id, title, shows }` onto a legal matter's Evidence tab.

## How to work a request

1. Search first with the narrowest query that could still find it; widen only when it finds nothing: drop the sender and keep the words, then widen the dates. Say which accounts and dates you covered when nothing is found.
2. Read a hit only when the snippet does not settle it. Quote a mail sparingly: the sender, the date and the line that matters, never a whole body.
3. Before filing, say in one line what you found and where it goes. Plan, read the plan's words back, and apply only when the plan says what you expected. File once: a plan already applied answers *already*.
4. Never move, trash or delete mail (the verbs cannot; a tag's label in that person's Gmail is the one mark the press itself makes), and never search for anything outside the business question you were given. Every search is on the seat's call log with its query and its accounts.

## Finding the places

`find_job` names a job by its number, name, customer or address (its `id` is the `jobs_ledger_id`); `find_person` or `get_person_file` a teammate (a `people.id`); `read_rows` on `legal_matters` the open matters. A supplier's bill for a job goes on the job; a paper about a teammate goes on their HR file; anything for the attorney goes on the matter.
