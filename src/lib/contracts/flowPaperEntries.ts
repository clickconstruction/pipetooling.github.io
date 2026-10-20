/**
 * Papers on the flows (Messages cut 4, cluster 6's F3): the papers the office adds to a step of a flow in the New paper
 * window (`flow_paper_create`, v2.5306), as lines on Settings → Contracts & terms. They are the office's data, not the
 * app's code, so `CUSTOMER_CONTRACT_CATALOG` holds none of them: `flowPaperEntries` makes one entry per Contract library
 * document with a flow kind each time the tab reads the library, all in the data-driven area Papers on the flows
 * (`DATA_DRIVEN_AREAS`). An upload is their paper, with no wording of ours; a contract reads as its published clauses; a
 * notice as its words in both languages. Pure; the tab reads the rows with `FLOW_PAPER_COLUMNS` and `FLOW_CLAUSE_COLUMNS`.
 */
import { effectiveBookVersionPlainDate } from '../contractBookVersionDate'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import type { ContractBookDoc, ContractCatalogAudience, ContractCatalogEntry, ContractCatalogGroup, ContractEditDoor } from './customerContractCatalog'

export type FlowPaperKind = 'upload' | 'contract' | 'notice'

/** A Contract library document with a flow kind, as the tab reads it. */
export interface FlowPaperDoc {
  id: string
  document_name: string
  name_es: string | null
  flow_kind: FlowPaperKind
  /** `sub` for the trade partner flow's papers; `customer` for the customer's and the architect's. */
  audience: string
  /** An upload that runs out: the days before it does that the ask for the next one goes. */
  renew_ask_days: number | null
  book_body_html: string | null
  book_body_es: string | null
  book_body_format: string
  book_version_date: string | null
  updated_at?: string | null
  /** Cut 4c's count of the paper's published clause changes; null or 0 before the first. */
  revision?: number | null
}

/** A published clause of a contract on a flow, as the tab reads it. */
export interface FlowPaperClause {
  paper_id: string
  sequence_order: number
  text_en: string
  text_es: string
  scope: string[]
}

export const FLOW_PAPER_COLUMNS = 'id, document_name, name_es, flow_kind, audience, renew_ask_days, book_body_html, book_body_es, book_body_format, book_version_date, updated_at, revision'
export const FLOW_CLAUSE_COLUMNS = 'paper_id, sequence_order, text_en, text_es, scope'

/** The entry, its row and its card's anchor: `flow-paper-<library document id>`. */
export function flowPaperEntryId(docId: string): string {
  return `flow-paper-${docId.toLowerCase()}`
}

const trimmed = (v: string | null | undefined) => (v ?? '').trim()

function bookDoc(d: FlowPaperDoc): ContractBookDoc {
  return { id: d.id, document_name: d.document_name, book_body_html: d.book_body_html, book_body_format: d.book_body_format, book_version_date: d.book_version_date, updated_at: d.updated_at ?? null }
}

/** A contract's clauses as one text, numbered in their order, each kept to a trade saying so; then the Spanish. */
export function flowClauseText(clauses: readonly FlowPaperClause[]): string {
  const ordered = [...clauses].sort((a, b) => a.sequence_order - b.sequence_order)
  const kept = (c: FlowPaperClause) => {
    const trades = c.scope.filter((t) => t !== 'all')
    return trades.length ? ` (${trades.join(', ')} only, on its exhibit)` : ''
  }
  const en = ordered.map((c, i) => `${i + 1}. ${c.text_en.trim()}${kept(c)}`).join('\n')
  // An empty Spanish clause shows the English on the Spanish page, so it reads that way here.
  const es = ordered.some((c) => c.text_es.trim()) ? ordered.map((c, i) => `${i + 1}. ${c.text_es.trim() || c.text_en.trim()}`).join('\n') : ''
  return es ? `${en}\n\nIn Spanish\n${es}` : en
}

/** A notice's words, the Spanish after the English when the words are plain. */
function noticeText(d: FlowPaperDoc, format: 'plain' | 'html' | 'markdown'): string {
  const es = format === 'plain' ? trimmed(d.book_body_es) : ''
  return [trimmed(d.book_body_html), es ? `In Spanish\n${es}` : ''].filter(Boolean).join('\n\n')
}

