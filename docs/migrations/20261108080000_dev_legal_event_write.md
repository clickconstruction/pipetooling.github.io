# 20261108080000 — dev_legal_event_write (v2.6682)

The dev MCP's dry-run wrapper for recording what happened on a legal matter: `plan_matter_event` → `apply_matter_event` in `dev-mcp` (punch list #169, `to-dos/dev-mcp-legal-documents-and-events/`, step 2; the document verbs shipped as v2.6004). One `SECURITY DEFINER` function, `dev_legal_event_write(p jsonb, p_dry_run boolean DEFAULT true)`, gated `auth.uid()` + `is_dev()`, closed to `anon`, modeled on `dev_legal_plan_write` (`20261023195135`), writing through #167's `legal_event_add` (`20261025120000`, v2.5836) with `p_source = 'mcp'`.

- `p = { matter_id, on, body, notes?, document_ids? }`: the day it happened (`YYYY-MM-DD`, never ahead of `app_today()`; a day ahead is refused with *plan a step instead*), what (under 500 characters), notes (under 4,000), and the Evidence documents that prove it — every id a live `legal_matter_documents` row of the same matter, the missing ones named in the refusal.
- The dry run returns the matter, the event as it would be written (`after`, with the documents by title and whether each is held from the firm), `events_on_matter` (the matter's live event count, so an event recorded since the plan changes the hash) and `firm_reads_it`.
- The write calls `legal_event_add` as the caller: the row lands as kind `event` with `meta = { notes, document_ids, source: 'mcp' }`, and the desk's Timeline tags it *dev MCP*. The office undoes it with **Undo…** (`legal_void_entry`); the seat has no undo verb.
- No table is created, so no fence is owed; training mode is blocked by the entries table's statement trigger inside `legal_event_add`.

Deploy order: push this migration, then `supabase functions deploy dev-mcp` (server 0.40.0). `find_rpc` lists it once `npm run gen-types:linked` and the catalog rebuild land as their own `chore(types)` PR; `dev-mcp` calls it by name and needs neither.
