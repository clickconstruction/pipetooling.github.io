/**
 * Which standard terms an unsent agreement carries (v2.3965). A draft is not a
 * snapshot: until it is sent, a draft written from a Contract Book document
 * follows that document's current wording. A draft written from another
 * document, or from the built-in wording, keeps its own — the office chose
 * that in the Contract window. A sent row keeps the wording it went out with.
 * Pure; the save, the quick send and the sweep's pane do the I/O.
 */
import { DEFAULT_JOB_CONTRACT_TERMS_PLAIN } from './jobContractDocument'
import type { JobContractRow } from './jobContractLifecycle'
import type { QuickSendTemplate } from './jobContractQuickSend'

/** The five columns of a `job_contracts` row that hold its standard terms. */
export type JobContractTerms = Pick<JobContractRow, 'body_html' | 'body_format' | 'template_document_id' | 'template_name' | 'template_version_date'>

/** What the rule reads off the job's live row. */
export type JobContractTermsRow = JobContractTerms & Pick<JobContractRow, 'status'> & { voided_at?: string | null }

export const BUILTIN_JOB_CONTRACT_TERMS_NAME = 'Built-in service agreement terms'

/** The terms a Book document — or, with none, the built-in wording — puts on an agreement. */
export function jobContractTermsFromTemplate(template: QuickSendTemplate): JobContractTerms {
  return {
    body_html: template ? (template.book_body_html ?? '') : DEFAULT_JOB_CONTRACT_TERMS_PLAIN,
    body_format: template ? template.book_body_format : 'plain',
    template_document_id: template?.id ?? null,
    template_name: template ? template.document_name : BUILTIN_JOB_CONTRACT_TERMS_NAME,
    template_version_date: template?.book_version_date ?? null,
  }
}

/** The terms columns alone, off a row or a payload; a missing column reads as the column's own default. */
export function pickJobContractTerms(source: Partial<JobContractTerms>): JobContractTerms {
  return {
    body_html: source.body_html ?? null,
    body_format: source.body_format ?? 'plain',
    template_document_id: source.template_document_id ?? null,
    template_name: source.template_name ?? null,
    template_version_date: source.template_version_date ?? null,
  }
}

function sameTerms(a: JobContractTerms, b: JobContractTerms): boolean {
  return (
    (a.body_html ?? '') === (b.body_html ?? '') &&
    a.body_format === b.body_format &&
    (a.template_name ?? '') === (b.template_name ?? '') &&
    (a.template_version_date ?? '') === (b.template_version_date ?? '')
  )
}

/**
 * The terms to write, or null to leave the row's terms as they are.
 * - No row yet: the incoming terms — the insert carries them.
 * - A row that is not an unsent draft (sent, signed, voided): null — it is locked.
 * - A draft from the built-in wording, or from another document than the one being saved with: null.
 * - A draft from the same document: the incoming terms when any of them differ, else null.
 */
export function draftTermsToWrite(existing: JobContractTermsRow | null, incoming: JobContractTerms): JobContractTerms | null {
  if (!existing) return incoming
  if (existing.status !== 'draft' || existing.voided_at) return null
  if (!existing.template_document_id || existing.template_document_id !== incoming.template_document_id) return null
  return sameTerms(existing, incoming) ? null : incoming
}

/** The terms the agreement goes out with under the rule — what the sweep's preview and draft PDF show. */
export function jobContractTermsInEffect(existing: JobContractTermsRow | null, incoming: JobContractTerms): JobContractTerms {
  if (!existing) return incoming
  return draftTermsToWrite(existing, incoming) ?? pickJobContractTerms(existing)
}
