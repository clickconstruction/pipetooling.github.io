/**
 * A signed hours statement onto a legal matter's Evidence tab (punch list #212, PR 4, the owner's call 7: the matter is
 * where court starts). **Add to evidence** copies the signed PDF — the flattened Contract Form `open-contract-form-pdf`
 * minds — into `legal_matter_documents` under the matter's folder with a title, a `shows` line and the signing day, and
 * points the statement at the copy (`matter_document_id`), so the desk's Evidence row and the statement's row each know
 * the other. The firm then reads it under Documents from the office and the packet letters it as *Signed hours
 * statements*. Pure words here plus one orchestration against an injected io, so the band's smoke hands a fake.
 */
import type { LegalEvidenceStatement } from './legalPacket'

export type HoursStatementEvidenceIo = {
  /** A short-lived link to the signed PDF through the gate (`open-contract-form-pdf`). */
  signedPdfUrl: (contractDocumentId: string) => Promise<string>
  /** The bytes behind the link. */
  fetchBytes: (url: string) => Promise<Blob>
  /** The desk's own add: upload under the matter, then the row. Answers the document's id. */
  addDocument: (matterId: string, draft: { title: string; shows: string; datedOn: string | null; state: 'final' }, file: File) => Promise<string>
  /** Point the statement at its copy. */
  linkStatement: (statementId: string, matterDocumentId: string) => Promise<void>
  /** Take the copy off again when the link fails, so nothing half-filed sits on Evidence. */
  retireDocument: (matterDocumentId: string) => Promise<void>
}

/** *Signed hours statement HS-1042-0007 · Marcus Reyes*. */
export function hoursStatementEvidenceTitle(s: Pick<LegalEvidenceStatement, 'recordId' | 'workerName'>): string {
  return `Signed hours statement ${s.recordId} · ${s.workerName}`
}

/** The one line the firm reads beside the title: who, how much, where, when, and that the worker signed for it. */
export function hoursStatementEvidenceShows(s: Pick<LegalEvidenceStatement, 'workerName' | 'hours' | 'periodLabel' | 'withPay' | 'statedDays'>, job: { label: string; site: string | null }): string {
  const where = job.site ? ` at ${job.site}` : ''
  const hours = s.hours > 0 ? `${s.hours % 1 === 0 ? s.hours : s.hours.toFixed(1)} h` : 'the hours'
  const pay = s.withPay ? ' and what the company paid for it' : ''
  const stated = s.statedDays > 0 ? ` ${s.statedDays} ${s.statedDays === 1 ? 'day is' : 'days are'} as the worker states them, not as the company recorded them.` : ''
  return `${s.workerName} signed for ${hours} of work on job ${job.label}${where}, ${s.periodLabel}${pay}, from the clock and the pay reports as they stood.${stated}`
}

/** `HS-1042-0007 signed.pdf`. */
export function hoursStatementEvidenceFileName(recordId: string): string {
  return `${recordId.replace(/[\\/:*?"<>|]+/g, ' ').trim()} signed.pdf`
}

/** Why Add to evidence cannot be pressed, or null. */
export function hoursStatementEvidenceProblem(s: Pick<LegalEvidenceStatement, 'signed' | 'contractDocumentId' | 'matterDocumentId'>, matter: { id: string | null; canEdit: boolean }): string | null {
  if (!s.signed) return 'Only a signed statement goes on the matter.'
  if (!s.contractDocumentId) return 'This statement has no signed copy to add.'
  if (s.matterDocumentId) return 'Already on the matter.'
  if (!matter.id) return 'Make the matter first: save the narrative or send the account to the firm.'
  if (!matter.canEdit) return 'The matter is not yours to change.'
  return null
}

export type AddToEvidenceArgs = {
  matterId: string
  statement: Pick<LegalEvidenceStatement, 'id' | 'recordId' | 'workerName' | 'hours' | 'periodLabel' | 'withPay' | 'statedDays' | 'signedOn' | 'contractDocumentId'>
  job: { label: string; site: string | null }
}

/**
 * Copy the signed PDF onto the matter and tie the statement to it. The copy is taken off again if the tie fails, so
 * nothing half-filed sits on Evidence (as the sworn statement's filing does, v2.6212).
 */
export async function addHoursStatementToEvidence(io: HoursStatementEvidenceIo, args: AddToEvidenceArgs): Promise<{ matterDocumentId: string }> {
  const { statement: s } = args
  if (!s.contractDocumentId) throw new Error('This statement has no signed copy to add.')
  const url = await io.signedPdfUrl(s.contractDocumentId)
  const blob = await io.fetchBytes(url)
  const file = new File([blob], hoursStatementEvidenceFileName(s.recordId), { type: 'application/pdf' })
  const matterDocumentId = await io.addDocument(args.matterId, { title: hoursStatementEvidenceTitle(s), shows: hoursStatementEvidenceShows(s, args.job), datedOn: s.signedOn, state: 'final' }, file)
  try {
    await io.linkStatement(s.id, matterDocumentId)
  } catch (e) {
    await io.retireDocument(matterDocumentId).catch(() => undefined)
    throw e
  }
  return { matterDocumentId }
}

/** The toast once it lands. */
export function hoursStatementOnMatterWords(recordId: string): string {
  return `${recordId} is on the matter’s Evidence tab. The firm reads it with the documents from the office.`
}
