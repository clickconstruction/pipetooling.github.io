/**
 * A stop window's reading of one recorded paper's proof (`lienMailProof.ts`), the same on every screen that opens one.
 *
 * Three screens open a stop's window: the desk's notices pane, its affidavit pane and the job's Lien window. Each
 * built the reading by hand, and they differed. Only the notices pane said whether a filed lien owes the original
 * contractor a copy, so the other two showed the contractor's card only once that copy had a record, and counted the
 * proof one short: *Mail proof: 1 of 2 on file* where the notices pane read *1 of 3*. A copy still to mail had no card
 * there, and so no press (`lienMailProofDoor.ts`).
 *
 * Whether the contractor gets a copy is the filing's own answer, and the job's when the paper keeps none
 * (`lienServeHasContractor`): the rule *Filed liens: copies to mail* and the Lien window's Filings list already read.
 *
 * Pure.
 */
import { lienMailProof, type LienMailProof } from './lienMailProof'
import { lienServeHasContractor } from './lienServeNumbers'
import type { JobLienFilingRow } from './lienDeadlines'

export type LienStopProofFiling = Pick<JobLienFilingRow, 'kind' | 'sends' | 'served_at' | 'fields'> & { document_url?: string | null; document_note?: string | null }

export function lienStopProof(
  filing: LienStopProofFiling,
  ctx: {
    /** The job sits under a GC today. Read for a filed affidavit whose paper does not say. */
    isSub: boolean
    /** The notice's mailed files off its desk item, as stored, when the screen holds them. */
    mailedCopies?: unknown
  },
): LienMailProof | null {
  return lienMailProof({
    kind: filing.kind,
    sends: filing.sends,
    documentUrl: filing.document_url,
    documentNote: filing.document_note,
    mailedCopies: ctx.mailedCopies,
    servedAt: filing.served_at,
    hasContractor: filing.kind === 'affidavit' ? lienServeHasContractor({ isSub: ctx.isSub, filing: filing as JobLienFilingRow }) : undefined,
  })
}
