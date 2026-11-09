---
name: "Counsel-only on a matter document, and the matter's documents as text the search can read"
number: 288
group: close
status: LIVE 2026-11-09 · the owner's pick of 2026-11-08, one documents table for people and matters · PR 1 the table and text documents (v2.6716, #7346), PR 2 the counsel-only mark (v2.6720, #7347), PR 3 the seat's section read (v2.6722, #7348) and the firm preview's Read here (v2.6770, #7416) merged; migrations 20261108210000, 20261108230000 and 20261108233000 on prod; legal-portal and dev-mcp 0.46.0 deployed; How to verify run on two ZZ TEST matters 2026-11-09 (Where it stands)
summary: >
  The Legal desk's matter is what the firm reads, so it is the natural home for anything written
  for the attorney. Two things keep that from working for a case on a person: a matter document
  is a file in a bucket, so the case search reads its title and its what-it-shows line and none of
  its words; and a matter document has no counsel-only hold, so the one document written for
  counsel alone, the intake memo's section held with counsel, had to live on the HR file and reach
  the attorney by hand. Give a matter document a counsel-only mark the firm's portal and the agent
  role honor, and let a text document on a matter be text, read by section and searched like a
  named document.
next: The owner's two calls under Where it stands: whether to stand up a ZZ test firm for the one leg not walked (the live portal as a firm), and whether to keep or archive the ZZ TEST rows the verify left. Then delete this card. Owed by this session: a types PR once #7427 lands, for the two new read functions.
size: M · PR 1 text on a matter document and the search union (S) · PR 2 the counsel-only mark on the document, the portal's and the agent's refusals (S) · PR 3 the seat's section reads on a matter document (S)
blocker: None.
ver: v2.6716 · 6720 · 6722 · 6770
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

2026-11-09, after the three PRs and the preview fix were live. Run as a dev through the seat, on the dev server against prod data in headless Chrome, and by read-only queries of prod's catalog. Every row written is a ZZ TEST row.

- **A text document through the seat.** A ZZ TEST matter opened on the ZZ Test Hand file. A made-up `.md` filed with `markdown` kept its words in `documents`, and its Evidence row points at them.
- **The search.** `search_case` for a phrase inside it returned one `matter_document` hit naming section 1. #285's file index also read the bytes, and that row was left out of the hits, so the line is found once.
- **The desk.** The matter's Evidence tab showed **Read** on the memo and drew it with its two headings. The PDF had no Read. The counsel-only row wore the lock.
- **Counsel-only.** The seat's `read_rows` on `legal_matter_documents` and on `documents` returned only the plain document; the counsel-only row and its words were refused. `search_case` returned that hit marked counsel-only. `hr_agent` holds no grant and no policy on either table. `get_matter_document` on it was refused with the count. On the ZZ TEST GC matter, the release sheet's **Preview what the firm sees** showed both counsel-only papers locked, with *For counsel alone. Not in the printed packet.*
- **A PDF.** Filed as bytes, it kept no text and was found by its title alone. `get_matter_document` refused it as not a text document.
- **The section read.** `get_matter_document` on the memo gave the section index, then section 1 alone with its neighbours named.

**Found and fixed on the way.** The firm preview listed a text document with no **Read here**, because the desk never passed the words; v2.6770 reads them when the preview opens, and a re-walk showed three Read here presses. The queue's SQL beds refused PR 3's first migration (a doubled function header and a lost `DECLARE`); it was fixed and a test now holds each function whole.

**Not walked.** The live portal as a firm. No ZZ matter is released to a firm and there is no test firm; releasing one would reach a real firm's portal. The printed packet leaving a counsel-only paper out is held by `legalFirmPacketPrint.test.ts`.

**Left on prod.** The ZZ TEST matter on ZZ Test Hand with its three documents, the counsel-only memo on the ZZ TEST GC matter, and the ZZ TEST sink job flagged into Collections for the walk and back out.

**The landing (the loving-dewdney session, 2026-11-09 03:00 to 05:30 UTC).** Each migration was pushed alone with `--include-all`, since both stamps sit below the ledger's newest; each dry run and push prompt listed exactly one file, so none of #188's `dev_gates_*` set rode along. After PR 2, `dev-mcp` 0.45.0 went out as main's code with prod's own `catalog.ts` kept: the deployed catalog was a regen off prod ahead of main (the `documents` table, `settlement_only`, the `file_index` columns), and a plain deploy would have taken them off. After PR 3, main's catalog was ahead (#7411's regen), so 0.46.0 deployed straight from main. PR 3 carried the same server pin as #285's #7344; the two conflicted in the queue, #285's session dequeued #7344 to let PR 3 go first, and PR 3 merged after one re-arm. The main checkout at the repo root sat on an old feature branch, so the pushes ran from a worktree fast-forwarded to `origin/main` with the Supabase link state copied in.

**Watch.** #285's PR 2 (#7344) carries a `dev_case_search` body at `20261108220000`. It must drop that body or renumber after `20261108233000`, or a late push would wipe the counsel-only marks on matter-document hits.

