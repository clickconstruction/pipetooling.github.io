// search_case (v2.6620, punch list #278 PR 2): the grep an agent has over a folder, over a person's case in the app —
// one call of dev_case_search (migration 20261107070000) as the dev: the entries, the evidence titles and memos, the
// named documents and the summary and narrative a section at a time, and the matter's narrative, entries and
// documents — their titles and what-it-shows lines, and since v2.6716 (punch list #288) a text document's words by
// section. The kernel resolves the person the way get_person_file does, shapes the ask, and names the verb
// that reads each hit further. Dev-only: another role is refused in words, since the RPC refuses it too.
import type { Reader } from './devMcpComposites.ts'
import { resolvePerson } from './devMcpPersonFile.ts'

export type CaseSearchAsk = { person: string; q: unknown; in?: unknown; limit?: unknown }
export const CASE_SEARCH_SOURCES = ['entries', 'evidence', 'documents', 'summary', 'narrative', 'matter'] as const
export type CaseSearchSource = (typeof CASE_SEARCH_SOURCES)[number]

export type CaseSearchHit = { source: string; id: string; title: string | null; section_n: number | null; section: string | null; day: string | null; counsel_only: boolean; rank: number; snippet: string }
type RpcReply = { q: string; query: string; in: string | null; person_id: string; matter_id: string | null; count: number; shown: number; hits: CaseSearchHit[] }

/** What reads a hit further, by its source. */
export function readNextFor(source: string): string {
  switch (source) {
    case 'entry':
      return 'get_person_file (the Timeline) or read_rows on person_file_entries by id'
    case 'evidence':
      return 'get_person_file (evidence, with the files and Drive state)'
    case 'document':
      return 'read_rows on person_documents (select content) by id; change it with plan_person_doc { doc_id, ops } on the section named'
    case 'summary':
    case 'narrative':
      return 'read_rows on person_files (select content) by person_id and kind; change it with plan_person_doc { kind, ops }'
    case 'matter_narrative':
      return 'read_rows on legal_matters (select narrative_md) by id; change it with plan_matter_narrative'
    case 'matter_entry':
      return 'read_rows on legal_matter_entries by id'
    case 'matter_document':
      return 'the document on the matter\'s Evidence tab (read_rows on legal_matter_documents by id); a hit with a section is a text document\'s words — read_rows on documents (select content) by the row\'s text_document_id; a hit with no section is the title or what it shows, not the file'
    default:
      return 'read_rows on the source by id'
  }
}

export function caseSearchInput(ask: CaseSearchAsk): { ok: true; q: string; in: CaseSearchSource | null; limit: number } | { ok: false; refused: string } {
  const q = typeof ask.q === 'string' ? ask.q.trim() : ''
  if (!q) return { ok: false, refused: 'search_case needs q — words, "a phrase", or a word with -another left out (websearch syntax).' }
  if (q.length > 400) return { ok: false, refused: 'search_case: q is longer than 400 characters.' }
  const source = typeof ask.in === 'string' && ask.in.trim() ? ask.in.trim() : null
  if (source && !(CASE_SEARCH_SOURCES as readonly string[]).includes(source)) return { ok: false, refused: `search_case: in must be one of ${CASE_SEARCH_SOURCES.join(', ')}.` }
  const limit = typeof ask.limit === 'number' && Number.isFinite(ask.limit) ? Math.max(1, Math.min(100, Math.floor(ask.limit))) : 40
  return { ok: true, q, in: (source as CaseSearchSource | null) ?? null, limit }
}

export async function searchCase(reader: Reader, ask: CaseSearchAsk, who: { role: string }) {
  if (who.role !== 'dev') return { refused: 'search_case reads the HR file and the matter, which are dev-only; it does not search as another person.' }
  const input = caseSearchInput(ask)
  if (!input.ok) return { refused: input.refused }
  const resolved = await resolvePerson(reader, ask.person)
  if ('refused' in resolved) return resolved
  const person = resolved.person
  const reply = (await reader.rpc('dev_case_search', { p_person_id: person.id, p_q: input.q, p_in: input.in, p_limit: input.limit })) as RpcReply | null
  const hits = (reply?.hits ?? []).map((h) => ({ ...h, read_next: readNextFor(h.source) }))
  const bySource: Record<string, number> = {}
  for (const h of hits) bySource[h.source] = (bySource[h.source] ?? 0) + 1
  return {
    person: { id: person.id, name: person.name },
    q: input.q,
    query: reply?.query ?? null,
    in: input.in,
    matter_id: reply?.matter_id ?? null,
    count: reply?.count ?? hits.length,
    shown: hits.length,
    by_source: bySource,
    hits,
    note: 'A hit on a document names the section it sits in (section_n is the heading\'s number, when it carries one); the snippet marks the match with « ». A matter document kept as text (a .md or .txt) is searched by section like a named document; a PDF, an image or an .eml is found by its title and what it shows alone. Counsel-only items are marked, not hidden; a counsel-only matter document\'s row and words are refused to the seat when read on, so the hit is all a session sees of it.',
  }
}
