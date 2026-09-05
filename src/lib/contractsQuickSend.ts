import { bestPersonDocRow } from './contractsAgreementsPanel'
import { hasContractSigningContent } from './contractSigningContent'
import { maxEffectiveBookVersionRow, type BookVersionDateSource } from './contractBookVersionDate'

/**
 * Quick-send resolution for People → Contracts (v2.1410): "send this one
 * document to this one person" without assigning a template. Two questions,
 * answered purely from the tab's caches:
 *
 * 1. Where does the signing content come from? (`resolveQuickSendSource`) —
 *    the newest Contract Book copy of the document wins; when the document
 *    only exists ad-hoc (no book copy with content), the best existing
 *    person copy that has signing content is the source.
 * 2. Who can it go to? (`quickSendRosterSplit`) — roster people split into
 *    "hasn't received it yet" (no row, or an unsent placeholder to reuse)
 *    and "already has it" (sent → resend). Signed people are excluded from
 *    the pickable list and only reported as a count.
 */

export type QuickSendBookRow = BookVersionDateSource & {
  id: string
  document_name: string
  book_body_html: string | null
  book_body_format: string
  canonical_document_url?: string | null
  form_template_id?: string | null
}

export type QuickSendPersonRow = {
  id: string
  person_name: string
  document_name: string
  status: string
  lineage_version: number
  sent_at: string | null
  signer_last_viewed_at: string | null
  signed_at: string | null
  url: string | null
  signing_body_html: string | null
  signing_body_format: string
  canonical_document_url: string | null
}

export type QuickSendSource =
  | {
      kind: 'book'
      /** contract_template_documents.id to pin as the applied book copy. */
      appliedTemplateDocumentId: string
      signingBodyHtml: string | null
      signingBodyFormat: string
      canonicalDocumentUrl: string | null
    }
  | {
      kind: 'person'
      signingBodyHtml: string | null
      signingBodyFormat: string
      canonicalDocumentUrl: string | null
    }

/**
 * Content source for a quick-send copy of `documentName`: the newest
 * (effective version date) book copy that has signing content, else the best
 * existing person copy with signing content. Null when nothing anywhere has
 * content — quick send can't produce a signable page then.
 */
export function resolveQuickSendSource(input: {
  documentName: string
  templateDocuments: readonly QuickSendBookRow[]
  personDocuments: readonly QuickSendPersonRow[]
}): QuickSendSource | null {
  const bookRows = input.templateDocuments.filter(
    (d) =>
      d.document_name === input.documentName &&
      hasContractSigningContent({
        signing_body_html: d.book_body_html,
        canonical_document_url: d.canonical_document_url,
        form_template_id: d.form_template_id,
      }),
  )
  const bestBook = maxEffectiveBookVersionRow(bookRows) ?? bookRows[0] ?? null
  if (bestBook) {
    return {
      kind: 'book',
      appliedTemplateDocumentId: bestBook.id,
      signingBodyHtml: bestBook.book_body_html?.trim() ? bestBook.book_body_html : null,
      signingBodyFormat: bestBook.book_body_format,
      canonicalDocumentUrl: bestBook.canonical_document_url?.trim() ? bestBook.canonical_document_url : null,
    }
  }
  const personRows = input.personDocuments.filter(
    (d) => d.document_name === input.documentName && hasContractSigningContent(d),
  )
  const bestPerson = bestPersonDocRow(personRows)
  if (bestPerson) {
    return {
      kind: 'person',
      signingBodyHtml: bestPerson.signing_body_html?.trim() ? bestPerson.signing_body_html : null,
      signingBodyFormat: bestPerson.signing_body_format,
      canonicalDocumentUrl: bestPerson.canonical_document_url?.trim() ? bestPerson.canonical_document_url : null,
    }
  }
  return null
}

export type QuickSendRosterSplit = {
  /** No copy yet, or only an unsent placeholder (send reuses it). */
  needsIt: string[]
  /** Best copy is sent — picking them is a resend. */
  resend: { personName: string; sentAt: string | null }[]
  /** Signed people are done — excluded from the pickable list. */
  signedCount: number
}

