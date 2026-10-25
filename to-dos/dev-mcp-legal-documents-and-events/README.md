---
name: "Dev MCP: put documents and past events on a Legal desk matter"
number: 169
group: gated
status: proposed 2026-10-24 · rank 4 of 10 from the review of the Burd matter (job 891) · not built
summary: >
  The dev MCP writes a matter's narrative and its planned steps but cannot add a document or
  record an event, so a Claude session filing a case has to drive the desk in a browser, and a
  person has to pick every file in the file dialog. Add plan-then-apply verbs for both: a document
  goes up through a signed upload URL and is checked before its row is written, and an event is
  the office's new entry from #167.
next: >
  The owner picks Do, Later or Drop. #167 decides the event's kind before the event verbs.
size: M (two definer RPCs, the upload path, four verbs, the docs)
blocker: >
  The owner's pick, and #167 for the event verbs.
opinion: build — filing job 891 took a session in the browser pane plus the owner picking seven PDFs by hand
mockup: not required — MCP verbs; the desk already shows what they write
---

# Dev MCP: put documents and past events on a Legal desk matter

## The ask

The owner, 2026-10-24, after filing Click v Burd & Assoc. (job 891) on the Legal desk: *"Are
there features that if we had added to the legal desk would have made this recording of the burd
situation better?"* The review found ten, ranked by what each would have saved on job 891, and the
owner asked for each as a to-do with the Burd case as its example. This is rank 4.

## What happened on job 891

Filing the case on 2026-10-24 used the dev MCP for nothing but the narrative and the planned
steps, because that is all it writes. The session drove the desk in the desktop app's browser
pane instead. That pane cannot read files from the computer beside it, so the owner picked the
seven PDFs in the file dialog by hand, and the five past events went in as planned steps marked
done.

## What exists today

- `supabase/functions/dev-mcp/index.ts` and `supabase/functions/dev-mcp/catalog.ts`:
  `plan_matter_narrative` / `apply_matter_narrative` over `dev_legal_narrative_write`
  (`supabase/migrations/20261007235000_dev_legal_narrative_write.sql`), and
  `plan_matter_plan_item` / `apply_matter_plan_item` over `dev_legal_plan_write`
  (`supabase/migrations/20261023195135_legal_plan_items.sql`, v2.5800). Both dry-run first and
  write with `source = 'mcp'`.
- The documents bucket and the add path in `src/lib/legal/legalMatterDocumentsIo.ts` (the file
  under `legalDocumentStoragePath`, then the row).
- `docs/dev-mcp/README.md`.

## The proposal

- `plan_matter_document` takes the matter, the title, the *shows* line, and the file's name, size
  and type (and its day, once #168 lands). It returns what the row will say, whether the firm
  reads it, and a signed upload URL for the file's path. The agent PUTs the bytes.
  `apply_matter_document` checks the object is there with the planned size and type, then writes
  the row with `source = 'mcp'`. An upload never applied is removed by apply's sweep.
- `plan_matter_event` / `apply_matter_event`: the event from #167 (day, what, notes, document ids).
- Both audited like the narrative and plan verbs; the desk shows *· dev MCP* beside what they wrote.

## Open decisions

- A signed upload URL (no size limit on the MCP call) or base64 in the call (simpler, but a 5 MB
  PDF is about 7 MB of text).
- Whether the MCP may add a document already held from the firm.

## Where it plugs in

Existing: the dev MCP's plan-then-apply pattern, the bucket, the documents table, the audit. New:
`dev_legal_document_write`, `dev_legal_event_write`, the four verbs, their catalog entries, the
docs.

## Plan

1. The document verbs: migration, function, catalog, docs. M.
2. The event verbs, after #167. S.

## How to verify

From a Claude session with the dev MCP, on a ZZ TEST matter: plan a document, PUT a small PDF to
the URL, apply. It shows on Evidence with *· dev MCP*. An apply whose file does not match the plan
is refused and writes nothing.
