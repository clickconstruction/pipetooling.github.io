// get_matter_document (v2.6722, punch list #288 PR 3): a text document on a legal matter's Evidence tab read a piece at a
// time — the section index, then one section by its number or heading — through dev_matter_doc_read (migration
// 20261108233000) as the dev, the way get_person_document reads a named document on an HR file. The kernel shapes the ask
// and names the row's doors; the function refuses a paper that is a file alone (a PDF, an image, an .eml) and, to the seat
// as deployed, one for counsel alone. Dev-only: another role is refused in words, as the RPC refuses it.
import type { Reader } from './devMcpComposites.ts'

export type MatterDocReadAsk = { matter_id: unknown; doc_id: unknown; section?: unknown }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function matterDocReadInput(ask: MatterDocReadAsk): { ok: true; matterId: string; docId: string; section: string | null } | { ok: false; refused: string } {
  const matterId = typeof ask.matter_id === 'string' ? ask.matter_id.trim().toLowerCase() : ''
  const docId = typeof ask.doc_id === 'string' ? ask.doc_id.trim().toLowerCase() : ''
  if (!UUID_RE.test(matterId)) return { ok: false, refused: 'get_matter_document needs matter_id (a legal_matters.id: read_rows on legal_matters by payer_name, or get_case_brief).' }
  if (!UUID_RE.test(docId)) return { ok: false, refused: 'get_matter_document needs doc_id (a legal_matter_documents.id on that matter: the Evidence row, from get_case_brief or search_case).' }
  const section = typeof ask.section === 'number' && Number.isFinite(ask.section) ? String(Math.floor(ask.section)) : typeof ask.section === 'string' && ask.section.trim() ? ask.section.trim() : null
  if (section && section.length > 200) return { ok: false, refused: 'get_matter_document: section is a number or a heading, under 200 characters.' }
  return { ok: true, matterId, docId, section }
}

type Section = { i: number; n: number | null; heading: string | null; level: number; from_line: number; to_line: number; chars: number }
type RpcReply = {
  target: Record<string, unknown>
  lines: number
  sections: Section[]
  section: (Section & { body: string; cut: boolean; before: { n: number | null; heading: string | null } | null; after: { n: number | null; heading: string | null } | null }) | null
}

/** What reads on from here: another section, the file itself, and where the words are changed. */
export function matterReadNextWords(section: { heading: string | null } | null): string {
  const change = 'The words are the office\'s to change on the Legal desk\'s Evidence tab (Read on the row); the seat has no section write on a matter document yet.'
  if (section) return `Read another section with get_matter_document { matter_id, doc_id, section: <n or heading> }; the paper itself is read_rows on legal_matter_documents by id. ${change}`
  return `Read one section with get_matter_document { matter_id, doc_id, section: <n or heading> }. ${change}`
}

export async function getMatterDocument(reader: Reader, ask: MatterDocReadAsk, who: { role: string }) {
  if (who.role !== 'dev') return { refused: 'get_matter_document reads the Legal desk\'s matter, which the seat reads as a dev only; it does not read as another person.' }
  const input = matterDocReadInput(ask)
  if (!input.ok) return { refused: input.refused }
  const reply = (await reader.rpc('dev_matter_doc_read', { p_matter_id: input.matterId, p_doc_id: input.docId, p_section: input.section })) as RpcReply | null
  if (!reply) return { refused: 'dev_matter_doc_read answered nothing.' }
  return {
    matter_id: input.matterId,
    target: reply.target,
    lines: reply.lines,
    sections: reply.sections,
    section: reply.section,
    read_next: matterReadNextWords(reply.section),
  }
}
