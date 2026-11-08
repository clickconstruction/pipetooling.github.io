---
name: "A document names the evidence record it transcribes, so a search hit on a line of a call opens the call"
number: 287
group: ready
status: proposed 2026-11-08 · the owner's yes the same day · not built
summary: >
  A transcript on an HR file is a named document; the recording it transcribes is an evidence
  record with a date, a hash and a Drive link to the audio. Nothing joins them. A search hit on a
  line of the call lands on the document and the reader has to find the record by its title. Let a
  named document name its evidence record: the document shows the record's date, hash and audio
  door, the record shows "transcript on file" with a door to the document, and the case brief and
  search carry the pair.
next: Build the column and the two chips; then set the link on this week's documents through the seat.
size: S
blocker: None.
opinion: build — one nullable column and two chips, and it turns a pile of transcripts into evidence a reader can open from either side
mockup: not required — a chip on the document's header and a chip on the record's row, both surfaces shipped
---

# A document names the evidence record it transcribes (#287)

## The ask

2026-11-08. Twenty transcripts went onto a former teammate's HR file as named documents so their
lines could be searched (#285 makes that unnecessary for the next case). Each is the words of a
recording that is already an evidence record with its date, its SHA-256 and a link to the audio.
A search hit lands on the document; the record that proves it is three screens away. The owner
asked that a hit on a line of a call open the call.

## The decision

- **`person_documents.evidence_id`**, nullable, referencing `person_file_evidence`. Set at creation
  through `plan_person_doc { evidence_id }` or on an existing document through a section-free
  plan (`{ doc_id, evidence_id }`), and in the app from the document's header (*Transcribes…*,
  a picker over the person's records).
- **Both sides show it.** The document header gains a chip: the record's title, its date, the first
  twelve characters of its hash, and a door to the record and to the audio file. The record's row on
  the Evidence tab and in the Timeline gains *Transcript on file* with a door to the document.
- **The brief and the search carry it.** `get_case_brief` lists `evidence_id` on each document and
  `document_id` on each record; a `search_case` hit on a document carries the record's id and date,
  so an agent cites the call by its evidence number, not the document's title.
- **Counsel-only follows the record.** A document tied to a counsel-only record is itself
  counsel-only; the plan refuses the pair otherwise.

## Where it plugs in

- `person_documents` (`20261107040000`), `person_file_evidence` and `person_file_attachments`
  (v2.6541, v2.6544).
- `PersonFilePanel.tsx`'s Documents view and the Evidence tab's row; the Timeline kernel in
  `supabase/functions/_shared/personTimeline.ts`.
- `devMcpCaseBrief.ts` (v2.6619), `dev_case_search` (v2.6620), `plan_person_doc` (v2.6613).

## The plan

One PR: the column and its index (migration), the write path through `dev_person_doc_write`, the
two chips, the brief's and the search's extra fields, a smoke on each chip, the seat README row.
Then one seat pass on the case already filed: a section-free plan per transcript setting
`evidence_id`, applied on the owner's word.

## How to verify

On a ZZ Test person: a made-up evidence record with a linked file and a named document; set the
link; the document's header shows the record's date and hash and opens the record; the record's
row shows *Transcript on file* and opens the document; `search_case` for a word in the document
returns the hit with the record's id. Tie a document to a counsel-only record without the tick:
refused.
