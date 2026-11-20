// get_person_document (v2.6621, punch list #278 PR 3): a document on a person's HR file a piece at a time — the section
// index, then one section by its number or heading — through dev_doc_read (migration 20261107080000) as the dev. The
// kernel resolves the person as get_person_file does, shapes the ask, and names the write that changes the section it
// handed back, so read and write use one grammar. Dev-only: another role is refused in words, as the RPC refuses it.
//
// v2.8197 (punch list #315, upgrade 5a, the seat's half): freshness: true on the summary's or the narrative's index
// says when each section took its present words and how many entries were written since, through the tab's own kernel
// (sectionFreshness.ts) over the newest prior versions. Asked for, never by default: a version is the whole text.
import { readAllRows, type Reader } from './devMcpComposites.ts'
import { resolvePerson } from './devMcpPersonFile.ts'
import { parseSectionCitations, sectionChangedWords, sectionFreshness, sectionNewerWords, type DocRevision } from './sectionFreshness.ts'

/** How many prior versions a freshness read takes, as the tab's fold does. */
export const DOC_FRESHNESS_REVISIONS = 12

export type DocReadAsk = { person: string; doc_id?: unknown; kind?: unknown; section?: unknown; freshness?: unknown }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function docReadInput(ask: DocReadAsk): { ok: true; docId: string | null; kind: 'summary' | 'narrative' | null; section: string | null; freshness: boolean } | { ok: false; refused: string } {
  const docId = typeof ask.doc_id === 'string' ? ask.doc_id.trim().toLowerCase() : ''
  const kind = typeof ask.kind === 'string' ? ask.kind.trim() : ''
  if ((docId !== '') === (kind !== '')) return { ok: false, refused: 'get_person_document needs doc_id (a named document, from get_case_brief or get_person_file) or kind (summary | narrative), one of the two.' }
  if (docId && !UUID_RE.test(docId)) return { ok: false, refused: 'get_person_document: doc_id must be a documents.id (a named document on the file).' }
  if (kind && kind !== 'summary' && kind !== 'narrative') return { ok: false, refused: 'get_person_document: kind must be summary or narrative.' }
  const section = typeof ask.section === 'number' && Number.isFinite(ask.section) ? String(Math.floor(ask.section)) : typeof ask.section === 'string' && ask.section.trim() ? ask.section.trim() : null
  if (section && section.length > 200) return { ok: false, refused: 'get_person_document: section is a number or a heading, under 200 characters.' }
  if (ask.freshness !== undefined && ask.freshness !== null && typeof ask.freshness !== 'boolean') return { ok: false, refused: 'get_person_document: freshness is true, or left out.' }
  if (ask.freshness === true && (!kind || section)) return { ok: false, refused: 'get_person_document: freshness is for the summary or the narrative (kind), on the index, without section. A named document keeps no versions this reads.' }
  return { ok: true, docId: docId || null, kind: (kind as 'summary' | 'narrative') || null, section, freshness: ask.freshness === true }
}

/**
 * When each section of the summary or the narrative took its present words, and how many entries were written since:
 * the document as it stands, its newest prior versions and the entries, each read as the dev, handed to the tab's own
 * kernel. Fail-soft: a read that fails answers `held` and the index still comes.
 */
