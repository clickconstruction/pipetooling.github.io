import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { putJobFolderFile } from './jobFolderAddFileIo'
import { filingDocumentPayload } from './lienFilingDocumentLink'
import type { LienScanTarget } from './lienScanBatch'
import { LIEN_CLERK_SCAN_NOTE, lienFiledScanName, lienScanProblem } from './lienScanFile'

/**
 * One scan to save: the file as it is, and the filed lien it belongs to. A lien's pages of a split stack come as a
 * function that cuts them (punch list #366, the stack), so a cut that fails is that scan's own failure and the true
 * size is checked once it is known.
 */
export type LienScanSave = { key: string; file: File | (() => Promise<File>); target: LienScanTarget }

export type LienScanSaveResult = { done: LienScanSave[]; failed: Array<{ save: LienScanSave; reason: string }> }

/**
 * Save several stamped scans (punch list #366), each to its own job: the file goes up as it is into the job's Drive
 * folder under Team only, Sent by us, named as the single upload names it, and its link becomes the filing's saved
 * copy. Each is its own pair of writes; the batch keeps going past one that fails and hands it back with its reason.
 * A scan that reached the folder but not the filing says so, since the file is there to link by hand.
 */
export async function saveLienScans(saves: ReadonlyArray<LienScanSave>, put: typeof putJobFolderFile = putJobFolderFile): Promise<LienScanSaveResult> {
  const result: LienScanSaveResult = { done: [], failed: [] }
  for (const save of saves) {
    let url = ''
    try {
      const file = typeof save.file === 'function' ? await save.file() : save.file
      // A cut piece's size is known only now: the folder's limit is each lien's piece, never the stack's.
      const problem = lienScanProblem(file, 'affidavit')
      if (problem) {
        result.failed.push({ save, reason: problem })
        continue
      }
      const named = new File([file], lienFiledScanName(save.target.jobNumber, save.target.filedYmd, file), { type: file.type || 'application/pdf' })
      url = (await put(save.target.jobId, 'sent', named)).url
    } catch (e) {
      result.failed.push({ save, reason: formatErrorMessage(e, 'the file was not added to the job’s folder') })
      continue
    }
    try {
      await withSupabaseRetry(
        () => supabase.from('job_lien_filings').update(filingDocumentPayload({ url, note: LIEN_CLERK_SCAN_NOTE }, { clear: true }) as never).eq('id', save.target.filingId),
        'save lien filing scan',
      )
      result.done.push(save)
    } catch (e) {
      result.failed.push({ save, reason: `The scan is in the job’s Drive folder, but its link was not saved on the filing: ${formatErrorMessage(e, 'the record was not saved')}` })
    }
  }
  return result
}