function bodyFormat(v: string): 'plain' | 'html' | 'markdown' {
  return v === 'html' || v === 'markdown' ? v : 'plain'
}

const GROUP: Readonly<Record<FlowPaperKind, ContractCatalogGroup>> = { upload: 'theirs', contract: 'signed', notice: 'notice' }
const KINDS: ReadonlySet<string> = new Set(Object.keys(GROUP))

/**
 * One entry per paper on the flows: the trade partners' first, then the customers' and the architects', each by name. A
 * row without a kind the window makes is no paper on a flow, so it makes no line.
 */
export function flowPaperEntries(docs: readonly FlowPaperDoc[], clauses: readonly FlowPaperClause[]): ContractCatalogEntry[] {
  const audienceOf = (d: FlowPaperDoc): ContractCatalogAudience => (d.audience === 'sub' ? 'trade' : 'flow_customer')
  const sorted = docs.filter((d) => KINDS.has(d.flow_kind)).sort((a, b) => Number(a.audience !== 'sub') - Number(b.audience !== 'sub') || a.document_name.localeCompare(b.document_name))
  return sorted.map((d): ContractCatalogEntry => {
    const audience = audienceOf(d)
    const them = audience === 'trade' ? 'the trade partner' : 'the customer or the architect'
    const en = trimmed(d.document_name) || 'A paper'
    const es = trimmed(d.name_es)
    const name = es && es.toLowerCase() !== en.toLowerCase() ? `${en} · ${es}` : en
    const doc = bookDoc(d)
    const format = bodyFormat(d.book_body_format)
    const days = d.renew_ask_days
    const base = { id: flowPaperEntryId(d.id), name, group: GROUP[d.flow_kind], area: 'flows' as const, audience, seenOn: [] }
    if (d.flow_kind === 'upload') {
      const edit: ContractEditDoor = { kind: 'code', note: 'Added from a step of a flow in the New paper window. It has no wording of ours to change.' }
      return {
        ...base,
        what: `A paper ${them} gives us, added to a step of a flow. The step finishes once it is on file.${days != null ? ' It runs out, so the step also needs its date ahead of today.' : ''}`,
        customerAction: `Uploads it on their page, or the office files it by hand.${days != null ? ` We ask for the next one ${days} ${days === 1 ? 'day' : 'days'} before it runs out.` : ''}`,
        source: { kind: 'flow_paper', doc, text: '', format, status: 'theirs', versionLabel: null },
        edit,
        copyKept: 'Their file, one for each person, on their papers.',
      }
    }
    if (d.flow_kind === 'contract') {
      const mine = clauses.filter((c) => c.paper_id === d.id)
      return {
        ...base,
        what: `A contract we write and ${them} signs, added to a step of a flow. It reads as its published clauses, and the step finishes on the signature.`,
        customerAction: 'Signs it on the sign page, after the e-sign consent.',
        source: { kind: 'flow_paper', doc, text: flowClauseText(mine), format: 'plain', status: mine.length ? 'yours' : 'blank', versionLabel: d.revision ? `version ${d.revision}` : null },
        edit: { kind: 'clauses', paperId: d.id },
        copyKept: 'The signed copy, one for each person, on their papers.',
      }
    }
    const text = noticeText(d, format)
    const ymd = effectiveBookVersionPlainDate(doc)
    return {
      ...base,
      what: `A notice we send ${them}, added to a step of a flow. Sending it finishes the step.`,
      customerAction: 'Reads it. Nothing is signed.',
      // The English is what the window requires, so a notice without it has nothing set.
      source: { kind: 'flow_paper', doc, text, format, status: trimmed(d.book_body_html) ? 'yours' : 'blank', versionLabel: ymd ? formatWorkDateYmdMonthDayShort(ymd) : null },
      edit: { kind: 'code', note: 'Its words were written in the New paper window when it was added to a step of a flow.' },
      copyKept: 'The copy we sent, one for each person, on their papers.',
    }
  })
}