/** Split the active roster for the quick-send picker; both groups sorted by name. */
export function quickSendRosterSplit(input: {
  documentName: string
  rosterNames: readonly string[]
  personDocuments: readonly QuickSendPersonRow[]
}): QuickSendRosterSplit {
  const byPerson = new Map<string, QuickSendPersonRow[]>()
  for (const d of input.personDocuments) {
    if (d.document_name !== input.documentName) continue
    const list = byPerson.get(d.person_name) ?? []
    list.push(d)
    byPerson.set(d.person_name, list)
  }
  const needsIt: string[] = []
  const resend: { personName: string; sentAt: string | null }[] = []
  let signedCount = 0
  for (const personName of input.rosterNames) {
    const best = bestPersonDocRow(byPerson.get(personName) ?? [])
    if (!best || best.status === 'unsent') needsIt.push(personName)
    else if (best.status === 'sent') resend.push({ personName, sentAt: best.sent_at })
    else signedCount++
  }
  needsIt.sort((a, b) => a.localeCompare(b))
  resend.sort((a, b) => a.personName.localeCompare(b.personName))
  return { needsIt, resend, signedCount }
}

/**
 * The person's existing row a quick send should reuse (their best unsent or
 * sent copy), or null when a fresh row must be created. Signed rows are never
 * reused — a re-send after signing is a new agreement copy.
 */
export function quickSendReusablePersonRow<T extends QuickSendPersonRow>(input: {
  documentName: string
  personName: string
  personDocuments: readonly T[]
}): T | null {
  const rows = input.personDocuments.filter(
    (d) => d.document_name === input.documentName && d.person_name === input.personName && d.status !== 'signed',
  )
  return bestPersonDocRow(rows)
}

/** Book documents for the Add-document "From Contract Book" picker: one entry per name (newest effective copy), sorted by name. */
export function listQuickAddBookDocuments<T extends QuickSendBookRow>(
  templateDocuments: readonly T[],
): { documentName: string; row: T }[] {
  const byName = new Map<string, T[]>()
  for (const d of templateDocuments) {
    const list = byName.get(d.document_name) ?? []
    list.push(d)
    byName.set(d.document_name, list)
  }
  const out: { documentName: string; row: T }[] = []
  for (const [documentName, rows] of byName) {
    const row = maxEffectiveBookVersionRow(rows) ?? rows[0]
    if (row) out.push({ documentName, row })
  }
  out.sort((a, b) => a.documentName.localeCompare(b.documentName))
  return out
}

/**
 * What a quick-send pick will do to `person_contract_documents` — decided at
 * pick time, EXECUTED at Send (journey-map decision 17, 2026-09-05: nothing
 * is written until the user commits). The three branches:
 *
 * - `reuse`  — the person's best unsent/sent copy already carries signing
 *              content → the Send modal targets that row; no write ever.
 * - `fill`   — an empty placeholder exists → Send fills its signing content
 *              (UPDATE) right before the email goes out.
 * - `insert` — no non-signed copy → Send creates the `unsent` row (INSERT)
 *              right before the email goes out.
 * - `no-content` — nothing anywhere has signable text; the pick shows an
 *              error and opens nothing.
 *
 * Canceling the Send modal on `fill`/`insert` leaves no trace, so abandoned
 * picks no longer feed "Needs attention · N" or the rail's unsent counts.
 */
export type QuickSendPlan =
  | { kind: 'reuse'; docId: string }
  | { kind: 'fill'; docId: string; source: QuickSendSource }
  | { kind: 'insert'; source: QuickSendSource }
  | { kind: 'no-content' }

export function quickSendPlan(input: {
  existing: Pick<QuickSendPersonRow, 'id' | 'signing_body_html' | 'canonical_document_url'> | null
  source: QuickSendSource | null
}): QuickSendPlan {
  const { existing, source } = input
  if (existing && hasContractSigningContent(existing)) return { kind: 'reuse', docId: existing.id }
  if (!source) return { kind: 'no-content' }
  if (existing) return { kind: 'fill', docId: existing.id, source }
  return { kind: 'insert', source }
}

/** True for the two plans that write a row at Send; false for reuse / no-content. */
export function quickSendPlanWrites(plan: QuickSendPlan): plan is Extract<QuickSendPlan, { kind: 'fill' | 'insert' }> {
  return plan.kind === 'fill' || plan.kind === 'insert'
}
