---
name: "The dev seat reads a mailed file's words: a text read beside read_mail_file's bytes"
number: 296
group: ready
status: asked 2026-11-09 with the ranged reads (v2.6806) · nothing built
summary: >
  Since v2.6806 the seat's read_mail_file hands any file off a mail back whole, in base64 pieces
  of at most 54,000 bytes. That makes the bytes reachable, but base64 is a costly way for an agent
  to read a supplier's PDF: a 180 KB file is four replies of 72,000 characters before a word of it
  is read. The file index already reads a file's words from its bytes on the server (a text PDF's
  layer, an .eml decoded, a text file). Let the seat ask for those words off a mail, paged by
  character, and say plainly when the file is a scan with no text layer.
next: One PR — the kernel's paging and words with tests, the verb wired through textFromBytes, the README row; then deploy dev-mcp and read one text PDF and one scan off a ZZ test mail.
size: S
blocker: none
opinion: build — the reader exists and is already in the function's bundle; this is the read an agent wants nine times in ten
mockup: not required — the verb has no screen; the reply's shape below is the design
---

# The dev seat reads a mailed file's words (#296)

## The ask

2026-11-09, from a read-only mail session at the seat: several supplier PDFs came back from `read_mail_file` as base64 cut at the door's 80,000 characters. The fix that shipped (v2.6806, `docs/recent-features/v2.6806.md`) is ranged reads: the bytes in pieces that fit, with `next_offset` and the sha256 of the whole. The other shape weighed that day was a text read, and it was carded here instead of built in the same PR.

## The decision

Ranged reads went first because they hold for every kind of file and need no parser. The text read is the second, and it does not replace the first: a scan, a picture or a spreadsheet still needs its bytes.

Open, for whoever builds it:

1. **A mode or a sibling verb.** `read_mail_file(account, id, name, text: true, offset?)` keeps one verb and one row; `read_mail_file_text` keeps each verb's reply one shape. The seat's other reads lean to one verb per shape (`get_person_document` beside `get_person_file`), so the sibling is the default.
2. **What a page is.** Paging by character offset is the simple contract, but every call parses the PDF again, since the function keeps nothing between calls. Paging by PDF page (`from_page`, `pages_read`, `next_page`) reads only what the call hands back. Pick by measuring a 40-page PDF against the function's CPU budget.

## Where it plugs in

Exists:

- `supabase/functions/_shared/fileText.ts` → `textFromBytes(data, { name, mimeType }, opts)` answers `{ text, source: 'pdf_layer' | 'plain', pages, pagesRead }` or `{ why: 'scan' | 'kind' | 'big' | 'slow' | 'error' }`. A PDF goes through `unpdf` inside `PdfReadLimits`; under `PDF_SCAN_MAX_CHARS` of text it is a scan; an image is a scan; `.eml` is decoded by `emlToText`.
- `_shared/fileIndexKernel.ts` holds the limits: `EXCERPT_PDF_LIMITS` (8 MB, 40 pages, 300 ms) is the one made for a read inside a request; `INDEX_PDF_LIMITS` is the index pass's. `heldWhyWords` already has words for each `why`.
- `dev-mcp/index.ts` already imports `_shared/fileIndex.ts`, which imports `fileText.ts`, so the reader is in the bundle today.
- `_shared/devMcpMailFile.ts` → the handler's `fileOff` already returns the file as bytes (`MailFileRaw`) with its sha256; `mailFileReadReply` is the pattern for a reply measured against `REPLY_MAX_CHARS` and for `read_next` words.

New:

- A pure kernel function beside `mailFileReadReply`: the read's result and an offset in, `{ account, id, name, mime, size_bytes, sha256, text_source, pages, pages_read, chars, offset, next_offset, read_next?, text }` out, at most about 60,000 characters of text a reply, cut on a line end where one is near.
- The refusal words, each naming the next press: a scan (*no text layer; read its bytes with `read_mail_file`, or file it with `plan_mail_file` and the file index's OCR reads it there*), a kind the reader does not read, a file over the reader's size, a read that ran out of time (how many pages were read).
- The verb's declaration, its README row, the skill's line, a release note and fragment, `SERVER_VERSION`.

## How to verify

Unit tests for the paging and each refusal's words, as `src/lib/devMcp/devMcpMailFile.test.ts` does for the pieces. Live, after the deploy: a mail to a ZZ test login with one text PDF, one scanned PDF and one `.eml` attached; read each; the text PDF's words match the file, the scan answers in words, and no reply carries the door's "… cut at" tail.
