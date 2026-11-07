---
name: "Named documents on the HR file: any number of titled markdown documents beside the summary and narrative, edited in the app or by the seat a section at a time, with a counsel-only mark and a file door for the long ones"
number: 277
group: close
status: LIVE 2026-11-07 · PR 1 the table and the seat's door (v2.6613, #7181, migration 20261107040000 pushed, dev-mcp deployed), PR 2 the Documents view with Add a document (v2.6614, #7182) and PR 3 the citations as doors (v2.6615, #7185) merged and deployed; the Documents view walked on prod after the deploy (the tab, the pinned pair, the three doors, the From a file form), nothing added.
summary: >
  A person's HR file keeps two documents the agent writes from the entries, a one-page summary
  and the chronological narrative, and since v2.6610 a dev edits either in the app while the seat
  edits them by section. Everything else written about the person has no home: two long documents from a
  case folder, each a few hundred kilobytes, went onto the file this week as evidence
  records with Drive links, which the app can neither render nor edit, and #275 reached for a
  third fixed kind to hold one of them. The next such document would need a fourth. One shape
  instead: named documents, any number a person, each a titled markdown text with the same
  editor, the same revision trail, the seat's same section ops by document id, a counsel-only
  mark, and a door that takes a .md or .txt file off the desk so a long document never rides
  through an agent's context. The view the two fixed documents share becomes Documents, with
  Summary and Narrative pinned at the top as the two the agent keeps.
next: Taunya adds the case's two long documents by From a file on the person's Documents view; then her and Micah's two calls on the card: archive a named document in the app, and whether the two Drive-linked evidence records are retired once the documents are in. Delete this card after.
size: M + M + S
blocker: None.
mockup: mockup.html — the Documents view with the two pinned documents and the named list, Add a document's three doors, one document open with its section index and Edit the document, the counsel-only mark, and the seat's plan reply by document id
opinion: build — the summary and narrative stay the two derived documents with their freshness and the agent's routine; everything else written about a person is a titled document, and the app already has the editor, the renderer, the revision trigger and the seat verb to carry it. The alternatives below were weighed and lose on either editing or scale.
---

# Named documents on the HR file (#277)

## The ask

2026-11-07, after the week's import of a former teammate's case folder onto People → HR and the walk of the live editor: two long documents about the person, the owners' history of their time and a knowledge base, sit on the file as evidence records with Drive links. The app opens them in Drive and cannot render, edit or revise them. Taunya asked whether users should be able to make text files for the narrative, and whether those should be the HR file's default documents. The answer: named documents beside the two fixed ones, not in their place.

## The decision

