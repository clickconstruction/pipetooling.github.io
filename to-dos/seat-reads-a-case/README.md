---
name: "The seat reads a case the way an agent reads a folder: one brief, a search across the record, a document by section, a document's history, and section ops on the matter's narrative"
number: 278
group: residual
status: LANDED 2026-11-07 · the five PRs merged (v2.6619–v2.6623), all five migrations pushed, dev-mcp deployed, types and catalog regenerated (#7225), and walked on prod on a real person's file reading only: the brief (nothing held), the search (hits named by section), a section read, the history and a narrative dry run all answer. The walk found the history's diff of a long narrative overrunning the door's 80,000-character cut; fixed as v2.6642 (#7227, dev-mcp 0.38.1: a 40,000-character cap beside the 400 lines) and walked again whole.
summary: >
  An agent given a case folder reads one page that says what is where, greps for a word, opens a
  long document at the section it needs, and keeps its own notes beside the record for the next
  session. Given the same case in the app, the seat makes six or seven reads to learn what the
  README said in one, filters one table at a time instead of searching, hands a document back whole
  (two of this week's are a quarter and a third of a megabyte, which is why they went in as Drive
  links), reads no revision, and leaves the agent's notes in a file outside the app. Five reads
  close that, in order of value: get_case_brief, search_case, get_person_document by section,
  get_document_history with a since on the list, and the matter narrative's section ops. No screen
  changes; a convention for the agent's notes rides on named documents.
next: Two follow-ups only, neither started: a reference form from an HR entry to a development's day (the way N§16 reaches a narrative section), and the brief as a page in the app. Delete this card when both are built or dropped.
size: S + S (the two follow-ups)
blocker: None.
mockup: not required — verbs on the seat, no screen changes; the brief's shape is written below as the reply it returns
opinion: built and merged — push the two migrations and deploy the seat the same day, since get_document_history and the narrative's ops call a function only their migration creates or widens.
---

# The seat reads a case the way an agent reads a folder (#278)

## Where it stands

Five PRs opened 2026-11-07, each from `main` alone (not stacked), all five merged the same day in order, each with its migration, its kernel over the injected `Reader` with unit tests, the catalog lines, the two docs lines, a release note and a fragment, and the seat's `SERVER_VERSION` bumped:

| PR | Verb | Version | Server | Migration | Branch |
| --- | --- | --- | --- | --- | --- |
| 1 · #7192 | `get_case_brief(person)` | v2.6619 | 0.34.0 | `20261107060000_case_brief_indexes` (the views' `headings` column, `hr_doc_heading_index`) | `claude/278-pr1-case-brief` |
| 2 · #7193 | `search_case(person, q, in?, limit?)` | v2.6620 | 0.35.0 | `20261107070000_case_search` (`hr_doc_sections`, five GIN indexes, `dev_case_search`) | `claude/278-pr2-search-case` |
| 3 · #7194 | `get_person_document(person, doc_id? or kind?, section?)` | v2.6621 | 0.36.0 | `20261107080000_doc_read_by_section` (`dev_doc_read`) | `claude/278-pr3-doc-section` |
| 4 · #7195 | `get_document_history(person, doc_id? or kind?, from?, to?)` and `changed_since` on `get_person_file`'s documents | v2.6622 | 0.37.0 | `20261107090000_doc_history` (`dev_doc_history`; the diff is computed in the kernel) | `claude/278-pr4-doc-history` |
| 5 · #7197 | `plan_matter_narrative` / `apply_matter_narrative` take `ops` and `expect_updated_at` | v2.6623 | 0.38.0 | `20261107100000_matter_narrative_ops` (`hr_doc_apply_ops`, `dev_legal_narrative_write` replaced) | `claude/278-pr5-narrative-ops` |

What the plan above called "the narrative the same way" in PR 3 is in PR 3 by `kind: narrative` (the summary too); the `since` of PR 4 landed as `changed_since` on the documents list, read from the ask's existing `since`. No table is created, so no fence appliers; `SET lock_timeout` opens every migration.

**The merges.** All five changed the same `SERVER_VERSION` line, the same pinned test lines and the same spot of `docs/dev-mcp/README.md` and `docs/EDGE_FUNCTIONS.md`, so after #7192 landed each next PR had `main` merged into it (the later version line kept, every seat line kept, a blank line between the seat's blockquotes), tests and `check:edge-bundles` run, and was queued alone: #7193, then #7194, #7195, #7197. Three of the five migrations reached prod with other sessions' pushes the same day (`20261107060000`, `070000`, `080000`); `20261107090000_doc_history` and `20261107100000_matter_narrative_ops` are pending, and the live seat still answers 0.33.0 until `supabase functions deploy dev-mcp`. Then regenerate the catalog and walk.

Not built: the two follow-ups below; a matter document's file body in `search_case` (its title and what-it-shows line are searched; the body joins when the write keeps a text column).

## The ask

2026-11-07, after a case folder went onto a person's HR file and matter through the seat: Taunya wants an agent to gain its context from the app the way it does from a folder, answer quickly and well, and update what needs updating. The gaps below are the ones that cost the most during that week's work.

## What the agent has today

- `get_person_file(person)` — the file whole: the Timeline's lines, the fact chips, the evidence records, the summary and narrative, and since v2.6613 the named documents' list (title, size, sections, counsel mark) without their text.
- `read_rows` with filters, one table at a time; `find_person`, `get_job`, `get_history(development_id)` for a development's History whole.
- `plan_person_doc` → `apply_person_doc` by section (v2.6608, #277); `plan_matter_narrative` by whole text; `plan_theme_marks`, `plan_person_evidence`, `plan_matter_document` and the rest.

## The five reads

### 1. `get_case_brief(person)` — one page that says what is where (M)

One reply of a few kilobytes, every item with its id for a drill-in, in this order:

```
{ person: { id, name, kind, start, end },
  agent_notes: { doc_id, updated_at, first_lines } | null,      -- the named document titled "Agent notes", when one exists
  summary: { chars, updated_at, state: current | stale, text },  -- the summary whole; it is a page by rule
  narrative: { chars, sections: [{ n, heading, line }] },
  documents: [{ id, title, counsel_only, chars, sections: [{ n, heading, line }], updated_at }],
  entries: { count, first, last, by_source: {...}, newest: [{ id, ymd, first_line }] },     -- the newest ten
  evidence: [{ id, dated_on, title, counsel_only, files: n }],
  matter: { id, stage, narrative: { chars, sections }, steps: [{ id, on, body, done }], documents: [{ id, title, state, dated_on }] } | null,
  themes: [{ id, name, marked: n, proposed: n }],
  developments: [{ id, name, headlines: [{ at, first_line }] }],   -- the developments the person's entries or jobs name, their History's newest five lines
  read_next: 'read_rows on person_documents (select content) by id, or get_person_document by section; get_history for a development; get_person_file for the Timeline whole.' }
```

Rests on the reads the seat already makes (`devMcpPersonFile.ts`'s reader over `person_file_entries`, `person_file_evidence`, `person_files`, `person_document_index`, `legal_matters` by `person_id`, `legal_matter_entries`, `legal_matter_documents`, `legal_theme_marks`, `dev_history_read`), composed in a new `_shared/devMcpCaseBrief.ts` kernel over the injected `Reader`, the way `devMcpComposites.ts` composes `get_job`. The section indexes come from `hr_doc_headings` through `person_document_index` (a second view column, `headings jsonb`, or one RPC `dev_doc_sections(doc_id | kind)`), never from the text through the seat. Dev-only as the file is; a non-dev gets the papers and `held: dev only`, as `get_person_file` does. Counsel-only documents and records appear with their mark and no text. The agent's notes: a convention, not a kind — a named document titled *Agent notes*, kept by the seat through `plan_person_doc`, which the brief returns first and which the next session reads before anything else; `docs/dev-mcp/README.md` says so.

### 2. `search_case(person, q, in?)` — grep over the record (M)

One Postgres full-text search, dev-only, over: `person_file_entries.content`, `person_file_evidence.title` and `memo`, `person_documents.content`, `person_files.content`, the matter's `legal_matters.narrative_md`, `legal_matter_entries.body`, and the text of the matter's text/markdown documents (their bytes sit in the `legal-matter-documents` bucket; either the file index of punch list #240 extended to that bucket, or a `text` column filled at write for `text/*` documents, which `dev_legal_document_write` can fill since it already reads the bytes). The reply: hits with the table, the id, the day, the section the hit sits in (for a document, by `hr_doc_headings`; for the narrative, the same), a snippet with the match marked, and the counsel mark — marked, never hidden from a dev. A GIN index on each `to_tsvector('english', …)` column, a migration with the four fences untouched (no table). `in?` narrows to one source. Rests on a definer RPC `dev_case_search(p_person_id, p_q, p_in)` gated `is_dev()`.

### 3. `get_person_document(doc_id | kind, section?)` — a document a piece at a time (S)

Without `section`: the index — every heading with its number, level, line and the section's character count. With `section` (a number as `headingNumber` reads it, or a heading's text): that section's text alone, with the sections before and after named. Rests on `hr_doc_headings` and one RPC `dev_doc_section(p_doc_id, p_kind, p_section)` that slices the text server-side, so a 300 KB document never crosses the door whole. The same verb reads the summary and narrative by `kind`. The seat's `plan_person_doc` ops already name sections the same way, so read and write use one grammar.

### 4. `get_document_history(doc_id | kind, from?, to?)` and `since` on the list (S)

The revisions of a document (`person_document_revisions`, `person_file_revisions`): time, who replaced it, size before and after, and the first changed line; with `from` and `to` (two revision ids, or a revision and *now*), the diff as unified text, capped. The documents list in `get_person_file` and in the brief takes `since` (YYYY-MM-DD) and marks each document `changed_since: true | false`, so "what moved since Tuesday" is one call. Rests on the revisions tables (devs read them already) and a definer RPC for the diff (`dev_doc_diff`), or the diff computed in the kernel from two revisions' text.

### 5. `plan_matter_narrative` takes section ops (S)

The matter's narrative is edited whole (`dev_legal_narrative_write`, v2.4814). Give it `ops` — `replace_section`, `insert_after`, `append` — with the same dry run (the words removed and added, the headings after) and the same `expect_updated_at` guard as `dev_person_doc_write`, so an agent that extends the account for the firm sends one section, not the whole text.

## Follow-ups, not in this card

- A reference form from an HR entry to a development's day, the way `N§16` (v2.6615) reaches a narrative section — `D:Gun Dog 2026-05-24` or a job number — drawn as a press on the Timeline and read by the brief into `developments`.
- The brief as a page in the app, for a dev who wants the same orientation a session gets.

## Where it plugs in

- The seat: `supabase/functions/dev-mcp/index.ts` (the read verbs beside `get_person_file`), `_shared/devMcpPersonFile.ts` (the reader and `held` pattern), `_shared/devMcpComposites.ts` (the composite shape), `docs/dev-mcp/README.md` (the verbs table), `docs/EDGE_FUNCTIONS.md`.
- The documents: `person_documents`, `person_document_index`, `person_document_revisions`, `person_files`, `person_file_revisions`, `hr_doc_headings` (`20261107013000`, `20261107040000`); the client's `src/lib/people/hrDocMarkdown.ts` (`extractHrDocHeadings`, the same reading) and `hrDocCitations.ts` (`headingNumber`).
- The matter: `legal_matters.narrative_md`, `legal_set_narrative`, `dev_legal_narrative_write` (`20261007235000`), `legal_matter_documents` and the `legal-matter-documents` bucket, the file index (`to-dos` #240).
- The developments: `dev_history_read`, `get_history`.

## How to verify

Each verb gets a test over a fake reader the way `src/lib/devMcp/devMcpPersonFile.test.ts` does: the brief from one made-up person with two documents, a matter and a development (every id present, the agent's notes first, counsel-only items marked with no text, a non-dev held); the search over a fixture with a hit in each source and its section named; a section read that returns one section with its neighbours and refuses a number the document lacks; the history with two revisions and their diff; the narrative's ops against a fixture with a repeated heading refused. Then the dev server's seat against a made-up person on prod, reading only.
