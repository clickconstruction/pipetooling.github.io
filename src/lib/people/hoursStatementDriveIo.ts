/**
 * Put in Sent by us on the app's client (punch list #212, residual C, v2.6634): the signed PDF through its gate
 * (`open-contract-form-pdf`, the signing io's door), `drive-link`'s `put` into Team only → Sent by us (the Documents
 * tab's Add a file door), and the row's two columns. The orchestration is `hoursStatementDrive.ts`; the section's smoke
 * hands a fake io instead of this one.
 */
import { putJobFolderFile } from '../jobs/jobFolderAddFileIo'
import type { HoursStatementDriveIo } from './hoursStatementDrive'
import type { HoursStatementSigningIo } from './hoursStatementSigningIo'
import { setHoursStatementDriveCopy } from './hoursStatementsIo'

export function supabaseHoursStatementDriveIo(signing: HoursStatementSigningIo): HoursStatementDriveIo {
  return {
    signedPdfUrl: (documentId) => signing.openSignedPdf(documentId),
    fetchBytes: async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`The signed PDF could not be read (${res.status}).`)
      return await res.blob()
    },
    putInSentByUs: async (jobId, file) => ({ driveFileId: (await putJobFolderFile(jobId, 'sent', file)).driveFileId }),
    // Called on the press, not at render: a smoke that mocks hoursStatementsIo without this export must still draw the section.
    markFiled: (statementId, driveFileId) => setHoursStatementDriveCopy(statementId, driveFileId),
  }
}
