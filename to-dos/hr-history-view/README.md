---
name: "The HR file's History view: a long account of a person read by section, with the sections the entries cite, a held section named, and the seat's door for the long documents"
number: 275
group: ready
status: planned 2026-11-06 · nothing built · follows #269, whose load left the company history on the owner's desk waiting for a view
summary: >
  A case folder on a former teammate carries a 250 KB company history in thirty-six dated sections,
  the account the owners dictated and polished over three months. The HR file has a one-page summary
  and a chronological narrative, both rewritten in full and read as one scroll, and neither holds a
  document of that length readably. The Timeline's entries already cite the history's sections by
  number in their basis lines, so the two records point at each other with no door between them.
  One view: a third long document on the file, kind history, read one section at a time from a
  dated index, each section naming the entries that cite it and opening the Timeline on its month,
  a counsel-held section shown as held with nothing of it on the page, and the seat's plan then apply
  door for the long documents so the agent files them the way it files everything else.
next: the owner's two calls (History beside Narrative or in its place; the view read-only in the app with the seat as its one writer); then PR 1 the kind and the view, PR 2 the seat's door, PR 3 the citations as doors.
size: M + S + S
blocker: None.
mockup: history-mockup.html — the History tab beside the file's others, the dated section index with a held section, the reading pane with the entries that cite the section and the door to the Timeline, and the seat's plan reply
opinion: build — the entries are the record and stay so; the history is the owners' account of them, which counsel reads first and the office reads to remember, and it belongs on the file the way the narrative does, only readable at its length; the one thing to settle first is whether it replaces the narrative, since both tell the same story at two lengths
---

# The HR file's History view (#275)

## The ask, in the owner's words

2026-11-06, at the end of the folder's import through the seat: the HR file holds the facts (175 entries), the exhibits (45 evidence records) and the matter (a narrative, five steps, six documents, the themes), and one piece of the folder is still on the desk — "the company history (245 KB, waits for a History view)". The same evening: "lets do the theme marks, Ev #23, the company history, the People drive Manager role, and the three UI views", the History view among them.

## What the history is

A markdown document in thirty-six sections, each a dated chapter with a heading (*§16 Bidding conduct, office behavior, and the "six companies"*), written once and extended with dated notes as recordings were transcribed, with a changelog at the top. Five of its passages are counsel-only, marked in prose rather than with a fence. The Timeline's entries cite it by section (*Basis: FH — N§16*), as they cite the evidence by number (*Ev #21*). It is the account; the entries are the record.

## The decision

- **A third long document, not a bigger narrative.** `person_files` keeps a summary (a page) and a narrative (the story, extended at the bottom); both are rewritten in full and read as one scroll, and prior versions archive by trigger (`person_file_revisions`). The history joins them as `kind = 'history'`, same table, same archive, same markdown door — so the loader, the freshness dots and the agent's rewrite habit need nothing new. Rejected: a matter document, which the firm would receive whole and which has no section index; a folder of entries, which would say the same thing twice.
- **Read by section.** The view draws an index from the `##` headings — the section's number, its title, the date or span it covers, its first line as a lede — and one section at a time in the reading pane, so a 250 KB document never lands in the DOM at once and a reader always knows where they are. A pick writes `section=` into the address, as By theme writes `theme=`, so a link opens the same place.
- **The citations become doors, both ways.** An entry's basis line already names the section (`N§16`); the kernel reads those references and the section shows *cited by 7 entries* as chips that open the Timeline on the entry, and the entry's line shows the section as a door. Nothing new is written: the references are in the text today.
- **A held section is named, not shown.** The app copy is scrubbed before it is filed, and where a section is counsel-only the document carries a fence (`:::counsel … :::`) in place of the words; the view draws the section in the index with a lock and the words *Held with counsel; nothing of it is on this page*, so the index stays complete and the hold is visible. The seat strips the fence's body before it writes, so a copy that was not scrubbed by hand cannot leak through the door. The hold binds the app and the seat; the folder keeps the whole.
- **The seat's door for the long documents.** `plan_person_doc(doc)` → `apply_person_doc(doc, plan_hash)`, `doc = { person_id, kind: summary | narrative | history, markdown, covered_through? }`: the plan replies with the section count, the bytes, the held sections and the sections the entries cite; the hash commits to the text as it would be written and the live revision, so apply writes only when nothing moved. Through a dry-run wrapper over the docs' own RPC, as every other write.

Open, the owner's: whether the history replaces the narrative on a file that has both (one story at two lengths), or sits beside it under its own tab; whether the view is read-only in the app and written only through the seat, as the summary and narrative are in practice.

## Where it plugs in

- The documents: `person_files` (`kind`, `content`, `covered_through`), `person_file_revisions` (the archive trigger, v2.2232), the loader `src/lib/people/personTimelineIo.ts` (`docRows` → `docs.summary` / `docs.narrative`), the Narrative view's renderer (`marked` + the contract sanitizer, the jump list from `##` headings) in `src/components/people/personFile/PersonFilePanel.tsx`.
- The entries' citations: `person_file_entries.content` basis lines (`N§16`, `Ev #21`), the Timeline kernel `supabase/functions/_shared/personTimeline.ts` and its lines' `ref`.
- The view's siblings: Timeline · Evidence · Narrative · By theme (`PersonThemesView.tsx`, the address pattern) · Matter (`PersonMatterPanel.tsx`), the view tabs in `PersonFilePanel.tsx` (`PersonFileView`).
- The seat: `supabase/functions/_shared/devMcpWrites.ts` (`WRITE_VERBS`, the plan hash and reply), `supabase/functions/dev-mcp/index.ts` (the tool list and the write branch), `docs/dev-mcp/README.md` (the verbs table), the docs' RPC the HR agent writes through today.
- The counsel-only hold's words: `docs/HR_FILES.md` (v2.6554, the stated limit).

## The plan

| PR | What | Size |
|---|---|---|
| 1 | `kind = 'history'` accepted by the docs' RPC and read by the loader; the kernel `personHistorySections` (the `##` sections with number, title, span, lede, the `:::counsel` fence read as held, the `N§n` citations matched from the entries); the **History** view beside the file's others — the index, the reading pane one section at a time, the held marker, `section=` in the address; render smoke; `HR_FILES.md` → the tab and the docs; the guide *keep private employee files* | M |
| 2 | The seat's `plan_person_doc` → `apply_person_doc` for the three kinds, the fence's body stripped before the write, the plan naming the held sections and the cited ones; `docs/dev-mcp/README.md`; the import of the folder's history through it on the owner's *Apply it* | S |
| 3 | The citations as doors: an entry's `N§n` becomes a press to the section on the History view, and a section's *cited by* chips open the Timeline on the entry, lit; `Ev #n` the same onto the Evidence record | S |

## How to verify

Each PR: the kernel's tests (sections from a fixture with a fence and a changelog; citations matched and unmatched), the view's render smoke, the help-guide and release-note suites, typecheck and lint; then the dev server as the dev on a real person's file at 375, 768 and 1280 px, with screenshots. PR 2's door: a plan reply quoted into an apply on a throwaway person, the held section absent from the row, then a correcting write. Gotcha: the renderer's sanitizer must pass the fence's marker through to the view and never its body.
