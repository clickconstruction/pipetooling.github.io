---
name: "Counsel-only on a matter document, and the matter's documents as text the search can read"
number: 288
group: ready
status: proposed 2026-11-08 · the owner's yes the same day · the shape picked the same day (the shared documents table) · PR 1 built as v2.6716 (migration 20261108210000, legal-portal and dev-mcp 0.44.0 to deploy after the push) · PR 2 and PR 3 next
summary: >
  The Legal desk's matter is what the firm reads, so it is the natural home for anything written
  for the attorney. Two things keep that from working for a case on a person: a matter document
  is a file in a bucket, so the case search reads its title and its what-it-shows line and none of
  its words; and a matter document has no counsel-only hold, so the one document written for
  counsel alone, the intake memo's section held with counsel, had to live on the HR file and reach
  the attorney by hand. Give a matter document a counsel-only mark the firm's portal and the agent
  role honor, and let a text document on a matter be text, read by section and searched like a
  named document.
next: Merge PR 1 after #286's and #287's migrations are on main (they alter the table PR 1 renames), push the migration, deploy legal-portal and dev-mcp, regenerate the types and the catalog; then PR 2 the counsel-only mark on the Evidence row and PR 3 the seat's section reads on a matter's text document.
size: M · PR 1 text on a matter document and the search union (S) · PR 2 the counsel-only mark on the document, the portal's and the agent's refusals (S) · PR 3 the seat's section reads on a matter document (S)
blocker: None on the shape (picked 2026-11-08); the firm portal's read of a held document is a product call for PR 2.
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
  on filing (the desk's tick, the seat's field, the mail door's `to.counsel_only`). What it binds:
  the portal lists the document to the firm's logins only when the matter's firm is counsel of
  record and never includes it in a packet or a print for a third party; the agent role's policy
  refuses the row; the seat's reads mark it to a dev as the HR file's does. The limit is stated as
  on the HR file: it holds the document from the agent as deployed and from any print, not from a
  dev's own session.
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
| 2 | `counsel_only` on a matter document: the tick on the desk's add form, the seat's and the mail door's field, the portal's list and packet refusing it, the agent role's policy, the lock chip on the row, `ACCESS_CONTROL.md` and `docs/HR_FILES.md` stating the limit. | S |
| 3 | The seat reads a matter document by section (`get_matter_document { matter_id, doc_id, section? }`) and `search_case` hits on it carry the section, as a named document's do. | S |

## How to verify

On a test matter: file a made-up `.md` through the seat; the desk renders it; `search_case` for a
phrase inside it returns a `matter_document` hit with the section. Tick counsel-only on a second
document: the portal's list as the test firm omits it, the packet omits it, the agent role's read
returns nothing, the dev's read marks it. File a PDF: `content` stays null and the title still
searches.
