---
name: "Search reaches the text of a linked file: a transcript, a mail or a PDF on an evidence record or a matter document is found by its words"
number: 285
group: ready
status: building 2026-11-08 · PR 1 v2.6714 (the index's reach: `file_index.source`, the records pass, the sweep's step, the filers' hooks; PR open) · PR 2 and PR 3 next
summary: >
  A person's case search (v2.6620) reads the entries, the memos, the named documents, the two
  fixed documents and the matter's narrative, titles and what-it-shows lines. It does not read the
  files: a transcript linked from Drive on an evidence record, a .eml, a text PDF on the matter's
  Evidence tab. Importing a case this week, every transcript had to be retyped into a named
  document so a line of a call could be found, and the matter's five text documents are in the app
  with none of their words searchable. The file text index already exists for the Jobs drive
  (#240, file_index); point it at the files the HR file and the matter link or store, and let the
  case search union it, each hit naming the record and the file.
next: Merge PR 1, push `20261108200000`, deploy file-index-sweep, hr-evidence-drive, dev-mcp and drive-link; then PR 2 (the case search unions file text, with the seat's hit shape) and PR 3 (the backfill verb); then the case's records need no retyping.
ver: v2.6714
size: M · PR 1 the index's reach (S) · PR 2 the search union and the hit shape (S) · PR 3 the backfill verb for the records already filed (XS)
blocker: None.
opinion: build — the index, the extractor and the OCR exist; this is three small joins, and it removes the one reason an agent had to carry a quarter-megabyte of text through a chat
mockup: not required — the box is the seat's search_case and the HR file's search; a hit gains a file line, nothing else changes on screen
---

# Search reaches the text of a linked file (#285)

## The ask

2026-11-08, after the import of a former teammate's case folder onto People → HR: the owner asked
that any line from any recorded call be searchable in the app. The twenty-odd transcripts were on
the file as Drive-linked files on their evidence records, and the seat's search does not read a
file, so the only door was to retype each transcript into a named document through the seat, a
day's work and a hundred thousand tokens an hour. The matter's documents had the same gap: the
claims matrix is on the matter's Evidence tab and no line of it can be found.

## The decision

- **Reuse the file text index, do not build a second one.** `file_index` (#240, v2.6319) holds one
  row per Drive file with its extracted text, a `search` tsvector, OCR for scans behind a secret and
  embeddings behind a key. Its sweep walks the PipeTooling Jobs Shared Drive. Two more sources join
  it: every `person_file_attachments` row with a `drive_url` (the People drive's linked files), and
  every `legal_matter_documents` row's bytes in the `legal-matter-documents` bucket (read once on
  filing, the way a staged evidence file is).
- **The case search unions it.** `dev_case_search` (`20261107070000`) gains a `file` source: a hit
  names the record or matter document it hangs on, the file's name, the excerpt and the page or
  line where the index has one. `in: 'files'` narrows to it.
- **Counsel-only is honored twice.** A file on a counsel-only record indexes (the text sits in our
  table, never in Drive) but the row carries `counsel_only` and the seat's reads mark it as the
  rest of the search does; the agent role's policy on `file_index` rows hung on counsel-only
  records refuses them the way `person_file_evidence` does.
- **Transcripts stay evidence.** Once a linked transcript is searchable as a file, it does not also
  need to be a named document. The documents made this week stay; new cases file the transcript
  once.

## Where it plugs in

- `file_index` and its sweep (`drive-link`, `file_index_sweep_last_at`), the extractor and OCR
  queue (#240 PRs 1 to 5), `search_file_index(words, max)`.
- `person_file_attachments.drive_url` / `drive_file_id` (v2.6541) and `storage_path` (staged
  files), `person_file_evidence.counsel_only` (v2.6554).
- `legal_matter_documents.storage_path`, `mime`, `size_bytes`; the `legal-matter-documents` bucket.
- `dev_case_search` and the seat's `search_case` (v2.6620); `hr_doc_sections` for the shape of a
  sectioned hit.

## The plan

| PR | What | Size |
|---|---|---|
| 1 | The index's reach: a `source` column on `file_index` (`drive` today; `hr_attachment`, `matter_document`); the evidence filer and the matter document filer enqueue a row on filing; the sweep's reconcile step reads the People drive's linked ids it has not seen; a bucket read for matter documents under the 12 MB cap. Migration, `docs/migrations/`, the two functions redeployed. | S |
| 2 | The search union: `dev_case_search` adds the `file` source joined through the attachment or matter document to the person or matter, counsel-only carried, excerpt from `ts_headline`; `search_case` documents the new source and `in: 'files'`; the HR file's search box shows a file hit with its record's title and a door to the file. | S |
| 3 | The backfill: `plan_index_backfill { scope: 'person', person_id }` lists the linked and staged files a person's records carry that have no row, and `apply_index_backfill` queues them; one run per case already filed. | XS |

## How to verify

PR 1: file a made-up `.md` as a linked file on a ZZ Test person's evidence record and a made-up
PDF on a test matter; `read_file_index_status` shows both rows with their words. PR 2:
`search_case` for a phrase only the file holds returns a `file` hit naming the record; the same
phrase on a counsel-only record returns the hit marked to a dev and nothing to the agent role.
PR 3: the backfill plan on the test person lists exactly the files with no row; apply fills them.
