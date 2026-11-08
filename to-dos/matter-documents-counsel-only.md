---
name: "Counsel-only on a matter document, and the matter's documents as text the search can read"
number: 288
group: ready
status: proposed 2026-11-08 · the owner's yes the same day · not built
summary: >
  The Legal desk's matter is what the firm reads, so it is the natural home for anything written
  for the attorney. Two things keep that from working for a case on a person: a matter document
  is a file in a bucket, so the case search reads its title and its what-it-shows line and none of
  its words; and a matter document has no counsel-only hold, so the one document written for
  counsel alone, the intake memo's section held with counsel, had to live on the HR file and reach
  the attorney by hand. Give a matter document a counsel-only mark the firm's portal and the agent
  role honor, and let a text document on a matter be text, read by section and searched like a
  named document.
next: Decide the shape with the owner: a text column beside the file (recommended, PR 1) or the one documents table for people and matters that #277 named as the long-term shape; then build PR 1 and the mark.
size: M · PR 1 text on a matter document and the search union (S) · PR 2 the counsel-only mark on the document, the portal's and the agent's refusals (S) · PR 3 the seat's section reads on a matter document (S)
blocker: The owner's pick between a text column now and the shared documents table later; the firm portal's read of a held document is a product call.
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

- **Text beside the file.** `legal_matter_documents.content text` nullable: a `.md` or `.txt`
  filed through the desk, the seat (`plan_matter_document` with `markdown`) or the mail door is
  kept as text as well as bytes; a PDF keeps bytes alone and #285 indexes its words. A text document
  renders in the desk and the portal through the HR documents' renderer and is read by section
  through the seat the way a named document is.
- **The search reads it.** `dev_case_search`'s `matter_document` source searches `content` where
  it is set, sectioned through `hr_doc_sections`' grammar, beside `title` and `shows`.
- **A counsel-only mark on the document.** `legal_matter_documents.counsel_only boolean`, set
  on filing (the desk's tick, the seat's field, the mail door's `to.counsel_only`). What it binds:
  the portal lists the document to the firm's logins only when the matter's firm is counsel of
  record and never includes it in a packet or a print for a third party; the agent role's policy
  refuses the row; the seat's reads mark it to a dev as the HR file's does. The limit is stated as
  on the HR file: it holds the document from the agent as deployed and from any print, not from a
  dev's own session.
- **Not a merge of the two tables yet.** #277 weighed one documents table for people and matters
  and chose to build the person table first with nothing that fights the later merge. That still
  holds: a `content` column and a `counsel_only` column on the matter table are what a merge would
  carry over; nothing here forecloses it.

## Where it plugs in

- `legal_matter_documents` (`20261030030000`), the `legal-matter-documents` bucket, the desk's
  Evidence tab and the firm portal's read (`legal-portal`, #85).
- `plan_matter_document` / `apply_matter_document` (v2.6004), `plan_mail_file` (v2.6568).
- `hr_doc_sections`, `hrDocMarkdownToSafeHtml`, `get_person_document`'s section grammar
  (v2.6621); `dev_case_search` (v2.6620).

## The plan

| PR | What | Size |
|---|---|---|
| 1 | `content` on a matter document; the desk, the seat and the mail door keep text for a text file; the desk and the portal render it; `dev_case_search` searches it by section. Migration, `legal-portal` and `dev-mcp` redeployed. | S |
| 2 | `counsel_only` on a matter document: the tick on the desk's add form, the seat's and the mail door's field, the portal's list and packet refusing it, the agent role's policy, the lock chip on the row, `ACCESS_CONTROL.md` and `docs/HR_FILES.md` stating the limit. | S |
| 3 | The seat reads a matter document by section (`get_matter_document { matter_id, doc_id, section? }`) and `search_case` hits on it carry the section, as a named document's do. | S |

## How to verify

On a test matter: file a made-up `.md` through the seat; the desk renders it; `search_case` for a
phrase inside it returns a `matter_document` hit with the section. Tick counsel-only on a second
document: the portal's list as the test firm omits it, the packet omits it, the agent role's read
returns nothing, the dev's read marks it. File a PDF: `content` stays null and the title still
searches.
