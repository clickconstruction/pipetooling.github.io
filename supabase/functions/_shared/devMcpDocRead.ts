// get_person_document (v2.6621, punch list #278 PR 3): a document on a person's HR file a piece at a time — the section
// index, then one section by its number or heading — through dev_doc_read (migration 20261107080000) as the dev. The
// kernel resolves the person as get_person_file does, shapes the ask, and names the write that changes the section it
// handed back, so read and write use one grammar. Dev-only: another role is refused in words, as the RPC refuses it.
import type { Reader } from './devMcpComposites.ts'
import { resolvePerson } from './devMcpPersonFile.ts'

export type DocReadAsk = { person: string; doc_id?: unknown; kind?: unknown; section?: unknown }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function docReadInput(ask: DocReadAsk): { ok: true; docId: string | null; kind: 'summary' | 'narrative' | null; section: string | null } | { ok: false; refused: string } {
  const docId = typeof ask.doc_id === 'string' ? ask.doc_id.trim().toLowerCase() : ''
  const kind = typeof ask.kind === 'string' ? ask.kind.trim() : ''
  if ((docId !== '') === (kind !== '')) return { ok: false, refused: 'get_person_document needs doc_id (a named document, from get_case_brief or get_person_file) or kind (summary | narrative), one of the two.' }
  if (docId && !UUID_RE.test(docId)) return { ok: false, refused: 'get_person_document: doc_id must be a documents.id (a named document on the file).' }
  if (kind && kind !== 'summary' && kind !== 'narrative') return { ok: false, refused: 'get_person_document: kind must be summary or narrative.' }
  const section = typeof ask.section === 'number' && Number.isFinite(ask.section) ? String(Math.floor(ask.section)) : typeof ask.section === 'string' && ask.section.trim() ? ask.section.trim() : null
  if (section && section.length > 200) return { ok: false, refused: 'get_person_document: section is a number or a heading, under 200 characters.' }
  return { ok: true, docId: docId || null, kind: (kind as 'summary' | 'narrative') || null, section }
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

export async function getPersonDocument(reader: Reader, ask: DocReadAsk, who: { role: string }) {
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
    read_next: changeWords(input, reply.section),
  }
}
