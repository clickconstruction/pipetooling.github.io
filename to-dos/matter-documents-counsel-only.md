---
name: "Counsel-only on a matter document, and the matter's documents as text the search can read"
number: 288
group: close
status: SHIPPED — PR 1 v2.6716 (#7346, merged 2026-11-08), PR 2 v2.6720 (#7347, merged 2026-11-09 03:04 UTC) and PR 3 v2.6722 (#7348, merged 2026-11-09 05:15 UTC); the three migrations (20261108210000, 20261108230000, 20261108233000) are in prod's ledger, each pushed alone; legal-portal and dev-mcp 0.46.0 deployed and current; How to verify run through the seat on the ZZ TEST GC On Notice matter on 2026-11-09 (Where it stands)
summary: >
  The Legal desk's matter is what the firm reads, so it is the natural home for anything written
  for the attorney. Two things keep that from working for a case on a person: a matter document
  is a file in a bucket, so the case search reads its title and its what-it-shows line and none of
  its words; and a matter document has no counsel-only hold, so the one document written for
  counsel alone, the intake memo's section held with counsel, had to live on the HR file and reach
  the attorney by hand. Give a matter document a counsel-only mark the firm's portal and the agent
  role honor, and let a text document on a matter be text, read by section and searched like a
  named document.
next: the owner's look at the Evidence tab of the ZZ TEST GC On Notice matter — the lock chip on the counsel-only memo and Read on the plain memo (both filed 2026-11-09). Two legs of How to verify wait on test data that does not exist: the search_case hit with its section needs a matter standing on a ZZ TEST person (plan_matter_open_person → apply_matter_open_person on one of the ZZ Test people; the only person-standing matter today is a real one and takes no test filings), and the portal's list and packet leaving the held document out need a test firm as counsel of record on the matter. The next types regen (chore(types) after the pushes) adds dev_matter_doc_read, hr_doc_slice, matter_counsel_only_count and matter_text_document_is_counsel_only to the catalog; the verbs run without it. Left for a later card: the seat writing a matter's text document by section (plan_person_doc's ops with a matter owner), once #286's and #287's hands are off dev_person_doc_write.
size: M · PR 1 text on a matter document and the search union (S) · PR 2 the counsel-only mark on the document, the portal's and the agent's refusals (S) · PR 3 the seat's section reads on a matter document (S)
blocker: none for the builder — what is left is the owner's look and two live legs that want test data (next).
opinion: build PR 1 and PR 2 now — the matter is where counsel reads, and today it is the one place in the case a session cannot search or hold; leave the table merge for when the Legal desk asks for it
mockup: not required — the Evidence tab's row gains a lock chip and a text viewer; the desk and the portal are shipped surfaces
---

# Counsel-only on a matter document, and matter documents as text (#288)

## The ask

2026-11-08. A former teammate's matter holds six documents for the firm. Their words cannot be
searched, because a matter document is a file in the `legal-matter-documents` bucket and
`dev_case_search` reads only `title` and `shows`. And the part of the intake memo written for
counsel's eyes alone could not go on the matter at all, since the firm's portal and the agent seat
read every matter document; it went on the HR file with the counsel-only tick, where the attorney
cannot see it. The owner asked for both: the matter's documents searchable, and a counsel-only
hold on the matter.

## The decision

- **The owner's pick, 2026-11-08: the shared documents table, not a text column.** Asked "a
  nullable text column beside the file on `legal_matter_documents` now, or the one shared documents
  table for people and matters that #277 named as the long-term shape", the owner said *Shared
  documents table*. So PR 1 (v2.6716, migration `20261108210000`) renamed `person_documents` to
  `documents`, owned by a person or a matter, with the old names kept as views; a `.md` or `.txt`
  filed through the desk, the seat (`plan_matter_document` with `markdown`) or the mail door is kept
  as a `documents` row the Evidence row points at (`text_document_id`), as well as bytes in the
  bucket; a PDF keeps bytes alone and #285 indexes its words. A text document renders in the desk
  (**Read** on the row) and the portal (**Read here**) through the HR documents' renderer and is read
  by section through the seat the way a named document is (PR 3).
- **The search reads it.** `dev_case_search`'s `matter_document` source searches the text document's
  words where the row points at one, sectioned through `hr_doc_sections`' grammar, beside `title`
  and `shows` (PR 1).
