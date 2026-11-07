/**
 * A signed hours statement's PDF into the job's Drive folder (punch list #212, residual C, v2.6634): **Put in Sent by us**
 * on a signed row copies the flattened Contract Form `open-contract-form-pdf` minds into the job's *Team only → Sent by
 * us* folder through `drive-link`'s `put` (the Documents tab's Add a file door, v2.6303), and keeps the Drive file id on
 * the statement (`drive_file_id`, `drive_filed_at`), so the row offers the press once and **Open in Drive ↗** after. The
 * card's call 6 named this as the later S once `put` had a caller. One orchestration against an injected io, as the
 * Legal desk's Add to evidence (`hoursStatementEvidence.ts`), so the section's smoke hands a fake.
 */
import { driveViewUrl } from '../../../supabase/functions/_shared/driveLink'
import { hoursStatementEvidenceFileName } from '../../../supabase/functions/_shared/hoursStatementEvidenceWords'

export type HoursStatementDriveIo = {
  /** A short-lived link to the signed PDF through the gate (`open-contract-form-pdf`). */
  signedPdfUrl: (contractDocumentId: string) => Promise<string>
  /** The bytes behind the link. */
  fetchBytes: (url: string) => Promise<Blob>
  /** `drive-link`'s `put` into Team only → Sent by us; answers the Drive file id. */
  putInSentByUs: (jobId: string, file: File) => Promise<{ driveFileId: string }>
  /** Keep the copy's id on the statement. */
  markFiled: (statementId: string, driveFileId: string) => Promise<void>
}

/** The folder as the office knows it on the Documents tab. */
export const HOURS_STATEMENT_DRIVE_FOLDER = 'Team only → Sent by us'

export const HOURS_STATEMENT_DRIVE_WORDS = {
  put: 'Put in Sent by us',
  putting: 'Putting…',
  open: 'Open in Drive ↗',
  putTitle: `Copies the signed PDF into the job’s Drive folder, ${HOURS_STATEMENT_DRIVE_FOLDER}, where the office keeps what it sent`,
  openTitle: `The copy in the job’s Drive folder, ${HOURS_STATEMENT_DRIVE_FOLDER}`,
  failed: 'The signed PDF was not put in Sent by us.',
} as const

/** Why Put in Sent by us cannot be pressed, or null. */
export function hoursStatementDriveProblem(row: { state: string; contract_document_id: string | null; drive_file_id?: string | null }): string | null {
  if (row.state !== 'signed') return 'Only a signed statement goes in Sent by us.'
  if (!row.contract_document_id) return 'This statement has no signed copy to put there.'
  if (row.drive_file_id) return `Already in ${HOURS_STATEMENT_DRIVE_FOLDER}.`
  return null
}

/** `HS-1042-0007 signed.pdf`, the name the Legal desk's copy carries too. */
export function hoursStatementDriveFileName(recordId: string): string {
  return hoursStatementEvidenceFileName(recordId)
}

/** Drive's own viewer for the copy. */
export function hoursStatementDriveUrl(driveFileId: string): string {
  return driveViewUrl(driveFileId)
}

/** The toast once the copy is there. */
export function hoursStatementInDriveWords(recordId: string): string {
  return `${recordId} is in ${HOURS_STATEMENT_DRIVE_FOLDER}.`
}

export type PutInSentByUsArgs = { statementId: string; recordId: string; jobId: string; contractDocumentId: string }

/**
 * Copy the signed PDF into Sent by us and keep its id on the statement. The copy is made first: if the tie fails the
 * file stays in Drive (the office can see it in the folder) and the error names why the row did not take it.
 */
export async function putHoursStatementInSentByUs(io: HoursStatementDriveIo, args: PutInSentByUsArgs): Promise<{ driveFileId: string; url: string }> {
  const url = await io.signedPdfUrl(args.contractDocumentId)
  const blob = await io.fetchBytes(url)
  const file = new File([blob], hoursStatementDriveFileName(args.recordId), { type: 'application/pdf' })
  const { driveFileId } = await io.putInSentByUs(args.jobId, file)
  await io.markFiled(args.statementId, driveFileId)
  return { driveFileId, url: hoursStatementDriveUrl(driveFileId) }
}