- **Summary and narrative stay fixed and derived.** The summary carries a covered-through date, a current or stale state, the count of entries it covers and the amber line when entries outrun it; the narrative is the one chronological story with its jump list; the agent's routine in `docs/HR_FILES.md` is written around exactly those two. A free list of narratives would leave the freshness kernel and the agent nothing fixed to stand on. They keep `person_files`.
- **Named documents are a list, not a third kind.** A new table, `person_documents`: `id`, `person_id`, `title`, `content` (markdown or plain text, the renderer takes both), `counsel_only`, `author_label`, `created_by`, `updated_by`, `updated_at`, `archived_at`; its own revisions table and the same `BEFORE UPDATE` archive trigger as `person_files` (`20260824141540`), so every save keeps the prior version; dev-only RLS like the rest of the HR tables, and the four fence appliers. The limit is 1,000,000 characters a document; the two long ones this week were a few hundred kilobytes each.
- **One editor, one renderer, one seat door.** The in-app editor from v2.6610 (the box, the words under it, *How it will read*, Save with the loaded `updated_at`) takes a document id as well as a kind. `dev_person_doc_write` (`20261107013000`) takes `doc_id` in place of `kind`, or `title` to make a new one, with the same section ops (`replace_section`, `insert_after`, `append`), the same dry run, the same stale refusal. `get_person_file` lists the documents (title, size, sections, kept by, counsel mark) and reads one on request.
- **A file door, so long documents never ride through an agent.** *Add a document* offers *Write it*, *From a file* (a `.md` or `.txt` picked off the desk, read in the browser, saved through the same RPC) and *Paste text*. This is how the two case-folder documents land: Taunya picks the file. A document of a few hundred kilobytes costs an agent hundreds of thousands of tokens a call when sent whole, which is why the Drive link was the only door this week.
- **A counsel-only mark on the document.** The same lock the evidence records wear (v2.6554): the document shows its chip, is left out of any print or copy for a third party, and the seat's reads say so. Passages inside a document keep the `[C] COUNSEL-ONLY` tag the week's app copies carry; the mark is for a document that is counsel-only whole.
- **The view is Documents.** The tab named *Summary & narrative* since v2.6612 becomes *Documents (n)*: the two pinned documents first, under *Kept by the agent*, then *Named documents* newest first, then *Add a document*. A document opens in place of the list with a *‹ Documents* door, its section index on the left (the `##` headings, as the narrative's jump list reads them), the reading pane on the right, *Edit the document*, *Copy as text*, and the lock chip when it is counsel-only.
- **Open, Taunya's and Micah's:** whether a named document can be archived in the app (the row keeps `archived_at`; the press is a one-liner either way); whether the two Drive-linked evidence records are retired once the documents are in (a note on each, nothing deleted).

## Is this the best we can do?

Four other shapes were weighed.

| Shape | Why not |
|---|---|
| **A third fixed kind, `history` (#275)** | Holds one document; the knowledge base, the intake memo and the interview guide would each need a kind of their own. The section index and the citation doors #275 designed carry over unchanged to a named document. |
| **Render the Drive-linked files in the app** | The server could fetch a linked `.md` through the service account and the app could draw it. No editing, no revisions, no section ops, a round trip to Drive on every open, and a 350 KB read each time. Reading only. |
| **Store them as files in the HR bucket, like the matter's Evidence documents** | The viewer draws a text file, but an edit is a new file, revisions are copies, the seat's section ops have no row to work on, and the counsel fence has nothing to mark. Right for a PDF or a recording; wrong for a text the office keeps changing. |
| **One documents table shared by HR files and matters** | The cleaner long-term shape, with an owner kind and id. The matter's own text today is one `narrative_md` column and its documents are bucket files; folding them in means a migration of live matter rows and a second editor surface in one PR. Build the person table now with nothing in it that fights that later merge (no kind column, a plain owner id), and let a matter's text documents join when the Legal desk asks for them. |

Two things this plan does not do, on purpose. It does not search across documents (the browser's own find works inside one; a search across the file is its own item). It does not print or export a document for a third party beyond *Copy as text*; a document that leaves the circle is the matter's business.

## Where it plugs in

- The two fixed documents: `person_files`, `person_file_revisions` and the trigger (`20260824141540`); the loader `src/lib/people/personTimelineIo.ts` (`docs.summary` / `docs.narrative`); the view and editor in `PersonFilePanel.tsx` (`renderDoc`, `docEdit`, `saveDoc`, v2.6610); the kernel `src/lib/people/hrDocEditor.ts`; the renderer `src/lib/people/hrDocMarkdown.ts` (`hrDocMarkdownToSafeHtml`, `extractHrDocHeadings`).
- The seat: `dev_person_doc_write` and `hr_doc_headings` (`20261107013000`); `plan_person_doc` / `apply_person_doc` in `supabase/functions/_shared/devMcpWrites.ts` and `dev-mcp/index.ts`; `get_person_file` in `_shared/personTimeline.ts`.
- The counsel-only mark: `person_file_evidence.counsel_only` (v2.6554) and its chip in the panel; `docs/HR_FILES.md`.
- The citations (PR 3): `person_file_entries.content` basis lines (`N§16`), the Timeline kernel `supabase/functions/_shared/personTimeline.ts`.

## The plan

| PR | What | Size |
|---|---|---|
| 1 | Migration: `person_documents` and `person_document_revisions`, the archive trigger, dev-only policies, the four fence appliers; `dev_person_doc_write` takes `doc_id` (an existing document) or `title` (a new one) beside `kind`, with `counsel_only?`; `hr_doc_headings` unchanged. `plan_person_doc` / `apply_person_doc` carry the new fields; `get_person_file` lists documents and reads one by id; the writes test, `docs/dev-mcp/README.md`, `docs/HR_FILES.md`, `docs/migrations/`. | M |
| 2 | The Documents view in `PersonFilePanel.tsx`: the tab, the pinned pair, the named list with the lock chip, *Add a document* (write it, from a file, paste), the open document with its section index, *Edit the document* through the v2.6610 editor by id, *Copy as text*; `personTimelineIo` loads the list; `hrDocEditor.ts` grows the file reader (size and type checks, the words); render smokes; the help guide *keep private employee files* gains *Keep a named document*. Then the two case-folder documents land through *From a file*. | M |
| 3 | #275's third PR, kept: an entry's `N§16` becomes a press to that section of the named document it cites, and a section shows *cited by n entries* as chips that open the Timeline on the entry. | S |

PR 2 calls the RPC shape PR 1 creates, so PR 1's migration is pushed right after its merge, before PR 2 deploys.

## How to verify

PR 1: the writes test holds the new fields and refusals; a dry run on the dev server's seat against a made-up person names the new document and its sections; the migration's bed makes a document, edits a section, reads the revision, and sees a non-dev refused. PR 2: the smokes walk Add a document from a file (a fixture `.md`), the open document's index, an edit and a stale refusal; then the dev server as the dev on a made-up person, with nothing saved on a real one. PR 3: a fixture entry citing `§3` opens the section; a section with two citing entries shows two chips.