export async function docFreshness(reader: Reader, personId: string, kind: 'summary' | 'narrative', ymdOf: (iso: string) => string) {
  const mine = [{ column: 'person_id', op: 'eq' as const, value: personId }, { column: 'kind', op: 'eq' as const, value: kind }]
  try {
    const [files, versions, entries] = await Promise.all([
      reader.rows('person_files', { select: 'content,updated_at', filters: mine, limit: 1 }),
      reader.rows('person_file_revisions', { select: 'content,replaced_at', filters: mine, order: [{ column: 'replaced_at', ascending: false }], limit: DOC_FRESHNESS_REVISIONS + 1 }),
      readAllRows(reader, 'person_file_entries', { select: 'id,created_at,content', filters: [{ column: 'person_id', op: 'eq', value: personId }] }),
    ])
    const doc = files[0] as { content?: string; updated_at?: string | null } | undefined
    if (!doc || typeof doc.content !== 'string') return { held: `no ${kind} on this file` }
    const revisions = (versions as unknown as DocRevision[]).slice(0, DOC_FRESHNESS_REVISIONS)
    const rows = sectionFreshness({
      content: doc.content,
      updatedAt: doc.updated_at ?? null,
      revisions,
      entries: entries.rows.map((e) => ({ created_at: String(e.created_at ?? ''), cites: parseSectionCitations(typeof e.content === 'string' ? e.content : '').map((c) => c.section) })),
    })
    return {
      versions_read: revisions.length,
      older_versions: versions.length > DOC_FRESHNESS_REVISIONS,
      look_again: rows.filter((f) => f.newerCiting > 0).length,
      sections: rows.map((f) => ({
        heading: f.heading || null,
        level: f.level,
        changed: sectionChangedWords(f, ymdOf),
        changed_at: f.changedAt,
        ...(f.atLeast ? { at_least: true } : {}),
        since: sectionNewerWords(f),
        newer_entries: f.newerEntries,
        ...(f.newerCiting > 0 ? { newer_citing: f.newerCiting } : {}),
      })),
      note: 'changed is the day a section took the words it has now, read from the newest prior versions; at_least means it reads the same in the oldest version read, so the true day is earlier. newer_entries counts the entries written since, and newer_citing those whose words cite the section (N§2): look again at such a section before relying on it. older_versions says versions past the ones read exist.',
    }
  } catch (e) {
    return { held: e instanceof Error ? e.message : String(e) }
  }
}

type Section = { i: number; n: number | null; heading: string | null; level: number; from_line: number; to_line: number; chars: number }
type RpcReply = {
  target: Record<string, unknown>
  lines: number
  sections: Section[]
  section: (Section & { body: string; cut: boolean; before: { n: number | null; heading: string | null } | null; after: { n: number | null; heading: string | null } | null }) | null
}

/** The write that changes what was read, in the ops grammar of plan_person_doc. */
export function changeWords(input: { docId: string | null; kind: string | null }, section: { heading: string | null } | null): string {
  const target = input.docId ? `doc_id: "${input.docId}"` : `kind: "${input.kind}"`
  if (section?.heading) return `Change this section with plan_person_doc { person_id, ${target}, ops: [{ op: "replace_section", heading: "${section.heading}", markdown }] }; insert_after the same heading adds after it.`
  if (section) return `This is the text before the first heading; plan_person_doc { person_id, ${target}, markdown } rewrites the whole document.`
  return `Read one section with get_person_document { section: <n or heading> }; change one with plan_person_doc { person_id, ${target}, ops: [{ op: "replace_section", heading, markdown }] }.`
}

export async function getPersonDocument(reader: Reader, ask: DocReadAsk, who: { role: string; ymdOf?: (iso: string) => string }) {
  if (who.role !== 'dev') return { refused: 'get_person_document reads the HR file, which is dev-only; it does not read as another person.' }
  const input = docReadInput(ask)
  if (!input.ok) return { refused: input.refused }
  const resolved = await resolvePerson(reader, ask.person)
  if ('refused' in resolved) return resolved
  const person = resolved.person
  const reply = (await reader.rpc('dev_doc_read', { p_person_id: person.id, p_doc_id: input.docId, p_kind: input.kind, p_section: input.section })) as RpcReply | null
  if (!reply) return { refused: 'dev_doc_read answered nothing.' }
  return {
    person: { id: person.id, name: person.name },
    target: reply.target,
    lines: reply.lines,
    sections: reply.sections,
    section: reply.section,
    // v2.8197: only when asked, and only for the summary or the narrative.
    ...(input.freshness && input.kind ? { freshness: await docFreshness(reader, person.id, input.kind, who.ymdOf ?? ((iso) => iso.slice(0, 10))) } : {}),
    read_next: changeWords(input, reply.section),
  }
}
