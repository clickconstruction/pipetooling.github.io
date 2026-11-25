/**
 * The read behind *changed since printed* (punch list #362, step 7): each job's newest filed print of its notice and
 * of its affidavit, from the sent copies the lien prints file. The rules are `lienPrintSworn.ts`.
 *
 * Only the lien office reads `sent_documents`, so for any other seat this answers no prints, as the table does.
 */
import { loadSentPrintsForJobs } from '../sent/sentCopiesIo'
import { LIEN_PRINT_KINDS, lienNewestPrints, type LienPrintFact } from './lienPrintSworn'

export type LienNewestPrintsRead = {
  /** By `lienPrintKey(kind, jobId)`. */
  prints: Map<string, LienPrintFact>
  /** False when a read filled its limit: a job's print may be older than the rows read. */
  whole: boolean
}

/** Each of these jobs' newest filed prints, or null when the read failed: never "nothing printed" on a failure. */
export async function loadLienNewestPrints(jobIds: readonly string[]): Promise<LienNewestPrintsRead | null> {
  const read = await loadSentPrintsForJobs(Object.keys(LIEN_PRINT_KINDS), jobIds)
  if (!read) return null
  return { prints: lienNewestPrints(read.copies), whole: read.whole }
}
