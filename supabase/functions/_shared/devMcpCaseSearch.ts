// search_case (v2.6620, punch list #278 PR 2): the grep an agent has over a folder, over a person's case in the app —
// one call of dev_case_search (migration 20261107070000) as the dev: the entries, the evidence titles and memos, the
// named documents and the summary and narrative a section at a time, and the matter's narrative, entries and
// documents — their titles and what-it-shows lines, and since v2.6716 (punch list #288) a text document's words by
// section. Since v2.6719 (punch list #285 PR 2, migration 20261108220000) the files too: every record file the index
// read (file_index, source hr_attachment or matter_document) is a `file` hit naming the record it hangs on; a text
// document's bytes are not a second hit. The kernel resolves the person the way get_person_file does, shapes the ask, and names the verb
// that reads each hit further. Dev-only: another role is refused in words, since the RPC refuses it too.
import type { Reader } from './devMcpComposites.ts'
import { resolvePerson } from './devMcpPersonFile.ts'

export type CaseSearchAsk = { person: string; q: unknown; in?: unknown; limit?: unknown }
export const CASE_SEARCH_SOURCES = ['entries', 'evidence', 'documents', 'summary', 'narrative', 'matter', 'files'] as const
export type CaseSearchSource = (typeof CASE_SEARCH_SOURCES)[number]

/** A hit; on a `file` hit `record_kind` (evidence | entry | file | matter_document), `record_id` and `record_title` name the record the file hangs on (null on every other source). */
export type CaseSearchHit = { source: string; id: string; title: string | null; section_n: number | null; section: string | null; day: string | null; counsel_only: boolean; rank: number; snippet: string; record_kind?: string | null; record_id?: string | null; record_title?: string | null }
/** v2.6713 (punch list #287): the record a document hit transcribes, so the agent cites the call by its record, not the document's title. */
export type CaseSearchEvidence = { evidence_id: string; evidence_day: string | null; evidence_title: string | null }
type RpcReply = { q: string; query: string; in: string | null; person_id: string; matter_id: string | null; count: number; shown: number; hits: CaseSearchHit[] }

/** What reads a hit further, by its source. */
export function readNextFor(source: string): string {
  switch (source) {
    case 'entry':
      return 'get_person_file (the Timeline) or read_rows on person_file_entries by id'
    case 'evidence':
      return 'get_person_file (evidence, with the files and Drive state)'
    case 'document':
      return 'read_rows on person_documents (select content) by id; change it with plan_person_doc { doc_id, ops } on the section named; a hit that carries evidence_id transcribes that record (get_person_file lists it with its files)'
    case 'summary':
    case 'narrative':
      return 'read_rows on person_files (select content) by person_id and kind; change it with plan_person_doc { kind, ops }'
    case 'matter_narrative':
      return 'read_rows on legal_matters (select narrative_md) by id; change it with plan_matter_narrative'
    case 'matter_entry':
      return 'read_rows on legal_matter_entries by id'
    case 'matter_document':
      return 'the document on the matter\'s Evidence tab (read_rows on legal_matter_documents by id); a hit with a section is a text document\'s words — read_rows on documents (select content) by the row\'s text_document_id; a hit with no section is the title or what it shows, not the file — a PDF\'s or .eml\'s own words are a file hit'
    case 'file':
      return 'the file\'s words: read_rows on file_index (select text) by drive_file_id = id (the record file\'s own id); the record it hangs on: get_person_file (evidence, record_id) or read_rows on legal_matter_documents by record_id; the file itself opens from the record\'s chip on People → HR or the matter\'s Evidence tab'
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
  const transcribed = await transcribedRecords(reader, person.id, reply?.hits ?? [])
  const hits = (reply?.hits ?? []).map((h) => ({ ...h, ...(h.source === 'document' ? transcribed.get(h.id) ?? {} : {}), read_next: readNextFor(h.source) }))
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
    note: 'A hit on a document names the section it sits in (section_n is the heading\'s number, when it carries one); the snippet marks the match with « ». A matter document kept as text (a .md or .txt) is searched by section like a named document. A file hit (source file) is a record\'s file the index read — a transcript linked from Drive, a staged .eml or PDF, a matter document\'s PDF or .eml: title is the file\'s name, record_kind / record_id / record_title the evidence record, entry or matter document it hangs on; in: files narrows to them. A file the index has not read is not found (a scan, a kind it does not read, one filed in the last ten minutes): read_file_index_status\'s by_why and records_without_rows say how many wait. A document that transcribes a recording carries evidence_id, evidence_day and evidence_title, the record to cite. Counsel-only items are marked, not hidden.',
  }
}

/**
 * v2.6713 (punch list #287): for the document hits, the record each transcribes — `person_documents.evidence_id` read
 * from the index view, the record's day and title from `person_file_evidence` — joined here so `dev_case_search`'s
 * body stays as it is. Fail-soft: a catalog that does not know the column yet, or a refused read, leaves the hits as
 * they were. A counsel-only record's title stays out, as the seat's other reads keep it.
 */
async function transcribedRecords(reader: Reader, personId: string, hits: ReadonlyArray<CaseSearchHit>): Promise<Map<string, CaseSearchEvidence>> {
  const out = new Map<string, CaseSearchEvidence>()
  const docIds = hits.filter((h) => h.source === 'document').map((h) => h.id)
  if (docIds.length === 0) return out
  try {
    const docs = (await reader.rows('person_document_index', { select: 'id,evidence_id', filters: [{ column: 'person_id', op: 'eq', value: personId }], limit: 200 })) as { id: string; evidence_id: string | null }[]
    const tied = docs.filter((d) => d.evidence_id && docIds.includes(d.id))
    if (tied.length === 0) return out
    const recordIds = [...new Set(tied.map((d) => d.evidence_id as string))]
    const records = (await reader.rows('person_file_evidence', { select: 'id,dated_on,title,counsel_only', filters: [{ column: 'id', op: 'in', value: recordIds }], limit: 200 })) as { id: string; dated_on: string; title: string; counsel_only: boolean | null }[]
    const byId = new Map(records.map((r) => [r.id, r]))
    for (const d of tied) {
      const r = byId.get(d.evidence_id as string)
      out.set(d.id, { evidence_id: d.evidence_id as string, evidence_day: r?.dated_on ?? null, evidence_title: r && !r.counsel_only ? r.title : null })
    }
  } catch {
    // Left as the search answered: the hit still names the document.
  }
  return out
}