- **A counsel-only mark on the document.** `legal_matter_documents.counsel_only boolean`, set
  on filing (the desk's tick, the seat's field, the mail door's `to.counsel_only`) or from the
  row's menu (PR 2, v2.6720). What it binds: the portal lists the document to the firm's logins,
  who are counsel of record, with a lock, and the printed packet (a paper for a third party) leaves
  it out; the seat as deployed is refused the row and its words by restrictive policies and told
  the count, and the agent role has no policy on either table; the seat's search marks the hit, as
  the HR file's does. The limit is stated as on the HR file: it holds the document from the seat
  and the agent as deployed and from any print, not from a dev's own session.
- **The merge of the two tables, done.** #277 weighed one documents table for people and matters
  and built the person table first with nothing that fights the later merge; the owner's pick made
  PR 1 that merge. `dev_person_doc_write`, `dev_doc_read` and `dev_doc_history` still read through
  the `person_documents` view until PR 3 moves them; the seat's own reads move once the catalog
  knows `documents`.

## Where it plugs in

- `legal_matter_documents` (`20261030030000`), the `legal-matter-documents` bucket, the desk's
  Evidence tab and the firm portal's read (`legal-portal`, #85).
- `plan_matter_document` / `apply_matter_document` (v2.6004), `plan_mail_file` (v2.6568).
- `hr_doc_sections`, `hrDocMarkdownToSafeHtml`, `get_person_document`'s section grammar
  (v2.6621); `dev_case_search` (v2.6620).

## The plan

| PR | What | Size |
|---|---|---|
| 1 | The shared `documents` table (the rename, `matter_id`, the views with the old names) and `legal_matter_documents.text_document_id`; the desk, the seat and the mail door keep text for a text file; the desk and the portal render it; `dev_case_search` searches it by section. Migration, `legal-portal` and `dev-mcp` redeployed. **Built: v2.6716.** | M |
| 2 | `counsel_only` on a matter document: the tick on the desk's add form, the seat's and the mail door's field, the portal's list wearing the lock and the packet leaving it out, the seat refused the row and its words by policy (the agent role has none), the lock chip on the row and the menu's on and off, `ACCESS_CONTROL.md` and `docs/HR_FILES.md` stating the limit. **Built: v2.6720.** | S |
| 3 | The seat reads a matter document by section (`get_matter_document { matter_id, doc_id, section? }`) and `search_case` hits on it carry the section, as a named document's do (the hits since PR 1; the read through `hr_doc_slice`, the grammar `get_person_document` shares). **Built: v2.6722.** | S |

## How to verify

On a test matter: file a made-up `.md` through the seat; the desk renders it; `search_case` for a
phrase inside it returns a `matter_document` hit with the section. Tick counsel-only on a second
document: the portal's list as the test firm omits it, the packet omits it, the agent role's read
returns nothing, the dev's read marks it. File a PDF: `content` stays null and the title still
searches.

## Where it stands

2026-11-09: the three PRs are on main and live. PR 2 (#7347) merged at 03:04 UTC; its migration was
pushed alone (`--include-all`, since its stamp sits below the ledger's newest), `legal-portal` was
redeployed from main and `dev-mcp` 0.45.0 from main's code with prod's own catalog kept (the deployed
catalog was a regen off prod ahead of main; a plain deploy would have taken the `documents` table
off it). PR 3 (#7348) retargeted to main by itself, took main's merge with the server at 0.46.0
(main's 0.45.0 + 1; #285's #7344 sat at the same pin, so its session dequeued to let PR 3 go first
and takes the next free number), and merged at 05:15 UTC after one re-arm; its migration was pushed
alone and `dev-mcp` 0.46.0 deployed straight from main, whose catalog the types PR #7411 had just
brought ahead of prod's. `check:migration-drift` reads fully applied after each push.

How to verify, run through the seat on the ZZ TEST GC On Notice matter (a matter on a customer, no
firm): a counsel-only memo filed with `plan_matter_document` → `apply_matter_document`
(`counsel_only: true`, kept as text) is absent from the seat's `read_rows` on
`legal_matter_documents` and on `documents`, `matter_counsel_only_count` counts it, and
`dev_matter_doc_read` refuses it in words ("for counsel alone — refused to the seat as deployed").
A plain memo with three numbered sections reads back: the index names the preamble and the three
sections with their numbers and lines, section 2 comes back with its body and its neighbours named,
and the older plain-text paper filed before PR 1 (bytes alone, no text row) is refused as "not a
text document", pointing at its title and what it shows. Not covered on this matter: the
`search_case` hit with its section (no ZZ TEST person has a matter) and the portal's list and packet
as a test firm (the matter has no firm); the packet's omission is held by
`legalFirmPacketPrint.test.ts`. The PDF leg (`content` null, title still searched) is PR 1's and
was not re-run.
